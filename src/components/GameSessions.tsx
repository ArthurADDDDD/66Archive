'use client'

import { useMemo, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { EntryRow } from './EntryRow'
import { EntryTimeline } from './EntryTimeline'
import { applyEntryFilter, ClearYearButton, OrderToggle, useEntryFilter } from './EntryFilters'

/**
 * 游戏详情页的相关场次：整行就地展开播放预览，不把点击行为变成详情页跳转。
 * 默认全部打开，让多日期、多视频的关系一次呈现；点击整行仍可单独收起或展开。
 *
 * 年份筛选来自上面那张「年份分布」条形图（点某一年就只看那一年），
 * 正倒序则是这里的切换键。右侧年月时间轴从 entries 现算，跟着一起变。
 */
export function GameSessions({ entries, color = '#E0A244' }: { entries: TimelineEntry[]; color?: string }) {
  const { year, order } = useEntryFilter()
  // getGameProfile 交出来的是降序（最近一场在前）
  const visible = useMemo(() => applyEntryFilter(entries, year, order, 'desc'), [entries, year, order])

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(entries.map((entry) => entry.id)))
  const allExpanded = visible.length > 0 && visible.every((entry) => expanded.has(entry.id))
  const expandAll = () => setExpanded(new Set([...expanded, ...visible.map((entry) => entry.id)]))
  const collapseAll = () =>
    setExpanded((current) => {
      const next = new Set(current)
      for (const entry of visible) next.delete(entry.id)
      return next
    })

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
        <div>
          <p className="text-meta uppercase tracking-[0.16em] text-faint">Sessions · 这些晚上</p>
          <h2 className="mt-2 text-h3 font-semibold text-ink">
            档案里的相关场次
            {year !== null && (
              <span className="ml-2 text-control font-normal tnum" style={{ color }}>
                · {year} 年 · {visible.length} 场
                <span className="text-faint">（共 {entries.length} 场）</span>
              </span>
            )}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ClearYearButton />
          <OrderToggle />
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

      {visible.length > 10 ? (
        <div className="mt-6 w-full">
          {/* key 让筛选/换序后时间轴从头量一遍，不留上一份的游标位置 */}
          <EntryTimeline key={`${year ?? 'all'}-${order}`} entries={visible} color={color} renderEntry={row} />
        </div>
      ) : (
        <div className="mt-6 w-full divide-y divide-line/50 border-y border-line/60">
          {visible.map((entry) => (
            <div key={entry.id}>{row(entry)}</div>
          ))}
        </div>
      )}
    </div>
  )
}
