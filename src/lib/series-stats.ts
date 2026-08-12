import type { Dataset, TimelineEntry } from './data'
import { toTimelineEntries } from './data'
import type { Series } from './schema'

export const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六']

export type SeriesStats = Series & {
  entryCount: number
  firstDate: string
  lastDate: string
  /** 倒序，与旧版一致 */
  entries: TimelineEntry[]
  /** 周日…周六各有多少期 */
  weekdayCounts: number[]
  /** 这档节目固定在星期几。只有真的固定（过半）才有值，否则是 null——不硬凑。 */
  dominantWeekday: { day: number; count: number; share: number } | null
}

/** 用 UTC 算星期，避免本地时区把跨零点的日期推到前一天。 */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

/**
 * 按系列聚合。
 *
 * `dominantWeekday` 是这一版系列详情页选版式的依据：
 * 《心灵砒霜》243 期里 219 期在星期天，它就该长成一张七年的周历；
 * 《戏说封神》19 期集中在两个月，它就不该。**版式由数据决定，不是按 id 写死的。**
 */
export function buildSeriesStats(ds: Dataset): SeriesStats[] {
  const entries = toTimelineEntries(ds)
  const byId = new Map<string, TimelineEntry[]>()
  for (const e of entries) {
    if (!e.seriesId) continue
    if (!byId.has(e.seriesId)) byId.set(e.seriesId, [])
    byId.get(e.seriesId)!.push(e)
  }

  return [...ds.series.values()].map((series) => {
    const list = [...(byId.get(series.id) ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    const weekdayCounts = Array.from({ length: 7 }, () => 0)
    for (const e of list) weekdayCounts[weekdayOf(e.date)]++

    const top = weekdayCounts.reduce((best, n, day) => (n > weekdayCounts[best] ? day : best), 0)
    const share = list.length ? weekdayCounts[top] / list.length : 0

    return {
      ...series,
      entryCount: list.length,
      firstDate: list.length ? list[list.length - 1].date : '',
      lastDate: list.length ? list[0].date : '',
      entries: list,
      weekdayCounts,
      dominantWeekday: share >= 0.5 && list.length >= 10 ? { day: top, count: weekdayCounts[top], share } : null,
    }
  })
}

/** 一格 = 一天。`entry` 有值就是那天有一期。 */
export type CalendarCell = { date: string; weekIndex: number; weekday: number; entry: TimelineEntry }
export type CalendarYear = { year: number; weekCount: number; lit: CalendarCell[] }

/**
 * 把一档节目摊成"每年 × 每周 × 星期几"的格子。
 * 每一列是一周，每一行是星期几——固定在周日播的节目，会在周日那一行连成一条亮线。
 * 这是 243 行表格永远说不出来的一件事。
 *
 * 只返回**亮着的格子**（外加这一年有几列）。空格子由 SeriesCalendar 用一个 SVG
 * pattern 一次画完：整整八年逐格生成 DOM 是 2,700 多个节点、页面白白多出六百多 KB（实测 1,107 KB → 475 KB），
 * 而它们全都是同一个灰方块。
 *
 * 每一天只归属它自己所在的那一年（`date` 的年份），不会因为跨年的那一周被画两次。
 */
export function buildSeriesCalendar(stats: SeriesStats): CalendarYear[] {
  if (!stats.firstDate) return []

  const firstYear = Number(stats.firstDate.slice(0, 4))
  const lastYear = Number(stats.lastDate.slice(0, 4))
  const years: CalendarYear[] = []

  for (let year = firstYear; year <= lastYear; year++) {
    // 从这一年 1 月 1 日所在那一周的星期天开始数，保证每一列都是完整的一周。
    const origin = Date.UTC(year, 0, 1) - new Date(Date.UTC(year, 0, 1)).getUTCDay() * 86400000
    const lastDay = Date.UTC(year, 11, 31)
    const weekCount = Math.floor((lastDay - origin) / (7 * 86400000)) + 1

    const lit = stats.entries
      .filter((e) => e.date.slice(0, 4) === String(year))
      .map((e) => {
        const t = Date.parse(`${e.date}T00:00:00Z`)
        return {
          date: e.date,
          weekIndex: Math.floor((t - origin) / (7 * 86400000)),
          weekday: weekdayOf(e.date),
          entry: e,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    years.push({ year, weekCount, lit })
  }
  return years
}
