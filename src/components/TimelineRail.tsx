'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { MediaFrame } from './primitives'

/**
 * 右侧快速时间轴：全站共用的那条「条儿」。
 *
 * 原本这套交互在首页、编年史各写了一遍，画廊要用时就该抽出来，而不是抄第三遍。
 * 组件只负责「一列刻度 + 悬停放大 + 预览卡 + 拖动定位 + 跳转」，
 * 数据长什么样、颜色怎么分段，全交给调用方——它不认识幕、年份或照片。
 *
 * 约定：每个刻度的 `id` 必须是页面上一个真实元素的 id，跳转就是滚到那个元素。
 *
 * 轨道挂到 body 上：页面容器带入场动画的 transform，会成为 fixed 的包含块，
 * 留在原地的话「贴住视口右缘」会变成「停在整页高度的正中间」。
 */

export type TimelineRailMark = {
  /** 同时是 React key 和跳转目标的 DOM id */
  id: string
  /** 预览卡首行：日期 / 年份 / 章节标记 */
  meta: string
  /** 预览卡主行 */
  title: string
  color: string
  /** 刻度档位：主段落用 lead，次级用 major，普通节点 minor */
  weight?: 'lead' | 'major' | 'minor'
  /** 有画面就出画面；没有就是一张纯文字卡 */
  cover?: string | null
  /** 预览卡上的小标，例如「关键节点」 */
  badge?: string | null
  /** 预览卡底栏左侧的补充信息 */
  footer?: string | null
}

/** 服务端没有 document，portal 只能在挂载后建立。 */
const subscribeNoop = () => () => {}

const WEIGHT_CLASS: Record<NonNullable<TimelineRailMark['weight']>, string> = {
  lead: 'timeline-rail__mark--lead',
  major: 'timeline-rail__mark--major',
  minor: '',
}

