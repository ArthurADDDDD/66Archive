import type { TimelineEntry } from './data'
import type { Platform } from './schema'

export type CoverageStats = {
  total: number
  duration: number
  cover: number
  games: number
  series: number
  segments: number
}

/** 各字段的实际覆盖率——统计页开场就要说清楚哪些图表是在多大的样本上画的 */
export function computeCoverage(entries: TimelineEntry[]): CoverageStats {
  return {
    total: entries.length,
    duration: entries.filter((e) => e.duration_min).length,
    cover: entries.filter((e) => e.cover).length,
    games: entries.filter((e) => e.games.length > 0).length,
    series: entries.filter((e) => e.seriesName).length,
    segments: entries.filter((e) => e.bands.length > 0).length,
  }
}

export type YearTypeRow = { year: number; video: number; live: number }

export function yearTypeHistogram(entries: TimelineEntry[]): YearTypeRow[] {
  const map = new Map<number, YearTypeRow>()
  for (const e of entries) {
    const y = Number(e.date.slice(0, 4))
    const row = map.get(y) ?? { year: y, video: 0, live: 0 }
    row[e.type]++
    map.set(y, row)
  }
  return [...map.values()].sort((a, b) => a.year - b.year)
}

export type YearPlatformRow = { year: number; platforms: Partial<Record<Platform, number>>; total: number }

/** 平台迁移：每年各平台条目数，驱动堆叠横条 */
export function yearPlatformHistogram(entries: TimelineEntry[]): YearPlatformRow[] {
  const map = new Map<number, YearPlatformRow>()
  for (const e of entries) {
    const y = Number(e.date.slice(0, 4))
    const row = map.get(y) ?? { year: y, platforms: {}, total: 0 }
    const p = e.platform as Platform
    row.platforms[p] = (row.platforms[p] ?? 0) + 1
    row.total++
    map.set(y, row)
  }
  return [...map.values()].sort((a, b) => a.year - b.year)
}

export type MonthGap = { year: number; month: number }

/**
 * 从首条记录到今天，逐月扫描找出完全没有记录的月份。
 * 这不是"数据丢了"的指控，是给采集侧和志愿者的一张缺口清单。
 */
export function findMonthlyGaps(entries: TimelineEntry[]): MonthGap[] {
  if (entries.length === 0) return []
  const dates = entries.map((e) => e.date).sort()
  const first = dates[0]
  const last = dates[dates.length - 1]
  const present = new Set(entries.map((e) => e.date.slice(0, 7)))

  const gaps: MonthGap[] = []
  let y = Number(first.slice(0, 4))
  let m = Number(first.slice(5, 7))
  const endY = Number(last.slice(0, 4))
  const endM = Number(last.slice(5, 7))

  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (!present.has(key)) gaps.push({ year: y, month: m })
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return gaps
}
