import type { TimelineEntry } from './data'

/**
 * 档案缺口口径（联系页「还差哪些素材」用）。
 *
 * 只报数据里能核对的事实，不做推断：
 * - 「空白月份」= 档案里这个月一条记录都没有，**不等于**这个月没播；
 *   写文案时必须保持这个区别（AGENTS.md：不编造数据）。
 * - 「链接已失效」只统计明确标了 dead 的来源；unchecked 不冒充失效，也不冒充可用。
 * 全部构建期派生，页面不做任何客户端计算。
 */

export type CoverageCell = {
  year: number
  month: number
  count: number
  /** 落在档案跨度之外（第一条记录之前 / 今天之后）——不算缺口，渲染成留白 */
  outOfRange: boolean
}

export type CoverageYear = {
  year: number
  count: number
  /** 这一年里需要补的条目数（缺时长 / 无来源 / 来源全失效，按条目去重） */
  todo: number
  blankMonths: number
}

export type Coverage = {
  totalEntries: number
  firstYear: number
  lastYear: number
  years: number[]
  cells: CoverageCell[]
  maxMonthCount: number
  /** 跨度之内、档案里一条记录都没有的月份数 */
  blankMonths: number
  monthsInRange: number
  emptyYears: number[]
  missingDuration: number
  durationCoverage: number
  deadOnly: number
  noSource: number
  noCover: number
  /** 至少命中一项缺口的条目数（去重） */
  todoEntries: number
  yearRows: CoverageYear[]
}

export function buildCoverage(timeline: TimelineEntry[]): Coverage {
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() + 1

  const years = [...new Set(timeline.map((e) => Number(e.date.slice(0, 4))))].sort((a, b) => a - b)
  const firstYear = years[0] ?? nowYear
  const lastYear = Math.max(nowYear, years[years.length - 1] ?? nowYear)
  const firstMonth = timeline.length
    ? Math.min(...timeline.filter((e) => Number(e.date.slice(0, 4)) === firstYear).map((e) => Number(e.date.slice(5, 7))))
    : 1

  const monthCounts = new Map<string, number>()
  for (const e of timeline) {
    const key = `${e.date.slice(0, 4)}-${e.date.slice(5, 7)}`
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1)
  }

  const span: number[] = []
  for (let y = firstYear; y <= lastYear; y++) span.push(y)

  const cells: CoverageCell[] = []
  let blankMonths = 0
  let monthsInRange = 0
  for (const year of span) {
    for (let month = 1; month <= 12; month++) {
      const before = year === firstYear && month < firstMonth
      const after = year === nowYear && month > nowMonth
      const outOfRange = before || after
      const count = monthCounts.get(`${year}-${String(month).padStart(2, '0')}`) ?? 0
      if (!outOfRange) {
        monthsInRange += 1
        if (count === 0) blankMonths += 1
      }
      cells.push({ year, month, count, outOfRange })
    }
  }

  // —— 条目级缺口 ——
  let missingDuration = 0
  let deadOnly = 0
  let noSource = 0
  let noCover = 0
  const todoByYear = new Map<number, number>()
  let todoEntries = 0
  for (const e of timeline) {
    const year = Number(e.date.slice(0, 4))
    const lacksDuration = !e.duration_min
    const lacksSource = e.sourceCount === 0
    const allDead = e.sourceCount > 0 && e.aliveCount === 0 && e.deadCount === e.sourceCount
    if (lacksDuration) missingDuration += 1
    if (lacksSource) noSource += 1
    if (allDead) deadOnly += 1
    if (!e.cover) noCover += 1
    if (lacksDuration || lacksSource || allDead) {
      todoEntries += 1
      todoByYear.set(year, (todoByYear.get(year) ?? 0) + 1)
    }
  }

  const countByYear = new Map<number, number>()
  const blankByYear = new Map<number, number>()
  for (const cell of cells) {
    if (cell.outOfRange) continue
    countByYear.set(cell.year, (countByYear.get(cell.year) ?? 0) + cell.count)
    if (cell.count === 0) blankByYear.set(cell.year, (blankByYear.get(cell.year) ?? 0) + 1)
  }

  const yearRows: CoverageYear[] = span.map((year) => ({
    year,
    count: countByYear.get(year) ?? 0,
    todo: todoByYear.get(year) ?? 0,
    blankMonths: blankByYear.get(year) ?? 0,
  }))

  return {
    totalEntries: timeline.length,
    firstYear,
    lastYear,
    years: span,
    cells,
    maxMonthCount: Math.max(1, ...cells.map((c) => c.count)),
    blankMonths,
    monthsInRange,
    emptyYears: span.filter((y) => (countByYear.get(y) ?? 0) === 0),
    missingDuration,
    durationCoverage: timeline.length ? Math.round(((timeline.length - missingDuration) / timeline.length) * 100) : 0,
    deadOnly,
    noSource,
    noCover,
    todoEntries,
    yearRows,
  }
}
