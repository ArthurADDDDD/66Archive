'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { TimelineEntry } from '@/lib/data'
import { MONTH_CN } from '@/lib/ui'
import { TimelineRail, type TimelineRailMark } from './TimelineRail'
// 只能引类型：从 EntryMobileIndex 引任何值，打包时整个模块都会被拉回这一块，按需加载就白做了。
import type { MonthGroup } from './EntryMobileIndex'

/** 与 EntryMobileIndex 里的同名常量一致：右侧轨道从 md 起才出现。 */
const RAIL_HIDDEN_QUERY = '(max-width: 767px)'

/**
 * 手机端的年月索引按需加载：电脑端有右侧轨道，永远不会请求这一块；
 * 手机上也是水合之后才去拿，不占首屏。
 */
const EntryMobileIndex = dynamic(() => import('./EntryMobileIndex').then((module) => module.EntryMobileIndex), {
  ssr: false,
})

/**
 * 条目正文右侧的年月索引（只有轨道，不管正文怎么排）。
 *
 * 刻度和首页共用 TimelineRail：月份越密集，刻度越长、越亮；悬停时会放大并显示
 * 该月第一张可用封面，点击或拖动才定位正文。列表和封面网格都用它——网格的卡片
 * 同样带 `entry-<id>` 锚点，轨道不需要知道正文是横排还是网格。
 *
 * 手机上轨道放不下，改由底部的年月胶囊（`EntryMobileIndex`）承担同一件事。
 */
export function EntryMonthRail({
  entries,
  indexEntries = entries,
  color = '#5BC8E8',
  unit = '条',
  onMissingTarget,
}: {
  entries: TimelineEntry[]
  /** 可比正文更完整：分批渲染时仍保留完整年月索引。 */
  indexEntries?: TimelineEntry[]
  color?: string
  /** 计数单位：节目是「期」，游戏是「场」。 */
  unit?: string
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

  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const media = window.matchMedia(RAIL_HIDDEN_QUERY)
    const sync = () => setPhone(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

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
      {phone && (
        <EntryMobileIndex
          groups={groups}
          lastEntryId={entries[entries.length - 1]?.id ?? null}
          total={indexEntries.length}
          color={color}
          unit={unit}
          onMissingTarget={onMissingTarget}
        />
      )}
    </>
  )
}

/** 年月轴 + 原来的横向条目列表：列表视图的组合，网格视图直接用 EntryMonthRail。 */
export function EntryTimeline({
  entries,
  indexEntries = entries,
  color = '#5BC8E8',
  unit = '条',
  renderEntry,
  onMissingTarget,
}: {
  entries: TimelineEntry[]
  indexEntries?: TimelineEntry[]
  color?: string
  unit?: string
  renderEntry: (entry: TimelineEntry) => ReactNode
  onMissingTarget?: (id: string) => void
}) {
  const counts = useMemo(() => new Map(groupByMonth(indexEntries).map((group) => [group.key, group.count])), [indexEntries])

  return (
    <>
      <EntryMonthRail
        entries={entries}
        indexEntries={indexEntries}
        color={color}
        unit={unit}
        onMissingTarget={onMissingTarget}
      />

      <div aria-label="按年月查找条目" className="entry-landing-stage w-full divide-y divide-line/50 border-y border-line/60">
        {entries.map((entry, index) => {
          const key = entry.date.slice(0, 7)
          const previous = entries[index - 1]
          const newMonth = previous?.date.slice(0, 7) !== key
          const newYear = previous?.date.slice(0, 4) !== entry.date.slice(0, 4)
          return (
            <div key={entry.id}>
              {/* 手机上没有右侧轨道：列表里自己标出「现在翻到哪一年哪一月」。 */}
              {newMonth && (
                <p className="flex items-baseline gap-2 px-1 pb-1.5 pt-4 text-meta text-faint tnum md:hidden">
                  <span className={newYear ? 'text-[0.9375rem] font-semibold text-ink' : 'text-muted'}>
                    {entry.date.slice(0, 4)} 年 {Number(entry.date.slice(5, 7))} 月
                  </span>
                  <span>· {counts.get(key) ?? 1} {unit}</span>
                </p>
              )}
              {renderEntry(entry)}
            </div>
          )
        })}
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
