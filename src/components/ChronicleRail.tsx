'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ResolvedBeat } from '@/lib/narrative'
import type { StorySection } from '@/lib/story-years'
import { applyLiveStoryYears } from '@/lib/live-content'
import { useLiveContent } from './LiveContentProvider'
import { MediaFrame } from './primitives'
import { chronicleDate } from './StoryTimeline'

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
 * Chronicle 的桌面端快速时间轴。
 * 刻度不维护第二份静态清单：它和正文一起消费后台实时 narrative，后台新增、隐藏、
 * 排序后的合法节点会同时出现在正文与这里。带真实封面的节点在 hover 时显示画面。
 */
export function ChronicleRail({ sections: baselineSections }: { sections: StorySection[] }) {
  const { narrative } = useLiveContent()
  const sections = useMemo(
    () => applyLiveStoryYears(baselineSections, narrative?.storyActs, narrative?.deletedIds ?? []),
    [baselineSections, narrative],
  )
  const marks = useMemo(() => sections.flatMap(marksForSection), [sections])
  const railRef = useRef<HTMLDivElement>(null)
  const markRefs = useRef<(HTMLSpanElement | null)[]>([])
  const draggingRef = useRef(false)
  const activeIdRef = useRef(marks[0]?.id ?? '')
  const [activeId, setActiveId] = useState(marks[0]?.id ?? '')
  const [hoverPct, setHoverPct] = useState<number | null>(null)
  const [dragPct, setDragPct] = useState<number | null>(null)

  useEffect(() => {
    const setActive = (id: string) => {
      if (activeIdRef.current === id) return
      activeIdRef.current = id
      setActiveId(id)
    }
    const knownIds = new Set(marks.map((mark) => mark.id))
    const findCurrent = () => {
      const focusY = window.innerHeight * 0.46
      let current = marks[0]?.id ?? ''
      for (const mark of marks) {
        const element = document.getElementById(mark.id)
        if (!element) continue
        if (element.getBoundingClientRect().top <= focusY) current = mark.id
        else break
      }
      setActive(current)
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && knownIds.has(entry.target.id)) setActive(entry.target.id)
      }
    }, { rootMargin: '-45% 0px -49% 0px', threshold: 0 })

    marks.forEach((mark) => {
      const element = document.getElementById(mark.id)
      if (element) observer.observe(element)
    })
    findCurrent()
    return () => observer.disconnect()
  }, [marks])

  const activeIndex = Math.max(0, marks.findIndex((mark) => mark.id === activeId))
  const previewPct = dragPct ?? hoverPct
  const previewIndex = previewPct == null
    ? activeIndex
    : Math.max(0, Math.min(marks.length - 1, Math.round(previewPct * (marks.length - 1))))
  const previewMark = marks[previewIndex]

  useEffect(() => {
    const radius = 0.1
    marks.forEach((mark, index) => {
      const element = markRefs.current[index]
      if (!element) return
      const position = marks.length > 1 ? index / (marks.length - 1) : 0
      const baseScale = mark.kind === 'year' ? 1.35 : 1
      const baseOpacity = index === activeIndex ? 0.9 : mark.kind === 'year' ? 0.42 : 0.2
      if (previewPct == null) {
        element.style.transform = `scaleX(${baseScale})`
        element.style.opacity = String(baseOpacity)
        return
      }
      const proximity = Math.max(0, 1 - Math.abs(position - previewPct) / radius)
      const eased = proximity * proximity * (3 - 2 * proximity)
      element.style.transform = `scaleX(${(baseScale + 2.15 * eased).toFixed(3)})`
      element.style.opacity = (baseOpacity + (0.98 - baseOpacity) * eased).toFixed(3)
    })
  }, [activeIndex, marks, previewPct])

  const getPct = useCallback((clientY: number) => {
    const rect = railRef.current?.getBoundingClientRect()
    if (!rect) return null
    return Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
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

  useEffect(() => {
    const onPointerUp = (event: PointerEvent) => {
      if (!draggingRef.current) return
      const pct = getPct(event.clientY)
      draggingRef.current = false
      setDragPct(null)
      if (pct != null) jumpToIndex(Math.round(pct * (marks.length - 1)))
    }
    window.addEventListener('pointerup', onPointerUp)
    return () => window.removeEventListener('pointerup', onPointerUp)
  }, [getPct, jumpToIndex, marks.length])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const next = event.key === 'ArrowDown' || event.key === 'PageDown'
      ? activeIndex + 1
      : event.key === 'ArrowUp' || event.key === 'PageUp'
        ? activeIndex - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? marks.length - 1
            : null
    if (next === null) return
    event.preventDefault()
    jumpToIndex(next)
  }

  if (marks.length === 0) return null

  return (
    <aside className="pointer-events-none fixed inset-y-0 right-0 z-30 hidden xl:flex xl:items-center" aria-label="编年史快速时间轴">
      <div
        ref={railRef}
        className={`home-section-rail pointer-events-auto relative h-[clamp(28rem,76vh,58rem)] w-[clamp(5rem,6vw,7rem)] cursor-grab select-none active:cursor-grabbing ${dragPct != null ? 'is-dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="编年史阅读位置"
        aria-valuemin={1}
        aria-valuemax={marks.length}
        aria-valuenow={activeIndex + 1}
        aria-valuetext={`${marks[activeIndex]?.year}，${marks[activeIndex]?.title}`}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch') return
          event.preventDefault()
          const pct = getPct(event.clientY)
          draggingRef.current = true
          setHoverPct(pct)
          setDragPct(pct)
        }}
        onPointerMove={(event) => {
          const pct = getPct(event.clientY)
          setHoverPct(pct)
          if (draggingRef.current) setDragPct(pct)
        }}
        onPointerLeave={() => {
          if (!draggingRef.current) setHoverPct(null)
        }}
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
              className={`home-section-rail__mark absolute right-[clamp(0.5rem,1vw,1.25rem)] rounded-full ${mark.kind === 'year' ? 'home-section-rail__mark--section' : ''}`}
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
          <div
            className="pointer-events-none absolute right-[calc(100%-0.4rem)] w-[clamp(15rem,22vw,21rem)] -translate-y-1/2 overflow-hidden rounded-xl border border-line/80 bg-surface/95 text-left shadow-[0_1rem_3rem_rgba(0,0,0,0.36)] backdrop-blur-xl"
            style={{ top: `${previewPct * 100}%` }}
          >
            {previewMark.cover ? (
              <MediaFrame src={previewMark.cover} alt="" className="aspect-video w-full rounded-none border-0">
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-base/95 to-transparent" />
                <span className="absolute inset-x-3 bottom-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex rounded-full bg-base/75 px-2 py-0.5 font-mono text-meta backdrop-blur tnum" style={{ color: previewMark.color }}>
                      {previewMark.year}
                    </span>
                    {previewMark.important && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-base/75 px-2 py-0.5 text-[10px] tracking-[0.12em] text-white/90 backdrop-blur">
                        <span aria-hidden className="h-1 w-1 rotate-45 bg-current" />关键节点
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block text-control font-medium leading-snug text-white">{previewMark.title}</span>
                </span>
              </MediaFrame>
            ) : (
              <div className="px-3.5 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-meta tnum" style={{ color: previewMark.color }}>{previewMark.year}</span>
                  {previewMark.important && (
                    <span className="inline-flex items-center gap-1 text-[10px] tracking-[0.12em]" style={{ color: previewMark.color }}>
                      <span aria-hidden className="h-1 w-1 rotate-45 bg-current" />关键节点
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-control leading-snug text-ink">{previewMark.title}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-line/70 px-3.5 py-2 text-meta">
              <span className="font-mono text-faint tnum">{previewMark.date}</span>
              {dragPct != null && <span className="text-faint">松开跳转</span>}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
