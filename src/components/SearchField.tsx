'use client'

import { useRef, useState, type RefObject } from 'react'

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

  const expand = () => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(280, window.innerWidth * 0.8)
      const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16)
      setPanel({ top: rect.bottom + 8, left, width })
    }
    setOpen(true)
    requestAnimationFrame(() => mobileRef.current?.focus())
  }

  return (
    <div ref={rootRef} className={`group/search relative ${iconClassName ?? ''}`}>
      {/* 移动端：纯图标，无描边无底色 */}
      <button
        type="button"
        onClick={() => (open ? mobileRef.current?.blur() : expand())}
        aria-label={`展开搜索：${ariaLabel}`}
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
      {open && (
        <div
          style={{ top: panel.top, left: panel.left, width: panel.width }}
          className="ui-panel-in fixed z-40 rounded-xl bg-surface/95 p-1 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-md sm:hidden"
        >
          <input
            ref={mobileRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') mobileRef.current?.blur()
            }}
            placeholder={mobilePlaceholder ?? '搜索'}
            aria-label={ariaLabel}
            className="w-full bg-transparent px-2.5 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none"
          />
        </div>
      )}

      {kbd && (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-mono text-meta text-faint transition-[opacity,transform] duration-200 group-focus-within/search:translate-x-1 group-focus-within/search:opacity-0 sm:block">
          {kbd}
        </kbd>
      )}
    </div>
  )
}
