/**
 * 实时内容客户端（只读）
 * =====================
 * 内容服务通过只读接口 `/api/content/*` 暴露经过白名单裁剪的当前文案与板块编排。
 * 这个文件是前台读它的唯一入口。
 *
 * 三条硬规矩：
 * 1. **只读**。这里不会发出任何写请求，也不认识任何凭据——公开仓里没有、
 *    也永远不该有服务端连接串或管理端鉴权逻辑。
 * 2. **失败就回退基线**。请求失败、超时、返回结构不对，一律当作「没有覆盖」，
 *    页面继续用 `narrative.ts` / `site-copy.ts` 里的内置基线渲染。内容服务不可用
 *    绝不能让整站空白。
 *    但「瞬时失败」不该等同于「没有覆盖」：节流与短暂的上游波动会退避重试几次
 *    （见 `fetchJson`）。不重试的话，一次偶发失败就表现为「后台改好的文案自己
 *    变回了旧版」——页面没坏，却让人以为改不动了，比整块空白更难排查。
 * 3. **只认稳定 ID**。覆盖按 id 匹配；内容服务里没有的 id 用基线，基线里没有的 `custom-*`
 *    按纯文案节点渲染，其余未知 id 忽略。故事卡可携带经过内容服务校验的档案锚点覆盖。
 *
 * 站点是静态导出的，所以这些请求发生在浏览器里、首屏渲染之后。服务端渲染出来的
 * 永远是基线，覆盖是随后打上去的——这也是「内容服务不可用时页面照常」的实现方式。
 */

/**
 * 生产环境前台与接口同域时留空即可；本地联调可通过 `NEXT_PUBLIC_CONTENT_ORIGIN`
 * 指向本地服务。内容服务对配置好的来源回 CORS 头，不需要额外的开发代理。
 */
import { fillEmphasis, type ActId, type MemeCategory, type ResolvedAct, type ResolvedBeat } from './narrative'
import { proxyImage } from './platforms'

const CONTENT_ORIGIN = (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, '')

const REQUEST_TIMEOUT_MS = 4000

/**
 * 值得重试的状态码。429 是网关节流：首页每次加载都会并发拉三份内容，
 * 连续刷新很容易撞上按 IP 的配额。5xx 是上游短暂不可用。两者都是瞬时状态，
 * 隔一下再试通常就拿到了。4xx（除 429）是「确实没有」，重试没有意义。
 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

/** 重试次数，不含首次。 */
const RETRY_LIMIT = 2

/** 退避基数；实际间隔是 base × 2^n 再乘一个 1~2 的随机系数。 */
const RETRY_BASE_DELAY_MS = 400

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 首屏预取的落点。
 *
 * 覆盖是在 `LiveContentProvider` 的 effect 里发起的，也就是必须等整个 React
 * 运行时下载、解析、水合完才轮到它。实测线上首页：水合结束在 ~400ms，三份内容
 * 到齐在 ~590ms——这 590ms 里页面画的是构建期烤入的旧文案，用户看到的
 * 「刷新时短暂回滚」就是这一段。
 *
 * 请求本身并不依赖 React：URL 是固定的，也不需要任何页面状态。所以真正该做的是
 * 让它在 HTML 解析阶段就发出去，和 JS 下载并行，而不是排在 JS 后面。
 * `layout.tsx` 的 `<head>` 内联脚本负责发起，结果挂在这个全局上，这里取走。
 *
 * 取不到就照常走 `fetchJsonOnce`——脚本没跑、被 CSP 拦掉、或者这是 dev 环境，
 * 行为都和从前完全一致。这一层是纯粹的提速，不是新的依赖。
 */
type ContentBoot = Record<string, Promise<unknown> | undefined>

/** 超时哨兵。用 Symbol 而不是 null，才能和「脚本确实拿到了 null」区分开。 */
const BOOT_TIMED_OUT = Symbol('boot-timeout')

/**
 * 取走某个路径的预取结果，并从全局上摘掉。
 *
 * **只认一次**是关键：`fetchJson` 失败后会重试，而一个已经 settle 的 promise
 * 每次 await 都返回同一个结果。不摘掉的话，一次预取失败会让三次重试全部空转。
 */
