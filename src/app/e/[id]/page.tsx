import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buildSourceGroups, getDataset } from '@/lib/data'
import { visibleGameIds } from '@/lib/games'
import { PLATFORM_META, SOURCE_KIND_LABEL, proxyImage, withTimestamp } from '@/lib/platforms'
import { formatDuration, gameColor } from '@/lib/ui'
import { toSeconds, type Platform } from '@/lib/schema'
import { buildEntryRails } from '@/lib/relations'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { RelatedRail } from '@/components/RelatedRail'

export function generateStaticParams() {
  return getDataset().entries.map((e) => ({ id: e.id }))
}

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ds = getDataset()
  const idx = ds.entries.findIndex((e) => e.id === id)
  if (idx === -1) notFound()

  const entry = ds.entries[idx]
  const compactGameIds = visibleGameIds(entry.games)
  const sourceGroup = buildSourceGroups(ds.entries).get(entry.id) ?? [entry]
  const groupedSources = sourceGroup
    .flatMap((item) => item.sources.map((source) => ({ ...source, entryTitle: item.title })))
    .filter((source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index)
  const newer = ds.entries[idx - 1]
  const older = ds.entries[idx + 1]
  const platform = PLATFORM_META[entry.platform as Platform]
  const totalSec = (entry.duration_min ?? 0) * 60
  const cover = proxyImage(entry.cover, 720)
  const primary = groupedSources.find((source) => source.status === 'alive') ?? groupedSources[0]
  const backHref = `/archive/?y=${entry.date.slice(0, 4)}&m=${Number(entry.date.slice(5, 7))}`

  const rails = buildEntryRails(entry, ds)

  return (
    // 外层不带 px-page：RelatedRail 自带一层，套两层百分比 padding 会复利
    // （原来这里就是 px-4 套 RelatedRail 的 px-4，手机上等于 32px 双重内边距）
    <div className="ui-page-in pb-8">
      <MobileQuickNav active="entry" />
      <BackToTop />
      <header className="site-header-container flex items-center px-page py-5">
        <SiteNav active="entry" />
      </header>
      <div className="mx-auto max-w-[56.25rem]">
        <div className="mt-5 px-page">
          <Link href={backHref} className="ui-press inline-block rounded-sm text-meta text-muted tnum underline underline-offset-4 hover:text-live">
            ← 回到 {entry.date.slice(0, 7).replace('-', ' 年 ')} 月
          </Link>
        </div>

        <header className="mt-6 border-b border-line px-page pb-6">
        <div className="flex flex-wrap items-center gap-2 text-meta tnum">
          <span className="rounded-sm px-1.5 py-0.5 font-semibold text-[#12141C]" style={{ background: platform?.color }}>
            {platform?.name ?? entry.platform}
          </span>
          <span className="text-muted">{entry.date}</span>
          {entry.time && <span className="text-faint">{entry.time} 开播</span>}
          <span className="text-faint">·</span>
          <span className="text-muted">{formatDuration(entry.duration_min)}</span>
          {entry.confidence !== 'high' && (
            <span className="rounded-sm border border-line px-1.5 text-faint">
              {entry.confidence === 'low' ? '待考证' : '部分待核实'}
            </span>
          )}
        </div>
        <h1 className="mt-3 text-h2 font-semibold">{entry.title}</h1>
        {entry.note && <p className="mt-2 text-meta text-faint">{entry.note}</p>}
        </header>

      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt={`${entry.title} 封面`}
          referrerPolicy="no-referrer"
          className="ui-reveal mt-6 aspect-video w-full border border-line bg-raised object-cover sm:rounded"
        />
      )}

      {/* 分段：这场几点在打什么，点色块直接跳到对应时间 */}
      <section className="mt-8 px-page">
        <h2 className="mb-3 text-meta uppercase tracking-[0.16em] text-faint">播了什么</h2>
        {entry.segments.length === 0 ? (
          <p className="text-body text-muted">
            尚未录入分段信息。
            {compactGameIds.length > 0 && (
              <> 已知涉及：{compactGameIds.map((g) => ds.games.get(g)?.name ?? g).join('、')}。</>
            )}
          </p>
        ) : (
          <>
            <div className="group/segments flex h-3 w-full overflow-hidden rounded-full bg-raised">
              {totalSec > 0 && toSeconds(entry.segments[0].at) > 0 && (
                <span
                  style={{ width: `${(toSeconds(entry.segments[0].at) / totalSec) * 100}%` }}
                  className="bg-line"
                  title="开播前 / 未分段"
                />
              )}
              {entry.segments.map((s, i) => {
                const from = toSeconds(s.at)
                const to = i + 1 < entry.segments.length ? toSeconds(entry.segments[i + 1].at) : totalSec || from
                const width = totalSec ? ((to - from) / totalSec) * 100 : 100 / entry.segments.length
                return (
                  <span
                    key={i}
                    style={{ width: `${width}%`, background: gameColor(s.game ?? null), opacity: s.game ? 0.9 : 0.3 }}
                    className="transition-[filter,opacity] duration-300 group-hover/segments:brightness-125"
                    title={`${s.at} ${s.label}`}
                  />
                )
              })}
            </div>
            <ol className="mt-4 space-y-1">
              {entry.segments.map((s, i) => {
                const href = primary ? withTimestamp(primary.url, toSeconds(s.at)) : null
                const name = s.game ? (ds.games.get(s.game)?.name ?? s.game) : s.label
                const Row = (
                  <>
                    <span className="font-mono text-meta text-faint tnum">{s.at}</span>
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: gameColor(s.game ?? null) }} />
                    <span className="text-body text-ink">{name}</span>
                    {s.game && <span className="text-meta text-faint">{s.label}</span>}
                  </>
                )
                return (
                  <li key={i}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group ui-press flex items-center gap-3 rounded px-2 py-2.5 transition-colors hover:bg-surface sm:py-1.5"
                      >
                        {Row}
                        <span className="ml-auto text-meta text-live opacity-0 transition-opacity group-hover:opacity-100">
                          跳转 ↗
                        </span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-3 px-2 py-2.5 sm:py-1.5">{Row}</div>
                    )}
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </section>

      <section className="mt-10 px-page">
        <h2 className="mb-3 text-meta uppercase tracking-[0.16em] text-faint tnum">
          观看链接
        </h2>
        {groupedSources.length === 0 ? (
          <p className="text-body text-muted">还没有可用链接。如果你手上有，欢迎补录。</p>
        ) : (
          <ul className="divide-y divide-line rounded border border-line">
            {groupedSources.map((s, i) => {
              const acc = s.account ? ds.accounts.get(s.account) : undefined
              const dead = s.status === 'dead'
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 transition-colors duration-200 hover:bg-surface/80 sm:py-2.5">
                  <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-meta ${i === 0 ? 'border-live/50 text-live' : 'border-line text-muted'}`}>
                    {i === 0 ? '主链接' : `备选 ${i}`}
                  </span>
                  <span className="text-meta text-muted">{SOURCE_KIND_LABEL[s.kind] ?? s.kind}</span>
                  {acc && <span className="text-meta text-ink">{acc.name}</span>}
                  {s.entryTitle !== entry.title && <span className="max-w-full truncate text-meta text-faint">{s.entryTitle}</span>}
                  {s.parts && <span className="font-mono text-meta text-faint tnum">{s.parts} P</span>}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`ui-press ml-auto rounded-sm px-1 py-2 text-meta underline underline-offset-4 sm:py-0 ${
                      dead ? 'text-faint' : 'text-live'
                    }`}
                  >
                    打开 ↗
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <RelatedRail rails={rails} />

        <nav className="mt-12 flex justify-between gap-4 border-t border-line px-page pt-6 text-meta tnum">
        {older ? (
          <Link href={`/e/${older.id}/`} className="max-w-[45%] truncate py-2 text-muted hover:text-ink sm:py-0">
            ← {older.date} {older.title}
          </Link>
        ) : (
          <span />
        )}
        {newer && (
          <Link href={`/e/${newer.id}/`} className="max-w-[45%] truncate py-2 text-right text-muted hover:text-ink sm:py-0">
            {newer.date} {newer.title} →
          </Link>
        )}
        </nav>
      </div>
    </div>
  )
}
