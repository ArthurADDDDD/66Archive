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
 *    按纯文案节点渲染，其余未知 id 忽略——日期、链接、封面这些只有基线里有。
 *
 * 站点是静态导出的，所以这些请求发生在浏览器里、首屏渲染之后。服务端渲染出来的
 * 永远是基线，覆盖是随后打上去的——这也是「内容服务不可用时页面照常」的实现方式。
 */

/**
 * 生产环境前台与接口同域时留空即可；本地联调可通过 `NEXT_PUBLIC_CONTENT_ORIGIN`
 * 指向本地服务。内容服务对配置好的来源回 CORS 头，不需要额外的开发代理。
 */
import { fillEmphasis, type ActId, type ResolvedAct, type ResolvedBeat } from './narrative'

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

export type LiveBeat = {
  id: string
  kicker: string
  title: string
  body: string
  visible: boolean
  date: string
  important: boolean
  size: 'hero' | 'type' | 'small' | 'montage'
  chips: string[]
  footnote: { text: string; rel: string; date: string }
  /** 卡片尾标（如 `TO BE CONTINUED...`）；空串表示这张卡不带尾标 */
  tail: string
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
  /** 展示日期文本（如 `2016—17`），不是档案日期 */
  date: string
  /** 背景纹理文字；可含 `{var}` 占位符，由构建期派生值填充 */
  emphasis: string
  /** 首页默认展开：true 时这条高光加载后直接展开（用户仍可手动折叠）。 */
  expanded: boolean
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
    date: str(value.date),
    important: bool(value.important),
    size: size === 'hero' || size === 'type' || size === 'montage' ? size : 'small',
    chips: strList(value.chips),
    footnote: { text: str(footnote.text), rel: str(footnote.rel), date: str(footnote.date) },
    tail: str(value.tail),
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
                date: str(item.date),
                emphasis: str(item.emphasis),
                expanded: bool(item.expanded),
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
    kicker: home ? (live.important ? '重要' : undefined) : live.kicker || undefined,
    title: live.title,
    body: live.body || undefined,
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
    href: null,
    external: false,
    cover: null,
    emphasis: live.emphasis ? fillEmphasis(live.emphasis, emphasisVars) : undefined,
    expanded: live.expanded,
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
        title: override.title || beat.title,
        body: override.body || undefined,
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
      years: live.years || act.act.years,
      color: live.color || act.act.color,
      closer: live.closer.line ? { line: live.closer.line, tail: live.closer.tail || undefined } : undefined,
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
        kicker: override.kicker || undefined,
        title: override.title || beat.title,
        body: override.body || undefined,
        date: override.date || beat.date,
        emphasis: override.emphasis ? fillEmphasis(override.emphasis, emphasisVars) : undefined,
        // 默认展开以后台为准：勾选→加载即展开；未勾选→保持折叠（覆盖基线，基线无此概念）。
        expanded: override.expanded,
      }
    })
}

/**
 * 故事模式时间轴的覆盖。
 *
 * 故事模式的年份归位（哪一年放哪几条）是构建期按策展日期算好的，这里不重算——
 * 只对已经归位的节点打文案覆盖、按后台顺序重排、隐藏被关掉的节点。
 * featured 身份由公开仓基线决定；后台可以改顺序和显隐，但不会把多张关键记忆重新压成单张。
 * 全部 featured 被隐藏时由该年第一条 secondary 顶上，不让整年塌成空行。
 *
 * 注意：改后台里的「展示日期」不会把节点挪到另一年——年份分组是构建期的结果，
 * 跨年移动需要重新构建公开仓。日常改文案不受影响。
 */
export function applyLiveStoryYears<T extends { featured?: ResolvedBeat[]; hero: ResolvedBeat | null; secondary: ResolvedBeat[] }>(
  years: T[],
  liveActs: LiveAct[] | undefined,
  deletedIds: string[] = [],
): T[] {
  const deleted = new Set(deletedIds ?? [])
  const liveActList = liveActs ?? []
  if (liveActList.length === 0 && deleted.size === 0) return years

  const overrides = new Map<string, LiveBeat>()
  const order = new Map<string, number>()
  let position = 0
  for (const act of liveActList) {
    if (deleted.has(act.id)) continue
    for (const beat of act.beats) {
      if (deleted.has(beat.id)) continue
      if (isCustomId(beat.id)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[live-content] 故事模式不支持 custom beat 归年，已忽略 ${beat.id}`)
        }
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
    return {
      ...beat,
      date: override.date || beat.date,
      kicker: override.kicker || undefined,
      title: override.title || beat.title,
      body: override.body || undefined,
    }
  }
  const visible = (beat: ResolvedBeat) =>
    !deleted.has(beat.id) && !deleted.has(beat.act) && overrides.get(beat.id)?.visible !== false

  return years.map((year) => {
    const baselineFeatured = year.featured?.length ? year.featured : year.hero ? [year.hero] : []
    const featuredIds = new Set(baselineFeatured.map((beat) => beat.id))
    const source = [...baselineFeatured, ...year.secondary].filter(
      (beat, index, list) => list.findIndex((item) => item.id === beat.id) === index,
    )
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
