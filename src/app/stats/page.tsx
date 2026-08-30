import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { SiteFooter } from '@/components/primitives'
import { LivePageHeader } from '@/components/LiveSection'
import { YearBarChart } from '@/components/YearCharts'
import { YearLane, YearAxis, EraFlow } from '@/components/YearLane'
import { CoverageGaps } from '@/components/CoverageMap'
import { PopularContent } from '@/components/PopularContent'
import { StatsSection as Section } from '@/components/StatsSection'
import { buildCoverage } from '@/lib/coverage'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { getGameProfile } from '@/lib/narrative'
import { buildSeriesList } from '@/lib/series'
import { allGameIds } from '@/lib/narrative'

/**
 * 数据里的发现：每一节只回答一个问题。
 * 数据 → 观察 → 记忆：数字先行，观察一句话，最后都通向编年史 / 游戏 / 节目。
 * 图表只有纯 CSS 的条 / 点 / 时间线，不引入任何图表依赖。
 */
/** 「哪些节目坚持得最久」这一节数据意义不大，先隐藏不删——想恢复直接改回 true。 */
const SHOW_LONGEST_RUNNING_SERIES = false

export default function StatsPage() {
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)

  // —— 00 已收录直播（只统计直播条目；视频投稿不计入直播时长）——
  const liveTimeline = timeline.filter((e) => e.type === 'live')
  const liveKnownMinutes = liveTimeline.reduce((sum, e) => sum + (e.duration_min ?? 0), 0)
  const liveKnownHours = Math.round(liveKnownMinutes / 60)
  const liveDurationCoverage = liveTimeline.length ? Math.round((liveTimeline.filter((e) => e.duration_min).length / liveTimeline.length) * 100) : 0
  const publicHoursFloor = 10_000
  const publicHoursLowerBound = Math.max(publicHoursFloor, liveKnownHours)

  // —— 01 每一年 ——
  const byYear = new Map<number, { count: number; minutes: number; known: number }>()
  for (const e of timeline) {
    const y = Number(e.date.slice(0, 4))
    const row = byYear.get(y) ?? { count: 0, minutes: 0, known: 0 }
    row.count += 1
    if (e.duration_min) {
      row.minutes += e.duration_min
      row.known += 1
    }
    byYear.set(y, row)
  }
  const yearRows = [...byYear.entries()].sort((a, b) => a[0] - b[0])
  const observedYears = new Set(yearRows.map(([year]) => year))
  const firstArchiveYear = yearRows[0]?.[0] ?? new Date().getFullYear()
  const lastArchiveYear = yearRows[yearRows.length - 1]?.[0] ?? firstArchiveYear
  const emptyYears: number[] = []
  for (let year = firstArchiveYear; year <= lastArchiveYear; year++) {
    if (!observedYears.has(year)) emptyYears.push(year)
  }
  let topYear = yearRows[0]?.[0] ?? 0
  let topCount = 0
  for (const [y, r] of yearRows) if (r.count > topCount) {
    topCount = r.count
    topYear = y
  }

  // —— 02 / 03 游戏 ——
  const profiles = allGameIds(ds)
    .map((id) => getGameProfile(ds, timeline, id))
    .filter((p): p is NonNullable<typeof p> => p !== null)
  const longest = [...profiles]
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 8)
    .filter((p) => p.totalMinutes > 0)
  const maxMinutes = Math.max(1, ...longest.map((p) => p.totalMinutes))

  const revisited = profiles
    .filter((p) => p.entries.length > 0)
    .map((p) => {
      const years = [...new Set(p.entries.map((e) => e.date.slice(0, 4)))].sort()
      let gaps = 0
      for (let i = 1; i < years.length; i++) if (Number(years[i]) - Number(years[i - 1]) > 1) gaps += 1
      return { p, years, gaps }
    })
    .sort((a, b) => b.years.length - a.years.length || b.p.totalMinutes - a.p.totalMinutes)
    .slice(0, 6)

  // —— 04 时代 ——
  // 2015 是视频投稿与斗鱼直播重叠的过渡年，时代统计按条目类型/平台分，不再按年份硬切。
  const eras = [
    {
      id: 'video',
      label: '视频时期',
      years: '2010 — 2015',
      color: '#E0A244',
      from: 2010,
      entries: timeline.filter((e) => e.type === 'video'),
    },
    {
      id: 'douyu',
      label: '斗鱼时期',
      years: '2015 — 2023',
      color: '#5BC8E8',
      from: 2015,
      entries: timeline.filter((e) => e.type === 'live' && e.platform === 'douyu'),
    },
    {
      id: 'douyin',
      label: '抖音时期',
      years: '2024 — 至今',
      color: '#FF6B75',
      from: 2024,
      entries: timeline.filter((e) => e.type === 'live' && e.platform === 'douyin'),
    },
  ].map((era) => {
    const count = era.entries.length
    const minutes = era.entries.reduce((sum, entry) => sum + (entry.duration_min ?? 0), 0)
    const perYear = new Map<number, number>()
    for (const entry of era.entries) {
      const y = Number(entry.date.slice(0, 4))
      perYear.set(y, (perYear.get(y) ?? 0) + 1)
    }
    return { ...era, count, hours: Math.round(minutes / 60), perYear }
  })

  // 每一年一根柱子，柱子内部按时期分段——时代更替是这一节唯一要说清的事。
  const eraColumns = []
  for (let year = firstArchiveYear; year <= lastArchiveYear; year++) {
    eraColumns.push({
      year,
      segments: eras.map((era) => ({
        id: era.id,
        label: era.label,
        color: era.color,
        count: era.perYear.get(year) ?? 0,
      })),
    })
  }

  // —— 06 缺口 ——（全站唯一一份，联系页只留提交入口）
  const coverage = buildCoverage(timeline)

  // —— 05 节目 ——
  const series = buildSeriesList(ds, timeline)
    .map((s) => ({ ...s, span: s.count > 1 ? Number(s.lastDate.slice(0, 4)) - Number(s.firstDate.slice(0, 4)) + 1 : 1 }))
    .sort((a, b) => b.span - a.span || b.count - a.count)
  const longestSeries = series[0]
  const pishuangSeries = series.find((s) => s.id === 'xinling-pishuang')

  return (
    <main className="ui-page-in min-h-screen overflow-x-clip">
      <MobileQuickNav active="stats" />
      <BackToTop />
      <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
        <SiteNav active="stats" />
        <Link href="/archive/" className="ui-press hidden whitespace-nowrap rounded-sm text-meta text-live lg:block">
          去录播室逐条查看 →
        </Link>
      </header>

      <section className="site-container-wide px-page pb-[clamp(3rem,7vh,7rem)] pt-[clamp(2.5rem,6vh,6rem)]">
        <LivePageHeader
          pageId="stats"
          eyebrowColor="#E5568A"
          wide
        />
      </section>

      {/* 00 已收录直播与已确认时长 */}
      <Section question="已收录直播有多少？" accent="#E5568A">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line/80 bg-surface/40 p-5">
            <p className="text-meta uppercase tracking-[0.16em] text-faint">已收录直播</p>
            <p className="mt-3 font-mono text-h3 font-bold text-ink tnum">{liveTimeline.length.toLocaleString()}</p>
            <p className="mt-1 text-meta text-faint tnum">场直播</p>
          </div>
          <div className="rounded-xl border border-line/80 bg-surface/40 p-5">
            <p className="text-meta uppercase tracking-[0.16em] text-faint">已确认时长</p>
            <p className="mt-3 font-mono text-h3 font-bold text-ink tnum">{liveKnownHours.toLocaleString()}</p>
            <p className="mt-1 text-meta text-faint tnum">小时 · {liveDurationCoverage}% 的直播已有可核对时长</p>
          </div>
          <div className="rounded-xl border border-line/80 bg-surface/40 p-5">
            <p className="text-meta uppercase tracking-[0.16em] text-faint">公开口径累计时长</p>
            <p className="mt-3 font-mono text-h3 font-bold text-ink tnum">{publicHoursLowerBound.toLocaleString()}+</p>
            <p className="mt-1 text-meta text-faint tnum">小时 · 下限</p>
          </div>
        </div>
        <Observation>
          早期有一部分直播录像已经找不到了，所以「已确认时长」只代表目前能核对到的那些，不等于她实际播了多久。
          {`公开采访与平台年度统计等资料给出的累计时长下限为 ${publicHoursFloor.toLocaleString()} 小时；若站内已确认时长超过这一数值，卡片会随档案更新。`}
        </Observation>
      </Section>

      {/* 01 哪一年留下的记录最多？ */}
      <Section question="哪一年留下的记录最多？" accent="#E0A244">
        <YearBarChart rows={yearRows} topYear={topYear} />
        <Observation>
          最多的一年是 {topYear} 年，留下了 {topCount.toLocaleString()} 条记录。
          {emptyYears.length > 0
            ? ` ${emptyYears.join('、')} 年目前没有保存下来的站内录像。`
            : ' 档案覆盖到的每一年都至少留下了一条记录。'}
        </Observation>
        <p className="mt-6 text-meta text-faint tnum">已录时长最高的一年：{hoursTop(yearRows)} 小时</p>
      </Section>

      {/* 02 哪些游戏陪得最久？ */}
      <Section question="哪些游戏陪得最久？" accent="#E5568A">
        <div className="space-y-3">
          {longest.map((p, i) => (
            <Link key={p.id} href={`/games/${p.id}/`} className="group block">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-baseline gap-2 text-body text-muted group-hover:text-ink">
                  <span className="font-mono text-meta text-faint tnum">{String(i + 1).padStart(2, '0')}</span>
                  {p.name}
                </span>
                <span className="text-meta text-faint tnum">{p.hoursLabel}</span>
              </div>
              <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-raised">
                <span
                  className="block h-full rounded-full transition-[width,filter] group-hover:brightness-150"
                  style={{ width: `${(p.totalMinutes / maxMinutes) * 100}%`, background: '#E5568A' }}
                />
              </div>
            </Link>
          ))}
        </div>
        <Observation>
          陪伴最久的游戏是「{longest[0]?.name}」，已录 {longest[0]?.hoursLabel}。
        </Observation>
      </Section>

      {/* 03 哪些游戏反复回来？ */}
      <Section
        question="哪些游戏，隔了几年还会回来？"
        accent="#5BC8E8"
        legend={`一格一年（${firstArchiveYear} — ${lastArchiveYear}）· 亮起来＝这一年打过，暗格＝这一年没碰过`}
      >
        <YearAxis from={firstArchiveYear} to={lastArchiveYear} className="mb-1.5" />
        <div className="divide-y divide-line/60 border-y border-line/60">
          {revisited.map(({ p, years, gaps }) => (
            <Link key={p.id} href={`/games/${p.id}/`} className="group block py-3.5 transition-colors hover:bg-surface/30">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-body font-medium text-ink">{p.name}</span>
                <span className="text-meta text-faint tnum">
                  <span className="font-mono text-control font-semibold text-ink">{years.length}</span> 个年份里打过
                  {gaps > 0 && <> · 中途断过 {gaps} 次</>}
                </span>
              </div>
              <div className="mt-2">
                <YearLane
                  from={firstArchiveYear}
                  to={lastArchiveYear}
                  perYear={p.entries.reduce<{ year: number; count: number }[]>((acc, entry) => {
                    const y = Number(entry.date.slice(0, 4))
                    const row = acc.find((item) => item.year === y)
                    if (row) row.count += 1
                    else acc.push({ year: y, count: 1 })
                    return acc
                  }, [])}
                  color="#5BC8E8"
                  unit="场"
                  compact
                  showAxis={false}
                />
              </div>
            </Link>
          ))}
        </div>
        <Observation>
          有些游戏隔了几年，还是会重新打开：「{revisited[0]?.p.name}」在 {revisited[0]?.years.length} 个不同年份里都出现过。
        </Observation>
      </Section>

      {/* 04 时代如何变化？ */}
      <Section question="时代如何变化？" accent="#FF6B75">
        <div className="grid gap-3 sm:grid-cols-3">
          {eras.map((era) => (
            <Link
              key={era.id}
              href={`/archive/?y=${era.from}`}
              className="rounded-xl border border-line/80 bg-surface/40 p-5 transition-colors hover:border-muted/60"
            >
              <p className="flex items-center gap-2 text-meta uppercase tracking-[0.16em]" style={{ color: era.color }}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: era.color }} />
                {era.label}
              </p>
              <p className="mt-3 font-mono text-h3 font-bold text-ink tnum">{era.count.toLocaleString()}</p>
              <p className="mt-1 text-meta text-faint tnum">条记录 · {era.hours.toLocaleString()} 小时</p>
            </Link>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-line/80 bg-surface/40 p-[clamp(0.875rem,1.2vw,1.25rem)]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="text-body font-medium text-ink">一年一根柱子，颜色就是当时的主场</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {eras.map((era) => (
                <span key={era.id} className="flex items-center gap-2 text-meta text-faint">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-[0.1875rem]" style={{ background: era.color }} />
                  {era.label}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-[clamp(0.875rem,1.4vw,1.25rem)]">
            <EraFlow rows={eraColumns} />
          </div>
        </div>
        <Observation>
          视频时期靠录像，斗鱼时期靠直播。2023 年 11 月斗鱼停播以后，到 2024 年 8 月重新开播之间，直播记录自然出现了一段空档。
        </Observation>
      </Section>

      {/* 05 哪些节目坚持得最久？——隐藏中，见 SHOW_LONGEST_RUNNING_SERIES */}
      {SHOW_LONGEST_RUNNING_SERIES && (
      <Section
        question="哪些节目坚持得最久？"
        accent="#A78BFA"
        legend={`一格一年（${firstArchiveYear} — ${lastArchiveYear}）· 柱子越高，这一年更新得越多`}
      >
        <YearAxis from={firstArchiveYear} to={lastArchiveYear} className="mb-1.5" />
        <div className="divide-y divide-line/60 border-y border-line/60">
          {series.slice(0, 6).map((s) => (
            <Link key={s.id} href={`/series/${s.id}/`} className="group block py-3.5 transition-colors hover:bg-surface/30">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-body font-medium text-ink">{s.name}</span>
                <span className="text-meta text-faint tnum">
                  <span className="font-mono text-control font-semibold text-ink">{s.count}</span> 期 · 从 {s.firstDate.slice(0, 4)} 播到 {s.lastDate.slice(0, 4)}
                </span>
              </div>
              <div className="mt-2">
                <YearLane
                  from={firstArchiveYear}
                  to={lastArchiveYear}
                  perYear={s.perYear}
                  color="#A78BFA"
                  unit="期"
                  compact
                  showAxis={false}
                />
              </div>
            </Link>
          ))}
        </div>
        <Observation>
          「{pishuangSeries?.name ?? longestSeries?.name ?? '心灵砒霜'}」横跨了 {pishuangSeries?.span ?? longestSeries?.span ?? 0} 年——固定出现在每周日，是档案里坚持最久的节目。
        </Observation>
      </Section>
      )}

      {/* 06 站内点击排行——数据在运行期从内容服务拉；拿不到就整节不出现 */}
      <PopularContent
        question="水友们最爱点开哪些记录？"
        accent="#7BD88F"
        legend="站内点开一次算一次，从建站起一路累计到现在 · 同一个人反复点开会重复计入，所以这是「被点开的次数」，不是「多少人看过」 · 这个功能刚上线，眼下的点击大多来自开发调试，数字随时可能重新从零开始"
      />

      {/* 07 档案还有多少空白？ */}
      <Section
        question="档案还有多少空白？"
        accent="#5BC8E8"
        legend="一格一个月 · 亮起来＝档案里有记录，空格＝还没有找到任何录像。空格不代表那个月没播。"
      >
        <CoverageGaps coverage={coverage} />
        <Observation>
          手上有对应时间的录播、切片或者原视频链接，可以从
          <Link href="/contact/" className="text-live underline decoration-line underline-offset-4 hover:decoration-live">
            联系页
          </Link>
          告诉我，这张图就会少一块空白。
        </Observation>
      </Section>

      <SiteFooter />
    </main>
  )
}

function hoursTop(yearRows: [number, { count: number; minutes: number; known: number }][]): string {
  const top = yearRows.reduce((acc, [, r]) => (r.minutes > acc.minutes ? r : acc), { minutes: 0, known: 0 })
  return top.minutes ? Math.round(top.minutes / 60).toLocaleString() : '—'
}

function Observation({ children }: { children: React.ReactNode }) {
  return (
    <p className="measure-body mt-6 border-l-2 border-line pl-4 text-body text-muted">
      <span className="text-meta uppercase tracking-[0.16em] text-faint">观察 · </span>
      {children}
    </p>
  )
}
