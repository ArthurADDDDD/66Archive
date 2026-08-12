import { SiteNav } from '@/components/SiteNav'
import { SeriesTimeline } from '@/components/SeriesTimeline'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { buildSeriesStats } from '@/lib/series-stats'

export default function SeriesIndexPage() {
  const ds = getDataset()
  const all = toTimelineEntries(ds)
  const series = buildSeriesStats(ds).sort((a, b) => a.firstDate.localeCompare(b.firstDate))
  const withEntries = series.filter((s) => s.entryCount > 0)
  const pending = series.filter((s) => s.entryCount === 0)
  const covered = withEntries.reduce((n, s) => n + s.entryCount, 0)

  const dates = all.map((e) => e.date).sort()
  const rangeStart = dates[0] ?? '2010-01-01'
  const rangeEnd = dates[dates.length - 1] ?? rangeStart

  return (
    <main className="ui-page-in min-h-screen overflow-hidden">
      <header className="ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center px-4 py-5 sm:px-6">
        <SiteNav active="series" />
      </header>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-12 pt-14 sm:px-6 sm:pt-20">
        <div className="pointer-events-none absolute -right-20 -top-32 h-[420px] w-[420px] rounded-full bg-today/10 blur-[110px]" />
        <div className="ui-reveal relative max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-today">Series · Recurring formats</p>
          <h1 className="mt-4 text-[42px] font-semibold leading-[1.08] tracking-tight sm:text-[64px]">连载与固定栏目。</h1>
          <p className="mt-6 max-w-2xl text-[14px] leading-8 text-muted">
            条的位置和长度是系列在这 {new Date(rangeStart).getFullYear()}—{new Date(rangeEnd).getFullYear()} 年里真实的起止时间，条内的细线是每一期实际发生的日期——密的地方是稳定连载，疏的地方是断更或不定期。系列归属目前只覆盖 {covered} / {all.length} 条（{((covered / all.length) * 100).toFixed(1)}%）。
          </p>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-3 border-y border-line py-4 font-mono text-[10px] text-faint">
          <div>
            <span className="block font-display text-2xl font-bold text-ink">{series.length}</span>
            <span className="mt-1 block">已定义系列</span>
          </div>
          <div>
            <span className="block font-display text-2xl font-bold text-ink">{covered}</span>
            <span className="mt-1 block">已归入场次</span>
          </div>
          <div>
            <span className="block font-display text-2xl font-bold text-ink">{pending.length}</span>
            <span className="mt-1 block">尚无归入记录</span>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
        <SeriesTimeline series={withEntries} rangeStart={rangeStart} rangeEnd={rangeEnd} />
      </section>

      {pending.length > 0 && (
        <section className="relative mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
          <div className="ui-card rounded-2xl border border-dashed border-line bg-surface/25 p-5 sm:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Registered, no entries yet</p>
            <h2 className="mt-3 text-[20px] font-medium tracking-tight text-ink">已定义系列，还没有场次归入。</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {pending.map((s) => (
                <span key={s.id} className="rounded-full border border-line px-3 py-1.5 font-mono text-[10px] text-faint">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
