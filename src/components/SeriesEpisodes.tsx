'use client'

import { useMemo, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { EntryGrid } from './EntryGrid'
import { EntryRow } from './EntryRow'
import { EntryTimeline } from './EntryTimeline'
import { EntryViewToggle, useEntryView } from './EntryViewMode'
import { applyEntryFilter, ClearYearButton, OrderToggle, useEntryFilter } from './EntryFilters'

/**
 * 节目全部期数。
 * 列表一条不省；点击某一期后在当前页面展开来源、分段和标签信息，
 * 不再把查找动作变成 /e/ 的完整详情页跳转。系列跨年份，所以这里显示完整日期。
 *
 * 年份筛选与正倒序都作用在同一份 entries 上——右侧那条年月时间轴是从 entries
 * 现算的（EntryTimeline 内部 groupByMonth），所以刻度、游标、悬停标签会跟着一起变，
 * 不需要额外通知它。
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
  const { year, order } = useEntryFilter()
  const { view, setView, compact } = useEntryView()
  // 网格一次只展开一条：整行插入的详情面板很高，同时开两块就没法对照了。
  const [gridExpandedId, setGridExpandedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // buildSeries 交出来的是升序（第一期在前）
  const visible = useMemo(() => applyEntryFilter(entries, year, order, 'asc'), [entries, year, order])

  const allExpanded = visible.length > 0 && visible.every((entry) => expanded.has(entry.id))
  const expandAll = () => setExpanded(new Set(visible.map((entry) => entry.id)))
  const collapseAll = () => setExpanded(new Set())

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const row = (entry: TimelineEntry) => (
    <EntryRow entry={entry} expanded={expanded.has(entry.id)} showFullDate onToggle={() => toggle(entry.id)} />
  )

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-meta text-faint">
          {unit === '场' ? '点击记录' : '点击期数'}展开原平台来源、分段和标签信息
          {year === null ? (
            <span className="ml-2 tnum">· {count} {unit}</span>
          ) : (
            <span className="ml-2 tnum" style={{ color }}>
              · {year} 年 · {visible.length} {unit}
              <span className="text-faint">（共 {count} {unit}）</span>
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ClearYearButton />
          <OrderToggle />
          <EntryViewToggle view={view} setView={setView} compact={compact} />
          {view === 'list' && (
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
          )}
        </div>
      </div>

      {view === 'grid' ? (
        <div className="mt-4 w-full">
          <EntryGrid
            entries={visible}
            expandedId={gridExpandedId}
            onToggle={(id) => setGridExpandedId(gridExpandedId === id ? null : id)}
            showFullDate
          />
        </div>
      ) : visible.length > 10 ? (
        <div className="mt-4 w-full">
          {/* key 让筛选/换序后时间轴从头量一遍，不留上一份的游标位置 */}
          <EntryTimeline key={`${year ?? 'all'}-${order}`} entries={visible} color={color} renderEntry={row} />
        </div>
      ) : (
        <div className="mt-4 w-full divide-y divide-line/50 border-y border-line/60">
          {visible.map((entry) => (
            <div key={entry.id}>{row(entry)}</div>
          ))}
        </div>
      )}
    </div>
  )
}
