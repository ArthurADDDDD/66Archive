'use client'

import { useMemo, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { EntryRow } from './EntryRow'
import { EntryTimeline } from './EntryTimeline'
import { useSeriesFilter } from './SeriesFilters'

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
  const { year, setYear, order, setOrder } = useSeriesFilter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const visible = useMemo(() => {
    const filtered = year === null ? entries : entries.filter((entry) => Number(entry.date.slice(0, 4)) === year)
    // 原数组是构建期排好的升序，别就地反转
    return order === 'asc' ? filtered : [...filtered].reverse()
  }, [entries, year, order])

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
          {year !== null && (
            <button
              type="button"
              onClick={() => setYear(null)}
              className="ui-press rounded-full border border-line px-4 py-2 text-meta text-muted transition-colors hover:border-muted hover:text-ink sm:px-3 sm:py-1.5"
            >
              清除年份
            </button>
          )}
          {/* 一个按钮在两种顺序之间来回切，标签写的是「点了会变成什么」 */}
          <button
            type="button"
            onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
            title={order === 'asc' ? '当前：最早在前' : '当前：最新在前'}
            className="ui-press flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-meta text-muted transition-colors hover:border-muted hover:text-ink sm:px-3 sm:py-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="stroke-current">
              <path d="M7 4v16M7 20l-3.5-4M7 20l3.5-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 7h7M14 12h5M14 17h3" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {order === 'asc' ? '最早在前' : '最新在前'}
          </button>
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
      </div>

      {visible.length > 10 ? (
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
