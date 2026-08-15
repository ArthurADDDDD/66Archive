'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

/** 单行文字只有溢出时才自动滚动；短标题保持静止。 */
export function AutoScrollText({ children, className = '' }: { children: string; className?: string }) {
  const viewportRef = useRef<HTMLSpanElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const viewport = viewportRef.current
    const measure = measureRef.current
    if (!viewport || !measure) return
    const update = () => setOverflowing(measure.scrollWidth > viewport.clientWidth + 1)
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    observer.observe(measure)
    update()
    return () => observer.disconnect()
  }, [children])

  const style = { '--auto-scroll-duration': `${Math.min(24, Math.max(11, children.length * 0.42))}s` } as CSSProperties

  return (
    <span ref={viewportRef} className={`relative block overflow-hidden whitespace-nowrap ${className}`}>
      <span ref={measureRef} aria-hidden className="pointer-events-none absolute invisible whitespace-nowrap">{children}</span>
      {overflowing ? (
        <span className="auto-scroll-text__track inline-flex min-w-max gap-[clamp(1.5rem,3vw,3rem)] motion-reduce:animate-none" style={style}>
          <span>{children}</span>
          <span aria-hidden>{children}</span>
        </span>
      ) : (
        <span>{children}</span>
      )}
    </span>
  )
}
