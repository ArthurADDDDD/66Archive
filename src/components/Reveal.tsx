'use client'

import { useEffect, useRef } from 'react'

/**
 * 滚动显现。SSR 安全：HTML 里元素完全可见（无 JS 也不隐藏）；
 * 挂载后只有视口下方的元素才加 .ui-reveal-scroll（视口内元素保持可见），
 * 进入视口后由 IntersectionObserver 解除隐藏。reduced-motion 下完全跳过。
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) return

    el.classList.add('ui-reveal-scroll')
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.classList.add('ui-reveal-visible')
        io.disconnect()
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={className} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  )
}
