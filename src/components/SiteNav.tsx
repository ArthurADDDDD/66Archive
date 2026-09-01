'use client'

import { useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSiteCopy } from './LiveContentProvider'

export const NAV_ITEMS = [
  { href: '/', label: '首页', id: 'home' },
  { href: '/chronicle/', label: '编年史', id: 'chronicle' },
  { href: '/archive/', label: '录播室', id: 'archive' },
  { href: '/games/', label: '游戏', id: 'games' },
  { href: '/series/', label: '节目', id: 'series' },
  { href: '/stats/', label: '数据', id: 'stats' },
  { href: '/gallery/', label: '画廊', id: 'gallery' },
  { href: '/contact/', label: '联系我们', id: 'contact' },
] as const

/**
 * 主导航。
 * 宽屏（lg+）：横向 pill 行。
 * 手机与中屏（<lg）：顶部一行 = 直播状态/站名 + 「当前栏目 / Menu」按钮；
 * 点击展开整宽 dropdown（不引入任何 drawer 库）——触控目标 ≥44px、
 * Escape / 点击外部关闭、键盘可达、当前栏目明显、无横向滚动。
 */
export function SiteNav({
  active,
  compact = false,
  statusSlot = true,
}: {
  active: 'home' | 'chronicle' | 'archive' | 'games' | 'series' | 'stats' | 'gallery' | 'contact' | 'entry'
  compact?: boolean
  /** 快捷导航里关闭，保证全站只有页头主导航承载直播状态入口。 */
  statusSlot?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  // 导航显示名可以由后台改（去哪个页面是固定的）。拉不到就用基线里的名字。
  const copy = useSiteCopy()
  const items = NAV_ITEMS.map((item) => ({ ...item, label: copy.nav.find((nav) => nav.id === item.id)?.label ?? item.label }))
  const [open, setOpen] = useState(false)
  // 一个页面上可能同时存在两个 SiteNav（页头一个 + 下拉唤起的快捷导航一个），
  // 菜单面板的 id 必须各自唯一，否则 aria-controls 会指向错的那一个。
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelTop, setPanelTop] = useState(0)
  const prefetchTimerRef = useRef<number | null>(null)
  const prefetchedRoutesRef = useRef(new Set<string>())
  const navigatingToRef = useRef<string | null>(null)
  const navigationResetTimerRef = useRef<number | null>(null)
  // 面板要挂到 body 上（见下方注释），SSR 阶段没有 document，先不渲染。
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalReady(true)
  }, [])

  /**
   * Next Link 默认会把视口里的链接全部预取。主导航同时露出七个目标时，首页会立刻
   * 拉下整套子页 RSC（仅录播室压缩前就有 3MB+）和页面脚本，反而把用户真正点的
   * 导航与背景音乐堵在后面。这里关掉视口预取，只在一个目标被 hover / focus 一小段
   * 时间后预热它：桌面仍保留“指向即将打开”的速度，触屏也不会为没点的页面花流量。
   */
  function cancelIntentPrefetch() {
    if (prefetchTimerRef.current === null) return
    window.clearTimeout(prefetchTimerRef.current)
    prefetchTimerRef.current = null
  }

  function queueIntentPrefetch(href: string, selected: boolean) {
    cancelIntentPrefetch()
    if (selected || prefetchedRoutesRef.current.has(href)) return
    prefetchTimerRef.current = window.setTimeout(() => {
      prefetchTimerRef.current = null
      prefetchedRoutesRef.current.add(href)
      router.prefetch(href)
    }, 180)
  }

  /**
   * 慢网下重复点同一个入口不会让导航队列越积越长。第一次点击照常交给 Next，
   * 后续同目标点击在路由完成前只保留为一次；12 秒后自动放开，避免网络失败时无法重试。
   */
  function beginNavigation(event: ReactMouseEvent<HTMLAnchorElement>, href: string, selected: boolean) {
    cancelIntentPrefetch()
    if (selected) return
    if (navigatingToRef.current === href) {
      event.preventDefault()
      return
    }

    navigatingToRef.current = href
    if (navigationResetTimerRef.current !== null) window.clearTimeout(navigationResetTimerRef.current)
    navigationResetTimerRef.current = window.setTimeout(() => {
      navigatingToRef.current = null
      navigationResetTimerRef.current = null
    }, 12_000)
  }

  useEffect(
    () => () => {
      if (prefetchTimerRef.current !== null) window.clearTimeout(prefetchTimerRef.current)
      if (navigationResetTimerRef.current !== null) window.clearTimeout(navigationResetTimerRef.current)
    },
    [],
  )

  // 路由已经完成：立即解除重复点击保护，不依赖组件是否被新页面复用。
  useEffect(() => {
    navigatingToRef.current = null
    if (navigationResetTimerRef.current !== null) {
      window.clearTimeout(navigationResetTimerRef.current)
      navigationResetTimerRef.current = null
    }
  }, [pathname])

  const current = items.find((i) => active === i.id || (active === 'entry' && i.id === 'archive')) ?? items[1]

  // 路由变化时自动收起：无需监听——菜单项点击自带 setOpen(false)，
  // 跨页导航则整个组件卸载重置；usePathname 在这里没有收起的意义。

  // 打开时：测 header 底边 → 面板挂在其下；Escape 关闭并归还焦点；点击外部关闭。
  // 面板是 fixed 且只测一次——所以打开期间必须锁住页面滚动，
  // 否则 header 滚走了、面板还悬在原处，变成一块脱离导航的浮空菜单。
  useEffect(() => {
    if (!open) return
    const header = rootRef.current?.closest('header')
    const rect = header?.getBoundingClientRect()
    setPanelTop(Math.max(0, Math.min(rect ? rect.bottom : 0, window.innerHeight)))
    panelRef.current?.querySelector('a')?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none lg:gap-5">
      {!compact && (
        statusSlot
          ? <span data-live-status-slot className="flex h-11 min-w-[5.5rem] shrink-0 items-center" />
          : <span className="flex h-11 shrink-0 items-center text-sm font-semibold tracking-tight text-ink">女流编年史</span>
      )}

      {/* 桌面：pill 行（保持原样） */}
      <nav
        aria-label="主导航"
        className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full border border-line/80 bg-surface/70 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.1)] transition-[border-color,box-shadow] duration-300 hover:border-muted/70 hover:shadow-[0_10px_35px_rgba(0,0,0,0.18)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex"
      >
        {items.map((item) => {
          const selected = active === item.id || (active === 'entry' && item.id === 'archive')
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={false}
              onMouseEnter={() => queueIntentPrefetch(item.href, selected)}
              onMouseLeave={() => cancelIntentPrefetch()}
              onFocus={() => queueIntentPrefetch(item.href, selected)}
              onBlur={() => cancelIntentPrefetch()}
              onPointerDown={() => cancelIntentPrefetch()}
              onClick={(event) => beginNavigation(event, item.href, selected)}
              data-analytics-event="nav.click"
              data-analytics-target={item.id}
              aria-current={selected ? 'page' : undefined}
              className={`ui-press shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-meta ${selected ? 'bg-ink text-[#12141C] shadow-[0_4px_14px_rgba(230,228,239,0.12)]' : 'text-muted hover:bg-raised hover:text-ink'
                }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* 移动端：当前栏目 + Menu 按钮（≥44px 触控） */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        className="ui-press ml-auto flex h-11 min-w-0 shrink items-center gap-1.5 rounded-full border border-line/80 bg-surface/70 px-3 text-meta text-muted transition-colors hover:border-muted/70 hover:text-ink lg:hidden"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-live" />
          <span className="truncate">{current.label}</span>
        </span>
        <span aria-hidden className={`text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ⌄
        </span>
        <span className="sr-only">{open ? '收起菜单' : '展开菜单'}</span>
      </button>

      {/*
        移动端 dropdown：整宽面板，挂在 header 之下。
        必须 portal 到 body——面板虽然是 fixed z-50，但它的父级 header 是 sticky z-30，
        z-index 只在那个层叠上下文内部有效，于是回到顶部按钮 / 下拉快捷导航（都是 z-40）
        和顶部阅读进度条（z-50）会盖在展开的菜单上面。挂到 body 之后 z-[60] 才是全局生效的。
      */}
      {open && portalReady && createPortal(
        <div
          id={menuId}
          role="menu"
          ref={panelRef}
          className="ui-sheet-in fixed inset-x-0 z-[60] border-b border-line bg-base shadow-[0_24px_60px_rgba(0,0,0,0.35)] lg:hidden"
          style={{ top: panelTop }}
        >
          <div className="site-container-wide px-page pb-4 pt-2">
            <p className="px-3 pt-2 text-meta uppercase tracking-[0.16em] text-faint">
              女流编年史 · Menu
            </p>
            <ul className="mt-1">
              {items.map((item) => {
                const selected = active === item.id || (active === 'entry' && item.id === 'archive')
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      onMouseEnter={() => queueIntentPrefetch(item.href, selected)}
                      onMouseLeave={() => cancelIntentPrefetch()}
                      onFocus={() => queueIntentPrefetch(item.href, selected)}
                      onBlur={() => cancelIntentPrefetch()}
                      onPointerDown={() => cancelIntentPrefetch()}
                      data-analytics-event="nav.click"
                      data-analytics-target={item.id}
                      role="menuitem"
                      aria-current={selected ? 'page' : undefined}
                      onClick={(event) => {
                        beginNavigation(event, item.href, selected)
                        setOpen(false)
                      }}
                      className={`ui-press flex min-h-[2.75rem] items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                        selected ? 'bg-surface/80 text-ink' : 'text-muted hover:bg-surface/50 hover:text-ink'
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-live' : 'bg-line'}`}
                      />
                      {item.label}
                      {selected && <span className="ml-auto text-meta text-live">当前</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
