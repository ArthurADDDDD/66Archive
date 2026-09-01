'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { NAV_ITEMS, SiteNav } from './SiteNav'
import { useSiteCopy } from './LiveContentProvider'

/**
 * 长页面上的两个滚动辅助件。都是「不打扰」优先：
 * 第一屏一律不出现，只有真的往下走了才登场；离开视野的方式和登场一样安静。
 *
 * - MobileQuickNav：手机端下拉（向上滚）时唤起的轻量导航条。页面很长时不用一路滚回顶部找 nav。
 * - BackToTop：右下角的小圆钮，滚过一屏才淡入。
 *
 * 两者都只做 transform / opacity（合成层，不触发布局）；减少动态效果时仍保留功能，
 * 全局样式会把动画时长压到近乎 0，不需要禁用滚动监听。
 */

/** 共用：滚动位置 + 方向 + 视口高度。rAF 节流，passive 监听。 */
function useScrollState() {
  const [state, setState] = useState({ y: 0, up: false, vh: 0 })
  const lastY = useRef(0)

  useEffect(() => {
    let ticking = false
    const update = () => {
      ticking = false
      const y = window.scrollY
      // 5px 死区：手指微抖或回弹不该让导航条闪来闪去
      const delta = y - lastY.current
      const vh = window.innerHeight
      if (Math.abs(delta) > 5) {
        setState({ y, up: delta < 0, vh })
        lastY.current = y
      } else {
        setState((prev) => (prev.y === y && prev.vh === vh ? prev : { ...prev, y, vh }))
      }
    }
    // 「取消上一个 rAF 再排新的」在快速滚动时会被连续的 scroll 事件反复打断，
    // 导致 update 只在手指停下那一刻才跑一次——方向判断变成看那一瞬间的抖动，
    // 而不是整个滚动过程。改成「已经排了就不再抢」，保证每帧都真正采样一次。
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }
    lastY.current = window.scrollY
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return state
}

export function MobileQuickNav({
  active,
  tools,
}: {
  active: React.ComponentProps<typeof SiteNav>['active']
  /** 搜索、筛选等当前页面操作；与页面入口收进同一个固定胶囊。 */
  tools?: ReactNode
}) {
  return <PageNavCapsule active={active} tools={tools} />
}

/**
 * 长页快捷导航：离开页首后只留一个小胶囊，需要时再展开页面列表。
 * 手机与桌面共用同一套交互，避免同一个功能在不同设备上长成两种东西。
 * 胶囊始终停在页面统一版心的上沿，不占文档流，也不要求用户先向上滚。
 */
function PageNavCapsule({
  active,
  tools,
}: {
  active: React.ComponentProps<typeof SiteNav>['active']
  tools?: ReactNode
}) {
  const { y } = useScrollState()
  const copy = useSiteCopy()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  // 原先半屏以上的阈值很像组件迟迟没加载；页头离开后就应立即提供入口。
  const shown = y > 96
  const items = NAV_ITEMS.map((item) => ({ ...item, label: copy.nav.find((nav) => nav.id === item.id)?.label ?? item.label }))
  const current = items.find((item) => active === item.id || (active === 'entry' && item.id === 'archive')) ?? items[0]

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!mounted) return null

  return createPortal(
    <div
      aria-hidden={!shown}
      className={`pointer-events-none fixed inset-x-0 top-3 z-40 block transition-[opacity,transform] duration-200 sm:top-4 ${
        shown ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
      style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
    >
      <div className="site-header-container px-page">
        <div
          ref={rootRef}
          inert={!shown}
          className="pointer-events-auto relative inline-flex max-w-full items-center overflow-visible rounded-full border border-line/80 bg-base/85 shadow-[0_10px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl"
        >
          <button
            type="button"
            tabIndex={shown ? 0 : -1}
            aria-expanded={shown && open}
            aria-haspopup="menu"
            aria-label={`${current.label}，打开页面导航`}
            onClick={() => setOpen((value) => !value)}
            className={`ui-press flex h-11 min-w-24 items-center justify-between gap-3 rounded-full px-3.5 text-meta transition-[background-color,color] sm:h-9 ${
              open ? 'bg-raised/95 text-ink' : 'text-muted hover:bg-raised/70 hover:text-ink'
            }`}
          >
            <span className="flex items-center gap-2">
              <i className="h-1.5 w-1.5 rounded-full bg-live" aria-hidden />
              {current.label}
            </span>
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
              className={`stroke-current transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path d="m2.5 4.5 3.5 3 3.5-3" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {tools && (
            <div className="flex min-w-0 items-center border-l border-line/80 px-0.5">
              {tools}
            </div>
          )}

          {shown && open && (
            <nav
              aria-label="页面导航"
              className="ui-sheet-in absolute left-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-line/90 bg-base/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl"
            >
              <ul className="grid gap-0.5">
                {items.map((item) => {
                  const selected = active === item.id || (active === 'entry' && item.id === 'archive')
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        aria-current={selected ? 'page' : undefined}
                        onClick={() => setOpen(false)}
                        className={`ui-press flex min-h-10 items-center justify-between rounded-xl px-3 text-control transition-colors ${
                          selected ? 'bg-raised text-ink' : 'text-muted hover:bg-surface hover:text-ink'
                        }`}
                      >
                        {item.label}
                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-live" aria-hidden />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * 回到顶部：右下角小圆钮。
 * 离开第一屏后，向上滚才出现；继续向下浏览时保持隐藏。
 * 挂到 body，避免页面入场动画的 transform 把 fixed 限制在 main 内，
 * 导致按钮看起来只出现在文档最底部。
 */
export function BackToTop() {
  const { y, up, vh } = useScrollState()
  const [mounted, setMounted] = useState(false)
  const shown = vh > 0 && y > vh && up

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const button = (
    <button
      type="button"
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
      }}
      className={`ui-press fixed bottom-5 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-line/80 bg-surface/80 text-muted backdrop-blur transition-[opacity,transform,color,border-color] duration-300 hover:border-live/60 hover:text-ink sm:bottom-8 sm:right-8 ${
        shown ? 'translate-y-0 opacity-70 hover:opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <span className="sr-only">回到顶部</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="stroke-current">
        <path d="M12 19V5" strokeWidth="2" strokeLinecap="round" />
        <path d="m5 12 7-7 7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )

  return mounted ? createPortal(button, document.body) : null
}
