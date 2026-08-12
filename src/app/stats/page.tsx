import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { buildGameStats, formatGameDuration } from '@/lib/game-stats'
import { PLATFORM_META } from '@/lib/platforms'
import { computeCoverage, findMonthlyGaps, yearPlatformHistogram, yearTypeHistogram } from '@/lib/stats'
import { gameColor, MONTH_CN } from '@/lib/ui'
import type { Platform } from '@/lib/schema'
import { PLATFORMS } from '@/lib/schema'

function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

export default function StatsPage() {
  const ds = getDataset()
  const entries = toTimelineEntries(ds)
  const coverage = computeCoverage(entries)
  const yearTypes = yearTypeHistogram(entries)
  const yearPlatforms = yearPlatformHistogram(entries)
  const gaps = findMonthlyGaps(entries)
  const topGames = buildGameStats(ds)
    .filter((g) => g.knownDurationMin > 0)
    .sort((a, b) => b.knownDurationMin - a.knownDurationMin)
    .slice(0, 20)

  const maxYearTotal = Math.max(1, ...yearTypes.map((y) => y.video + y.live))
  const totalKnownHours = Math.round(topGames.reduce((n, g) => n + g.knownDurationMin, 0) / 60)

  const gapsByYear = gaps.reduce<Map<number, number[]>>((map, g) => {
    const list = map.get(g.year) ?? []
    list.push(g.month)
    map.set(g.year, list)
    return map
  }, new Map())

  return (
    <main className="ui-page-in min-h-screen overflow-hidden">
      <header className="ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center px-4 py-5 sm:px-6">
        <SiteNav active="stats" />
      </header>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-12 pt-14 sm:px-6 sm:pt-20">
        <div className="pointer-events-none absolute -right-20 -top-32 h-[420px] w-[420px] rounded-full bg-video/10 blur-[110px]" />
        <div className="ui-reveal relative max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-video">Stats · Read with caution</p>
          <h1 className="mt-4 text-[42px] font-semibold leading-[1.08] tracking-tight sm:text-[64px]">数字看这十六年。</h1>
          <p className="mt-6 max-w-2xl text-[14px] leading-8 text-muted">
            这些图表建立在不同覆盖率的字段上——年份 / 平台是逐条已知的，但游戏标签、系列归属、分段目前都只覆盖一小部分。每张图表旁都标了它实际统计到的样本量，不代表全貌的地方不会装作代表全貌。
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 border-y border-line py-4 font-mono text-[10px] text-faint sm:grid-cols-6">
          <CoverageCell label="总条目" value={coverage.total.toLocaleString()} />
          <CoverageCell label="时长" value={pct(coverage.duration, coverage.total)} />
          <CoverageCell label="封面" value={pct(coverage.cover, coverage.total)} />
          <CoverageCell label="游戏标签" value={pct(coverage.games, coverage.total)} />
          <CoverageCell label="系列归属" value={pct(coverage.series, coverage.total)} />
          <CoverageCell label="分段" value={pct(coverage.segments, coverage.total)} />
        </div>
      </section>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          年度产出 · 视频 / 直播 · 样本 {coverage.total} 条（100% 已知）
        </h2>
        <div className="mt-5 flex items-end gap-1.5 sm:gap-2.5">
          {yearTypes.map((y) => {
            const total = y.video + y.live
            return (
              <div key={y.year} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-40 w-full flex-col justify-end overflow-hidden rounded-t-sm" title={`${y.year} · 视频 ${y.video} · 直播 ${y.live}`}>
                  <span className="w-full shrink-0 bg-video/80" style={{ height: `${(y.video / maxYearTotal) * 100}%` }} />
                  <span className="w-full shrink-0 bg-live/80" style={{ height: `${(y.live / maxYearTotal) * 100}%` }} />
                </div>
                <span className="font-mono text-[9px] text-faint tnum">{String(y.year).slice(2)}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex gap-4 font-mono text-[10px] text-faint">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-video" />视频</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-live" />直播</span>
        </div>
      </section>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          平台迁移 · 每年条目按平台占比 · 样本 {coverage.total} 条（100% 已知）
        </h2>
        <div className="mt-5 space-y-2">
          {yearPlatforms.map((row) => (
            <div key={row.year} className="flex items-center gap-3">
              <span className="w-10 shrink-0 font-mono text-[10px] text-faint tnum">{row.year}</span>
              <div className="flex h-4 flex-1 overflow-hidden rounded-full bg-raised">
                {PLATFORMS.map((p) => {
                  const n = row.platforms[p] ?? 0
                  if (!n) return null
                  const meta = PLATFORM_META[p]
                  return (
                    <span
                      key={p}
                      style={{ width: `${(n / row.total) * 100}%`, background: meta.color }}
                      className="opacity-80 transition-opacity hover:opacity-100"
                      title={`${meta.name} · ${n} 条`}
                    />
                  )
                })}
              </div>
              <span className="w-9 shrink-0 text-right font-mono text-[10px] text-faint tnum">{row.total}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 font-mono text-[10px] text-faint">
          {PLATFORMS.map((p) => {
            const meta = PLATFORM_META[p]
            return (
              <span key={p} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: meta.color }} />
                {meta.name}
              </span>
            )
          })}
        </div>
      </section>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          时长 Top 20 · 仅统计已打游戏标签的场次 · 样本 {coverage.games} / {coverage.total} 条（{pct(coverage.games, coverage.total)}）
        </h2>
        <p className="mt-2 max-w-2xl text-[12px] leading-6 text-muted">
          这份排行只覆盖打了游戏标签的场次，没被标记的场次不计入——不代表其他游戏投入更少，只是还没接进这张索引。上榜的 {topGames.length} 个游戏合计已知时长 {totalKnownHours} 小时。
        </p>
        <ul className="mt-5 space-y-1.5">
          {topGames.map((g, i) => {
            const maxMin = topGames[0].knownDurationMin
            return (
              <li key={g.id}>
                <Link href={`/games/${g.id}/`} className="ui-press group flex items-center gap-3 rounded px-2 py-1.5 hover:bg-surface/60">
                  <span className="w-5 shrink-0 font-mono text-[11px] text-faint tnum">{i + 1}</span>
                  <span className="w-36 shrink-0 truncate text-[13px] text-ink group-hover:text-live sm:w-48">{g.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(g.knownDurationMin / maxMin) * 100}%`, background: gameColor(g.id) }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right font-mono text-[10px] text-faint tnum">
                    {formatGameDuration(g.knownDurationMin, g.knownDurationCount, g.sessionCount)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {gapsByYear.size > 0 && (
        <section className="relative mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
          <div className="ui-card rounded-2xl border border-dashed border-line bg-surface/25 p-5 sm:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Coverage gaps</p>
            <h2 className="mt-3 text-[20px] font-medium tracking-tight text-ink">缺口地图 · {gaps.length} 个月还没有记录。</h2>
            <p className="mt-3 max-w-2xl text-[13px] leading-7 text-muted">
              在首条与最新记录之间，以下月份目前一条数据都没有——可能是真实停播，也可能只是还没采集到。以下按年份列出，供采集时优先核对。
            </p>
            <div className="mt-5 space-y-3">
              {[...gapsByYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, months]) => (
                <div key={year} className="flex flex-wrap items-center gap-2">
                  <span className="w-12 shrink-0 font-mono text-[11px] text-faint tnum">{year}</span>
                  {months.map((m) => (
                    <span key={m} className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-faint">
                      {MONTH_CN[m - 1]}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <Link href="/contact/" className="ui-press mt-6 inline-block rounded-sm font-mono text-[11px] text-live underline underline-offset-4">
              提供补录线索 →
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}

function CoverageCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block font-display text-xl font-bold text-ink sm:text-2xl">{value}</span>
      <span className="mt-1 block">{label}</span>
    </div>
  )
}