function takeBooted(path: string): Promise<unknown> | null {
  if (typeof window === 'undefined') return null
  const boot = (window as { __i6i6ContentBoot?: ContentBoot }).__i6i6ContentBoot
  const pending = boot?.[path]
  if (!pending) return null
  delete boot[path]
  return pending
}

/**
 * 预取结果，带上和普通请求一样的超时上限。
 *
 * 内联脚本里的 fetch 没有 AbortController——那点代码要尽可能短，而且它发出去的
 * 时候页面还没有任何超时策略可言。所以超时在这里补：预取挂住时不能连累整条链路，
 * 到点就放弃它、退回正常的请求加重试。
 */
async function bootedJson(path: string): Promise<unknown | null> {
  const booted = takeBooted(path)
  if (!booted) return null
  const settled = await Promise.race([
    booted.catch(() => null),
    sleep(REQUEST_TIMEOUT_MS).then(() => BOOT_TIMED_OUT),
  ])
  if (settled === BOOT_TIMED_OUT) return null
  return settled ?? null
}

export type LiveBeat = {
  id: string
  kicker: string
  title: string
  body: string
  visible: boolean
  expanded?: boolean
  date: string
  important: boolean
  size: 'hero' | 'type' | 'small' | 'montage'
  chips: string[]
  footnote: { text: string; rel: string; date: string }
  /** 卡片尾标（如 `TO BE CONTINUED...`）；空串表示这张卡不带尾标 */
  tail: string
  /** 故事卡当前锚定的档案条目；缺省表示沿用构建期基线。 */
  entryId?: string
  /** 内容接口按当前档案快照解析出的封面，只与 entryId 一起使用。 */
  entryCover?: string
}

export type LiveAct = {
  id: string
  kicker: string
  title: string
  body: string[]
  visible: boolean
  beats: LiveBeat[]
  label: string
  years: string
  color: string
  closer: { line: string; tail: string }
}

export type LiveHighlight = {
  id: string
  kicker: string
  title: string
  body: string
  visible: boolean
  /** 首页梗指南独立跳转；空串时沿用基线策展链接。 */
  link: string
  /** 展示日期文本（如 `2016—17`），不是档案日期 */
  date: string
  /** 背景纹理文字；可含 `{var}` 占位符，由构建期派生值填充 */
  emphasis: string
  /** 首页默认展开：true 时这条高光加载后直接展开（用户仍可手动折叠）。 */
  expanded: boolean
  /** 未提供表示旧版内容服务；null 表示这条保留数据不进入直播间梗。 */
  category?: MemeCategory | null
}

export type LiveNarrative = {
  homeActs: LiveAct[]
  highlights: LiveHighlight[]
  storyActs: LiveAct[]
  deletedIds: string[]
}

export type LiveCopyBlock = { id: string; eyebrow: string; title: string; lede: string }

export type LiveSiteCopy = {
  site: { title: string; description: string }
  nav: { id: string; label: string }[]
  hero: {
    status: string
    eyebrow: string
    title: string
    body: string[]
    primaryAction: string
    secondaryAction: string
  }
  homeSections: LiveCopyBlock[]
  rooms: { id: string; kicker: string; title: string; body: string }[]
  pages: LiveCopyBlock[]
}

export type LiveEditorialItem = { kind: string; refId: string; title: string; description: string }

export type LiveEditorialSection = {
  id: string
  page: string
  title: string
  description: string
  mode: 'automatic' | 'curated' | 'hybrid'
  limit: number
  excludedEntryIds: string[]
  items: LiveEditorialItem[]
}

export type LiveEditorial = { sections: LiveEditorialSection[] }

export type LiveContent = {
  narrative: LiveNarrative | null
  copy: LiveSiteCopy | null
  editorial: LiveEditorial | null
}

// --- 结构校验 -------------------------------------------------------------
// 故意手写而不是引入 zod：这段代码进浏览器 bundle，而前台需要的只是
// 「形状对不对」这一个判断。校验不通过就整份丢弃，退回基线。

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const bool = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback)
const strList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])

