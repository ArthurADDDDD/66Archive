'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { MONTH_CN } from '@/lib/ui'
import { EntryRow } from './EntryRow'
import { EMPTY_FILTERS, FilterRail, type Filters } from './FilterRail'
import { SearchField } from './SearchField'
import { SiteNav } from './SiteNav'

type Era = {
  id: string
  label: string
  detail: string
  from: number
  to: number
  color: string
}

type MonthSummary = {
  count: number
  /** 时长占比前三的标题，minutes=0 表示这条时长未知（仍会显示标题，但不会进构成条）。 */
  titles: { title: string; minutes: number }[]
  durationMinutes: number
  durationCount: number
}

/** 构成条 / 词条时长 tag 共用的一组色板，只在同一张卡内部分配，不是跨页面的品牌色。 */
const TITLE_PALETTE = ['#5BC8E8', '#E0A244', '#8B78E6']
const OTHER_SEGMENT_COLOR = '#3C4256'

/** 把「前三标题的分钟数」换算成构成条的色段；未覆盖到的已知时长归进一段「其他」，不会凭空多出或漏掉。 */
function buildTitleSegments(summary: MonthSummary) {
  const total = summary.durationMinutes
  if (total <= 0) return []
  const known = summary.titles.filter((title) => title.minutes > 0)
  const segments = known.map((title, index) => ({
    key: title.title,
    pct: (title.minutes / total) * 100,
    color: TITLE_PALETTE[index % TITLE_PALETTE.length],
  }))
  const rest = total - known.reduce((sum, title) => sum + title.minutes, 0)
  if (rest > 0.5) segments.push({ key: '__other', pct: (rest / total) * 100, color: OTHER_SEGMENT_COLOR })
  return segments
}

