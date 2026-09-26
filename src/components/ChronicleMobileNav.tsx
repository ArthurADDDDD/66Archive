'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CHRONICLE_ERAS, type ChronicleEraId } from '@/lib/chronicle-eras'

/** 电脑端（lg 起）有页头里的分段；这以下由底部胶囊接手。 */
const NAV_QUERY = '(max-width: 1023px)'

/**
 * 手机 / 平板的时代切换：读到正文时，底部中间浮出一颗三段胶囊
 * 「视频时代 | 斗鱼156277 | 抖音」，点一下直接换，不用滚回顶部。
 * 样式照录播室「按年月找」那颗胶囊；位置避开左下角的音乐按钮与右下角的回到顶部。
 * 顶部那排分段按钮还看得见时不出现，两个一样的开关不同时出现。
 * 挂到 body：页面入场动画带 transform，fixed 放在正文里会被困住（同 EntryMobileIndex）。
 */
export function ChronicleMobileNav({
  era,
  onEraChange,
}: {
  era: ChronicleEraId
  onEraChange: (era: ChronicleEraId) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [inView, setInView] = useState(false)
  /**
   * 放不下全名时改用两字简称（视频 / 斗鱼 / 抖音），绝不出现「视…」「斗…」。
   * 放不放得下取决于屏宽和系统字号，只能量：先按全名排，溢出了再切简称；屏幕变宽再试一次全名。
   */
  const [short, setShort] = useState(false)
  const groupRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return
    const check = () => {
      const overflowing = [...group.querySelectorAll<HTMLElement>('[data-era-label]')].some((node) => node.scrollWidth > node.clientWidth + 1)
      if (overflowing) setShort(true)
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(group)
    const reset = () => setShort(false)
    window.addEventListener('resize', reset)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reset)
    }
  }, [mounted, short])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal 只能在挂载后建立
    setMounted(true)
    const narrow = window.matchMedia(NAV_QUERY)
    let frame = 0
    const measure = () => {
      frame = 0
      const tabs = document.getElementById('chronicle-era-tabs')
      setInView(narrow.matches && !!tabs && tabs.getBoundingClientRect().bottom < 0)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    narrow.addEventListener('change', schedule)
    schedule()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      narrow.removeEventListener('change', schedule)
    }
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      ref={groupRef}
      role="group"
      aria-label="切换时代"
      aria-hidden={!inView}
      className={`fixed bottom-5 left-1/2 z-40 flex max-w-[calc(100vw-7rem)] -translate-x-1/2 items-center gap-0.5 rounded-full border border-line/80 bg-surface/90 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur transition-[opacity,transform] duration-300 lg:hidden ${
        inView ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      {CHRONICLE_ERAS.map((item) => {
        const selected = item.id === era
        return (
          <button
            key={item.id}
            type="button"
            tabIndex={inView ? 0 : -1}
            aria-pressed={selected}
            onClick={() => {
              if (!selected) onEraChange(item.id)
            }}
            className={`ui-press flex h-9 min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-meta transition-colors ${selected ? 'bg-raised text-ink' : 'text-muted'}`}
          >
            {/* 窄屏上三段要挤进一颗胶囊，圆点只给当前那段 */}
            {selected && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.color }} />}
            <span data-era-label className="truncate" title={item.label}>{short ? item.shortLabel : item.label}</span>
          </button>
        )
      })}
    </div>,
    document.body,
  )
}
