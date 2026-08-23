'use client'

import { useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { EntryRow } from './EntryRow'
import { EntryTimeline } from './EntryTimeline'

/**
 * 节目全部期数。
 * 列表一条不省；点击某一期后在当前页面展开来源、分段和标签信息，
 * 不再把查找动作变成 /e/ 的完整详情页跳转。系列跨年份，所以这里显示完整日期。
 */
export function SeriesEpisodes({
  entries,
  color,
  count,
  unit = '期',
}: {
  entries: TimelineEntry[]
  color: string
  count: number
  unit?: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const allExpanded = entries.length > 0 && expanded.size === entries.length
  const expandAll = () => setExpanded(new Set(entries.map((entry) => entry.id)))
  const collapseAll = () => setExpanded(new Set())

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-meta text-faint">
          {unit === '场' ? '点击记录' : '点击期数'}展开原平台来源、分段和标签信息
          <span className="ml-2 tnum">· {count} {unit}</span>
        </p>
        <button
          type="button"
          onClick={allExpanded ? collapseAll : expandAll}
          aria-expanded={allExpanded}
          className={`ui-press rounded-full border px-4 py-2 text-meta transition-colors sm:px-3 sm:py-1.5 ${
            allExpanded
              ? 'border-line text-muted hover:border-muted hover:text-ink'
              : 'bg-surface/30 hover:bg-surface'
          }`}
          style={!allExpanded ? { borderColor: `${color}80`, color } : undefined}
        >
          {allExpanded ? '全部折叠' : '全部展开'}
        </button>
      </div>

      {entries.length > 10 ? (
        <div className="mt-4 w-full">
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
        <div className="mt-4 w-full divide-y divide-line/50 border-y border-line/60">
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
