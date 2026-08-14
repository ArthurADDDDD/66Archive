/**
 * 实时内容客户端（只读）
 * =====================
 * 管理后台把当前的文案与板块编排存在私有 数据库 里，通过只读接口
 * `/api/content/*` 暴露经过白名单裁剪的当前值。这个文件是前台读它的唯一入口。
 *
 * 三条硬规矩：
 * 1. **只读**。这里不会发出任何写请求，也不认识任何凭据——公开仓里没有、
 *    也永远不该有数据库连接串或管理员鉴权逻辑。
 * 2. **失败就回退基线**。请求失败、超时、返回结构不对，一律当作「没有覆盖」，
 *    页面继续用 `narrative.ts` / `site-copy.ts` 里的内置基线渲染。后台短暂不可用
 *    绝不能让整站空白。
 * 3. **只认稳定 ID**。覆盖按 id 匹配；库里没有的 id 用基线，基线里没有的 id 忽略
 *    ——日期、链接、封面这些只有基线里有，凭空多出来的节点渲染不出完整卡片。
 *
 * 站点是静态导出的，所以这些请求发生在浏览器里、首屏渲染之后。服务端渲染出来的
 * 永远是基线，覆盖是随后打上去的——这也是「后台不可用时页面照常」的实现方式。
 */

/**
 * 生产环境前台与接口同域（反向代理 反代 `/api/content/`），留空即可。
 * 本地联调时前台在 3000、后台在 3100，用这个环境变量指过去；
 * 后台对配置好的来源回 CORS 头，不需要额外的开发代理。
 */
import type { ResolvedAct, ResolvedBeat } from './narrative'

const CONTENT_ORIGIN = (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, '')

const REQUEST_TIMEOUT_MS = 4000

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
  /** 首页默认展开：true 时这条高光加载后直接展开（用户仍可手动折叠）。 */
  expanded: boolean
}

export type LiveNarrative = {
  homeActs: LiveAct[]
  highlights: LiveHighlight[]
  storyActs: LiveAct[]
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
            ? { id: item.id, kicker: str(item.kicker), title: item.title, body: str(item.body), visible: bool(item.visible, true), expanded: bool(item.expanded) }
            : null,
        )
        .filter((item): item is LiveHighlight => item !== null)
    : []
  const narrative = { homeActs: acts(source.homeActs), highlights, storyActs: acts(source.storyActs) }
  const empty = narrative.homeActs.length === 0 && narrative.highlights.length === 0 && narrative.storyActs.length === 0
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

async function fetchJson(path: string): Promise<unknown | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(`${CONTENT_ORIGIN}${path}`, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) return null
      return await response.json()
    } finally {
      clearTimeout(timer)
    }
  } catch {
    // 网络错误、超时、CORS、JSON 解析失败——对前台来说都是同一件事：没有覆盖。
    return null
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

/**
 * 一幕的实时覆盖。
 *
 * 只覆盖文案与显示：标题、kicker、引子、短标签、年份副标、主题色、收束语，
 * 以及节点的展示日期、标题、描述、卡片规格、蒙太奇标签、隐线脚注。
 * 链接（href/external）、封面、构建期派生的蒙太奇素材与统计数字一律保留基线值
 * ——那些指向史料，不归后台管。
 *
 * `home` 为真时按首页口径处理小标签：首页的 kicker 由「重要」开关决定，
 * 不是节点自己的 kicker，这是公开仓 resolveActs 的既定行为，覆盖时必须跟着走，
 * 否则后台勾了「重要」首页却不显示。
 */
export function applyLiveAct(act: ResolvedAct, live: LiveAct | null, home = false): ResolvedAct {
  if (!live || !live.visible) return live && !live.visible ? { ...act, beats: [] } : act

  const liveBeats = new Map(live.beats.map((beat) => [beat.id, beat]))
  // 顺序以后台为准；后台没有的节点（公开仓新加、库里还没同步）接在后面，不丢卡。
  const ordered: ResolvedBeat[] = []
  for (const liveBeat of live.beats) {
    const baseline = act.beats.find((beat) => beat.id === liveBeat.id)
    if (baseline) ordered.push(baseline)
  }
  for (const beat of act.beats) {
    if (!liveBeats.has(beat.id)) ordered.push(beat)
  }

  const beats = ordered
    .filter((beat) => liveBeats.get(beat.id)?.visible !== false)
    .map((beat): ResolvedBeat => {
      const override = liveBeats.get(beat.id)
      if (!override) return beat
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

/** 一整组幕的覆盖，按 id 匹配；后台没有的幕保持基线。 */
export function applyLiveActs(acts: ResolvedAct[], live: LiveAct[] | undefined, home = false): ResolvedAct[] {
  if (!live || live.length === 0) return acts
  return acts
    .filter((act) => live.find((candidate) => candidate.id === act.act.id)?.visible !== false)
    .map((act) => applyLiveAct(act, live.find((candidate) => candidate.id === act.act.id) ?? null, home))
}

/** 高光条的覆盖：顺序、显示、kicker/标题/描述。链接与封面保留基线。 */
export function applyLiveHighlights(beats: ResolvedBeat[], live: LiveHighlight[] | undefined): ResolvedBeat[] {
  if (!live || live.length === 0) return beats
  const overrides = new Map(live.map((highlight) => [highlight.id, highlight]))
  const ordered: ResolvedBeat[] = []
  for (const highlight of live) {
    const baseline = beats.find((beat) => beat.id === highlight.id)
    if (baseline) ordered.push(baseline)
  }
  for (const beat of beats) {
    if (!overrides.has(beat.id)) ordered.push(beat)
  }
  return ordered
    .filter((beat) => overrides.get(beat.id)?.visible !== false)
    .map((beat) => {
      const override = overrides.get(beat.id)
      if (!override) return beat
      return {
        ...beat,
        kicker: override.kicker || undefined,
        title: override.title || beat.title,
        body: override.body || undefined,
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
 * hero 被隐藏时由该年第一条 secondary 顶上，不让整年塌成空行。
 *
 * 注意：改后台里的「展示日期」不会把节点挪到另一年——年份分组是构建期的结果，
 * 跨年移动需要重新构建公开仓。日常改文案不受影响。
 */
export function applyLiveStoryYears<T extends { hero: ResolvedBeat | null; secondary: ResolvedBeat[] }>(
  years: T[],
  liveActs: LiveAct[] | undefined,
): T[] {
  if (!liveActs || liveActs.length === 0) return years
  const overrides = new Map<string, LiveBeat>()
  const order = new Map<string, number>()
  let position = 0
  for (const act of liveActs) {
    for (const beat of act.beats) {
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
  const visible = (beat: ResolvedBeat) => overrides.get(beat.id)?.visible !== false

  return years.map((year) => {
    const kept = [...(year.hero ? [year.hero] : []), ...year.secondary].filter(visible)
    kept.sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER))
    const [hero, ...secondary] = kept.map(applyBeat)
    return { ...year, hero: hero ?? null, secondary }
  })
}
