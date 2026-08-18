'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { TimelineEntry } from '@/lib/data'
import { MONTH_CN } from '@/lib/ui'

type MonthGroup = {
  key: string
  year: string
  month: number
  count: number
  firstEntryId: string
  firstEntryTitle: string
}

/**
 * 首页式的条目时间线：目录本身保持原来的横向条目布局，时间索引独立贴在右侧。
 * 悬停只是看：显示该年月的标签，页面不动；点击（或按住拖动）才真正跳过去。
 * 标签不常驻——指针离开时间轴就收起，游标位置继续跟随当前阅读位置。
 */
export function EntryTimeline({
  entries,
  color = '#5BC8E8',
  renderEntry,
}: {
  entries: TimelineEntry[]
  color?: string
  renderEntry: (entry: TimelineEntry) => ReactNode
}) {
  const groups = useMemo(() => groupByMonth(entries), [entries])
  const railRef = useRef<HTMLDivElement>(null)
  const hoverIndexRef = useRef<number | null>(null)
  const activeIndexRef = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const draggingRef = useRef(false)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    // 时间轴必须脱离详情页的入场 transform，才能固定在浏览器视口右侧。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalReady(true)
  }, [])

  const scrollBehavior = useCallback((): ScrollBehavior => (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  ), [])

  const jumpToIndex = useCallback((index: number, behavior: ScrollBehavior = scrollBehavior()) => {
    const group = groups[Math.max(0, Math.min(groups.length - 1, index))]
    if (!group) return
    const bounded = Math.max(0, Math.min(groups.length - 1, index))
    activeIndexRef.current = bounded
    setActiveIndex(bounded)
    document.getElementById(`entry-${group.firstEntryId}`)?.scrollIntoView({ behavior, block: 'start' })
    window.history.replaceState(null, '', `#entry-${group.firstEntryId}`)
  }, [groups, scrollBehavior])

  const getIndex = useCallback((clientY: number) => {
    const rail = railRef.current
    if (!rail || groups.length === 0) return null
    const rect = rail.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    return Math.max(0, Math.min(groups.length - 1, Math.round(pct * (groups.length - 1))))
  }, [groups.length])

  useEffect(() => {
    const setActive = (index: number) => {
      if (activeIndexRef.current === index) return
      activeIndexRef.current = index
      setActiveIndex(index)
    }
    const initialIndex = () => {
      const focusY = window.innerHeight * 0.46
      let current = 0
      for (let index = 0; index < groups.length; index += 1) {
        const target = document.getElementById(`entry-${groups[index].firstEntryId}`)
        if (!target) continue
        if (target.getBoundingClientRect().top <= focusY) current = index
        else break
      }
      setActive(current)
    }
    // 让浏览器负责判断哪一个锚点经过阅读焦点，而不是每次 scroll 都查询所有月份的位置。
    const indexByEntryId = new Map(groups.map((group, index) => [`entry-${group.firstEntryId}`, index]))
    const observer = new IntersectionObserver((observations) => {
      for (const observation of observations) {
        if (!observation.isIntersecting) continue
        const index = indexByEntryId.get(observation.target.id)
        if (index !== undefined) setActive(index)
      }
    }, { rootMargin: '-45% 0px -49% 0px', threshold: 0 })
    for (const group of groups) {
      const target = document.getElementById(`entry-${group.firstEntryId}`)
      if (target) observer.observe(target)
    }
    initialIndex()
    return () => {
      observer.disconnect()
    }
  }, [groups])

  // 悬停只更新标签，不动页面：滚动条式的「预读」，不是自动跳转。
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return
    const index = getIndex(event.clientY)
    if (index === null || hoverIndexRef.current === index) return
    hoverIndexRef.current = index
    setHoverIndex(index)
    // 按住不放时可以继续拖着找位置，松开前一直跟着走。
    if (draggingRef.current) jumpToIndex(index, 'auto')
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return
    event.preventDefault()
    const index = getIndex(event.clientY)
    if (index === null) return
    draggingRef.current = true
    hoverIndexRef.current = index
    setHoverIndex(index)
    jumpToIndex(index, 'auto')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowDown' || event.key === 'PageDown') nextIndex = activeIndex + 1
    if (event.key === 'ArrowUp' || event.key === 'PageUp') nextIndex = activeIndex - 1
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = groups.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    jumpToIndex(nextIndex, 'auto')
  }

  // 标签只在指针停在时间轴上时出现；平时右侧只留刻度与游标。
  const previewIndex = hoverIndex ?? activeIndex
  const previewGroup = hoverIndex === null ? null : groups[hoverIndex]
  const visibleIndex = activeIndex
  const currentGroup = groups[previewIndex]

  if (groups.length === 0) return <div className="w-full divide-y divide-line/50 border-y border-line/60" />

  const rail = (
    <aside className="pointer-events-none fixed inset-y-0 right-0 z-30 hidden xl:flex xl:items-center" aria-label="条目年月时间轴">
        <div
          ref={railRef}
          className="home-section-rail pointer-events-auto relative h-[clamp(26rem,72vh,54rem)] w-[clamp(5rem,6vw,7rem)] cursor-pointer select-none"
          role="slider"
          tabIndex={0}
          aria-label="按年月查找条目"
          aria-valuemin={1}
          aria-valuemax={groups.length}
          aria-valuenow={visibleIndex + 1}
          aria-valuetext={`${currentGroup?.year} 年 ${MONTH_CN[(currentGroup?.month ?? 1) - 1]}，${currentGroup?.count} 条`}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={() => { draggingRef.current = false }}
          onPointerLeave={() => {
            draggingRef.current = false
            if (hoverIndexRef.current !== null) setHoverIndex(null)
            hoverIndexRef.current = null
          }}
          onKeyDown={handleKeyDown}
        >
          <span aria-hidden className="home-section-rail__edge absolute inset-y-0 right-0 w-full" />
          {groups.map((group, index) => {
            const top = groups.length > 1 ? (index / (groups.length - 1)) * 100 : 0
            const active = index === visibleIndex
            const dense = group.count >= 4
            return (
              <span
                key={group.key}
                aria-hidden
                className={`home-section-rail__mark absolute right-[clamp(0.5rem,1vw,1.25rem)] rounded-full ${dense ? 'home-section-rail__mark--act' : ''}`}
                style={{
                  top: `${top}%`,
                  background: color,
                  opacity: active ? 0.95 : dense ? 0.52 : 0.22,
                  boxShadow: active ? `0 0 0.9rem ${color}99` : undefined,
                }}
              />
            )
          })}

          <span
            aria-hidden
            className="home-section-rail__cursor absolute right-[clamp(0.5rem,1vw,1.25rem)] rounded-full"
            style={{
              top: `${groups.length > 1 ? (visibleIndex / (groups.length - 1)) * 100 : 0}%`,
              background: color,
              boxShadow: `0 0 1rem ${color}99`,
            }}
          />

          {previewGroup && (
            <span
              className="pointer-events-none absolute right-[calc(100%-0.4rem)] w-max max-w-[clamp(14rem,24vw,22rem)] -translate-y-1/2 rounded-xl border border-line/80 bg-surface/95 px-[clamp(0.75rem,1.2vw,1rem)] py-[clamp(0.625rem,1vw,0.875rem)] text-left shadow-[0_1rem_3rem_rgba(0,0,0,0.34)] backdrop-blur-xl"
              style={{ top: `${groups.length > 1 ? (previewIndex / (groups.length - 1)) * 100 : 0}%` }}
            >
              <span className="block font-mono text-meta tnum" style={{ color }}>{previewGroup.year}</span>
              <span className="mt-0.5 block line-clamp-2 text-control leading-snug text-ink">{previewGroup.firstEntryTitle}</span>
              <span className="mt-1 block font-mono text-meta text-faint tnum">{MONTH_CN[previewGroup.month - 1]} · {previewGroup.count} 条记录</span>
            </span>
          )}
        </div>
    </aside>
  )

  return (
    <>
      {portalReady && createPortal(rail, document.body)}

      <div aria-label="按年月查找条目" className="w-full divide-y divide-line/50 border-y border-line/60">
        {entries.map((entry) => (
          <div key={entry.id}>{renderEntry(entry)}</div>
        ))}
      </div>
    </>
  )
}

function groupByMonth(entries: TimelineEntry[]): MonthGroup[] {
  const grouped = new Map<string, MonthGroup>()
  for (const entry of entries) {
    const key = entry.date.slice(0, 7)
    const current = grouped.get(key)
    if (current) {
      current.count += 1
      continue
    }
    grouped.set(key, {
      key,
      year: entry.date.slice(0, 4),
      month: Number(entry.date.slice(5, 7)),
      count: 1,
      firstEntryId: entry.id,
      firstEntryTitle: entry.title,
    })
  }
  return [...grouped.values()]
}
