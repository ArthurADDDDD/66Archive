'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { deriveEraBoundary, MONTH_CN } from '@/lib/ui'
import { EntryRow } from './EntryRow'
import { EraStrip } from './EraStrip'
import { Preview } from './Preview'
import { EMPTY_FILTERS, FilterRail, type Filters } from './FilterRail'

export function Timeline({ entries, isDemo }: { entries: TimelineEntry[]; isDemo: boolean }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [hovered, setHovered] = useState<TimelineEntry | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeYear, setActiveYear] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const yearRefs = useRef(new Map<number, HTMLElement>())

  const boundary = useMemo(() => deriveEraBoundary(entries), [entries])

  // 筛选状态写进 URL，链接可分享、可回退
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setFilters({
      q: p.get('q') ?? '',
      platforms: p.get('p')?.split(',').filter(Boolean) ?? [],
      types: p.get('t')?.split(',').filter(Boolean) ?? [],
      games: p.get('g')?.split(',').filter(Boolean) ?? [],
      onlyAlive: p.get('alive') === '1',
    })
  }, [])

  const set = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      const p = new URLSearchParams()
      if (next.q) p.set('q', next.q)
      if (next.platforms.length) p.set('p', next.platforms.join(','))
      if (next.types.length) p.set('t', next.types.join(','))
      if (next.games.length) p.set('g', next.games.join(','))
      if (next.onlyAlive) p.set('alive', '1')
      const qs = p.toString()
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
      return next
    })
  }, [])

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return entries.filter((e) => {
      if (filters.types.length && !filters.types.includes(e.type)) return false
      if (filters.platforms.length && !filters.platforms.includes(e.platform)) return false
      if (filters.games.length && !e.games.some((g) => filters.games.includes(g.id))) return false
      if (filters.onlyAlive && e.sourceCount > 0 && e.aliveCount === 0) return false
      if (q) {
        const hay = `${e.title} ${e.games.map((g) => g.name).join(' ')} ${e.tags.join(' ')} ${e.seriesName ?? ''}`
        if (!hay.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [entries, filters])

  const platformCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) m.set(e.platform, (m.get(e.platform) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [entries])

  const gameCounts = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>()
    for (const e of entries) {
      for (const g of e.games) {
        const cur = m.get(g.id) ?? { ...g, count: 0 }
        cur.count++
        m.set(g.id, cur)
      }
    }
    return [...m.values()].sort((a, b) => b.count - a.count)
  }, [entries])

  // 按年 → 月分组
  const groups = useMemo(() => {
    const byYear = new Map<number, Map<number, TimelineEntry[]>>()
    for (const e of filtered) {
      const y = Number(e.date.slice(0, 4))
      const mo = Number(e.date.slice(5, 7))
      if (!byYear.has(y)) byYear.set(y, new Map())
      const months = byYear.get(y)!
      if (!months.has(mo)) months.set(mo, [])
      months.get(mo)!.push(e)
    }
    return [...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => ({
        year,
        months: [...months.entries()].sort((a, b) => b[0] - a[0]).map(([month, items]) => ({ month, items })),
        count: [...months.values()].reduce((n, v) => n + v.length, 0),
      }))
  }, [filtered])

  // "0 小时"会被读成事实（他一小时都没播），但真相是没人录入过——
  // 必须把"未知"和"零"分开显示，否则是在编造数据。
  const durationStats = useMemo(() => {
    const known = filtered.filter((e) => e.duration_min)
    const hours = Math.round(known.reduce((n, e) => n + (e.duration_min ?? 0), 0) / 60)
    return { known: known.length, hours }
  }, [filtered])

  const jump = useCallback((year: number) => {
    yearRefs.current.get(year)?.scrollIntoView({ block: 'start' })
  }, [])

  // 滚动时同步高亮当前年份
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => {
        const visible = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveYear(Number((visible[0].target as HTMLElement).dataset.year))
      },
      { rootMargin: '-96px 0px -70% 0px' },
    )
    yearRefs.current.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [groups])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        searchRef.current?.blur()
        setSheetOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* 顶部：品牌 + 搜索 + 压缩后的年份条 */}
      <header className="sticky top-0 z-30 border-b border-line bg-base">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-2.5 sm:px-6">
          <a href="/" className="shrink-0 font-mono text-[13px] font-semibold tracking-tight text-ink">
            六六编年史
          </a>
          <div className="hidden min-w-0 flex-1 md:block">
            <EraStrip entries={entries} boundary={boundary} compact activeYear={activeYear} onJump={jump} />
          </div>
          <div className="relative ml-auto w-full max-w-[220px]">
            <input
              ref={searchRef}
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="搜索标题、游戏、标签"
              aria-label="搜索"
              className="w-full rounded border border-line bg-surface py-1.5 pl-2.5 pr-7 text-[12px] text-ink placeholder:text-faint focus:border-live focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-faint">
              /
            </kbd>
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="shrink-0 rounded border border-line px-2 py-1.5 font-mono text-[11px] text-muted lg:hidden"
          >
            筛选
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-6">
        {/* 开场：十六年的形状 */}
        <section className="border-b border-line py-10 sm:py-14">
          <h1 className="max-w-2xl text-[26px] font-semibold leading-tight tracking-tight sm:text-[34px]">
            他从 2010 年开始发视频，一直播到现在。
            <br />
            <span className="text-muted">这里是每一次的索引。</span>
          </h1>
          <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-muted">
            不搬运任何资源，只收集公开链接——每一次播放都回到原平台、原 UP 主。
            竖条的高度是那场直播的真实时长，条内的颜色是当时在打的游戏。
          </p>

          <div className="mt-8">
            <EraStrip entries={entries} boundary={boundary} activeYear={activeYear} onJump={jump} />
          </div>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] text-faint tnum">
            <Stat label="条目" value={filtered.length.toString()} />
            <Stat
              label="累计时长"
              value={
                durationStats.known === 0
                  ? '尚未录入'
                  : `${durationStats.hours.toLocaleString()} 小时`
              }
              hint={
                durationStats.known > 0 && durationStats.known < filtered.length
                  ? `仅 ${durationStats.known} / ${filtered.length} 条有时长数据`
                  : undefined
              }
            />
            <Stat label="游戏" value={gameCounts.length.toString()} />
            <Stat
              label="时期分界"
              value={boundary ? `${boundary} 年（由数据推导，待考证）` : '待考证'}
            />
          </dl>

          {isDemo && (
            <p className="mt-6 rounded border border-video/40 bg-video/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-video">
              当前展示的是演示数据，用于验证界面与数据结构，不是真实记录。
              真实条目进入 <code>data/entries/</code> 后会自动替换。
            </p>
          )}
        </section>

        <div className="flex gap-8">
          {/* 筛选栏 */}
          <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-[200px] shrink-0 overflow-y-auto py-6 lg:block">
            <FilterRail
              filters={filters}
              set={set}
              platformCounts={platformCounts}
              gameCounts={gameCounts}
              total={entries.length}
              matched={filtered.length}
            />
          </aside>

          {/* 时间轴 */}
          <div className="min-w-0 flex-1 py-6" onMouseLeave={() => setHovered(null)}>
            {groups.length === 0 && (
              <div className="py-24 text-center">
                <p className="text-[14px] text-muted">这些条件下没有条目。</p>
                <button
                  onClick={() => set(EMPTY_FILTERS)}
                  className="mt-3 font-mono text-[12px] text-live underline underline-offset-4"
                >
                  清除筛选
                </button>
              </div>
            )}

            {groups.map((g, gi) => {
              const prev = groups[gi - 1]
              // 时期转折：从直播期滚入视频期的那一处
              const crossing =
                boundary !== null && prev && prev.year >= boundary && g.year < boundary
              return (
                <div key={g.year}>
                  {crossing && <EraDivider boundary={boundary!} />}
                  <section
                    id={`y${g.year}`}
                    data-year={g.year}
                    ref={(el) => {
                      if (el) yearRefs.current.set(g.year, el)
                    }}
                    className="scroll-mt-[57px]"
                  >
                    <div className="sticky top-[57px] z-10 -mx-1 flex items-baseline gap-3 bg-base px-1 py-2">
                      <h2 className="font-display text-[22px] font-extrabold leading-none tracking-tight text-ink tnum">
                        {g.year}
                      </h2>
                      <span className="font-mono text-[11px] text-faint tnum">{g.count} 条</span>
                    </div>

                    {g.months.map((m) => (
                      <div key={m.month} className="mb-4">
                        <h3 className="mb-1 pl-[60px] font-mono text-[10px] uppercase tracking-[0.18em] text-faint sm:pl-[72px]">
                          {MONTH_CN[m.month - 1]}
                        </h3>
                        {m.items.map((e) => (
                          <EntryRow
                            key={e.id}
                            entry={e}
                            expanded={expanded === e.id}
                            onHover={(en) => setHovered(en)}
                            onToggle={() => setExpanded(expanded === e.id ? null : e.id)}
                          />
                        ))}
                      </div>
                    ))}
                  </section>
                </div>
              )
            })}
          </div>

          {/* 停靠式悬停预览 */}
          <aside className="sticky top-[73px] hidden h-fit w-[320px] shrink-0 py-6 lg:block">
            <Preview entry={hovered} />
          </aside>
        </div>
      </main>

      {/* 移动端筛选抽屉 */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="关闭筛选"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-base/70 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl border-t border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-mono text-[12px] text-ink">筛选</h3>
              <button onClick={() => setSheetOpen(false)} className="font-mono text-[12px] text-live">
                完成
              </button>
            </div>
            <FilterRail
              filters={filters}
              set={set}
              platformCounts={platformCounts}
              gameCounts={gameCounts}
              total={entries.length}
              matched={filtered.length}
            />
          </div>
        </div>
      )}
    </>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="uppercase tracking-[0.18em]">{label}</dt>
      <dd className="mt-1 text-[13px] text-ink">{value}</dd>
      {hint && <dd className="mt-0.5 text-[10px] normal-case tracking-normal text-faint">{hint}</dd>}
    </div>
  )
}

/** 视频期与直播期之间的转折。分界年份由数据推导，不是考证结论。 */
function EraDivider({ boundary }: { boundary: number }) {
  return (
    <div className="my-10 border-y border-line py-6">
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em]">
        <span className="text-live">直播期</span>
        <span className="h-px flex-1 bg-gradient-to-l from-video/40 to-live/40" />
        <span className="text-video">视频期</span>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        往下是以投稿视频为主的年份。<span className="text-faint">分界（{boundary} 年）由条目数量推导得出，真实的转折点尚未考证。</span>
      </p>
    </div>
  )
}