/** "20小时" / "45分" 这类紧凑 tag，跟正文的 formatDuration（"N 小时 M 分"）不是一个场合——这里要短。 */
function formatHoursTag(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} 分`
  return `${Math.round(minutes / 60)} 小时`
}

const ERAS: Era[] = [
  { id: 'video', label: '视频时期', detail: '2010—2014', from: 2010, to: 2014, color: '#E0A244' },
  { id: 'douyu', label: '斗鱼时期', detail: '2015—2023', from: 2015, to: 2023, color: '#5BC8E8' },
  { id: 'douyin', label: '抖音时期', detail: '2024—至今', from: 2024, to: 9999, color: '#FF6B75' },
]

/**
 * 文档首次加载时的地址。之后站内软跳转（router.push / replaceState）都不会改它，
 * 用来区分「刷新的是这一页」和「刷新别的页之后又跳过来」。
 */
const INITIAL_URL = typeof window === 'undefined' ? '' : window.location.href

/**
 * 这次加载该不该恢复 URL 里的筛选条件。
 *
 * 刷新（F5 / ⌘R）当作「重新开始」：把上一次筛选留在地址栏里的参数丢掉，回到全年目录。
 * 筛选是当下的动作，不该在下一次打开时还压在结果上。
 * 但分享链接、从编年史点进来的 /archive/?y=2015 是正常导航（navigate），
 * 前进后退是 back_forward——这两种照常恢复，否则外链就废了。
 */
function paramsForThisLoad() {
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  const reloadedHere = nav?.type === 'reload' && window.location.href === INITIAL_URL
  if (!reloadedHere) return new URLSearchParams(window.location.search)
  window.history.replaceState(null, '', window.location.pathname)
  return new URLSearchParams()
}

export function Timeline({
  entries,
  isDemo,
  extra,
}: {
  entries: TimelineEntry[]
  isDemo: boolean
  hiddenUnreviewed?: number
  /** 录播室页头右侧插槽（面包屑 / 回编年史入口） */
  extra?: React.ReactNode
}) {
  const years = useMemo(
    () => [...new Set(entries.map((entry) => Number(entry.date.slice(0, 4))))].sort((a, b) => b - a),
    [entries],
  )
  const latestYear = years[0] ?? new Date().getFullYear()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [activeYear, setActiveYear] = useState(latestYear)
  const [activeMonth, setActiveMonth] = useState<number | null>(null)
  // 展开状态改成集合：档案是用来对照着查的，逐条互斥地开合每次只能看见一条。
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [order, setOrder] = useState<'desc' | 'asc'>('desc')
  const [sheetOpen, setSheetOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const monthsForYear = useCallback(
    (year: number) =>
      [...new Set(entries.filter((entry) => Number(entry.date.slice(0, 4)) === year).map((entry) => Number(entry.date.slice(5, 7))))].sort(
        (a, b) => b - a,
      ),
    [entries],
  )

  // 首次进入时恢复分享链接；没有月份参数时停在全年目录。
  // 静态导出无法在服务端读 searchParams，URL 恢复只能在客户端 effect 里完成，一次性且无外部依赖。
  useEffect(() => {
    const p = paramsForThisLoad()
    const requestedYear = Number(p.get('y'))
    const initialYear = years.includes(requestedYear) ? requestedYear : latestYear
    const requestedMonth = p.has('m') ? Number(p.get('m')) : null
    const availableMonths = monthsForYear(initialYear)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveYear(initialYear)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveMonth(requestedMonth !== null && availableMonths.includes(requestedMonth) ? requestedMonth : null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters({
      q: p.get('q') ?? '',
      platforms: p.get('p')?.split(',').filter(Boolean) ?? [],
      types: p.get('t')?.split(',').filter(Boolean) ?? [],
      games: p.get('g')?.split(',').filter(Boolean) ?? [],
      onlyAlive: p.get('alive') === '1',
    })
  }, [latestYear, monthsForYear, years])

  const writeUrl = useCallback((nextFilters: Filters, year: number, month: number | null) => {
    const p = new URLSearchParams()
    if (year !== latestYear) p.set('y', String(year))
    if (month !== null) p.set('m', String(month))
    if (nextFilters.q) p.set('q', nextFilters.q)
    if (nextFilters.platforms.length) p.set('p', nextFilters.platforms.join(','))
    if (nextFilters.types.length) p.set('t', nextFilters.types.join(','))
    if (nextFilters.games.length) p.set('g', nextFilters.games.join(','))
    if (nextFilters.onlyAlive) p.set('alive', '1')
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [latestYear])

  const hrefFor = useCallback((year: number, month: number | null) => {
    const p = new URLSearchParams()
    if (year !== latestYear) p.set('y', String(year))
    if (month !== null) p.set('m', String(month))
    if (filters.platforms.length) p.set('p', filters.platforms.join(','))
    if (filters.types.length) p.set('t', filters.types.join(','))
    if (filters.games.length) p.set('g', filters.games.join(','))
    if (filters.onlyAlive) p.set('alive', '1')
    const qs = p.toString()
    return `/archive/${qs ? `?${qs}` : ''}`
  }, [filters, latestYear])

  const set = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      writeUrl(next, activeYear, activeMonth)
      return next
    })
  }, [activeMonth, activeYear, writeUrl])

  const selectYear = useCallback((year: number) => {
    const nextFilters = filters.q ? { ...filters, q: '' } : filters
    setActiveYear(year)
    setActiveMonth(null)
    setFilters(nextFilters)
    setExpanded(new Set())
    writeUrl(nextFilters, year, null)
  }, [filters, writeUrl])

  const selectMonth = useCallback((month: number | null) => {
    setActiveMonth(month)
    setExpanded(new Set())
    writeUrl(filters, activeYear, month)
  }, [activeYear, filters, writeUrl])

  /** 从月度年表点一个月：选中之后条目列表会出现在年表下方，点击本身不会自动带你去看——这里补上那一步。 */
  const selectMonthAndScroll = useCallback((month: number | null) => {
    selectMonth(month)
    if (month === null) return
    requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    })
  }, [selectMonth])

  const selectEra = useCallback((era: Era) => {
    const candidates = years.filter((year) => year >= era.from && year <= era.to)
    if (candidates[0] !== undefined) selectYear(candidates[0])
  }, [selectYear, years])

  const matchesFilters = useCallback((entry: TimelineEntry, includeSearch = true) => {
    if (filters.types.length && !filters.types.includes(entry.type)) return false
    if (filters.platforms.length && !filters.platforms.includes(entry.platform)) return false
    if (filters.games.length && !entry.games.some((game) => filters.games.includes(game.id))) return false
    if (filters.onlyAlive && entry.aliveCount === 0) return false
    const q = filters.q.trim().toLowerCase()
    if (includeSearch && q) {
      const sourceTitles = entry.sources.map((source) => source.entryTitle).join(' ')
      const haystack = `${entry.title} ${sourceTitles} ${entry.games.map((game) => game.name).join(' ')} ${entry.tags.join(' ')} ${entry.seriesName ?? ''}`
      if (!haystack.toLowerCase().includes(q)) return false
    }
    return true
  }, [filters])

  const filtered = useMemo(() => entries.filter((entry) => matchesFilters(entry)), [entries, matchesFilters])
  const filterOnly = useMemo(() => entries.filter((entry) => matchesFilters(entry, false)), [entries, matchesFilters])
  const searching = filters.q.trim().length > 0

  const yearCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const entry of filterOnly) {
      const year = Number(entry.date.slice(0, 4))
      counts.set(year, (counts.get(year) ?? 0) + 1)
    }
    return counts
  }, [filterOnly])

  const visible = useMemo(() => {
    if (searching) return filtered
    return filterOnly.filter((entry) => {
      if (Number(entry.date.slice(0, 4)) !== activeYear) return false
      return activeMonth === null || Number(entry.date.slice(5, 7)) === activeMonth
    })
  }, [activeMonth, activeYear, filterOnly, filtered, searching])

  const platformCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries) counts.set(entry.platform, (counts.get(entry.platform) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [entries])
  const gameCounts = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>()
    for (const entry of entries) {
      for (const game of entry.games) {
        const current = counts.get(game.id) ?? { ...game, count: 0 }
        current.count++
        counts.set(game.id, current)
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count)
  }, [entries])

  const durationStats = useMemo(() => {
    const known = entries.filter((entry) => entry.duration_min)
    const minutes = known.reduce((sum, entry) => sum + (entry.duration_min ?? 0), 0)
    return {
      hours: Math.round(minutes / 60),
      coverage: entries.length ? Math.round((known.length / entries.length) * 100) : 0,
    }
  }, [entries])

  const activeEra = ERAS.find((era) => activeYear >= era.from && activeYear <= era.to) ?? ERAS[0]
  const activeEraYears = years
    .filter((year) => year >= activeEra.from && year <= activeEra.to)
    .sort((a, b) => a - b)
  // 条数条的基准：本时期最高的一年。用时期内的峰值而不是全站峰值——
  // 否则视频期那几年在斗鱼期的量级面前会全部压成一条看不见的线。
  const yearSummaries = useMemo(() => {
    const accumulators = new Map<number, { months: Set<number>; titleCounts: Map<string, number>; durationMinutes: number; durationCount: number }>()
    for (const entry of filterOnly) {
      const year = Number(entry.date.slice(0, 4))
      const month = Number(entry.date.slice(5, 7))
      const summary = accumulators.get(year) ?? { months: new Set<number>(), titleCounts: new Map<string, number>(), durationMinutes: 0, durationCount: 0 }
      summary.months.add(month)
      summary.titleCounts.set(entry.title, (summary.titleCounts.get(entry.title) ?? 0) + 1)
      if (entry.duration_min) {
        summary.durationMinutes += entry.duration_min
        summary.durationCount++
      }
      accumulators.set(year, summary)
    }
    const summaries = new Map<number, { months: Set<number>; titles: string[]; durationMinutes: number; durationCount: number }>()
    for (const [year, summary] of accumulators) {
      const titles = [...summary.titleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title]) => title)
      summaries.set(year, { months: summary.months, titles, durationMinutes: summary.durationMinutes, durationCount: summary.durationCount })
    }
    return summaries
  }, [filterOnly])

  const monthSummaries = useMemo(() => {
    const accumulators = new Map<number, { count: number; titleStats: Map<string, { count: number; minutes: number }>; durationMinutes: number; durationCount: number }>()
    for (const entry of filterOnly) {
      if (Number(entry.date.slice(0, 4)) !== activeYear) continue
      const month = Number(entry.date.slice(5, 7))
      const summary = accumulators.get(month) ?? { count: 0, titleStats: new Map<string, { count: number; minutes: number }>(), durationMinutes: 0, durationCount: 0 }
      summary.count++
      const stat = summary.titleStats.get(entry.title) ?? { count: 0, minutes: 0 }
      stat.count++
      if (entry.duration_min) stat.minutes += entry.duration_min
      summary.titleStats.set(entry.title, stat)
      if (entry.duration_min) {
        summary.durationMinutes += entry.duration_min
        summary.durationCount++
      }
      accumulators.set(month, summary)
    }
    const summaries = new Map<number, MonthSummary>()
    for (const [month, summary] of accumulators) {
      // 排到前面的是时长占大头的那几条，不是出现次数最多的——这份榜单最终要驱动构成条，两者得是同一个口径。
      const titles = [...summary.titleStats.entries()]
        .sort((a, b) => b[1].minutes - a[1].minutes || b[1].count - a[1].count)
        .slice(0, 3)
        .map(([title, stat]) => ({ title, minutes: stat.minutes }))
      summaries.set(month, { count: summary.count, titles, durationMinutes: summary.durationMinutes, durationCount: summary.durationCount })
    }
    return summaries
  }, [activeYear, filterOnly])

  const dirtyCount = filters.platforms.length + filters.types.length + filters.games.length + Number(filters.onlyAlive)
  const searchLimit = 300
  // 默认新→旧（档案的习惯读法）；想按时间顺序读完一段的人可以翻过来。
  const ordered = useMemo(() => {
    const list = [...visible]
    list.sort((a, b) => (order === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
    return list
  }, [order, visible])
  const rendered = searching ? ordered.slice(0, searchLimit) : ordered
  const allExpanded = rendered.length > 0 && rendered.every((entry) => expanded.has(entry.id))
  const toggleEntry = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement !== searchRef.current) {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') {
        searchRef.current?.blur()
        setSheetOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!sheetOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [sheetOpen])

  return (
    <>
      <header className="ui-slide-down sticky top-0 z-30 border-b border-line bg-base/95 backdrop-blur">
        <div className="site-header-container flex flex-wrap items-center gap-2 px-page py-3 sm:flex-nowrap sm:gap-3">
          <SiteNav active="archive" />
          {/* 手机端 SearchField 已经塌成一个 44px 圆形图标——原本的 order-3 w-full
              会让 sticky header 白白多出一整行，行里只有那一个小圆圈。 */}
          <div className="w-auto sm:ml-auto sm:w-full sm:max-w-[360px]">
            <SearchField
              value={filters.q}
              onChange={(v) => set({ q: v })}
              placeholder={`搜索全部 ${entries.length.toLocaleString()} 条记录`}
              ariaLabel="搜索全部记录"
              kbd="/"
              inputRef={searchRef}
              inputClassName="w-full rounded-md border border-line bg-surface py-2.5 pl-3 pr-9 text-control text-ink shadow-transparent transition-[border-color,box-shadow,background-color] duration-300 placeholder:text-faint hover:bg-raised/70 focus:border-live focus:bg-raised/70 focus:shadow-[0_0_0_3px_rgba(91,200,232,0.1)] focus:outline-none sm:py-2"
            />
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="ui-press relative flex h-11 shrink-0 items-center rounded-md border border-line bg-surface px-3 text-meta text-muted hover:border-live/60 hover:text-ink hover:shadow-[0_8px_25px_rgba(91,200,232,0.08)] sm:h-auto sm:py-2"
          >
            筛选{dirtyCount > 0 && <span className="ml-1.5 tnum text-live">{dirtyCount}</span>}
          </button>
        </div>
      </header>

      <main className="ui-page-in site-container-wide px-page pb-16">
        <section className="ui-reveal pb-8 pt-4 sm:py-10">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              {/* 面包屑（含回编年史入口）与年份跨度同属一行眉标。 */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {extra}
                {/* 分隔点只在同一行时才有意义；手机端年份跨度换到下一行，点跟着一起收起来。 */}
                {extra && <span aria-hidden className="hidden text-meta text-faint/50 sm:inline">·</span>}
                <p className="w-full text-meta uppercase tracking-[0.16em] text-live tnum sm:w-auto">2010 — {latestYear}</p>
              </div>
              <h1 className="measure-hero mt-2 text-h1 font-semibold">从记得的内容，找到那段时间。</h1>
              <p className="measure-body mt-3 text-body text-muted">
                每个年份和月份都列出真实标题作为线索，不需要先记住准确日期；知道关键词时，也可以直接搜索全部公开记录。
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-x-3 text-meta uppercase tracking-[0.16em] text-faint tnum sm:flex sm:gap-6">
              <Stat label="条目" value={entries.length.toLocaleString()} />
              <Stat label="已录时长" value={durationStats.hours.toLocaleString()} unit="小时" />
              <Stat label="时长覆盖" value={`${durationStats.coverage}%`} />
            </dl>
          </div>

          {isDemo && (
            <p className="mt-5 rounded border border-video/40 bg-video/5 px-3 py-2 text-meta text-video">
              当前展示演示数据，不是真实记录。
            </p>
          )}
        </section>

        <section aria-label="时间定位" className="ui-reveal ui-delay-1 rounded-xl border border-line bg-surface/45 p-3 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {ERAS.map((era) => {
              const active = era.id === activeEra.id && !searching
              const count = entries.filter((entry) => {
                const year = Number(entry.date.slice(0, 4))
                return year >= era.from && year <= era.to
              }).length
              return (
                <button
                  key={era.id}
                  onClick={() => selectEra(era)}
                  aria-pressed={active}
                  className={`ui-card ui-press flex min-w-0 items-center justify-between rounded-lg border px-4 py-3 text-left ${active ? 'bg-raised text-ink shadow-[0_10px_35px_rgba(0,0,0,0.14)]' : 'border-line bg-base/30 text-muted hover:bg-raised/60'}`}
                  style={{ borderColor: active ? era.color : undefined }}
                >
                  <span className="min-w-0">
                    <span className="block text-control font-medium">{era.label}</span>
                    <span className="mt-0.5 block font-mono text-meta text-faint tnum">{era.detail}</span>
                  </span>
                  {/* 条数是这张卡真正的数据，之前和「2010—2015」一样是 11px 灰字，读起来一片平。 */}
                  <span
                    className="shrink-0 font-mono text-[1.375rem] font-bold leading-none tnum"
                    style={{ color: active ? era.color : undefined, opacity: active ? 1 : 0.75 }}
                  >
                    {count.toLocaleString()}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-meta uppercase tracking-[0.16em] text-faint">年度线索</h2>
              <span className="text-meta text-faint">{searching ? '正在搜索全部年份' : `${activeEra.label} · 选一年看看`}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {activeEraYears.map((year) => {
                const active = year === activeYear && !searching
                const summary = yearSummaries.get(year)
                const count = yearCounts.get(year) ?? 0
                return (
                  <a
                    key={year}
                    href={hrefFor(year, null)}
                    onClick={(event) => {
                      event.preventDefault()
                      selectYear(year)
                    }}
                    aria-current={active ? 'true' : undefined}
                    className={`ui-card ui-press flex min-h-[116px] min-w-0 flex-col rounded-lg border p-3 text-left ${active ? 'bg-raised/70' : 'border-line bg-base/40 hover:border-muted hover:bg-raised/50'}`}
                    style={active ? { borderColor: activeEra.color, boxShadow: `0 12px 36px ${activeEra.color}14` } : undefined}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-xl font-bold tnum" style={{ color: active ? activeEra.color : undefined }}>{year}</span>
                      {/* 条数与月份跨度都是这张卡的数据，不是装饰性小字——两个数字都提到 ink，只有连接词留灰。 */}
                      <span className="shrink-0 text-meta text-faint tnum">
                        <span className="font-mono text-[0.9375rem] font-semibold text-ink">{count.toLocaleString()}</span> 条 ·{' '}
                        <span className="font-mono text-[0.9375rem] font-semibold text-ink">{summary?.months.size ?? 0}</span> 个月
                      </span>
                    </span>
                    {summary && (
                      <span className="mt-1 block text-meta text-faint tnum">
                        {summary.durationCount > 0 ? (
                          <>
                            已录{' '}
                            <span className="font-mono text-control font-semibold text-ink">
                              {Math.round(summary.durationMinutes / 60).toLocaleString()}
                            </span>{' '}
                            小时
                          </>
                        ) : '时长待补'}
                      </span>
                    )}
                    <span className="mt-2 block space-y-1">
                      {summary?.titles.slice(0, 2).map((title) => (
                        <span key={title} className="block truncate text-meta leading-snug text-muted">{title}</span>
                      ))}
                      {!summary?.titles.length && <span className="block text-meta text-faint">暂无符合条件的内容</span>}
                    </span>
                  </a>
                )
              })}
            </div>
          </div>
        </section>

        <section className="ui-reveal ui-delay-2 mt-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="text-meta uppercase tracking-[0.16em] tnum" style={{ color: activeEra.color }}>
                {searching ? '全库搜索结果' : `${activeEra.label} / ${activeYear}`}
              </p>
              <h2 className="mt-1 text-[1.375rem] font-semibold tracking-tight">
                {searching ? `“${filters.q.trim()}”` : `${activeYear} 全年`}
              </h2>
            </div>
            <div className="flex items-center gap-3 text-meta text-faint tnum">
              {/* 这一行始终是「这一年（或这次搜索）总共多少条」，不随展开的月份变。 */}
              <span>
                <span className="font-mono text-[1.125rem] font-semibold text-ink">
                  {(searching ? visible.length : yearCounts.get(activeYear) ?? 0).toLocaleString()}
                </span>{' '}
                条
              </span>
              {(filters.platforms.length > 0 || filters.types.length > 0 || filters.games.length > 0 || filters.onlyAlive) && (
                <button onClick={() => set(EMPTY_FILTERS)} className="py-2 text-live underline underline-offset-4 sm:py-0">清除筛选</button>
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-20 text-center">
              <p className="text-body text-muted">这里暂时没有符合条件的条目。</p>
              <button onClick={() => set(EMPTY_FILTERS)} className="mt-3 text-meta text-live underline underline-offset-4">清除搜索与筛选</button>
            </div>
          ) : (
            <>
              {/* 月度年表常驻：展开某个月时它不再消失，而是留在上面继续当索引用。 */}
              {!searching && (
                <MonthArchive
                  summaries={monthSummaries}
                  selected={activeMonth}
                  onSelect={selectMonthAndScroll}
                  hrefFor={(month) => hrefFor(activeYear, month)}
                  color={activeEra.color}
                />
              )}

              {(searching || activeMonth !== null) && (
                <div ref={listRef} className={searching ? '' : 'mt-10 scroll-mt-24 border-t border-line pt-6'}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <h3 className="text-h3 font-semibold tracking-tight text-ink">
                      {searching ? '搜索结果' : `${activeYear} 年 ${MONTH_CN[activeMonth! - 1]}`}
                      <span className="ml-3 text-meta font-normal text-faint tnum">
                        <span className="font-mono text-[0.9375rem] font-semibold text-ink">{visible.length.toLocaleString()}</span> 条
                      </span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 排序：图标即状态，不再写「日期 新 → 旧」这行字——按钮本身够小够勤，不需要一直挂着文案。 */}
                      <button
                        type="button"
                        onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
                        aria-label={order === 'desc' ? '当前新到旧，点击切换为旧到新' : '当前旧到新，点击切换为新到旧'}
                        title={order === 'desc' ? '日期：新 → 旧' : '日期：旧 → 新'}
                        className="ui-press flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-muted hover:text-ink"
                      >
                        <span aria-hidden className="font-mono text-[0.9375rem]">{order === 'desc' ? '↓' : '↑'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpanded(allExpanded ? new Set() : new Set(rendered.map((entry) => entry.id)))}
                        aria-expanded={allExpanded}
                        className={`ui-press rounded-full border px-4 py-2 text-meta transition-colors sm:px-3 sm:py-1.5 ${
                          allExpanded
                            ? 'border-line text-muted hover:border-muted hover:text-ink'
                            : 'border-live/50 bg-live/5 text-live hover:border-live hover:bg-live/10'
                        }`}
                      >
                        {allExpanded ? '全部折叠' : '全部展开'}
                      </button>
                    </div>
                  </div>

                  <div
                    key={searching ? 'search-results' : `${activeYear}-${activeMonth}`}
                    className={`ui-content-swap divide-y divide-line/50 ${searching ? '' : 'ui-stagger'}`}
                  >
                    {rendered.map((entry, index) => {
                      const year = entry.date.slice(0, 4)
                      const previousYear = rendered[index - 1]?.date.slice(0, 4)
                      return (
                        <div key={entry.id}>
                          {searching && year !== previousYear && (
                            <h4 className="border-b border-line bg-surface/35 px-3 py-2 text-meta tracking-[0.14em] text-live tnum">
                              {year} 年
                            </h4>
                          )}
                          <EntryRow
                            entry={entry}
                            expanded={expanded.has(entry.id)}
                            onToggle={() => toggleEntry(entry.id)}
                          />
                        </div>
                      )
                    })}
                    {searching && visible.length > searchLimit && (
                      <p className="py-6 text-center text-meta text-faint tnum">仅显示前 {searchLimit} 条，请增加关键词继续缩小范围。</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {sheetOpen && (
        <div className="fixed inset-0 z-50">
          <button aria-label="关闭筛选" onClick={() => setSheetOpen(false)} className="ui-backdrop-in absolute inset-0 bg-base/80 backdrop-blur-sm" />
          <div className="ui-sheet-in absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-xl border-t border-line bg-surface p-5 shadow-[0_-20px_70px_rgba(0,0,0,0.3)] sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-16 sm:w-[360px] sm:origin-top-right sm:rounded-xl sm:border sm:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="mb-5 flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-medium text-ink">筛选记录</h3>
                <p className="mt-0.5 text-meta text-faint">搜索词会跨全部年份生效</p>
              </div>
              <button onClick={() => setSheetOpen(false)} className="ui-press rounded px-2 py-2 text-meta text-live hover:bg-live/10 sm:py-1">完成</button>
            </div>
            <FilterRail filters={filters} set={set} platformCounts={platformCounts} gameCounts={gameCounts} total={entries.length} matched={filtered.length} />
          </div>
        </div>
      )}
    </>
  )
}

/**
 * 月度年表。这里一屏能出现十二张卡、上百个数字——
 * 所以只让「条数」一个量级跳出来：数字用等宽大字，卡底一条按当年最高月归一化的条数条（时期色），
 * 线索标题继续压在 muted，空月份直接退成虚线格子，不再是一张同款卡片降透明度。
 */
/**
 * 月度年表。这里一屏能出现十二张卡、上百个数字——
 * 条数继续是等宽大字（最高的那个月染时期色）；原本卡底那条纯装饰的分隔线，
 * 换成了「这个月都在录什么」的构成条：按时长占比分段上色，段色和下面每条标题前的圆点对应。
 * 构成条固定卡在表头正下方，不再挂在卡片底部——内容行数不一样长的卡片，条也永远对得齐。
 */
function MonthArchive({
  summaries,
  selected,
  onSelect,
  hrefFor,
  color,
}: {
  summaries: Map<number, MonthSummary>
  /** 当前展开的月份；这张表不会因为展开而消失，选中的那一格会亮起来。 */
  selected: number | null
  onSelect: (month: number | null) => void
  hrefFor: (month: number) => string
  color: string
}) {
  const peak = Math.max(1, ...[...summaries.values()].map((summary) => summary.count))
  return (
    <div>
      <p className="measure-body mb-4 text-body text-muted">
        选一个月，看看那段时间都在播什么。
      </p>
      <div className="ui-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
          const summary = summaries.get(month)
          if (!summary) {
            // 空月份不再是「一张一样的卡，只是淡一点」：抽掉卡面，让有记录的月份自己浮出来。
            return (
              <div
                key={month}
                className="flex min-h-[148px] min-w-0 flex-col rounded-xl border border-dashed border-line/60 p-4"
              >
                <span className="text-[0.9375rem] font-medium text-faint">{MONTH_CN[month - 1]}</span>
                <span className="mt-3 block text-meta text-faint/70">没有记录</span>
              </div>
            )
          }
          const isPeak = summary.count === peak
          const isSelected = selected === month
          const segments = buildTitleSegments(summary)
          return (
            <a
              key={month}
              href={hrefFor(month)}
              aria-current={isSelected ? 'true' : undefined}
              onClick={(event) => {
                event.preventDefault()
                // 再点一次当前月份＝收起，回到只有年表的状态。
                onSelect(isSelected ? null : month)
              }}
              className={`ui-card ui-press flex min-h-[148px] min-w-0 flex-col rounded-xl border p-4 text-left transition-colors ${
                isSelected ? 'bg-raised/70' : 'border-line bg-surface/45 hover:border-muted hover:bg-raised/70'
              }`}
              style={isSelected ? { borderColor: color, boxShadow: `0 12px 36px ${color}14` } : undefined}
            >
              <span className="flex items-baseline justify-between gap-2 pb-2">
                <span className="text-[0.9375rem] font-medium text-ink" style={isSelected ? { color } : undefined}>{MONTH_CN[month - 1]}</span>
                {/* 条数是这一格唯一要被一眼读到的数据：等宽大字，最高的那个月直接染成时期色。 */}
                <span className="shrink-0 text-meta text-faint tnum">
                  <span
                    className="font-mono text-[1.25rem] font-bold leading-none text-ink"
                    style={isPeak ? { color } : undefined}
                  >
                    {summary.count}
                  </span>{' '}
                  条
                </span>
              </span>
              <span aria-hidden className="flex h-[5px] w-full overflow-hidden rounded-full bg-line/50">
                {segments.length > 0 ? (
                  segments.map((segment) => (
                    <span key={segment.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${segment.pct}%`, background: segment.color }} />
                  ))
                ) : (
                  <span className="h-full w-full" />
                )}
              </span>
              <span className="mt-3 block space-y-1.5">
                <span className="block text-meta text-faint tnum">
                  {summary.durationCount > 0 ? (
                    <>
                      已录{' '}
                      <span className="font-mono text-control font-semibold text-ink">
                        {Math.round(summary.durationMinutes / 60).toLocaleString()}
                      </span>{' '}
                      小时 · {summary.durationCount}/{summary.count} 条有时长
                    </>
                  ) : '时长待补'}
                </span>
                {summary.titles.map((title, index) => (
                  <span key={title.title} className="flex items-center gap-1.5 text-meta leading-snug text-muted">
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: segments[index]?.color ?? OTHER_SEGMENT_COLOR }} />
                    <span className="min-w-0 flex-1 truncate">{title.title}</span>
                    {title.minutes > 0 && <span className="shrink-0 text-faint tnum">{formatHoursTag(title.minutes)}</span>}
                  </span>
                ))}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 页头三个总量：数值是主角，标签退成眉标——和数据页 / 首页的 Stat 同一套读法。
 * 单位（小时）单独拆出来：跟数值挤在同一串字符里，手机端 305px 的三栏会把「10,842 小时」折成两行。
 */
function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta uppercase tracking-[0.16em] text-faint">{label}</dt>
      <dd className="mt-1.5 whitespace-nowrap font-mono text-[1.0625rem] font-bold tracking-normal text-ink tnum sm:text-[1.375rem]">
        {value}
        {unit && <span className="ml-1 font-sans text-meta font-normal text-faint">{unit}</span>}
      </dd>
    </div>
  )
}