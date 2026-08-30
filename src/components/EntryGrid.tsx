'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { EntryDetailBody, useEntrySource } from './EntryDetail'
import { visibleGameIds } from '@/lib/games'
import { PLATFORM_META } from '@/lib/platforms'
import { formatClock, gameColor } from '@/lib/ui'
import type { Platform } from '@/lib/schema'

/**
 * 封面网格：一屏能看到十几条，而不是一行一条往下滚三十屏。
 *
 * 和 B 站的稿件网格是同一种读法（封面 + 时长 + 两行标题），但有一处刻意不同：
 * 本站一条记录可能挂着多个来源，点封面跳走等于把「挑一个源」这件事甩给下一页。
 * 所以这里点开是**就地展开**——详情面板插在被点卡片所在那一行的正下方，
 * 页面不跳转、上下文不丢，和列表视图点开的是同一份 EntryDetailBody。
 *
 * 手机端不用这个视图（一行一列时网格没有意义，只是把列表变高），由调用方决定。
 */
export function EntryGrid({
  entries,
  expandedId,
  onToggle,
  showFullDate = false,
}: {
  entries: TimelineEntry[]
  /** 网格一次只展开一条：整行插入的面板很高，同时开两块就没法对照了。 */
  expandedId: string | null
  onToggle: (id: string) => void
  showFullDate?: boolean
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(1)

  // 面板要插在「被点卡片所在那一行」的末尾，所以得知道当前实际几列。
  // 不去猜断点：直接读 grid 算出来的轨道数，auto-fill 怎么排就是几列。
  const measure = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    const tracks = window.getComputedStyle(grid).gridTemplateColumns
    const next = tracks && tracks !== 'none' ? tracks.split(' ').filter(Boolean).length : 1
    setColumns((current) => (current === next ? current : Math.max(1, next)))
  }, [])

  useLayoutEffect(() => {
    measure()
    const grid = gridRef.current
    if (!grid || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [measure])

  // 展开的那一行可能整块落在视口外（尤其点的是最后一行）；把面板带进视线，但不抢走整屏。
  useEffect(() => {
    if (!expandedId) return
    const panel = panelRef.current
    if (!panel) return
    const frame = requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect()
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) return
      panel.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [expandedId])

  const expandedIndex = expandedId ? entries.findIndex((entry) => entry.id === expandedId) : -1
  const expandedRow = expandedIndex >= 0 ? Math.floor(expandedIndex / columns) : -1
  const expandedEntry = expandedIndex >= 0 ? entries[expandedIndex] : null

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-x-4 gap-y-6 xl:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]"
    >
      {entries.map((entry, index) => {
        const lastInRow = (index + 1) % columns === 0 || index === entries.length - 1
        const closesExpandedRow = expandedRow >= 0 && lastInRow && Math.floor(index / columns) === expandedRow
        return (
          <Fragment key={entry.id}>
            <EntryCard
              entry={entry}
              expanded={entry.id === expandedId}
              onToggle={() => onToggle(entry.id)}
              showFullDate={showFullDate}
            />
            {closesExpandedRow && expandedEntry && (
              <div ref={panelRef} className="col-span-full">
                {/* 小三角指回被点的那张卡，行内插入才不会读成「凭空多出来一块」。 */}
                <span aria-hidden className="relative z-10 block h-2">
                  <span
                    className="ui-panel-in absolute -bottom-[5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-l border-t border-line bg-surface"
                    style={{ left: `${((expandedIndex % columns) + 0.5) / columns * 100}%` }}
                  />
                </span>
                <div
                  id={`entry-preview-${expandedEntry.id}`}
                  className="ui-panel-in overflow-hidden rounded-xl border border-line bg-surface/85 shadow-[0_18px_55px_rgba(0,0,0,0.22)]"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-line/70 px-4 py-2.5">
                    <p className="min-w-0 flex-1 truncate text-meta text-faint tnum">
                      {expandedEntry.date}{expandedEntry.time ? ` ${expandedEntry.time}` : ''} · {expandedEntry.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => onToggle(expandedEntry.id)}
                      className="ui-press shrink-0 rounded-full border border-line px-2.5 py-1 text-meta text-muted transition-colors hover:border-muted hover:text-ink"
                    >
                      收起
                    </button>
                  </div>
                  <EntryDetailBody entry={expandedEntry} />
                </div>
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

/** 一张卡：封面 + 时长 + 两行标题 + 一行元信息。信息量刻意压到「够挑出想看的那条」为止。 */
function EntryCard({
  entry,
  expanded,
  onToggle,
  showFullDate,
}: {
  entry: TimelineEntry
  expanded: boolean
  onToggle: () => void
  showFullDate: boolean
}) {
  const { displayCover } = useEntrySource(entry)
  const platform = PLATFORM_META[entry.platform as Platform]
  const dead = entry.sourceCount > 0 && entry.deadCount === entry.sourceCount
  const compactGameIds = new Set(visibleGameIds(entry.games.map((game) => game.id)))
  const compactGames = entry.games.filter((game) => compactGameIds.has(game.id))
  const dateLabel = showFullDate ? entry.date : entry.date.slice(5).replace('-', '/')

  return (
    <button
      type="button"
      id={`entry-${entry.id}`}
      {...(expanded ? {} : { 'data-analytics-event': 'content.open', 'data-analytics-target': `entry:${entry.id}` })}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={`entry-preview-${entry.id}`}
      className="group ui-press flex min-w-0 scroll-mt-24 flex-col text-left"
    >
      <span
        className={`relative block aspect-video w-full overflow-hidden rounded-lg border bg-raised transition-[border-color,box-shadow] duration-300 ${
          expanded ? 'border-live/70 shadow-[0_10px_30px_rgba(91,200,232,0.16)]' : 'border-line/70 group-hover:border-muted'
        }`}
      >
        {displayCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayCover}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] ${dead ? 'opacity-45 grayscale' : ''}`}
          />
        ) : (
          <span className="flex h-full items-center justify-center text-meta text-faint">无封面</span>
        )}

        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />

        {/* 时长是这张卡上唯一的度量衡；未知时不画一个假的短条，直接写「时长未知」。 */}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white tnum">
          {entry.duration_min ? formatClock(entry.duration_min) : '时长未知'}
        </span>

        <span className="absolute left-1.5 top-1.5 flex items-center gap-1">
          {entry.sourceCount > 1 && (
            <span className="rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] font-medium text-live tnum">{entry.sourceCount} 源</span>
          )}
          {dead && <span className="rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-faint">链接已失效</span>}
        </span>

        {/* 点开＝就地展开，不跳站外。这句提示只在悬停时出现，免得每张卡都挂着一行说明。 */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-base/45 text-meta text-white opacity-0 backdrop-blur-[1px] transition-opacity duration-300 ${expanded ? '' : 'group-hover:opacity-100'}`}
        >
          <span className="rounded-full border border-white/25 bg-black/55 px-3 py-1.5">
            {entry.sourceCount > 1 ? `展开 ${entry.sourceCount} 个来源` : '展开详情'}
          </span>
        </span>
      </span>

      <span className="mt-2 block min-w-0">
        <span
          className={`line-clamp-2 text-control leading-snug transition-colors ${
            dead ? 'text-muted line-through decoration-faint' : 'text-ink group-hover:text-live'
          }`}
        >
          {entry.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-faint tnum">
          <span className="font-mono">{dateLabel}</span>
          <span className="text-line">·</span>
          <span style={{ color: platform?.color }}>{platform?.name ?? entry.platform}</span>
        </span>
        {compactGames.length > 0 && (
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-muted">
            {compactGames.slice(0, 2).map((game) => (
              <span key={game.id} className="flex min-w-0 items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: gameColor(game.id) }} />
                <span className="truncate">{game.name}</span>
              </span>
            ))}
            {compactGames.length > 2 && <span className="text-faint">+{compactGames.length - 2}</span>}
          </span>
        )}
      </span>
    </button>
  )
}
