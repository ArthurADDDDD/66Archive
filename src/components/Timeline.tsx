'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { MONTH_CN } from '@/lib/ui'
import { PLATFORM_META } from '@/lib/platforms'
import type { Platform } from '@/lib/schema'
import { EntryRow } from './EntryRow'
import { Preview } from './Preview'
import { EMPTY_FILTERS, FilterRail, type Filters } from './FilterRail'

type Era = {
  id: string
  label: string
  detail: string
  from: number
  to: number
  color: string
}

const ERAS: Era[] = [
  { id: 'video', label: '视频时期', detail: '2010—2015', from: 2010, to: 2015, color: '#E0A244' },
  { id: 'douyu', label: '斗鱼时期', detail: '2016—2023', from: 2016, to: 2023, color: '#5BC8E8' },
  { id: 'douyin', label: '抖音时期', detail: '2024—至今', from: 2024, to: 9999, color: '#FF6B75' },
]

export function Timeline({ entries, isDemo }: { entries: TimelineEntry[]; isDemo: boolean }) {
  const years = useMemo(
    () => [...new Set(entries.map((entry) => Number(entry.date.slice(0, 4))))].sort((a, b) => b - a),
    [entries],
  )
  const latestYear = years[0] ?? new Date().getFullYear()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [activeYear, setActiveYear] = useState(latestYear)
  const [activeMonth, setActiveMonth] = useState<number | null>(null)
  const [hovered, setHovered] = useState<TimelineEntry | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const monthsForYear = useCallback(
    (year: number) =>
      [...new Set(entries.filter((entry) => Number(entry.date.slice(0, 4)) === year).map((entry) => Number(entry.date.slice(5, 7))))].sort(
        (a, b) => b - a,
      ),
    [entries],
  )

  // 首次进入时恢复分享链接；没有参数时定位到最新一个有记录的月份。
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const requestedYear = Number(p.get('y'))
    const initialYear = years.includes(requestedYear) ? requestedYear : latestYear
    const requestedMonth = Number(p.get('m'))
    const availableMonths = monthsForYear(initialYear)
    setActiveYear(initialYear)
    setActiveMonth(availableMonths.includes(requestedMonth) ? requestedMonth : (availableMonths[0] ?? null))
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

  const set = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      writeUrl(next, activeYear, activeMonth)
      return next
    })
  }, [activeMonth, activeYear, writeUrl])

  const selectYear = useCallback((year: number) => {
    const month = monthsForYear(year)[0] ?? null
    const nextFilters = filters.q ? { ...filters, q: '' } : filters
    setActiveYear(year)
    setActiveMonth(month)
    setFilters(nextFilters)
    setExpanded(null)
    setHovered(null)
    writeUrl(nextFilters, year, month)
  }, [filters, monthsForYear, writeUrl])

  const selectMonth = useCallback((month: number | null) => {
    setActiveMonth(month)
    setExpanded(null)
    setHovered(null)
    writeUrl(filters, activeYear, month)
  }, [activeYear, filters, writeUrl])

  const selectEra = useCallback((era: Era) => {
    const candidates = years.filter((year) => year >= era.from && year <= era.to)
    if (candidates[0] !== undefined) selectYear(candidates[0])
  }, [selectYear, years])

  const matchesFilters = useCallback((entry: TimelineEntry, includeSearch = true) => {
    if (filters.types.length && !filters.types.includes(entry.type)) return false
    if (filters.platforms.length && !filters.platforms.includes(entry.platform)) return false
    if (filters.games.length && !entry.games.some((game) => filters.games.includes(game.id))) return false
    if (filters.onlyAlive && entry.sourceCount > 0 && entry.aliveCount === 0) return false
    const q = filters.q.trim().toLowerCase()
    if (includeSearch && q) {
      const haystack = `${entry.title} ${entry.games.map((game) => game.name).join(' ')} ${entry.tags.join(' ')} ${entry.seriesName ?? ''}`
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

  const monthCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const entry of filterOnly) {
      if (Number(entry.date.slice(0, 4)) !== activeYear) continue
      const month = Number(entry.date.slice(5, 7))
      counts.set(month, (counts.get(month) ?? 0) + 1)
    }
    return counts
  }, [activeYear, filterOnly])

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

  const activeEra = ERAS.find((era) => activeYear >= era.from && activeYear <= era.to) ?? ERAS[0]
  const dirtyCount = filters.platforms.length + filters.types.length + filters.games.length + Number(filters.onlyAlive)
  const searchLimit = 300
  const rendered = searching ? visible.slice(0, searchLimit) : visible

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

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-base/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="shrink-0 font-mono text-[13px] font-semibold tracking-tight text-ink">六六编年史</a>
          <span className="hidden h-4 w-px bg-line sm:block" />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-faint sm:block">公开作品索引</span>
          <div className="relative ml-auto w-full max-w-[360px]">
            <input
              ref={searchRef}
              value={filters.q}
              onChange={(event) => set({ q: event.target.value })}
              placeholder={`搜索全部 ${entries.length.toLocaleString()} 条记录`}
              aria-label="搜索全部记录"
              className="w-full rounded-md border border-line bg-surface py-2 pl-3 pr-9 text-[12px] text-ink placeholder:text-faint focus:border-live focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-faint">/</kbd>
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="relative shrink-0 rounded-md border border-line bg-surface px-3 py-2 font-mono text-[11px] text-muted hover:border-live/60 hover:text-ink"
          >
            筛选{dirtyCount > 0 && <span className="ml-1.5 text-live">{dirtyCount}</span>}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6">
        <section className="py-8 sm:py-10">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-live">2010 — {latestYear}</p>
              <h1 className="mt-2 max-w-2xl text-[27px] font-semibold leading-tight tracking-tight sm:text-[36px]">
                先找到一年，再打开那个月。
              </h1>
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted">
                不用从一条十六年的长轴里翻找。按时期、年份和月份逐层定位；搜索会直接检索全部公开记录。
              </p>
            </div>
            <dl className="flex gap-6 font-mono text-[10px] uppercase tracking-[0.16em] text-faint tnum">
              <Stat label="条目" value={entries.length.toLocaleString()} />
              <Stat label="年份" value={years.length.toString()} />
              <Stat label="已关联游戏" value={gameCounts.length.toString()} />
            </dl>
          </div>

          {isDemo && (
            <p className="mt-5 rounded border border-video/40 bg-video/5 px-3 py-2 font-mono text-[11px] text-video">
              当前展示演示数据，不是真实记录。
            </p>
          )}
        </section>

        <section aria-label="时间定位" className="rounded-xl border border-line bg-surface/45 p-3 sm:p-5">
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
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${active ? 'bg-raised text-ink' : 'border-line bg-base/30 text-muted hover:bg-raised/60'}`}
                  style={{ borderColor: active ? era.color : undefined }}
                >
                  <span>
                    <span className="block text-[13px] font-medium">{era.label}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-faint">{era.detail}</span>
                  </span>
                  <span className="font-mono text-[11px] text-faint tnum">{count.toLocaleString()}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">年份</h2>
              <span className="font-mono text-[10px] text-faint">{searching ? '正在搜索全部年份' : `${activeYear} 年 · ${(yearCounts.get(activeYear) ?? 0).toLocaleString()} 条`}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-9 xl:grid-cols-[repeat(17,minmax(0,1fr))]">
              {[...years].reverse().map((year) => {
                const active = year === activeYear && !searching
                return (
                  <button
                    key={year}
                    onClick={() => selectYear(year)}
                    aria-pressed={active}
                    className={`rounded-md border px-2 py-2 font-mono text-[11px] transition-colors tnum ${active ? 'border-live bg-live/10 text-live' : 'border-line bg-base/40 text-muted hover:border-muted hover:text-ink'}`}
                  >
                    <span className="block">{year}</span>
                    <span className="mt-0.5 block text-[9px] text-faint">{yearCounts.get(year) ?? 0}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {!searching && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">月份</h2>
                <span className="font-mono text-[10px] text-faint">默认只展开一个月，避免长滚动</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 lg:grid-cols-13">
                <MonthButton label="全年" count={[...monthCounts.values()].reduce((sum, count) => sum + count, 0)} active={activeMonth === null} onClick={() => selectMonth(null)} />
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <MonthButton key={month} label={MONTH_CN[month - 1]} count={monthCounts.get(month) ?? 0} active={activeMonth === month} onClick={() => selectMonth(month)} />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{searching ? '全库搜索结果' : `${activeEra.label} / ${activeYear}`}</p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight">
                {searching ? `“${filters.q.trim()}”` : activeMonth === null ? `${activeYear} 全年` : `${activeYear} 年 ${MONTH_CN[activeMonth - 1]}`}
              </h2>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-faint tnum">
              <span>{visible.length.toLocaleString()} 条</span>
              {(filters.platforms.length > 0 || filters.types.length > 0 || filters.games.length > 0 || filters.onlyAlive) && (
                <button onClick={() => set(EMPTY_FILTERS)} className="text-live underline underline-offset-4">清除筛选</button>
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-20 text-center">
              <p className="text-[14px] text-muted">这里暂时没有符合条件的条目。</p>
              <button onClick={() => set(EMPTY_FILTERS)} className="mt-3 font-mono text-[11px] text-live underline underline-offset-4">清除搜索与筛选</button>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" onMouseLeave={() => setHovered(null)}>
              <div className="min-w-0 divide-y divide-line/50">
                {rendered.map((entry, index) => {
                  const year = entry.date.slice(0, 4)
                  const previousYear = rendered[index - 1]?.date.slice(0, 4)
                  return (
                    <div key={entry.id}>
                      {searching && year !== previousYear && (
                        <h3 className="border-b border-line bg-surface/35 px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-live tnum">
                          {year} 年
                        </h3>
                      )}
                      <EntryRow
                        entry={entry}
                        expanded={expanded === entry.id}
                        onHover={(value) => setHovered(value)}
                        onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
                      />
                    </div>
                  )
                })}
                {searching && visible.length > searchLimit && (
                  <p className="py-6 text-center font-mono text-[11px] text-faint">仅显示前 {searchLimit} 条，请增加关键词继续缩小范围。</p>
                )}
              </div>
              <aside className="sticky top-[76px] hidden h-fit lg:block">
                <Preview entry={hovered} />
              </aside>
            </div>
          )}
        </section>
      </main>

      {sheetOpen && (
        <div className="fixed inset-0 z-50">
          <button aria-label="关闭筛选" onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-base/80 backdrop-blur-sm" />
          <div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-xl border-t border-line bg-surface p-5 sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-16 sm:w-[360px] sm:rounded-xl sm:border">
            <div className="mb-5 flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-[14px] font-medium text-ink">筛选记录</h3>
                <p className="mt-0.5 font-mono text-[10px] text-faint">搜索词会跨全部年份生效</p>
              </div>
              <button onClick={() => setSheetOpen(false)} className="font-mono text-[11px] text-live">完成</button>
            </div>
            <FilterRail filters={filters} set={set} platformCounts={platformCounts} gameCounts={gameCounts} total={entries.length} matched={filtered.length} />
          </div>
        </div>
      )}
    </>
  )
}

function MonthButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      disabled={count === 0}
      className={`rounded-md border px-1.5 py-2 font-mono text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${active ? 'border-live bg-live/10 text-live' : 'border-line bg-base/40 text-muted hover:border-muted hover:text-ink'}`}
    >
      <span className="block">{label}</span>
      <span className="mt-0.5 block text-[9px] text-faint tnum">{count}</span>
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="mt-1 text-[13px] tracking-normal text-ink">{value}</dd>
    </div>
  )
}
