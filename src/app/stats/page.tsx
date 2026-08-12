import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { ActivityStrip } from '@/components/ActivityStrip'
import { PageHeader } from '@/components/primitives'
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
  const withGames = timeline.filter((e) => e.games.length > 0).length
  const coverage = timeline.length ? Math.round((withGames / timeline.length) * 100) : 0
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
    <main className="ui-page-in min-h-screen overflow-hidden">
      <header className="ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center justify-between px-4 py-5 sm:px-6">
        <SiteNav active="stats" />
        <Link href="/chronicle/" className="ui-press hidden rounded-sm font-mono text-[11px] text-live underline-offset-4 hover:underline sm:block">
          去编年史逐条查看 →
        </Link>
      </header>

      <section className="mx-auto max-w-[1240px] px-4 pb-10 pt-8 sm:px-6 sm:pb-16 sm:pt-14">
        <PageHeader
          eyebrow="Stats · 数据里的发现"
          eyebrowColor="#E5568A"
          title="这些数字背后，是被保存下来的时间。"
          lede="每一节只回答一个问题。数字全部来自档案本身的逐条记录——先有数据，后有观察。"
          right={
            <details className="group max-w-sm" open={false}>
              <summary className="ui-press cursor-pointer list-none rounded-sm font-mono text-[10px] uppercase tracking-[0.18em] text-faint transition-colors hover:text-ink">
                <span className="underline decoration-dotted underline-offset-4">ⓘ 关于这些数据</span>
              </summary>
              <div className="mt-3 space-y-2 rounded-lg border border-line/80 bg-surface/40 p-4 font-mono text-[10px] leading-5 text-faint">
                <p>· 全部数字在构建期从档案逐条派生，不人工填写。</p>
                <p>· 时长只统计有时长记录的条目；时长缺失的记录不计入小时数。</p>
                <p>· 游戏场次基于条目 games 字段，目前标记覆盖率约 {coverage}%（补录中），曲线和排名只覆盖已标记部分。</p>
                <p>· 同场合并的重复录像已折叠；2011 年档案为空，是真实缺口。</p>
                <p>· 节目期数按标题 / 栏目 tag 精确匹配派生。</p>
              </div>
            </details>
          }
        />
      </section>

      {/* 01 哪一年留下的记录最多？ */}
      <Section question="哪一年留下的记录最多？" accent="#E0A244">
        <YearBarChart rows={yearRows} topYear={topYear} />
        <Observation>
          最多的一年是 {topYear} 年，档案里留下了 {topCount.toLocaleString()} 条记录。
          2011 年是一条横线——那一年档案为空，缺口被如实保留。
        </Observation>
        <p className="mt-6 font-mono text-[10px] text-faint/70">已录时长最高的一年：{hoursTop(yearRows)} 小时</p>
      </Section>

      {/* 02 哪些游戏陪得最久？ */}
      <Section question="哪些游戏陪得最久？" accent="#E5568A">
        <div className="space-y-3">
          {longest.map((p, i) => (
            <Link key={p.id} href={`/games/${p.id}/`} className="group block">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-baseline gap-2 text-[13px] text-muted group-hover:text-ink">
                  <span className="font-mono text-[9px] text-faint/60 tnum">{String(i + 1).padStart(2, '0')}</span>
                  {p.name}
                </span>
                <span className="font-mono text-[10px] text-faint tnum">{p.hoursLabel}</span>
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
          游戏字段仍在补录中（覆盖率约 {coverage}%）——这份排名会随补录变化，也会越来越全。
        </Observation>
      </Section>

      {/* 03 哪些游戏反复回来？ */}
      <Section question="哪些游戏，隔了几年还会回来？" accent="#5BC8E8">
        <div className="space-y-4">
          {revisited.map(({ p, years, gaps }) => (
            <Link key={p.id} href={`/games/${p.id}/`} className="group block">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] text-muted group-hover:text-ink">
                  {p.name}
                  {gaps > 0 && <span className="ml-2 font-mono text-[9px] text-faint/70 tnum">中途断过 {gaps} 次</span>}
                </span>
                <span className="font-mono text-[10px] text-faint tnum">{years.length} 个年份</span>
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
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: era.color }}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: era.color }} />
                {era.label}
              </p>
              <p className="mt-3 font-display text-[26px] font-bold text-ink tnum">{era.count.toLocaleString()}</p>
              <p className="mt-1 font-mono text-[9px] text-faint">条记录 · {era.hours.toLocaleString()} 小时</p>
            </Link>
          ))}
        </div>
        <div className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint/80">每一年，一个点</p>
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
                <span className="text-[13px] text-muted group-hover:text-ink">{s.name}</span>
                <span className="font-mono text-[10px] text-faint tnum">
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

      <footer className="mx-auto flex max-w-[1240px] flex-col justify-between gap-4 px-4 py-10 font-mono text-[10px] text-faint sm:flex-row sm:px-6">
        <span>只索引，不搬运 · 所有播放回到原平台</span>
        <Link href="/contact/" className="ui-press rounded-sm transition-colors hover:text-live">
          资料纠错与联系 →
        </Link>
      </footer>
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
      <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-20">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
          一个问题
        </p>
        <h2 className="mt-3 max-w-2xl text-[24px] font-semibold leading-snug tracking-tight text-ink sm:text-[32px]">
          {question}
        </h2>
        <div className="mt-6 max-w-3xl sm:mt-8">{children}</div>
      </div>
    </section>
  )
}

function Observation({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 max-w-2xl border-l-2 border-line pl-4 text-[13px] leading-7 text-muted">
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint/70">观察 · </span>
      {children}
    </p>
  )
}
