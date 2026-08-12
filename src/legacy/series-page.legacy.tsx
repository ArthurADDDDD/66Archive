import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { buildSeriesStats } from '@/lib/series-stats'

export default function SeriesIndexPage() {
  const ds = getDataset()
  const all = toTimelineEntries(ds)
  const series = buildSeriesStats(ds).sort((a, b) => b.entryCount - a.entryCount)
  const covered = series.reduce((n, s) => n + s.entryCount, 0)

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
            比起单场直播，这些系列和栏目更能看出内容上的连贯性——一部全流程解说的完整拆分，或是持续多年的固定周更。系列归属目前只覆盖 {covered} / {all.length} 条（{((covered / all.length) * 100).toFixed(1)}%），大多数记录还没被归类进任何系列。
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
            <span className="block font-display text-2xl font-bold text-ink">{series.filter((s) => s.entryCount === 0).length}</span>
            <span className="mt-1 block">尚无归入记录</span>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
        <div className="ui-reveal grid grid-cols-1 gap-4 sm:grid-cols-2">
          {series.map((s) => (
            <Link
              key={s.id}
              href={`/series/${s.id}/`}
              className="ui-card ui-press flex flex-col rounded-2xl border border-line bg-surface/55 p-5 hover:border-today/40 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[18px] font-medium leading-snug text-ink group-hover:text-today">{s.name}</h2>
                <span className="shrink-0 rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-faint tnum">
                  {s.entryCount} 期
                </span>
              </div>
              {s.description && <p className="mt-3 text-[13px] leading-6 text-muted">{s.description}</p>}
              {s.entryCount > 0 ? (
                <p className="mt-4 border-t border-line pt-3 font-mono text-[10px] text-faint tnum">
                  {s.firstDate} → {s.lastDate}
                </p>
              ) : (
                <p className="mt-4 border-t border-line pt-3 font-mono text-[10px] text-faint">还没有场次归入这个系列</p>
              )}
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
