import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDataset } from '@/lib/data'
import { PLATFORM_META, SOURCE_KIND_LABEL, proxyImage, withTimestamp } from '@/lib/platforms'
import { formatDuration, gameColor } from '@/lib/ui'
import { toSeconds, type Platform } from '@/lib/schema'
import { SiteNav } from '@/components/SiteNav'

export function generateStaticParams() {
  return getDataset().entries.map((e) => ({ id: e.id }))
}

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ds = getDataset()
  const idx = ds.entries.findIndex((e) => e.id === id)
  if (idx === -1) notFound()

  const entry = ds.entries[idx]
  const newer = ds.entries[idx - 1]
  const older = ds.entries[idx + 1]
  const platform = PLATFORM_META[entry.platform as Platform]
  const totalSec = (entry.duration_min ?? 0) * 60
  const cover = proxyImage(entry.cover, 720)
  const primary = entry.sources[0]
  const backHref = `/chronicle/?y=${entry.date.slice(0, 4)}&m=${Number(entry.date.slice(5, 7))}`

  const related = ds.entries
    .filter((e) => e.id !== entry.id && e.games.some((g) => entry.games.includes(g)))
    .slice(0, 6)

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-8 sm:px-6">
      <header className="flex items-center py-5">
        <SiteNav active="entry" />
      </header>
      <Link href={backHref} className="mt-5 inline-block font-mono text-[11px] text-muted underline underline-offset-4">
        ← 回到 {entry.date.slice(0, 7).replace('-', ' 年 ')} 月
      </Link>

      <header className="mt-6 border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tnum">
          <span className="rounded-sm px-1.5 py-0.5 font-semibold text-base" style={{ background: platform?.color }}>
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
        <h1 className="mt-3 text-[22px] font-semibold leading-snug sm:text-[28px]">{entry.title}</h1>
        {entry.note && <p className="mt-2 text-[12px] text-faint">{entry.note}</p>}
      </header>

      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt={`${entry.title} 封面`} className="mt-6 aspect-video w-full rounded border border-line bg-raised object-cover" />
      )}

      {/* 分段：这场几点在打什么，点色块直接跳到对应时间 */}
      <section className="mt-8">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">播了什么</h2>
        {entry.segments.length === 0 ? (
          <p className="text-[13px] text-muted">
            尚未录入分段信息。
            {entry.games.length > 0 && (
              <> 已知涉及：{entry.games.map((g) => ds.games.get(g)?.name ?? g).join('、')}。</>
            )}
          </p>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-raised">
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
                    <span className="font-mono text-[11px] text-faint tnum">{s.at}</span>
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: gameColor(s.game ?? null) }} />
                    <span className="text-[13px] text-ink">{name}</span>
                    {s.game && <span className="text-[12px] text-faint">{s.label}</span>}
                  </>
                )
                return (
                  <li key={i}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded px-2 py-1.5 transition-colors hover:bg-surface"
                      >
                        {Row}
                        <span className="ml-auto font-mono text-[10px] text-live opacity-0 transition-opacity group-hover:opacity-100">
                          跳转 ↗
                        </span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-3 px-2 py-1.5">{Row}</div>
                    )}
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </section>

      {/* 来源：同一场的官方回放与各路录播 */}
      <section className="mt-10">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          来源 · {entry.sources.length}
        </h2>
        {entry.sources.length === 0 ? (
          <p className="text-[13px] text-muted">还没有可用链接。如果你手上有，欢迎补录。</p>
        ) : (
          <ul className="divide-y divide-line rounded border border-line">
            {entry.sources.map((s, i) => {
              const acc = s.account ? ds.accounts.get(s.account) : undefined
              const dead = s.status === 'dead'
              const statusLabel = s.status === 'alive' ? '已核验可打开' : dead ? '已失效' : '未复查'
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                  <span className="font-mono text-[11px] text-muted">{SOURCE_KIND_LABEL[s.kind] ?? s.kind}</span>
                  {acc && <span className="text-[12px] text-ink">{acc.name}</span>}
                  {s.parts && <span className="font-mono text-[11px] text-faint tnum">{s.parts} P</span>}
                  <span className={`font-mono text-[11px] ${s.status === 'alive' ? 'text-live/80' : dead ? 'text-today/80' : 'text-faint'}`}>
                    {statusLabel}
                  </span>
                  {s.note && <span className="text-[12px] text-faint">{s.note}</span>}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`ml-auto font-mono text-[11px] underline underline-offset-4 ${
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
        <p className="mt-2 font-mono text-[10px] text-faint">
          本站不存放任何视频文件，所有链接均指向原平台。
        </p>
      </section>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">同游戏的其他记录</h2>
          <ul className="space-y-1">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/e/${r.id}/`} className="flex items-baseline gap-3 rounded px-2 py-1.5 hover:bg-surface">
                  <span className="font-mono text-[11px] text-faint tnum">{r.date}</span>
                  <span className="truncate text-[13px] text-ink">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="mt-12 flex justify-between gap-4 border-t border-line pt-6 font-mono text-[11px]">
        {older ? (
          <Link href={`/e/${older.id}/`} className="max-w-[45%] truncate text-muted hover:text-ink">
            ← {older.date} {older.title}
          </Link>
        ) : (
          <span />
        )}
        {newer && (
          <Link href={`/e/${newer.id}/`} className="max-w-[45%] truncate text-right text-muted hover:text-ink">
            {newer.date} {newer.title} →
          </Link>
        )}
      </nav>
    </div>
  )
}
