'use client'

import { useRef, useState, type RefObject } from 'react'

/**
 * 搜索框，两态：
 * - 桌面（sm+）：常驻输入框，外观与旧版一致。
 * - 移动端（<sm）：退化为一个圆形搜索 icon；点按后原地展开为输入框并自动聚焦，
 *   失焦或按 Esc 收回。避免手机端一整条全宽搜索栏挤占、重叠导航或控制控件。
 *
 * 数字/占位文案由调用方决定；输入框样式经 inputClassName 传入，保证各处观感统一。
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  kbd,
  inputRef,
  inputClassName,
  iconClassName,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  ariaLabel: string
  /** 桌面显示在输入框右侧的快捷键提示（如「/」） */
  kbd?: string
  /** 外部 ref（如编年史的「/」聚焦快捷键）；不传则内部自持 */
  inputRef?: RefObject<HTMLInputElement | null>
  inputClassName?: string
  iconClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const internalRef = useRef<HTMLInputElement>(null)
  const inputEl = inputRef ?? internalRef

  const expand = () => {
    setOpen(true)
    requestAnimationFrame(() => inputEl.current?.focus())
  }

  return (
    <div className={`group/search relative ${iconClassName ?? ''}`}>
      {/* 移动端：收起的搜索 icon（≥44px 触控） */}
      <button
        type="button"
        onClick={expand}
        aria-label={`展开搜索：${ariaLabel}`}
        aria-expanded={open}
        className={`ui-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line/80 bg-surface/70 text-muted transition-colors hover:border-live/60 hover:text-ink sm:hidden ${
          open ? 'hidden' : ''
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="stroke-current">
          <circle cx="11" cy="11" r="7" strokeWidth="2" />
          <path d="M16.5 16.5 21 21" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* 输入框：桌面常驻；移动端仅在展开时显示 */}
      <input
        ref={inputEl}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') inputEl.current?.blur()
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`${open ? 'block' : 'hidden sm:block'} ${inputClassName}`}
      />
      {kbd && (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-mono text-[10px] text-faint transition-[opacity,transform] duration-200 group-focus-within/search:translate-x-1 group-focus-within/search:opacity-0 sm:block">
          {kbd}
        </kbd>
      )}
    </div>
  )
}
