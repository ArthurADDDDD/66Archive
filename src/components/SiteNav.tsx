'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'

const ITEMS = [
  { href: '/', label: '首页', id: 'home' },
  { href: '/chronicle/', label: '编年史', id: 'chronicle' },
  { href: '/games/', label: '游戏', id: 'games' },
  { href: '/series/', label: '节目', id: 'series' },
  { href: '/stats/', label: '数据', id: 'stats' },
  { href: '/gallery/', label: '画廊', id: 'gallery' },
  { href: '/contact/', label: '联系我们', id: 'contact' },
] as const

/**
 * 主导航。
 * 桌面（sm+）：横向 pill 行，与之前一致，不做任何改动。
 * 移动端（<sm）：顶部一行 = 站名 + 「当前栏目 / Menu」按钮；
 * 点击展开整宽 dropdown（不引入任何 drawer 库）——触控目标 ≥44px、
 * Escape / 点击外部关闭、键盘可达、当前栏目明显、无横向滚动。
 */
export function SiteNav({
  active,
  compact = false,
}: {
  active: 'home' | 'chronicle' | 'games' | 'series' | 'stats' | 'gallery' | 'calibrate' | 'contact' | 'entry'
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  // 一个页面上可能同时存在两个 SiteNav（页头一个 + 下拉唤起的快捷导航一个），
  // 菜单面板的 id 必须各自唯一，否则 aria-controls 会指向错的那一个。
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelTop, setPanelTop] = useState(0)

  const current = ITEMS.find((i) => active === i.id || (active === 'entry' && i.id === 'chronicle')) ?? ITEMS[1]

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
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
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
    <div ref={rootRef} className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none sm:gap-5">
      {!compact && (
        <Link
          href="/"
          className="ui-press flex h-11 shrink-0 items-center rounded-sm text-sm font-semibold tracking-tight text-ink transition-colors hover:text-live"
        >
          女流编年史
        </Link>
      )}

      {/* 桌面：pill 行（保持原样） */}
      <nav
        aria-label="主导航"
        className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full border border-line/80 bg-surface/70 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.1)] transition-[border-color,box-shadow] duration-300 hover:border-muted/70 hover:shadow-[0_10px_35px_rgba(0,0,0,0.18)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex"
      >
        {ITEMS.map((item) => {
          const selected = active === item.id || (active === 'entry' && item.id === 'chronicle')
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={selected ? 'page' : undefined}
              className={`ui-press shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-meta sm:px-3 ${selected ? 'bg-ink text-[#12141C] shadow-[0_4px_14px_rgba(230,228,239,0.12)]' : 'text-muted hover:bg-raised hover:text-ink'
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
        className="ui-press ml-auto flex h-11 shrink-0 items-center gap-2 rounded-full border border-line/80 bg-surface/70 px-3.5 text-meta text-muted transition-colors hover:border-muted/70 hover:text-ink sm:hidden"
      >
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-live" />
          {current.label}
        </span>
        <span aria-hidden className={`text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ⌄
        </span>
        <span className="sr-only">{open ? '收起菜单' : '展开菜单'}</span>
      </button>

      {/* 移动端 dropdown：整宽面板，挂在 header 之下 */}
      {open && (
        <div
          id={menuId}
          role="menu"
          ref={panelRef}
          className="ui-sheet-in fixed inset-x-0 z-50 border-b border-line bg-base shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:hidden"
          style={{ top: panelTop }}
        >
          <div className="site-container px-4 py-2">
            <p className="px-3 pt-2 text-meta uppercase tracking-[0.16em] text-faint">
              女流编年史 · Menu
            </p>
            <ul className="mt-1">
              {ITEMS.map((item) => {
                const selected = active === item.id || (active === 'entry' && item.id === 'chronicle')
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      role="menuitem"
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => setOpen(false)}
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
            <p className="border-t border-line/50 px-3 py-2.5 text-meta text-faint">
              Esc 关闭 · 触控目标 ≥44px
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
