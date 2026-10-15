'use client'

import { createPortal } from 'react-dom'
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * 搜索框，两套完全独立的 DOM：
 * - 桌面（sm+）：常驻输入框，外观与旧版一致，用调用方传入的 inputClassName。
 * - 移动端（<sm）：退化为一个裸图标（无描边、无底色——「退化成图标」就该是图标本身，
 *   不是带框的胶囊按钮）。点开后不是把 header 撑出一整行，而是从图标位置长出一个
 *   紧凑的弹层（贴着图标、宽度收窄，不撑满视口），弹层里的输入框也不描边。
 *   占位符默认是「搜索」，不重复桌面版那句带总数的完整提示——已经点开图标来搜了，
 *   不需要再念一遍「全部 N 条记录」。
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  mobilePlaceholder,
  ariaLabel,
  kbd,
  inputRef,
  inputClassName,
  iconClassName,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  /** 移动端弹层的占位符；不传则用通用的「搜索」，不照搬桌面那句带计数的提示 */
  mobilePlaceholder?: string
  ariaLabel: string
  /** 桌面显示在输入框右侧的快捷键提示（如「/」） */
  kbd?: string
  /** 外部 ref（如编年史的「/」聚焦快捷键），绑定桌面常驻输入框 */
  inputRef?: RefObject<HTMLInputElement | null>
  inputClassName?: string
  iconClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState({ top: 0, left: 0, width: 280 })
  const desktopInternalRef = useRef<HTMLInputElement>(null)
  const desktopRef = inputRef ?? desktopInternalRef
  const mobileRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useLayoutEffect(() => {
    if (open) mobileRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    let frame = 0
    const updatePosition = () => {
      frame = 0
      if (window.matchMedia('(min-width: 640px)').matches) {
        setOpen(false)
        if (document.activeElement === mobileRef.current) desktopRef.current?.focus()
        return
      }
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(280, window.innerWidth * 0.8)
      const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16)
      setPanel({ top: rect.bottom + 8, left, width })
    }
    const schedulePosition = () => {
      if (!frame) frame = requestAnimationFrame(updatePosition)
    }
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('resize', schedulePosition)
    window.addEventListener('scroll', schedulePosition, true)
    document.addEventListener('pointerdown', closeOutside)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedulePosition)
      window.removeEventListener('scroll', schedulePosition, true)
      document.removeEventListener('pointerdown', closeOutside)
    }
  }, [open, desktopRef])

  const expand = () => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(280, window.innerWidth * 0.8)
      const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16)
      setPanel({ top: rect.bottom + 8, left, width })
    }
    setOpen(true)
  }

  return (
    <div
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !panelRef.current?.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          triggerRef.current?.focus()
        }
      }}
      className={`group/search relative ${iconClassName ?? ''}`}
    >
      {/* 移动端：纯图标，无描边无底色 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : expand())}
        aria-label={`${open ? '收起' : '展开'}搜索：${ariaLabel}`}
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        className={`ui-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ink active:opacity-70 sm:hidden ${
          open ? 'text-live' : ''
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="stroke-current">
          <circle cx="11" cy="11" r="7" strokeWidth="2" />
          <path d="M16.5 16.5 21 21" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* 桌面：常驻输入框，样式与旧版一致，与移动端弹层完全独立 */}
      <input
        ref={desktopRef}
        data-analytics-event="search.use"
        data-analytics-trigger="change"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') desktopRef.current?.blur()
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`hidden sm:block ${inputClassName ?? ''}`}
      />

      {/* 移动端：贴着图标长出的紧凑弹层，不描边、不撑满视口 */}
      {open && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          style={{ top: panel.top, left: panel.left, width: panel.width }}
          className="ui-panel-in fixed z-40 rounded-xl bg-surface/95 p-1 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-md sm:hidden"
        >
          <input
            ref={mobileRef}
            data-analytics-event="search.use"
            data-analytics-trigger="change"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return
              // 弹层挂在 body 末尾，Tab 仍应从搜索按钮所在位置继续。
              setOpen(false)
              triggerRef.current?.focus()
              if (event.shiftKey) event.preventDefault()
            }}
            placeholder={mobilePlaceholder ?? '搜索'}
            aria-label={ariaLabel}
            className="w-full bg-transparent px-2.5 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none"
          />
        </div>,
        document.body,
      )}

      {kbd && (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-mono text-meta text-faint transition-[opacity,transform] duration-200 group-focus-within/search:translate-x-1 group-focus-within/search:opacity-0 sm:block">
          {kbd}
        </kbd>
      )}
    </div>
  )
}
