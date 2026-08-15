'use client'

import { useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { EntryRow } from './EntryRow'
import { EntryTimeline } from './EntryTimeline'

/**
 * 游戏详情页的相关场次：整行就地展开播放预览，不把点击行为变成详情页跳转。
 * 默认全部打开，让多日期、多视频的关系一次呈现；点击整行仍可单独收起或展开。
 */
export function GameSessions({ entries, color = '#E0A244' }: { entries: TimelineEntry[]; color?: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(entries.map((entry) => entry.id)))
  const allExpanded = expanded.size === entries.length
  const expandAll = () => setExpanded(new Set(entries.map((entry) => entry.id)))
  const collapseAll = () => setExpanded(new Set())

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-meta uppercase tracking-[0.16em] text-faint">Sessions · 这些晚上</p>
          <h2 className="mt-2 text-h3 font-semibold text-ink">档案里的相关场次</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={allExpanded ? collapseAll : expandAll}
            aria-expanded={allExpanded}
            className={`ui-press rounded-full border px-4 py-2 text-meta transition-colors sm:px-3 sm:py-1.5 ${
              allExpanded
                ? 'border-line text-muted hover:border-muted hover:text-ink'
                : 'border-live/50 bg-live/5 text-live hover:border-live hover:bg-live/10'
            }`}
          >
            {allExpanded ? '全部折叠' : '全部展开'}
          </button>
        </div>
      </div>

      {entries.length > 10 ? (
        <div className="mt-6 w-full">
          <EntryTimeline
            entries={entries}
            color={color}
            renderEntry={(entry) => (
              <EntryRow
                entry={entry}
                expanded={expanded.has(entry.id)}
                showFullDate
                onToggle={() => {
                  setExpanded((current) => {
                    const next = new Set(current)
                    if (next.has(entry.id)) next.delete(entry.id)
                    else next.add(entry.id)
                    return next
                  })
                }}
              />
            )}
          />
        </div>
      ) : (
        <div className="mt-6 w-full divide-y divide-line/50 border-y border-line/60">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              expanded={expanded.has(entry.id)}
              showFullDate
              onToggle={() => {
                setExpanded((current) => {
                  const next = new Set(current)
                  if (next.has(entry.id)) next.delete(entry.id)
                  else next.add(entry.id)
                  return next
                })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
