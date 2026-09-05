'use client'

import { useMemo, type ReactNode } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { MONTH_CN } from '@/lib/ui'
import { TimelineRail, type TimelineRailMark } from './TimelineRail'

type MonthGroup = {
  key: string
  year: string
  month: number
  count: number
  firstEntryId: string
  firstEntryTitle: string
  cover: string | null
}

/**
 * 条目列表右侧的年月索引。
 *
 * 目录仍然保持原来的横向条目布局，刻度和首页共用 TimelineRail：月份越密集，
 * 刻度越长、越亮；悬停时会放大并显示该月第一张可用封面，点击或拖动才定位正文。
 */
export function EntryTimeline({
  entries,
  indexEntries = entries,
  color = '#5BC8E8',
  renderEntry,
  onMissingTarget,
}: {
  entries: TimelineEntry[]
  /** 可比正文更完整：分批渲染时仍保留完整年月索引。 */
  indexEntries?: TimelineEntry[]
  color?: string
  renderEntry: (entry: TimelineEntry) => ReactNode
  onMissingTarget?: (id: string) => void
}) {
  const groups = useMemo(() => groupByMonth(indexEntries), [indexEntries])
  const maxCount = useMemo(() => Math.max(1, ...groups.map((group) => group.count)), [groups])
  const marks = useMemo<TimelineRailMark[]>(
    () => groups.map((group) => ({
      id: `entry-${group.firstEntryId}`,
      meta: `${group.year}.${String(group.month).padStart(2, '0')}`,
      title: group.firstEntryTitle,
      color,
      cover: group.cover,
      weight: weightForCount(group.count, maxCount),
      footer: `${MONTH_CN[group.month - 1]} · ${group.count} 条记录`,
    })),
    [color, groups, maxCount],
  )

  return (
    <>
      <TimelineRail
        marks={marks}
        ariaLabel="条目年月时间轴"
        positionLabel="按年月查找条目"
        onMissingTarget={onMissingTarget}
        targetVersion={entries.length}
        height="clamp(26rem,72vh,54rem)"
        magnify={{ radius: 0.115, scale: 2.25 }}
      />

      <div aria-label="按年月查找条目" className="w-full divide-y divide-line/50 border-y border-line/60">
        {entries.map((entry) => (
          <div key={entry.id}>{renderEntry(entry)}</div>
        ))}
      </div>
    </>
  )
}

function weightForCount(count: number, maxCount: number): TimelineRailMark['weight'] {
  const ratio = count / maxCount
  if (ratio >= 0.75) return 'lead'
  if (ratio >= 0.4) return 'major'
  return 'minor'
}

function groupByMonth(entries: TimelineEntry[]): MonthGroup[] {
  const grouped = new Map<string, MonthGroup>()
  for (const entry of entries) {
    const key = entry.date.slice(0, 7)
    const current = grouped.get(key)
    if (current) {
      current.count += 1
      if (!current.cover && entry.cover) current.cover = entry.cover
      continue
    }
    grouped.set(key, {
      key,
      year: entry.date.slice(0, 4),
      month: Number(entry.date.slice(5, 7)),
      count: 1,
      firstEntryId: entry.id,
      firstEntryTitle: entry.title,
      cover: entry.cover,
    })
  }
  return [...grouped.values()]
}
