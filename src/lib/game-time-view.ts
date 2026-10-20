/**
 * 游戏时长在界面上的表达（口径见 docs/game-time.md §4）。
 *
 * 所有显示游戏时长的位置都从这里取数字和措辞，不各自换算：
 * - 区间：下限 = 已归属的关联录像，上限 = 再加上还没拆分的场次；
 * - 读者界面只用 `footageApproxLabel` 给一个大概，并带「相关录像」字样，不写成游玩时长；
 * - 已核实量、归属覆盖、区间写法只留给内部校对和测试，不进读者界面（2026-10-20 维护者修订）。
 */
import type { GameTimeSummary } from './game-time'

/** 进客户端载荷的最小形状（游戏库、首页卡片）。 */
export type GameTimeView = {
  sessions: number
  attributedSessions: number
  unattributedSessions: number
  associatedMinutes: number
  /** 关联录像 + 未拆分场次最多可能再加的部分。 */
  upperMinutes: number
  /** 有长度不明的部分（缺时长、录像不全），上限写成「X+」。 */
  upperOpen: boolean
  verifiedMinutes: number
  playtimeRankable: boolean
}

export function toGameTimeView(s: GameTimeSummary): GameTimeView {
  return {
    sessions: s.sessions,
    attributedSessions: s.attributedSessions,
    unattributedSessions: s.unattributedSessions,
    associatedMinutes: Math.round(s.associatedSec / 60),
    upperMinutes: Math.round((s.associatedSec + s.unknownUpperSec) / 60),
    upperOpen: s.upperOpen,
    verifiedMinutes: Math.round(s.verifiedSec / 60),
    playtimeRankable: s.playtimeRankable,
  }
}

const hours = (minutes: number) => Math.round(minutes / 60)

/**
 * 区间里的两个数（不带单位）：「16–24」「37」「169–213+」。
 * 不到 1 小时的下限也写成 0，保证区间两端单位一致。
 */
export function footageRangeNumbers(v: GameTimeView): string | null {
  const low = hours(v.associatedMinutes)
  const high = hours(v.upperMinutes)
  if (v.associatedMinutes === 0 && v.upperMinutes === 0) return v.upperOpen ? null : '0'
  if (high === low && !v.upperOpen) return `${low}`
  return `${low}–${high}${v.upperOpen ? '+' : ''}`
}

/** 「37 小时」「169–213+ 小时」「不到 1 小时」；完全不知道时为「时长未知」。 */
export function footageRangeLabel(v: GameTimeView): string {
  if (v.associatedMinutes > 0 && v.upperMinutes < 60 && !v.upperOpen) return '不到 1 小时'
  const range = footageRangeNumbers(v)
  return range === null ? '时长未知' : `${range} 小时`
}

/**
 * 给读者看的大致时长：「37 小时左右」「169 小时以上」「不到 39 小时」「不到 1 小时」「时长未知」。
 * 只说站得住的那一头（有已归属录像就说下限，全部未拆分就说上限），不把区间摆到读者面前。
 * 一律数字打头：界面上多写成「相关录像 {label}」，「约」打头会读成「相关录像 约 37 小时」。
 */
export function footageApproxLabel(v: GameTimeView): string {
  const low = hours(v.associatedMinutes)
  const high = hours(v.upperMinutes)
  if (!v.upperOpen && v.upperMinutes < 60) return v.upperMinutes === 0 ? '时长未知' : '不到 1 小时'
  // 下限不到 1 小时：「X 小时以上」说不出口，只能说上限；上限也开放就是真不知道
  if (low < 1) return v.upperOpen ? '时长未知' : `不到 ${Math.ceil(v.upperMinutes / 60)} 小时`
  if (high === low && !v.upperOpen) return `${low} 小时左右`
  return `${low} 小时以上`
}

/** 已核实量：0 时明确写「尚未核实」。只用于内部校对，不进读者界面。 */
export function verifiedLabel(v: Pick<GameTimeView, 'verifiedMinutes'>): string {
  if (v.verifiedMinutes === 0) return '尚未核实'
  return v.verifiedMinutes < 60 ? `已核实 ${v.verifiedMinutes} 分钟` : `已核实 ${hours(v.verifiedMinutes)} 小时`
}

/** 归属覆盖：「44/52 场」。 */
export function coverageLabel(v: GameTimeView): string {
  return `${v.attributedSessions}/${v.sessions} 场`
}

/** 卡片、行尾 title 提示里的完整说明，一句话交代三样东西。 */
export function footageTitle(v: GameTimeView): string {
  const parts = [`相关录像 ${footageRangeLabel(v)}`, verifiedLabel(v), `时长已归属 ${coverageLabel(v)}`]
  if (v.unattributedSessions > 0) parts.push(`${v.unattributedSessions} 场多游戏直播尚未拆分或缺时长，区间上限按整场计`)
  return parts.join(' · ')
}

/** 「时长不全」：一半以上场次的时长归属未知时，数字明显偏低，排序和卡片上要标出来。 */
export function footageIncomplete(v: GameTimeView): boolean {
  return v.sessions > 0 && v.unattributedSessions * 2 >= v.sessions
}
