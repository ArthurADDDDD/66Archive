import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { ActivityStrip } from '@/components/ActivityStrip'
import { SiteFooter } from '@/components/primitives'
import { LivePageHeader } from '@/components/LiveSection'
import { YearBarChart, EraDots } from '@/components/YearCharts'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { actColorForDate } from '@/lib/narrative'
import { getGameProfile } from '@/lib/narrative'
import { buildSeriesList } from '@/lib/series'
import { CURATED_GAMES } from '@/lib/narrative'

/**
 * 数据里的发现：每一节只回答一个问题。
 * 数据 → 观察 → 记忆：数字先行，观察一句话，最后都通向编年史 / 游戏 / 节目。
 * 图表只有纯 CSS 的条 / 点 / 时间线，不引入任何图表依赖。
 */
export default function StatsPage() {
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)

  // —— 00 已收录直播（只统计 type=live；视频投稿不计入直播时长）——
  const liveTimeline = timeline.filter((e) => e.type === 'live')
  const liveKnownMinutes = liveTimeline.reduce((sum, e) => sum + (e.duration_min ?? 0), 0)
  const liveKnownHours = Math.round(liveKnownMinutes / 60)
  const liveDurationCoverage = liveTimeline.length ? Math.round((liveTimeline.filter((e) => e.duration_min).length / liveTimeline.length) * 100) : 0

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
  let topYear = yearRows[0]?.[0] ?? 0
  let topCount = 0
  for (const [y, r] of yearRows) if (r.count > topCount) {
    topCount = r.count
    topYear = y
  }

  // —— 02 / 03 游戏 ——
  const ids = [...ds.games.keys(), ...Object.keys(CURATED_GAMES)]
  const profiles = ids
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
  const eras = [
    { id: 'video', label: '视频时期', years: '2010 — 2015', color: '#E0A244', from: 2010, to: 2015 },
    { id: 'douyu', label: '斗鱼时期', years: '2016 — 2023', color: '#5BC8E8', from: 2016, to: 2023 },
    { id: 'douyin', label: '抖音时期', years: '2024 — 至今', color: '#FF6B75', from: 2024, to: 9999 },
  ].map((era) => {
    const rows = yearRows.filter(([y]) => y >= era.from && y <= era.to)
    const count = rows.reduce((s, [, r]) => s + r.count, 0)
    const minutes = rows.reduce((s, [, r]) => s + r.minutes, 0)
    return { ...era, count, hours: Math.round(minutes / 60) }
  })

  // —— 05 节目 ——
  const series = buildSeriesList(ds, timeline)
    .map((s) => ({ ...s, span: s.count > 1 ? Number(s.lastDate.slice(0, 4)) - Number(s.firstDate.slice(0, 4)) + 1 : 1 }))
    .sort((a, b) => b.span - a.span || b.count - a.count)

  return (
    <main className="ui-page-in min-h-screen overflow-x-clip">
      <MobileQuickNav active="stats" />
      <BackToTop />
      <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
        <SiteNav active="stats" />
        <Link href="/chronicle/" className="ui-press hidden rounded-sm text-meta text-live sm:block">
          去编年史逐条查看 →
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
            <p className="mt-1 text-meta text-faint tnum">场 · type=live</p>
          </div>
          <div className="rounded-xl border border-line/80 bg-surface/40 p-5">
            <p className="text-meta uppercase tracking-[0.16em] text-faint">已确认时长</p>
            <p className="mt-3 font-mono text-h3 font-bold text-ink tnum">{liveKnownHours.toLocaleString()}</p>
            <p className="mt-1 text-meta text-faint tnum">小时 · 时长覆盖率 {liveDurationCoverage}%</p>
          </div>
          <div className="rounded-xl border border-line/80 bg-surface/40 p-5">
            <p className="text-meta uppercase tracking-[0.16em] text-faint">实际累计</p>
            <p className="mt-3 font-mono text-h3 font-bold text-ink tnum">10,000+</p>
            <p className="mt-1 text-meta text-faint tnum">小时 · 外部硬锚点估算</p>
          </div>
        </div>
        <Observation>
          早期部分直播档案已经遗失，已确认时长仅代表目前可核实的录像记录，不等于实际累计直播总时长。
        </Observation>
      </Section>

      {/* 01 哪一年留下的记录最多？ */}
      <Section question="哪一年留下的记录最多？" accent="#E0A244">
        <YearBarChart rows={yearRows} topYear={topYear} />
        <Observation>
          最多的一年是 {topYear} 年，档案里留下了 {topCount.toLocaleString()} 条记录。
          2011 年是一条横线——那一年档案为空，缺口被如实保留。
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
      <Section question="哪些游戏，隔了几年还会回来？" accent="#5BC8E8">
        <div className="space-y-4">
          {revisited.map(({ p, years, gaps }) => (
            <Link key={p.id} href={`/games/${p.id}/`} className="group block">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-body text-muted group-hover:text-ink">
                  {p.name}
                  {gaps > 0 && <span className="ml-2 text-meta text-faint tnum">中途断过 {gaps} 次</span>}
                </span>
                <span className="text-meta text-faint tnum">{years.length} 个年份</span>
              </div>
              <div className="mt-1.5 flex gap-1">
                {years.map((y) => (
                  <span
                    key={y}
                    className="h-[5px] w-[5px] rounded-full"
                    style={{ background: actColorForDate(`${y}-06-01`) }}
                    title={`${y} 年`}
                  />
                ))}
              </div>
            </Link>
          ))}
        </div>
        <Observation>
          反复回来的游戏，断档后还会续上——上面的彩点就是它出现过的每个年份。
        </Observation>
      </Section>

      {/* 04 时代如何变化？ */}
      <Section question="时代如何变化？" accent="#FF6B75">
        <div className="grid gap-3 sm:grid-cols-3">
          {eras.map((era) => (
            <Link
              key={era.id}
              href={`/chronicle/?y=${era.from}`}
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
        <div className="mt-10">
          <p className="text-meta uppercase tracking-[0.16em] text-faint">每一年，一个点</p>
          <div className="mt-4">
            <EraDots rows={yearRows} />
          </div>
        </div>
        <Observation>
          视频时期靠录像，斗鱼时期靠直播。2023 年底到 2024 年 8 月之间档案近乎空白——那是幕间，被原样保留。
        </Observation>
      </Section>

      {/* 05 哪些节目坚持得最久？ */}
      <Section question="哪些节目坚持得最久？" accent="#A78BFA">
        <div className="space-y-5">
          {series.slice(0, 6).map((s) => (
            <Link key={s.id} href={`/series/${s.id}/`} className="group block">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-body text-muted group-hover:text-ink">{s.name}</span>
                <span className="text-meta text-faint tnum">
                  {s.count} 期 · 跨 {s.span} 年
                </span>
              </div>
              <div className="mt-2">
                <ActivityStrip perYear={s.perYear} color="#A78BFA" height={20} />
              </div>
            </Link>
          ))}
        </div>
        <Observation>
          「心灵砒霜」横跨了整整 8 年——固定出现在每周日，是档案里坚持最久的节目。
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

function Section({ question, accent, children }: { question: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line">
        <div className="site-container-wide px-page py-[clamp(3rem,8vh,7rem)]">
        <p className="flex items-center gap-2 text-meta uppercase tracking-[0.16em] text-faint">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
          一个问题
        </p>
        <h2 className="mt-3 max-w-[min(100%,72rem)] text-[clamp(2rem,3vw,4rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-ink">{question}</h2>
        <div className="mt-8 w-full sm:mt-10">{children}</div>
      </div>
    </section>
  )
}

function Observation({ children }: { children: React.ReactNode }) {
  return (
    <p className="measure-body mt-6 border-l-2 border-line pl-4 text-body text-muted">
      <span className="text-meta uppercase tracking-[0.16em] text-faint">观察 · </span>
      {children}
    </p>
  )
}
