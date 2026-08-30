'use client'

import { useCallback, useEffect, useState } from 'react'

export type EntryView = 'list' | 'grid'

const STORAGE_KEY = 'i6i6:entry-view'
/** 手机端不提供网格：一行一列的「网格」只是把列表拉长，还把每条的元信息挤没了。 */
const COMPACT_QUERY = '(max-width: 639px)'

/**
 * 条目视图偏好：封面网格 / 紧凑列表。
 *
 * 默认封面网格——三十条记录在列表里要滚很久才见底，先看封面挑一条才是找东西的读法；
 * 想逐条对照日期与时长时再切回列表。选择记在 localStorage 里（这是长期偏好，
 * 不是当下的筛选动作，所以和年月筛选不同，它该被记住）。
 *
 * 手机端强制列表，但**不覆盖**用户存下来的偏好：横过来或换到平板还是回到他选的那个。
 */
export function useEntryView(defaultView: EntryView = 'grid') {
  const [view, setViewState] = useState<EntryView>(defaultView)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    // localStorage 是外部系统，首帧读不到它——只能挂载后同步一次。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === 'list' || stored === 'grid') setViewState(stored)
  }, [])

  useEffect(() => {
    const media = window.matchMedia(COMPACT_QUERY)
    const sync = () => setCompact(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const setView = useCallback((next: EntryView) => {
    setViewState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 隐私模式下写不进去就算了，这只是个偏好，不值得打断浏览。
    }
  }, [])

  return { view: compact ? 'list' : view, setView, compact, storedView: view }
}

/** 两个视图之间来回切。手机端整颗按钮不出现——那边只有列表一种读法。 */
export function EntryViewToggle({
  view,
  setView,
  compact,
}: {
  view: EntryView
  setView: (view: EntryView) => void
  compact: boolean
}) {
  if (compact) return null
  return (
    <div
      role="group"
      aria-label="切换条目视图"
      className="flex items-center rounded-full border border-line p-0.5"
    >
      <ViewButton active={view === 'grid'} onClick={() => setView('grid')} label="封面">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="stroke-current">
          <rect x="3" y="4" width="7.5" height="7" rx="1.5" strokeWidth="2" />
          <rect x="13.5" y="4" width="7.5" height="7" rx="1.5" strokeWidth="2" />
          <rect x="3" y="13" width="7.5" height="7" rx="1.5" strokeWidth="2" />
          <rect x="13.5" y="13" width="7.5" height="7" rx="1.5" strokeWidth="2" />
        </svg>
      </ViewButton>
      <ViewButton active={view === 'list'} onClick={() => setView('list')} label="列表">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="stroke-current">
          <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </ViewButton>
    </div>
  )
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${label}视图`}
      className={`ui-press flex items-center gap-1.5 rounded-full px-3 py-1.5 text-meta transition-colors ${
        active ? 'bg-live/12 text-live' : 'text-muted hover:text-ink'
      }`}
    >
      {children}
      {label}
    </button>
  )
}
