'use client'

import { useEffect, useRef } from 'react'

/**
 * 顶部 3px 阅读进度条。只做 transform: scaleX（合成层，不触发布局）。
 * SSR 安全：初始 scaleX(0)；reduced-motion 下不挂监听，保持静态。
 */
export function TimelineProgress() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const update = () => {
      const el = ref.current
      if (!el) return
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0
      el.style.transform = `scaleX(${progress})`
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className="ui-progress-bar fixed left-0 top-0 z-50 h-[3px] w-full origin-left bg-gradient-to-r from-video via-live to-today"
      style={{ transform: 'scaleX(0)' }}
    />
  )
}
