'use client'

import { useMemo } from 'react'
import { useLiveContent, useSiteCopy } from './LiveContentProvider'
import { TimelineRail, type TimelineRailMark } from './TimelineRail'

export type HomeActRailItem = {
  id: string
  label: string
  years: string
  color: string
  beats: Array<{ id: string; date: string; title: string }>
}

export type HomeSectionRailItem = {
  id: string
  label: string
  meta: string
  color: string
}

type RailMark = {
  id: string
  groupId: string
  date: string
  title: string
  color: string
  kind: 'section' | 'act' | 'event'
}

/**
 * PC 首页右侧章节导航：只做「幕 / 板块 → 刻度」这一层，
 * 刻度、Dock 式放大、预览与拖拽定位都用共用的 TimelineRail。
 * 不画贯穿页面的进度线；每个颜色段本身就是章节边界。
 */
export function HomeActRail({ acts: baselineActs, sections: baselineSections }: { acts: HomeActRailItem[]; sections: HomeSectionRailItem[] }) {
  // 右侧刻度上的幕名、年份、颜色和节点标题都跟着后台走；拉不到就用构建期的值。
  const { narrative } = useLiveContent()
  const copy = useSiteCopy()
  const acts = useMemo(() => {
    const deletedIds = narrative?.deletedIds ?? []
    const deleted = new Set(deletedIds)
    const baselineActsFiltered = baselineActs
      .filter((act) => !deleted.has(act.id) && narrative?.homeActs.find((candidate) => candidate.id === act.id)?.visible !== false)
      .map((act) => {
        const live = narrative?.homeActs.find((candidate) => candidate.id === act.id)
        if (!live) return act
        const visibleBeats = [
          ...live.beats
            .filter(
              (beat) =>
                !deleted.has(beat.id) &&
                beat.visible !== false &&
                (act.beats.some((baseline) => baseline.id === beat.id) || beat.id.startsWith('custom-')),
            )
            .map((beat) => {
              const baseline = act.beats.find((candidate) => candidate.id === beat.id)
              return baseline
                ? { ...baseline, date: beat.date || baseline.date, title: beat.title || baseline.title }
                : { id: beat.id, date: beat.date, title: beat.title }
            }),
          ...act.beats
            .filter((beat) => !live.beats.some((candidate) => candidate.id === beat.id) && !deleted.has(beat.id))
            .map((beat) => ({ id: beat.id, date: beat.date, title: beat.title })),
        ]
        return {
          ...act,
          label: live.kicker || live.label || act.label,
          years: live.years || act.years,
          color: live.color || act.color,
          beats: visibleBeats,
        }
      })
    const customActs = (narrative?.homeActs ?? [])
      .filter(
        (live) =>
          live.id.startsWith('custom-') &&
          !baselineActs.some((act) => act.id === live.id) &&
          !deleted.has(live.id) &&
          live.visible !== false,
      )
      .map((live) => ({
        id: live.id,
        label: live.kicker || live.label || live.title,
        years: live.years,
        color: live.color || '#5A5F73',
        beats: live.beats
          .filter((beat) => !deleted.has(beat.id) && beat.visible !== false)
          .map((beat) => ({ id: beat.id, date: beat.date, title: beat.title })),
      }))
    return [...baselineActsFiltered, ...customActs]
  }, [baselineActs, narrative])
  const sections = baselineSections.map((section) => {
    const block = copy.homeSections.find((candidate) => candidate.id === section.id)
    return block?.title ? { ...section, label: block.title } : section
  })
  const marks = useMemo<RailMark[]>(() => [
    ...(sections[0] ? [{
      id: sections[0].id,
      groupId: sections[0].id,
      date: sections[0].meta,
      title: sections[0].label,
      color: sections[0].color,
      kind: 'section' as const,
    }] : []),
    ...acts.flatMap((act) => [
      {
        id: act.id,
        groupId: act.id,
        date: act.years,
        title: act.label,
        color: act.color,
        kind: 'act' as const,
      },
      ...act.beats.map((beat) => ({
        id: `home-${act.id}-${beat.id}`,
        groupId: act.id,
        date: beat.date,
        title: beat.title,
        color: act.color,
        kind: 'event' as const,
      })),
    ]),
    ...sections.slice(1).map((section) => ({
      id: section.id,
      groupId: section.id,
      date: section.meta,
      title: section.label,
      color: section.color,
      kind: 'section' as const,
    })),
  ], [acts, sections])

  // 必须 memo：TimelineRail 按 marks 的身份重建 IntersectionObserver，
  // 每次渲染都给一份新数组等于每次渲染都重挂一遍观察器。
  const railMarks = useMemo<TimelineRailMark[]>(
    () => marks.map((mark) => ({
      id: mark.id,
      meta: mark.date,
      title: mark.title,
      color: mark.color,
      weight: mark.kind === 'section' ? 'lead' : mark.kind === 'act' ? 'major' : 'minor',
    })),
    [marks],
  )

  return (
    <TimelineRail
      marks={railMarks}
      ariaLabel="首页章节时间轴"
      positionLabel="首页阅读位置"
      height="clamp(26rem,72vh,54rem)"
      magnify={{ radius: 0.115, scale: 2.25 }}
    />
  )
}
