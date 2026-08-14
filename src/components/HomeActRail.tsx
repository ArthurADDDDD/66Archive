'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveContent, useSiteCopy } from './LiveContentProvider'

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
 * PC 首页右侧章节导航：彩色分段刻度 + Dock 式连续放大 + 拖拽预览。
 * 不画贯穿页面的进度线；每个颜色段本身就是章节边界。
 */
export function HomeActRail({ acts: baselineActs, sections: baselineSections }: { acts: HomeActRailItem[]; sections: HomeSectionRailItem[] }) {
  // 右侧刻度上的幕名、年份、颜色和节点标题都跟着后台走；拉不到就用构建期的值。
  const { narrative } = useLiveContent()
  const copy = useSiteCopy()
  const acts = baselineActs.map((act) => {
    const live = narrative?.homeActs.find((candidate) => candidate.id === act.id)
    if (!live) return act
    const visibleBeats = act.beats
      .filter((beat) => live.beats.find((candidate) => candidate.id === beat.id)?.visible !== false)
      .map((beat) => {
        const override = live.beats.find((candidate) => candidate.id === beat.id)
        return override ? { ...beat, date: override.date || beat.date, title: override.title || beat.title } : beat
      })
    return {
      ...act,
      label: live.kicker || live.label || act.label,
      years: live.years || act.years,
      color: live.color || act.color,
      beats: visibleBeats,
    }
  }).filter((act) => narrative?.homeActs.find((candidate) => candidate.id === act.id)?.visible !== false)
  const sections = baselineSections.map((section) => {
    const block = copy.homeSections.find((candidate) => candidate.id === section.id)
    return block?.title ? { ...section, label: block.title } : section
  })
  const railRef = useRef<HTMLDivElement>(null)
  const markRefs = useRef<(HTMLSpanElement | null)[]>([])
  const draggingRef = useRef(false)
  const hoverFrameRef = useRef<number | null>(null)
  const [activeId, setActiveId] = useState(sections[0]?.id ?? 'home-top')
  const [hoverPct, setHoverPct] = useState<number | null>(null)
  const [dragPct, setDragPct] = useState<number | null>(null)

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

  useEffect(() => {
    let frame = 0
    const update = () => {
      const focusY = window.innerHeight * 0.46
      let current = marks[0]?.id ?? ''
      for (const mark of marks) {
        const element = document.getElementById(mark.id)
        if (!element) continue
        if (element.getBoundingClientRect().top <= focusY) current = mark.id
        else break
      }
      setActiveId(current)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
    }
  }, [marks])

  const activeIndex = Math.max(0, marks.findIndex((mark) => mark.id === activeId))
  const previewPct = dragPct ?? hoverPct
  const previewIndex = previewPct == null
    ? activeIndex
    : Math.max(0, Math.min(marks.length - 1, Math.round(previewPct * (marks.length - 1))))
  const previewMark = marks[previewIndex]

  // 高频 hover 只直接修改刻度 DOM；React 仅更新单个 tooltip 的内容与位置。
  useEffect(() => {
    const radius = 0.115
    for (let index = 0; index < marks.length; index += 1) {
      const element = markRefs.current[index]
      if (!element) continue
      const mark = marks[index]
      const pos = marks.length > 1 ? index / (marks.length - 1) : 0
      const baseScale = mark.kind === 'section' ? 1.22 : mark.kind === 'act' ? 1.12 : 1
      const baseOpacity = index === activeIndex ? 0.9 : mark.kind === 'event' ? 0.18 : 0.34

      if (previewPct == null) {
        element.style.transform = `scaleX(${baseScale})`
        element.style.opacity = String(baseOpacity)
        continue
      }

      const distance = Math.abs(pos - previewPct)
      const proximity = Math.max(0, 1 - distance / radius)
      const eased = proximity * proximity * (3 - 2 * proximity)
      const scale = baseScale + 2.25 * eased
      const opacity = baseOpacity + (0.98 - baseOpacity) * eased
      element.style.transform = `scaleX(${scale.toFixed(3)})`
      element.style.opacity = opacity.toFixed(3)
    }
  }, [activeIndex, marks, previewPct])

  const getPct = useCallback((clientY: number) => {
    const rail = railRef.current
    if (!rail) return null
    const rect = rail.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
  }, [])

  const scheduleHover = useCallback((pct: number | null) => {
    if (hoverFrameRef.current !== null) cancelAnimationFrame(hoverFrameRef.current)
    hoverFrameRef.current = requestAnimationFrame(() => setHoverPct(pct))
  }, [])

  const jumpToIndex = useCallback((index: number) => {
    const mark = marks[Math.max(0, Math.min(marks.length - 1, index))]
    const target = mark ? document.getElementById(mark.id) : null
    if (!target) return
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
    window.history.replaceState(null, '', `#${mark.id}`)
  }, [marks])

  const commitDrag = useCallback((clientY?: number) => {
    if (!draggingRef.current) return
    const pct = clientY == null ? dragPct : getPct(clientY)
    draggingRef.current = false
    setDragPct(null)
    if (pct != null) jumpToIndex(Math.round(pct * (marks.length - 1)))
  }, [dragPct, getPct, jumpToIndex, marks.length])

  useEffect(() => {
    const onPointerUp = (event: PointerEvent) => commitDrag(event.clientY)
    window.addEventListener('pointerup', onPointerUp)
    return () => window.removeEventListener('pointerup', onPointerUp)
  }, [commitDrag])

  useEffect(() => () => {
    if (hoverFrameRef.current !== null) cancelAnimationFrame(hoverFrameRef.current)
  }, [])

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pct = getPct(event.clientY)
    scheduleHover(pct)
    if (draggingRef.current && pct != null) setDragPct(pct)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return
    event.preventDefault()
    const pct = getPct(event.clientY)
    draggingRef.current = true
    scheduleHover(pct)
    setDragPct(pct)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault()
      jumpToIndex(activeIndex + 1)
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault()
      jumpToIndex(activeIndex - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      jumpToIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      jumpToIndex(marks.length - 1)
    }
  }

  if (marks.length === 0) return null

  return (
    <aside className="pointer-events-none fixed inset-y-0 right-0 z-30 hidden xl:flex xl:items-center" aria-label="首页章节时间轴">
      <div
        ref={railRef}
        className={`home-section-rail pointer-events-auto relative h-[clamp(26rem,72vh,54rem)] w-[clamp(5rem,6vw,7rem)] cursor-grab select-none active:cursor-grabbing ${dragPct != null ? 'is-dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="首页阅读位置"
        aria-valuemin={1}
        aria-valuemax={marks.length}
        aria-valuenow={activeIndex + 1}
        aria-valuetext={`${marks[activeIndex]?.date}，${marks[activeIndex]?.title}`}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => {
          if (!draggingRef.current) scheduleHover(null)
        }}
        onKeyDown={handleKeyDown}
      >
        <span aria-hidden className="home-section-rail__edge absolute inset-y-0 right-0 w-full" />
        {marks.map((mark, index) => {
          const top = marks.length > 1 ? (index / (marks.length - 1)) * 100 : 0
          const active = index === activeIndex
          return (
            <span
              key={mark.id}
              ref={(element) => { markRefs.current[index] = element }}
              aria-hidden
              className={`home-section-rail__mark absolute right-[clamp(0.5rem,1vw,1.25rem)] rounded-full ${mark.kind === 'section' ? 'home-section-rail__mark--section' : mark.kind === 'act' ? 'home-section-rail__mark--act' : ''}`}
              style={{
                top: `${top}%`,
                background: mark.color,
                boxShadow: active ? `0 0 0.9rem ${mark.color}88` : undefined,
              }}
            />
          )
        })}

        <span
          aria-hidden
          className="home-section-rail__cursor absolute right-[clamp(0.5rem,1vw,1.25rem)] rounded-full"
          style={{
            top: `${marks.length > 1 ? (activeIndex / (marks.length - 1)) * 100 : 0}%`,
            background: marks[activeIndex]?.color,
            boxShadow: `0 0 1rem ${marks[activeIndex]?.color}99`,
          }}
        />

        {previewPct != null && previewMark && (
          <span
            className="pointer-events-none absolute right-[calc(100%-0.4rem)] w-max max-w-[22rem] -translate-y-1/2 rounded-xl border border-line/80 bg-surface/95 px-3.5 py-2.5 text-left shadow-[0_1rem_3rem_rgba(0,0,0,0.34)] backdrop-blur-xl"
            style={{ top: `${previewPct * 100}%` }}
          >
            <span className="block font-mono text-meta tnum" style={{ color: previewMark.color }}>{previewMark.date}</span>
            <span className="mt-0.5 block text-control leading-snug text-ink">{previewMark.title}</span>
            {dragPct != null && <span className="mt-1 block text-meta text-faint">松开跳转</span>}
          </span>
        )}
      </div>
    </aside>
  )
}
