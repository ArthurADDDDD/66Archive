'use client'

import { useEffect, useRef, useState } from 'react'
import { SiteNav } from './SiteNav'

/**
 * 长页面上的两个滚动辅助件。都是「不打扰」优先：
 * 第一屏一律不出现，只有真的往下走了才登场；离开视野的方式和登场一样安静。
 *
 * - MobileQuickNav：手机端下拉（向上滚）时唤起的轻量导航条。页面很长时不用一路滚回顶部找 nav。
 * - BackToTop：右下角的小圆钮，滚过一屏才淡入。
 *
 * 两者都只做 transform / opacity（合成层，不触发布局），
 * reduced-motion 下不挂滚动监听，保持静态、永不弹出。
 */

/** 共用：滚动位置 + 方向 + 视口高度。rAF 节流，passive 监听。 */
function useScrollState() {
  const [state, setState] = useState({ y: 0, up: false, vh: 0 })
  const lastY = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
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

/**
 * 手机端下拉唤起的轻量导航条。
 * 只在「已经离开第一屏」且「正在向上滚」时出现；向下滚立刻收起，不挡阅读。
 * 桌面端不渲染（sm+ 各页顶部本来就有 header）。
 */
export function MobileQuickNav({ active }: { active: React.ComponentProps<typeof SiteNav>['active'] }) {
  const { y, up } = useScrollState()
  const shown = y > 320 && up

  return (
    <header
      aria-hidden={!shown}
      aria-label="快捷导航"
      className={`fixed inset-x-0 top-0 z-40 border-b border-line/80 bg-base/95 backdrop-blur transition-transform duration-300 sm:hidden ${
        shown ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
    >
      {/* inert：收起时不该被 Tab 键或读屏进到里面 */}
      <div className="flex items-center gap-2 px-4 py-2" inert={!shown}>
        <SiteNav active={active} />
      </div>
    </header>
  )
}

/**
 * 回到顶部：右下角小圆钮，和手机端快捷导航同一套出场规则——
 * 离开第一屏之后，**往上滚**才淡入；继续往下读就自己收起来，不挡内容。
 * （此前是「滚过 900px 就一直挂着」，读长页面时它一路杵在那儿。）
 */
export function BackToTop() {
  const { y, up, vh } = useScrollState()
  const shown = vh > 0 && y > vh && up

  return (
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
}
