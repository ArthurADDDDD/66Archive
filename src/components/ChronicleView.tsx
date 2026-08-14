'use client'

import { useEffect, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import type { StoryYear } from '@/lib/story-years'
import { SiteNav } from './SiteNav'
import { BackToTop } from './ScrollAffordances'
import { SearchField } from './SearchField'
import { StoryTimeline } from './StoryTimeline'
import { Timeline } from './Timeline'

/**
 * 编年史双模式外壳：故事（默认）/ 档案。
 * - 故事模式：年份脊柱时间线（StoryTimeline）。条目仍由 STORY_ACTS 策展，
 *   只是版式不再照搬首页的三幕大卡——首页是「三个问题」，编年史是「一路走过来」。
 * - 档案模式：完整 Timeline（搜索/筛选/年份/来源全部保留）。
 * - 深链：URL 带 y/m/q/p/t/g/alive 时进入档案模式并交还给 Timeline 恢复。
 * 切换刻意克制：两个文字按钮，不是 SaaS 分段控件。
 */
const ARCHIVE_PARAMS = ['y', 'm', 'q', 'p', 't', 'g', 'alive'] as const

export function ChronicleView({
  storyYears,
  total,
  latestYear,
  entries,
  isDemo,
  hiddenUnreviewed = 0,
}: {
  storyYears: StoryYear[]
  total: number
  latestYear: number
  entries: TimelineEntry[]
  isDemo: boolean
  hiddenUnreviewed?: number
}) {
  const [mode, setMode] = useState<'story' | 'archive'>('story')
  const [mounted, setMounted] = useState(false)
  const [storySearch, setStorySearch] = useState('')

  // 深链：URL 带档案参数时直接从档案模式开始（Timeline 自己会恢复 y/q/…）
  // 静态导出无法在服务端读 searchParams，初始模式只能在客户端 effect 里定，一次性且无外部依赖。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const p = new URLSearchParams(window.location.search)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ARCHIVE_PARAMS.some((k) => p.has(k))) setMode('archive')
  }, [])

  /** 年份块上的「这一年还有 N 条记录」→ 直接落到档案模式的那一年 */
  const openArchiveYear = (year: number) => {
    window.history.replaceState(null, '', `/chronicle/?y=${year}`)
    setMode('archive')
  }

  const switchMode = (next: 'story' | 'archive') => {
    if (next === mode) return
    if (next === 'story') {
      window.history.replaceState(null, '', '/chronicle/')
    } else if (!window.location.search) {
      // 档案无参时先落一个年份，让 Timeline 有明确落点
      window.history.replaceState(null, '', `/chronicle/?y=${latestYear}`)
    }
    setMode(next)
  }

  // 编年史两种模式的 header 本身就是 sticky，不再叠一条 MobileQuickNav；只补回到顶部。
  if (mode === 'archive') {
    return (
      <>
        <Timeline entries={entries} isDemo={isDemo} hiddenUnreviewed={hiddenUnreviewed} extra={<ModeToggle mode={mode} onChange={switchMode} />} />
        <BackToTop />
      </>
    )
  }

  return (
    <>
      <header className="ui-slide-down sticky top-0 z-30 border-b border-line bg-base/95 backdrop-blur">
        <div className="site-header-container flex flex-wrap items-center gap-3 px-page py-3 sm:flex-nowrap">
          <SiteNav active="chronicle" />
          <SearchField
            value={storySearch}
            onChange={(value) => {
              setStorySearch(value)
              if (!value.trim()) return
              window.history.replaceState(null, '', `/chronicle/?q=${encodeURIComponent(value)}`)
              setMode('archive')
            }}
            placeholder={`搜索全部 ${total.toLocaleString()} 条记录`}
            ariaLabel="搜索全部记录"
            iconClassName="ml-auto sm:hidden"
            inputClassName="hidden"
          />
          <div className="hidden items-center gap-3 sm:flex">
            <button
              onClick={() => switchMode('archive')}
              className="ui-press shrink-0 rounded-sm px-1 py-2 text-meta text-live tnum sm:py-0"
            >
              搜索全部 {total.toLocaleString()} 条记录 →
            </button>
            <ModeToggle mode={mode} onChange={switchMode} />
          </div>
        </div>
      </header>
      {/* mounted 后再亮出滚动显现，避免 SSR 闪现 */}
      <div className={mounted ? '' : 'no-reveal'}>
        <StoryTimeline
          years={storyYears}
          total={total}
          latestYear={latestYear}
          onOpenArchive={openArchiveYear}
          modeControl={<ModeToggle mode={mode} onChange={switchMode} />}
        />
      </div>
      <BackToTop />
    </>
  )
}

/** 故事/档案切换：克制文字切换 */
function ModeToggle({ mode, onChange }: { mode: 'story' | 'archive'; onChange: (m: 'story' | 'archive') => void }) {
  return (
    <div role="group" aria-label="编年史模式" className="flex shrink-0 items-center gap-1 text-meta">
      <button
        onClick={() => onChange('story')}
        aria-pressed={mode === 'story'}
        className={`ui-press rounded-sm px-1 py-2 transition-colors sm:py-0.5 ${
          mode === 'story' ? 'text-ink underline underline-offset-4' : 'text-faint hover:text-muted'
        }`}
      >
        故事
      </button>
      <span aria-hidden className="text-faint/40">/</span>
      <button
        onClick={() => onChange('archive')}
        aria-pressed={mode === 'archive'}
        className={`ui-press rounded-sm px-1 py-2 transition-colors sm:py-0.5 ${
          mode === 'archive' ? 'text-ink underline underline-offset-4' : 'text-faint hover:text-muted'
        }`}
      >
        档案
      </button>
    </div>
  )
}