function parseBeat(value: unknown): LiveBeat | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') return null
  const size = str(value.size, 'small')
  const footnote = isRecord(value.footnote) ? value.footnote : {}
  return {
    id: value.id,
    kicker: str(value.kicker),
    title: value.title,
    body: str(value.body),
    visible: bool(value.visible, true),
    expanded: typeof value.expanded === 'boolean' ? value.expanded : undefined,
    date: str(value.date),
    important: bool(value.important),
    size: size === 'hero' || size === 'type' || size === 'montage' ? size : 'small',
    chips: strList(value.chips),
    footnote: { text: str(footnote.text), rel: str(footnote.rel), date: str(footnote.date) },
    tail: str(value.tail),
    entryId: typeof value.entryId === 'string' ? value.entryId : undefined,
    entryCover: typeof value.entryCover === 'string' ? value.entryCover : undefined,
  }
}

function parseAct(value: unknown): LiveAct | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') return null
  const closer = isRecord(value.closer) ? value.closer : {}
  const beats = Array.isArray(value.beats) ? value.beats.map(parseBeat).filter((beat): beat is LiveBeat => beat !== null) : []
  return {
    id: value.id,
    kicker: str(value.kicker),
    title: value.title,
    body: strList(value.body),
    visible: bool(value.visible, true),
    beats,
    label: str(value.label, value.title),
    years: str(value.years),
    // 只接受 #RRGGBB：这个值会进 style 属性，不能是任意字符串。
    color: /^#[0-9A-Fa-f]{6}$/.test(str(value.color)) ? str(value.color) : '',
    closer: { line: str(closer.line), tail: str(closer.tail) },
  }
}

export function parseNarrative(payload: unknown): LiveNarrative | null {
  if (!isRecord(payload) || !isRecord(payload.narrative)) return null
  const source = payload.narrative
  const acts = (value: unknown) =>
    Array.isArray(value) ? value.map(parseAct).filter((act): act is LiveAct => act !== null) : []
  const highlights = Array.isArray(source.highlights)
    ? source.highlights
        .map((item): LiveHighlight | null =>
          isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string'
            ? {
                id: item.id,
                kicker: str(item.kicker),
                title: item.title,
                body: str(item.body),
                visible: bool(item.visible, true),
                link: str(item.link),
                date: str(item.date),
                emphasis: str(item.emphasis),
                expanded: bool(item.expanded),
                category: item.category === null
                  ? null
                  : item.category === 'dazhou-mc'
                    ? 'game-meme'
                    : item.category === 'xinling-pishuang' || item.category === 'peiqi' || item.category === 'daily-meme' || item.category === 'game-meme'
                      ? item.category
                      : undefined,
              }
            : null,
        )
        .filter((item): item is LiveHighlight => item !== null)
    : []
  const deletedIds = strList(source.deletedIds)
  const narrative = { homeActs: acts(source.homeActs), highlights, storyActs: acts(source.storyActs), deletedIds }
  const empty = narrative.homeActs.length === 0 && narrative.highlights.length === 0 && narrative.storyActs.length === 0 && narrative.deletedIds.length === 0
  return empty ? null : narrative
}

function parseBlocks(value: unknown): LiveCopyBlock[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): LiveCopyBlock | null =>
      isRecord(item) && typeof item.id === 'string'
        ? { id: item.id, eyebrow: str(item.eyebrow), title: str(item.title), lede: str(item.lede) }
        : null,
    )
    .filter((item): item is LiveCopyBlock => item !== null)
}

export function parseSiteCopy(payload: unknown): LiveSiteCopy | null {
  if (!isRecord(payload) || !isRecord(payload.copy)) return null
  const source = payload.copy
  const site = isRecord(source.site) ? source.site : {}
  const hero = isRecord(source.hero) ? source.hero : {}
  if (typeof site.title !== 'string' || typeof hero.title !== 'string') return null
  return {
    site: { title: site.title, description: str(site.description) },
    nav: Array.isArray(source.nav)
      ? source.nav
          .map((item) => (isRecord(item) && typeof item.id === 'string' && typeof item.label === 'string' ? { id: item.id, label: item.label } : null))
          .filter((item): item is { id: string; label: string } => item !== null)
      : [],
    hero: {
      status: str(hero.status),
      eyebrow: str(hero.eyebrow),
      title: hero.title,
      body: strList(hero.body),
      primaryAction: str(hero.primaryAction),
      secondaryAction: str(hero.secondaryAction),
    },
    homeSections: parseBlocks(source.homeSections),
    rooms: Array.isArray(source.rooms)
      ? source.rooms
          .map((item) =>
            isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string'
              ? { id: item.id, kicker: str(item.kicker), title: item.title, body: str(item.body) }
              : null,
          )
          .filter((item): item is LiveSiteCopy['rooms'][number] => item !== null)
      : [],
    pages: parseBlocks(source.pages),
  }
}

