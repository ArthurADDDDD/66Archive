'use client'

import { useMemo } from 'react'
import type { ResolvedBeat } from '@/lib/narrative'
import type { StorySection } from '@/lib/story-years'
import { applyLiveStoryYears } from '@/lib/live-content'
import { useLiveContent } from './LiveContentProvider'
import { chronicleDate } from './StoryTimeline'
import { TimelineRail, type TimelineRailMark } from './TimelineRail'

type ChronicleMark = {
  id: string
  year: string
  date: string
  title: string
  cover?: string | null
  color: string
  important: boolean
  kind: 'year' | 'memory'
}

function marksForSection(section: StorySection): ChronicleMark[] {
  const beats = [...section.featured, ...section.secondary].filter(
    (beat, index, list) => list.findIndex((candidate) => candidate.id === beat.id) === index,
  )

  if (beats.length === 0) {
    return [{
      id: `story-year-${section.year}`,
      year: section.label,
      date: section.label,
      title: section.archiveCount > 0 ? `${section.archiveCount.toLocaleString()} 条档案记录` : '这一年的资料仍在补充',
      color: section.accent,
      important: false,
      kind: 'year',
    }]
  }

  return beats.map((beat: ResolvedBeat, index) => ({
    id: `story-beat-${beat.id}`,
    year: section.label,
    date: chronicleDate(beat.date),
    title: beat.title,
    cover: beat.cover,
    color: section.accent,
    important: Boolean(beat.important),
    kind: index === 0 ? 'year' : 'memory',
  }))
}

/**
 * Chronicle 的桌面端快速时间轴：只做「数据 → 刻度」这一层，
 * 刻度、悬停放大、预览卡与拖动定位都交给共用的 TimelineRail。
 *
 * 刻度不维护第二份静态清单：它和正文一起消费后台实时 narrative，后台新增、隐藏、
 * 排序后的合法节点会同时出现在正文与这里。带真实封面的节点在 hover 时显示画面。
 */
export function ChronicleRail({ sections: baselineSections }: { sections: StorySection[] }) {
  const { narrative } = useLiveContent()
  const sections = useMemo(
    () => applyLiveStoryYears(baselineSections, narrative?.storyActs, narrative?.deletedIds ?? []),
    [baselineSections, narrative],
  )
  const marks = useMemo<TimelineRailMark[]>(
    () => sections.flatMap(marksForSection).map((mark) => ({
      id: mark.id,
      meta: mark.year,
      title: mark.title,
      color: mark.color,
      cover: mark.cover,
      weight: mark.kind === 'year' ? 'lead' : 'minor',
      badge: mark.important ? '关键节点' : null,
      footer: mark.date,
    })),
    [sections],
  )

  return (
    <TimelineRail
      marks={marks}
      ariaLabel="编年史快速时间轴"
      positionLabel="编年史阅读位置"
      height="clamp(28rem,76vh,58rem)"
    />
  )
}
