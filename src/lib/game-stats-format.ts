import type { TimelineEntry } from './data'

/** 客户端组件可安全导入的类型与纯函数 —— 不引入 data.ts 的 fs 依赖 */

/** 一段"连着打"的时间：中间没有断超过 GAP_TOLERANCE_DAYS 天。 */
export type Binge = {
  from: string
  to: string
  /** 首尾相差的天数（含头尾） */
  spanDays: number
  sessions: number
  knownMinutes: number
}

/** 一次"回坑"：中间隔了很久又打开了。 */
export type Comeback = {
  gapDays: number
  /** 沉默前的最后一场 */
  before: TimelineEntry
  /** 回来的第一场 —— 那条标题往往就是全部的内容 */
  after: TimelineEntry
}

export type GameStats = {
  id: string
  name: string
  aliases: string[]
  cover?: string
  note?: string
  /** 客观发售日，来自 games.yaml。没有就是没有，不推测。 */
  released?: string
  sessionCount: number
  knownDurationMin: number
  knownDurationCount: number
  firstDate: string
  lastDate: string
  platforms: string[]
  /** 倒序（最近的在前），与旧版一致 */
  entries: TimelineEntry[]
  first?: TimelineEntry
  last?: TimelineEntry
  /** 首末相差的天数 */
  spanDays: number
  /** 最长的一次中断。只在真的很久（见 COMEBACK_MIN_DAYS）时才有值。 */
  comeback?: Comeback
  /** 打得最凶的那一段 */
  binge?: Binge
  /** 她是什么时候上车的：首播距发售的天数（负数 = 发售前）。没有发售日就没有这个数。 */
  daysFromRelease?: number
}

/**
 * 游戏库封面墙一个格子需要的全部东西——**仅此而已**。
 *
 * 为什么要单独有这个类型：`GamesLibrary` 是客户端组件，直接把 `GameStats[]` 传进去
 * 会把 492 个游戏各自的 `entries`（完整 TimelineEntry，含 sources / bands）
 * 一起序列化进 HTML，`/games/` 会变成 2.5 MB。
 * 往这个类型里加字段之前先想清楚：格子上真的要显示它吗？
 */
export type GameCard = {
  id: string
  name: string
  aliases: string[]
  face: string | null
  sessionCount: number
  knownDurationMin: number
  knownDurationCount: number
  firstDate: string
  lastDate: string
  /** 最长中断的天数；没有长中断就是 0 */
  comebackDays: number
}

/**
 * 一个游戏在库里露的那张脸 = **她第一次播它那天的截图**，不是商店页的宣传图。
 *
 * 为什么取"第一次"而不是"最近一次"：游戏库默认按"最近玩过"排，
 * 于是往下滚时封面的年代跟着首播年份一起往回退，滚到库底就真的是 2016 年的
 * A 站录播截图——考古现场。取"最近一次"整面墙的画质会趋于一致，这个效果就没了。
 *
 * `games.yaml` 的 `cover` 字段目前一个都没填；填了的话以它为准（那是关于游戏本身的资料）。
 */
export function gameFace(game: GameStats): string | null {
  return game.cover ?? game.first?.cover ?? null
}

export function toGameCard(game: GameStats): GameCard {
  return {
    id: game.id,
    name: game.name,
    aliases: game.aliases,
    face: gameFace(game),
    sessionCount: game.sessionCount,
    knownDurationMin: game.knownDurationMin,
    knownDurationCount: game.knownDurationCount,
    firstDate: game.firstDate,
    lastDate: game.lastDate,
    comebackDays: game.comeback?.gapDays ?? 0,
  }
}

export function formatGameDuration(min: number, knownCount: number, sessionCount: number): string {
  if (knownCount === 0) return '时长未知'
  const h = Math.floor(min / 60)
  const text = h ? `${h} 小时` : `${min} 分钟`
  return knownCount < sessionCount ? `${text}（仅 ${knownCount}/${sessionCount} 场有时长记录）` : text
}

export function formatHours(min: number): string {
  const h = Math.round(min / 60)
  return h >= 1 ? `${h} 小时` : `${min} 分`
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

/**
 * 她是什么时候上车的。
 * 这句话是游戏详情页最值钱的一句，但**必须有发售日才算得出来**——
 * games.yaml 里目前一个 released 都没有填，所以现在全站都返回 null，页面上就不显示。
 * 不要为了让这一行有东西显示而去猜发售日。
 */
export function formatBoarding(daysFromRelease: number | undefined): string | null {
  if (daysFromRelease === undefined) return null
  if (daysFromRelease === 0) return '发售当天就播了'
  if (daysFromRelease < 0) return `发售前 ${-daysFromRelease} 天就播了`
  if (daysFromRelease <= 7) return `发售第 ${daysFromRelease + 1} 天播的`
  if (daysFromRelease < 365) return `发售 ${daysFromRelease} 天后播的`
  return `发售 ${(daysFromRelease / 365).toFixed(1)} 年后才打开它`
}