export function TimelineRail({
  marks,
  ariaLabel,
  positionLabel,
  /** 轨道出现的最小宽度。首页和编年史要整屏版面才放得下，画廊平板就能用。 */
  showFrom = 'xl',
  /** 右下角有回到顶部这类浮动按钮时抬高轨道底边，两个浮层不叠在一起。 */
  reserveBottom = false,
  height = 'clamp(28rem,76vh,58rem)',
  /** 悬停放大的作用半径（占轨道全长的比例）与最大倍率 */
  magnify = { radius: 0.1, scale: 2.15 },
}: {
  marks: TimelineRailMark[]
  ariaLabel: string
  positionLabel: string
  showFrom?: 'md' | 'xl'
  reserveBottom?: boolean
  height?: string
  magnify?: { radius: number; scale: number }
}) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const railRef = useRef<HTMLDivElement>(null)
  const markRefs = useRef<(HTMLSpanElement | null)[]>([])
  const draggingRef = useRef(false)
  const activeIdRef = useRef(marks[0]?.id ?? '')
  const [activeId, setActiveId] = useState(marks[0]?.id ?? '')
  const [hoverPct, setHoverPct] = useState<number | null>(null)
  const [dragPct, setDragPct] = useState<number | null>(null)
  const { radius, scale: maxScale } = magnify

  // 当前位置跟着正文走：观察每个刻度对应的真实元素，不另外维护一份滚动量换算。
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

    for (const mark of marks) {
      const element = document.getElementById(mark.id)
      if (element) observer.observe(element)
    }
    findCurrent()
    return () => observer.disconnect()
  }, [marks])

  const activeIndex = Math.max(0, marks.findIndex((mark) => mark.id === activeId))
  const previewPct = dragPct ?? hoverPct
  const previewIndex = previewPct == null
    ? activeIndex
    : Math.max(0, Math.min(marks.length - 1, Math.round(previewPct * (marks.length - 1))))
  const previewMark = marks[previewIndex]

  // 高频悬停只改刻度自身的 style；React 只重绘那张预览卡。
  useEffect(() => {
    marks.forEach((mark, index) => {
      const element = markRefs.current[index]
      if (!element) return
      const position = marks.length > 1 ? index / (marks.length - 1) : 0
      const weight = mark.weight ?? 'minor'
      const baseScale = weight === 'lead' ? 1.35 : weight === 'major' ? 1.12 : 1
      const baseOpacity = index === activeIndex ? 0.9 : weight === 'lead' ? 0.42 : weight === 'major' ? 0.34 : 0.2
      if (previewPct == null) {
        element.style.transform = `scaleX(${baseScale})`
        element.style.opacity = String(baseOpacity)
        return
      }
      const proximity = Math.max(0, 1 - Math.abs(position - previewPct) / radius)
      const eased = proximity * proximity * (3 - 2 * proximity)
      element.style.transform = `scaleX(${(baseScale + maxScale * eased).toFixed(3)})`
      element.style.opacity = (baseOpacity + (0.98 - baseOpacity) * eased).toFixed(3)
    })
  }, [activeIndex, marks, previewPct, radius, maxScale])

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

  if (!mounted || marks.length === 0) return null

  return createPortal(
    <aside
      className={`pointer-events-none fixed right-0 top-0 z-30 hidden items-center ${
        reserveBottom ? 'bottom-[6.5rem]' : 'bottom-0'
      } ${showFrom === 'md' ? 'md:flex' : 'xl:flex'}`}
      aria-label={ariaLabel}
    >
      <div
        ref={railRef}
        className={`timeline-rail pointer-events-auto relative w-[clamp(5rem,6vw,7rem)] cursor-grab select-none active:cursor-grabbing ${dragPct != null ? 'is-dragging' : ''}`}
        style={{ height }}
        role="slider"
        tabIndex={0}
        aria-label={positionLabel}
        aria-valuemin={1}
        aria-valuemax={marks.length}
        aria-valuenow={activeIndex + 1}
        aria-valuetext={`${marks[activeIndex]?.meta}，${marks[activeIndex]?.title}`}
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
        <span aria-hidden className="timeline-rail__edge absolute inset-y-0 right-0 w-full" />
        {marks.map((mark, index) => {
          const top = marks.length > 1 ? (index / (marks.length - 1)) * 100 : 0
          const active = index === activeIndex
          return (
            <span
              key={mark.id}
              ref={(element) => { markRefs.current[index] = element }}
              aria-hidden
              className={`timeline-rail__mark absolute right-[clamp(0.5rem,1vw,1.25rem)] rounded-full ${WEIGHT_CLASS[mark.weight ?? 'minor']}`}
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
          className="timeline-rail__cursor absolute right-[clamp(0.5rem,1vw,1.25rem)] rounded-full"
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
                      {previewMark.meta}
                    </span>
                    {previewMark.badge && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-base/75 px-2 py-0.5 text-[10px] tracking-[0.12em] text-white/90 backdrop-blur">
                        <span aria-hidden className="h-1 w-1 rotate-45 bg-current" />{previewMark.badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block text-control font-medium leading-snug text-white">{previewMark.title}</span>
                </span>
              </MediaFrame>
            ) : (
              <div className="px-3.5 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-meta tnum" style={{ color: previewMark.color }}>{previewMark.meta}</span>
                  {previewMark.badge && (
                    <span className="inline-flex items-center gap-1 text-[10px] tracking-[0.12em]" style={{ color: previewMark.color }}>
                      <span aria-hidden className="h-1 w-1 rotate-45 bg-current" />{previewMark.badge}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-control leading-snug text-ink">{previewMark.title}</span>
              </div>
            )}
            {(previewMark.footer || dragPct != null) && (
              <div className="flex items-center justify-between gap-3 border-t border-line/70 px-3.5 py-2 text-meta">
                <span className="font-mono text-faint tnum">{previewMark.footer ?? ''}</span>
                {dragPct != null && <span className="text-faint">松开跳转</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>,
    document.body,
  )
}
