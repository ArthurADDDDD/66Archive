'use client'

import { useMemo, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { formatDuration } from '@/lib/ui'
import { ArchiveRow, SourceCount } from './primitives'

/**
 * 节目全部期数。
 * 桌面（sm+）：完整列表一条不省（与之前一致）。
 * 移动端：期数 <= 15 直接全部展示；超过 15 期时——
 *   1. 「先看几期」：第一期 + 按时间均匀采样 + 最后一期（诚实标注采样方式，不编「经典」）；
 *   2. 「全部节目」：按年份折叠的 accordion（一次只展开一年，默认全部关闭）。
 * 数据一条不少，只是移动端先给入口。
 */
export function SeriesEpisodes({
  entries,
  color,
  count,
}: {
  entries: TimelineEntry[]
  color: string
  count: number
}) {
  // 采样：第一期 + 均匀取 8 条中间 + 最后一期（确定性，构建期无随机）
  const sampled = useMemo(() => {
    if (entries.length <= 15) return null
    const n = entries.length
    const idx = new Set<number>([0, n - 1])
    for (let i = 1; i <= 8; i++) idx.add(Math.floor((n * i) / 9))
    return [...idx]
      .sort((a, b) => a - b)
      .map((i) => entries[i])
  }, [entries])

  const byYear = useMemo(() => {
    const map = new Map<number, TimelineEntry[]>()
    for (const e of entries) {
      const y = Number(e.date.slice(0, 4))
      const list = map.get(y)
      if (list) list.push(e)
      else map.set(y, [e])
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]) // 近年在前
  }, [entries])

  const [openYear, setOpenYear] = useState<number | null>(null)

  return (
    <>
      {/* 桌面：完整列表，一条不省 */}
      <ul className="hidden divide-y divide-line/60 border-b border-line/60 sm:block">
        {entries.map((e) => (
          <li key={e.id}>
            <ArchiveRow
              href={`/e/${e.id}/`}
              date={e.date}
              title={e.title}
              meta={e.duration_min != null ? formatDuration(e.duration_min) : undefined}
              right={<SourceCount count={e.sources.length} />}
              accent={color}
            />
          </li>
        ))}
      </ul>

      {/* 移动端：先看几期 + 年份折叠 */}
      <div className="sm:hidden">
        {sampled ? (
          <>
            <div className="rounded-lg border border-line/80 bg-surface/25 p-3">
              <p className="flex items-center justify-between gap-2 font-mono text-[10px] text-faint/80">
                先看几期 · 第一期 / 按时间采样 / 最后一期
                <span className="tnum">{count} 期</span>
              </p>
              <ul className="mt-1">
                {sampled.map((e) => (
                  <li key={e.id}>
                    <ArchiveRow
                      href={`/e/${e.id}/`}
                      date={e.date}
                      title={e.title}
                      meta={e.duration_min != null ? formatDuration(e.duration_min) : undefined}
                      accent={color}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 border-b border-line/60">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint/80">全部节目 · 按年展开</p>
              <div className="mt-2">
                {byYear.map(([year, list]) => {
                  const open = openYear === year
                  return (
                    <div key={year} className="border-b border-line/50">
                      <button
                        type="button"
                        onClick={() => setOpenYear(open ? null : year)}
                        aria-expanded={open}
                        className="ui-press flex min-h-[44px] w-full items-center justify-between gap-3 px-1 py-2 font-mono text-[11px] text-muted transition-colors hover:text-ink"
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="font-display text-[16px] font-bold text-ink tnum">{year}</span>
                          <span className="text-faint tnum">{list.length} 期</span>
                        </span>
                        <span
                          aria-hidden
                          className="text-faint/60 transition-transform duration-200"
                          style={{ color: open ? color : undefined, transform: open ? 'rotate(180deg)' : undefined }}
                        >
                          ⌄
                        </span>
                      </button>
                      {open && (
                        <ul className="ui-panel-in border-t border-line/40">
                          {list.map((e) => (
                            <li key={e.id}>
                              <ArchiveRow
                                href={`/e/${e.id}/`}
                                date={e.date}
                                title={e.title}
                                meta={e.duration_min != null ? formatDuration(e.duration_min) : undefined}
                                right={<SourceCount count={e.sources.length} />}
                                accent={color}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <ul className="divide-y divide-line/60 border-b border-line/60">
            {entries.map((e) => (
              <li key={e.id}>
                <ArchiveRow
                  href={`/e/${e.id}/`}
                  date={e.date}
                  title={e.title}
                  meta={e.duration_min != null ? formatDuration(e.duration_min) : undefined}
                  right={<SourceCount count={e.sources.length} />}
                  accent={color}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