export function parseEditorial(payload: unknown): LiveEditorial | null {
  if (!isRecord(payload) || !Array.isArray(payload.sections)) return null
  const sections = payload.sections
    .map((item): LiveEditorialSection | null => {
      if (!isRecord(item) || typeof item.id !== 'string') return null
      const mode = str(item.mode, 'curated')
      return {
        id: item.id,
        page: str(item.page),
        title: str(item.title),
        description: str(item.description),
        mode: mode === 'automatic' || mode === 'hybrid' ? mode : 'curated',
        limit: typeof item.limit === 'number' && Number.isFinite(item.limit) ? item.limit : 0,
        excludedEntryIds: strList(item.excludedEntryIds),
        items: Array.isArray(item.items)
          ? item.items
              .map((entry) =>
                isRecord(entry) && typeof entry.kind === 'string' && typeof entry.refId === 'string'
                  ? { kind: entry.kind, refId: entry.refId, title: str(entry.title), description: str(entry.description) }
                  : null,
              )
              .filter((entry): entry is LiveEditorialItem => entry !== null)
          : [],
      }
    })
    .filter((section): section is LiveEditorialSection => section !== null)
  return { sections }
}

type Attempt = { ok: true; data: unknown } | { ok: false; retryable: boolean }

async function fetchJsonOnce(path: string): Promise<Attempt> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${CONTENT_ORIGIN}${path}`, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) return { ok: false, retryable: RETRYABLE_STATUS.has(response.status) }
    return { ok: true, data: await response.json() }
  } catch {
    // 网络错误、超时、CORS、响应被截断——都可能是瞬时的，值得再试。
    return { ok: false, retryable: true }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 拉一份内容，瞬时失败退避重试；重试用尽仍失败就回退基线（返回 null）。
 *
 * 间隔带随机抖动：三份内容是并发拉的，同时失败时若按固定间隔一起重试，
 * 等于把刚才打爆配额的那一拨突发原样再发一遍。
 */
async function fetchJson(path: string): Promise<unknown | null> {
  // 先看首屏预取有没有现成的。有就直接用，省掉一整趟往返。
  const booted = await bootedJson(path)
  if (booted !== null) return booted

  for (let attempt = 0; ; attempt += 1) {
    const result = await fetchJsonOnce(path)
    if (result.ok) return result.data
    if (!result.retryable || attempt >= RETRY_LIMIT) return null
    await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt * (1 + Math.random()))
  }
}

export async function fetchLiveContent(): Promise<LiveContent> {
  const [narrative, copy, editorial] = await Promise.all([
    fetchJson('/api/content/narrative'),
    fetchJson('/api/content/site-copy'),
    fetchJson('/api/content/editorial'),
  ])
  return {
    narrative: parseNarrative(narrative),
    copy: parseSiteCopy(copy),
    editorial: parseEditorial(editorial),
  }
}

// --- 覆盖 -----------------------------------------------------------------
// 把后台当前值打到构建期解析好的基线对象上。纯函数，不碰 React，
// 服务端与客户端都能调用。


const isCustomId = (id: string): boolean => id.startsWith('custom-')

/** 构造一个后台新增的纯文案节点（无档案链接、无封面、无构建期蒙太奇素材）。 */
function resolveCustomBeat(live: LiveBeat, actId: ActId, home: boolean): ResolvedBeat {
  if (live.size === 'montage' && process.env.NODE_ENV !== 'production') {
    console.warn(`[live-content] custom beat ${live.id} 使用 montage，没有构建期素材，已按 type 降级渲染`)
  }
  return {
    id: live.id,
    act: actId,
    date: live.date,
    // 后台自定义 montage 没有构建期素材，统一按 type 字排大卡渲染。
    size: live.size === 'montage' ? 'type' : live.size,
    important: live.important,
    kicker: home ? (live.important ? '重要' : undefined) : live.kicker || undefined,
    title: live.title,
    body: live.body || undefined,
    expanded: live.expanded,
    href: null,
    external: false,
    cover: null,
    chips: live.chips.length > 0 ? live.chips : undefined,
    gameWorld: live.footnote.text
      ? { text: live.footnote.text, rel: live.footnote.rel || undefined, date: live.footnote.date || undefined }
      : undefined,
    tail: live.tail || undefined,
  }
}

/** 构造一个后台新增的首页幕（无基线档案元数据，count 为 0）。 */
function resolveCustomAct(live: LiveAct, home: boolean, deletedIds: string[] = []): ResolvedAct {
  const actId = live.id as ActId
  const deleted = new Set(deletedIds)
  return {
    act: {
      id: actId,
      kicker: live.kicker,
      title: live.title,
      body: live.body,
      label: live.label,
      years: live.years,
      color: live.color,
      closer: live.closer.line ? { line: live.closer.line, tail: live.closer.tail || undefined } : undefined,
      from: '',
      to: '',
      beats: [],
    },
    count: 0,
    beats: live.beats
      .filter((beat) => !deleted.has(beat.id) && beat.visible !== false)
      .map((beat) => resolveCustomBeat(beat, actId, home)),
  }
}

/** 构造一个后台新增的高光（无档案链接、无封面，固定 small 卡）。 */
function resolveCustomHighlight(live: LiveHighlight, emphasisVars: Record<string, string>): ResolvedBeat {
  return {
    id: live.id,
    act: '' as ActId,
    date: live.date,
    size: 'small',
    kicker: live.kicker || undefined,
    title: live.title,
    body: live.body || undefined,
    href: live.link || null,
    external: /^https?:\/\//.test(live.link),
    cover: null,
    emphasis: live.emphasis ? fillEmphasis(live.emphasis, emphasisVars) : undefined,
    expanded: live.expanded,
    category: live.category ?? null,
  }
}

/**
 * 一幕的实时覆盖。
 *
 * 只覆盖文案与显示：标题、kicker、引子、短标签、年份副标、主题色、收束语，
 * 以及节点的展示日期、标题、描述、卡片规格、蒙太奇标签、隐线脚注、卡片尾标。
 * 链接（href/external）、封面、构建期派生的蒙太奇素材与统计数字一律保留基线值
 * ——那些指向史料，不归后台管。
 *
 * `home` 为真时按首页口径处理小标签：首页的 kicker 由「重要」开关决定，
 * 不是节点自己的 kicker，这是公开仓 resolveActs 的既定行为，覆盖时必须跟着走，
 * 否则后台勾了「重要」首页却不显示。
 */
export function applyLiveAct(act: ResolvedAct, live: LiveAct | null, home = false, deletedIds: string[] = []): ResolvedAct {
  const deleted = new Set(deletedIds ?? [])

  if (deleted.has(act.act.id)) return { ...act, beats: [] }

  if (!live || !live.visible) {
    if (live && !live.visible) return { ...act, beats: [] }
    if (deleted.size === 0) return act
    return { ...act, beats: act.beats.filter((beat) => !deleted.has(beat.id) && !deleted.has(beat.act)) }
  }

  const liveBeats = new Map(live.beats.map((beat) => [beat.id, beat]))
  // 顺序以后台为准；后台没有的节点（公开仓新加、库里还没同步）接在后面，不丢卡。
  const ordered: ResolvedBeat[] = []
  for (const liveBeat of live.beats) {
    if (deleted.has(liveBeat.id)) continue
    const baseline = act.beats.find((beat) => beat.id === liveBeat.id)
    if (baseline) {
      ordered.push(baseline)
    } else if (isCustomId(liveBeat.id)) {
      ordered.push(resolveCustomBeat(liveBeat, act.act.id, home))
    }
  }
  for (const beat of act.beats) {
    if (!liveBeats.has(beat.id) && !deleted.has(beat.id) && !deleted.has(beat.act)) ordered.push(beat)
  }

  const beats = ordered
    .filter((beat) => !deleted.has(beat.id) && !deleted.has(beat.act) && liveBeats.get(beat.id)?.visible !== false)
    .map((beat): ResolvedBeat => {
      const override = liveBeats.get(beat.id)
      if (!override) return beat
      if (isCustomId(beat.id)) return resolveCustomBeat(override, act.act.id, home)
      return {
        ...beat,
        date: override.date || beat.date,
        // 公仓旧基线的「好久不见。」升级为复播节点；保留管理员写过的其他自定义标题。
        title: beat.id === 'back-again' && override.title === '好久不见。'
          ? beat.title
          : override.title || beat.title,
        body: override.body || undefined,
        expanded: override.expanded,
        important: override.important,
        kicker: home ? (override.important ? '重要' : undefined) : override.kicker || undefined,
        size: override.size,
        chips: override.chips.length > 0 ? override.chips : undefined,
        gameWorld: override.footnote.text
          ? { text: override.footnote.text, rel: override.footnote.rel || undefined, date: override.footnote.date || undefined }
          : undefined,
        // 后台清空尾标就是要它消失，所以空串覆盖成 undefined，不回退基线。
        tail: override.tail || undefined,
      }
    })

  return {
    ...act,
    act: {
      ...act.act,
      kicker: live.kicker || act.act.kicker,
      title: live.title || act.act.title,
      body: live.body.length > 0 ? live.body : act.act.body,
      label: live.label || act.act.label,
      // 旧内容快照把斗鱼时期笼统写成「2015 — 2023」；首播已有
      // 2015-01-21 的可核验记录，不能让这条遗留值覆盖较精确的公开基线。
      // 管理端填写任何其他文案时仍照常优先使用。
      years: act.act.id === 'act-ii' && live.years === '2015 — 2023 · 大周的那些年'
        ? act.act.years
        : live.years || act.act.years,
      color: live.color || act.act.color,
      // 固定三幕始终保留一页尾声；旧内容快照里空的 closer 回退到公开基线。
      closer: live.closer.line
        ? { line: live.closer.line, tail: live.closer.tail || undefined }
        : act.act.closer,
    },
    beats,
  }
}

/**
 * 一整组幕的覆盖，按 id 匹配；后台没有的幕保持基线。
 * 会追加后台新增的 `custom-*` 幕，并统一过滤删除墓碑。
 */
export function applyLiveActs(
  acts: ResolvedAct[],
  live: LiveAct[] | undefined,
  home = false,
  deletedIds: string[] = [],
): ResolvedAct[] {
  const deleted = new Set(deletedIds ?? [])
  const liveActs = live ?? []
  const baselineIds = new Set<string>(acts.map((act) => act.act.id))

  const baselineActs = acts
    .filter((act) => !deleted.has(act.act.id) && liveActs.find((candidate) => candidate.id === act.act.id)?.visible !== false)
    .map((act) => applyLiveAct(act, liveActs.find((candidate) => candidate.id === act.act.id) ?? null, home, deletedIds))

  const customActs = liveActs
    .filter(
      (act) =>
        isCustomId(act.id) &&
        !baselineIds.has(act.id) &&
        !deleted.has(act.id) &&
        act.visible !== false,
    )
    .map((act) => resolveCustomAct(act, home, deletedIds))

  return [...baselineActs, ...customActs]
}

/**
 * 高光条的覆盖。
 *
 * `emphasisVars` 是构建期算出的派生数字（如心灵砒霜期数）。后台写的 emphasis 里可以保留
 * `{xinlingCount}` 这种占位符，在这里填上——不这样做的话，管理员一改 emphasis 就只能
 * 手打一个当时的数字，那个数字之后永远不会再更新（narrative.ts：文案禁止硬编码数字）。
 */
export function applyLiveHighlights(
  beats: ResolvedBeat[],
  live: LiveHighlight[] | undefined,
  emphasisVars: Record<string, string> = {},
  deletedIds: string[] = [],
): ResolvedBeat[] {
  const deleted = new Set(deletedIds ?? [])
  const liveHighlights = live ?? []
  if (liveHighlights.length === 0 && deleted.size === 0) return beats

  const overrides = new Map(liveHighlights.map((highlight) => [highlight.id, highlight]))
  const ordered: ResolvedBeat[] = []
  for (const highlight of liveHighlights) {
    if (deleted.has(highlight.id)) continue
    const baseline = beats.find((beat) => beat.id === highlight.id)
    if (baseline) {
      ordered.push(baseline)
    } else if (isCustomId(highlight.id)) {
      ordered.push(resolveCustomHighlight(highlight, emphasisVars))
    }
  }
  for (const beat of beats) {
    if (!overrides.has(beat.id) && !deleted.has(beat.id)) ordered.push(beat)
  }

  return ordered
    .filter((beat) => !deleted.has(beat.id) && overrides.get(beat.id)?.visible !== false)
    .map((beat) => {
      const override = overrides.get(beat.id)
      if (!override) return beat
      if (isCustomId(beat.id)) return resolveCustomHighlight(override, emphasisVars)
      return {
        ...beat,
        // 大周已并入「游戏梗」；兼容内容服务里尚未改写的旧标签，同时仍允许管理员写新文案。
        kicker: beat.id === 'meme-dazhou' && override.kicker === '大周MC'
          ? '大周 · 我的世界'
          : override.kicker || undefined,
        title: override.title || beat.title,
        body: override.body || undefined,
        href: override.link || beat.href,
        date: override.date || beat.date,
        emphasis: override.emphasis ? fillEmphasis(override.emphasis, emphasisVars) : undefined,
        // 默认展开以后台为准：勾选→加载即展开；未勾选→保持折叠（覆盖基线，基线无此概念）。
        expanded: override.expanded,
        category: override.category === undefined ? beat.category : override.category,
      }
    })
}

/**
 * 故事模式时间轴的覆盖。
 *
 * 公仓基线节点和后台新增的 custom 节点，都按后台填写的展示日期动态归入年份段。
 * 这是故事页的策展展示位置，不会修改 archive entry 的史料日期；正文与右侧时间轴
 * 共用这份结果，不需要为新节点再维护第二份时间轴清单。
 * 已归位的节点会在这里打文案覆盖、按后台顺序重排、隐藏被关掉的节点。
 * featured 身份由公开仓基线决定；后台可以改顺序和显隐，但不会把多张关键记忆重新压成单张。
 * 全部 featured 被隐藏时由该年第一条 secondary 顶上，不让整年塌成空行。
 *
 * 展示顺序以后台为准：跨年份移动时先按展示日期换到相应年份段，同年内再按后台列表
 * 的顺序排列。无效日期不会猜测，保留公开基线的归位。
 */
function storyYearFromDisplayDate(value: string): number | null {
  const match = value.trim().match(/^(\d{4})(?:[.-](?:0[1-9]|1[0-2]))?(?:[.-]\d{1,2})?$/)
  return match ? Number(match[1]) : null
}

export function applyLiveStoryYears<T extends { year: number; featured?: ResolvedBeat[]; hero: ResolvedBeat | null; secondary: ResolvedBeat[] }>(
  years: T[],
  liveActs: LiveAct[] | undefined,
  deletedIds: string[] = [],
): T[] {
  const deleted = new Set(deletedIds ?? [])
  const liveActList = liveActs ?? []
  if (liveActList.length === 0 && deleted.size === 0) return years

  const overrides = new Map<string, LiveBeat>()
  const order = new Map<string, number>()
  const customByYear = new Map<number, ResolvedBeat[]>()
  let position = 0
  for (const act of liveActList) {
    if (deleted.has(act.id)) continue
    for (const beat of act.beats) {
      if (deleted.has(beat.id)) continue
      if (isCustomId(beat.id)) {
        if (beat.visible === false) continue
        const match = beat.date.match(/^(\d{4})\.(0[1-9]|1[0-2])$/)
        if (!match) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[live-content] 故事模式 custom beat 的日期必须是 YYYY.MM，已忽略 ${beat.id}`)
          }
          continue
        }
        const storyYear = Number(match[1])
        const resolved = { ...resolveCustomBeat(beat, act.id as ActId, false), storyYear }
        const custom = customByYear.get(storyYear)
        if (custom) custom.push(resolved)
        else customByYear.set(storyYear, [resolved])
        order.set(beat.id, position)
        position += 1
        continue
      }
      overrides.set(beat.id, beat)
      order.set(beat.id, position)
      position += 1
    }
  }

  const applyBeat = (beat: ResolvedBeat): ResolvedBeat => {
    const override = overrides.get(beat.id)
    if (!override) return beat
    const anchorChanged = override.entryId !== undefined
    const entryId = override.entryId ?? ''
    // 旧实时文档把首播节点只写到月份，正文也还是“2015 年初”。证据校准到
    // 2015-01-21 后，只对这组可识别的旧基线值升级；管理员后来写过的其他内容照常优先。
    const legacyDebutCopy = beat.id === 'door-156277'
      && override.date === '2015.01'
      && override.body.startsWith('2015 年初，她开始在斗鱼直播')
    const displayDate = legacyDebutCopy ? beat.date : override.date || beat.date
    return {
      ...beat,
      // 「展示日期」只管故事页编排；archive entry 的日期仍是数据层的唯一史料。
      date: displayDate,
      storyYear: storyYearFromDisplayDate(displayDate) ?? beat.storyYear,
      kicker: override.kicker || undefined,
      title: override.title || beat.title,
      body: legacyDebutCopy ? beat.body : override.body || undefined,
      expanded: override.expanded,
      important: override.important,
      ...(anchorChanged ? {
        href: entryId ? `/e/${entryId}/` : null,
        external: false,
        cover: entryId ? proxyImage(override.entryCover, beat.size === 'hero' ? 900 : 640) : null,
      } : {}),
    }
  }
  const visible = (beat: ResolvedBeat) =>
    !deleted.has(beat.id) && !deleted.has(beat.act) && overrides.get(beat.id)?.visible !== false

  // 基线节点也可能被后台改到另一年。先从原年份拿走，再插进展示日期指定的年份；
  // 这只影响故事页面编排，不会改动公开档案条目。
  const knownYears = new Set(years.map((year) => year.year))
  const movedIds = new Set<string>()
  const movedByYear = new Map<number, ResolvedBeat[]>()
  for (const year of years) {
    const source = [...(year.featured?.length ? year.featured : year.hero ? [year.hero] : []), ...year.secondary]
    for (const beat of source) {
      const targetYear = storyYearFromDisplayDate(overrides.get(beat.id)?.date ?? '')
      if (targetYear === null || targetYear === year.year || !knownYears.has(targetYear)) continue
      movedIds.add(beat.id)
      const moved = movedByYear.get(targetYear)
      if (moved) moved.push(beat)
      else movedByYear.set(targetYear, [beat])
    }
  }

  return years.map((year) => {
    const baselineFeatured = year.featured?.length ? year.featured : year.hero ? [year.hero] : []
    const custom = customByYear.get(year.year) ?? []
    const moved = movedByYear.get(year.year) ?? []
    const featuredIds = new Set([
      ...baselineFeatured.map((beat) => beat.id),
      ...moved.filter((beat) => beat.size === 'hero').map((beat) => beat.id),
      ...custom.filter((beat) => beat.size === 'hero').map((beat) => beat.id),
    ])
    const source = [...baselineFeatured, ...year.secondary, ...moved, ...custom]
      .filter((beat) => !movedIds.has(beat.id) || moved.some((item) => item.id === beat.id))
      .filter((beat, index, list) => list.findIndex((item) => item.id === beat.id) === index)
    const kept = source.filter(visible)
    kept.sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER))
    const resolved = kept.map(applyBeat)
    let featured = resolved.filter((beat) => featuredIds.has(beat.id))
    if (featured.length === 0 && resolved[0]) featured = [resolved[0]]
    const visibleFeaturedIds = new Set(featured.map((beat) => beat.id))
    const secondary = resolved.filter((beat) => !visibleFeaturedIds.has(beat.id))
    return { ...year, featured, hero: featured[0] ?? null, secondary }
  })
}
