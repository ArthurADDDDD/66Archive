import type { TimelineEntry } from './data'

export type Era = {
  id: string
  label: string
  detail: string
  from: number
  to: number
  color: string
}

/** 三个时期的分界。录播室的时期按钮与年度线索都按它分组。 */
export const ERAS: Era[] = [
  { id: 'video', label: '视频时期', detail: '2010—2014', from: 2010, to: 2014, color: '#E0A244' },
  { id: 'douyu', label: '斗鱼时期', detail: '2015—2023', from: 2015, to: 2023, color: '#5BC8E8' },
  { id: 'douyin', label: '抖音时期', detail: '2024—至今', from: 2024, to: 9999, color: '#FF6B75' },
]

export type ArchiveNavYear = {
  year: number
  count: number
  months: number
  hours: number
  /** 该年是否有已知时长；没有的话卡片显示「时长待补」而不是「已录 0 小时」。 */
  hasDuration: boolean
  titles: string[]
}

export type ArchiveNav = {
  total: number
  hours: number
  coverage: number
  latestYear: number
  eras: (Era & { count: number })[]
  activeEraLabel: string
  years: ArchiveNavYear[]
}

/**
 * 录播室首屏「时间定位」那一块的构建期版本。
 *
 * 为什么值得烤进 HTML：这块导航**完全不依赖那份 2.7 MB 的档案载荷**，它只是各年
 * 各时期的条数与标题。但此前它要等载荷到齐才画得出来，在此之前页面上是 37 块
 * 脉冲占位——用户盯着一屏灰条，等一个 230 KB 的请求，只为了看见「2024 有 56 条」。
 *
 * 烤进来之后首屏直接给出真实的、可点可分享的年份入口（`Timeline` 本来就是先按
 * `href` 导航、再在 click 里 preventDefault，所以这些 `<a>` 不是装饰）。
 * 载荷到达后 `Timeline` 接管，数字一致，不会跳。
 *
 * 只烤**当前时期**那几年（首屏默认就停在最新一年所属的时期），不是全部 16 年：
 * 其余年份要点过时期按钮才出现，那时载荷早就到了。
 */
export function buildArchiveNav(entries: TimelineEntry[]): ArchiveNav {
  const yearOf = (entry: TimelineEntry) => Number(entry.date.slice(0, 4))
  const known = entries.filter((entry) => entry.duration_min)
  const latestYear = entries.reduce((max, entry) => Math.max(max, yearOf(entry)), 0)
  const activeEra = ERAS.find((era) => latestYear >= era.from && latestYear <= era.to) ?? ERAS[0]

  const perYear = new Map<number, { count: number; months: Set<number>; minutes: number; durations: number; titles: Map<string, number> }>()
  for (const entry of entries) {
    const year = yearOf(entry)
    const bucket = perYear.get(year) ?? { count: 0, months: new Set<number>(), minutes: 0, durations: 0, titles: new Map<string, number>() }
    bucket.count += 1
    bucket.months.add(Number(entry.date.slice(5, 7)))
    bucket.titles.set(entry.title, (bucket.titles.get(entry.title) ?? 0) + 1)
    if (entry.duration_min) {
      bucket.minutes += entry.duration_min
      bucket.durations += 1
    }
    perYear.set(year, bucket)
  }

  return {
    total: entries.length,
    hours: Math.round(known.reduce((sum, entry) => sum + (entry.duration_min ?? 0), 0) / 60),
    coverage: entries.length ? Math.round((known.length / entries.length) * 100) : 0,
    latestYear,
    eras: ERAS.map((era) => ({
      ...era,
      count: entries.filter((entry) => yearOf(entry) >= era.from && yearOf(entry) <= era.to).length,
    })),
    activeEraLabel: activeEra.label,
    years: [...perYear.entries()]
      .filter(([year]) => year >= activeEra.from && year <= activeEra.to)
      .sort((a, b) => a[0] - b[0])
      .map(([year, bucket]) => ({
        year,
        count: bucket.count,
        months: bucket.months.size,
        hours: Math.round(bucket.minutes / 60),
        hasDuration: bucket.durations > 0,
        // 与 Timeline 同一口径：按出现次数取前两条（卡片只显示两行）。
        titles: [...bucket.titles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([title]) => title),
      })),
  }
}
