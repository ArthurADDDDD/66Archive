'use client'

import { useMemo } from 'react'
import type { ResolvedBeat } from '@/lib/narrative'
import type { StorySection } from '@/lib/story-years'
import { applyLiveStoryYears } from '@/lib/live-content'
import { CHRONICLE_ERAS, eraOfYear, type ChronicleEraId } from '@/lib/chronicle-eras'
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
  era: ChronicleEraId
}

const ERA_LABEL = new Map(CHRONICLE_ERAS.map((era) => [era.id, era.label]))
const ERA_COLOR = new Map(CHRONICLE_ERAS.map((era) => [era.id, era.color]))

/**
 * 一张卡一个刻度，id 就是正文里那张卡的 DOM id（`story-beat-…`），跳转直接落到那张卡上。
 * 顺序必须和正文一致：正文先排精选卡、再排其余卡，两组各自按日期排（见 story-years /
 * live-content 的 byStoryDate），这里照同样的顺序展开。
 */
function marksForSection(section: StorySection): ChronicleMark[] {
  const era = eraOfYear(section.year)
  const color = ERA_COLOR.get(era) ?? section.accent
  const featured = section.featured?.length ? section.featured : section.hero ? [section.hero] : []
  const beats = [...featured, ...section.secondary].filter(
    (beat, index, list) => list.findIndex((candidate) => candidate.id === beat.id) === index,
  )

  if (beats.length === 0) {
    return [{
      id: `story-year-${section.year}`,
      year: section.label,
      date: section.label,
      title: section.archiveCount > 0 ? `${section.archiveCount.toLocaleString()} 条档案记录` : '这一年的资料仍在补充',
      color,
      important: false,
      kind: 'year',
      era,
    }]
  }

  return beats.map((beat: ResolvedBeat, index) => ({
    id: `story-beat-${beat.id}`,
    year: section.label,
    date: chronicleDate(beat.date),
    title: beat.title,
    cover: beat.cover,
    color,
    important: Boolean(beat.important),
    kind: index === 0 ? 'year' : 'memory',
    era,
  }))
}

/**
 * 大事件的桌面端快速时间轴。
 *
 * 轨道画的是**三个时代的全部条目**，按时代上色，预览卡底栏写明「斗鱼156277 · 2016.06」。
 * 正文一次只显示一个时代，所以点到别的时代的刻度时，目标卡还不在页面上——
 * TimelineRail 会回调 onMissingTarget，这里把它交给页面：先切时代，再落到那张卡。
 */
export function ChronicleRail({
  sections: baselineSections,
  onJumpToEra,
}: {
  sections: StorySection[]
  onJumpToEra: (era: ChronicleEraId, targetId: string) => void
}) {
  const { narrative } = useLiveContent()
  const sections = useMemo(
    () => applyLiveStoryYears(baselineSections, narrative?.storyActs, narrative?.deletedIds ?? []),
    [baselineSections, narrative],
  )
  const chronicleMarks = useMemo(() => sections.flatMap(marksForSection), [sections])
  const eraById = useMemo(() => new Map(chronicleMarks.map((mark) => [mark.id, mark.era])), [chronicleMarks])
  const marks = useMemo<TimelineRailMark[]>(
    () => chronicleMarks.map((mark) => ({
      id: mark.id,
      meta: mark.year,
      title: mark.title,
      color: mark.color,
      cover: mark.cover,
      weight: mark.kind === 'year' ? 'lead' : 'minor',
      badge: mark.important ? '关键节点' : null,
      footer: `${ERA_LABEL.get(mark.era) ?? ''} · ${mark.date}`,
    })),
    [chronicleMarks],
  )

  return (
    <TimelineRail
      marks={marks}
      ariaLabel="大事件快速时间轴"
      positionLabel="大事件阅读位置"
      height="clamp(28rem,76vh,58rem)"
      onMissingTarget={(id) => {
        const era = eraById.get(id)
        if (era) onJumpToEra(era, id)
      }}
    />
  )
}
