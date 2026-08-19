'use client'

import { useEffect, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import type { StorySection } from '@/lib/story-years'
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
  storySections,
  total,
  latestYear,
  entries,
  isDemo,
  hiddenUnreviewed = 0,
}: {
  storySections: StorySection[]
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
        <Timeline
          entries={entries}
          isDemo={isDemo}
          hiddenUnreviewed={hiddenUnreviewed}
          extra={<ChronicleBreadcrumb mode={mode} onChange={switchMode} />}
        />
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
          {/* 和游戏 / 节目 / 数据各页一致：这条入口固定贴在页头最右端。 */}
          <button
            onClick={() => switchMode('archive')}
            className="ui-press ml-auto hidden shrink-0 rounded-sm text-meta text-live tnum sm:block"
          >
            搜索全部 {total.toLocaleString()} 条记录 →
          </button>
        </div>
      </header>
      {/* mounted 后再亮出滚动显现，避免 SSR 闪现 */}
      <div className={mounted ? '' : 'no-reveal'}>
        <StoryTimeline
          sections={storySections}
          latestYear={latestYear}
          onOpenArchive={openArchiveYear}
          eyebrow={<ChronicleBreadcrumb mode={mode} onChange={switchMode} />}
        />
      </div>
      <BackToTop />
    </>
  )
}

/**
 * 面包屑即模式切换：Chronicle · 编年史 · 故事模式 / 档案模式。
 * 切换本来就是「我现在在看哪一种编年史」，放在面包屑的最后一级比塞进页头更说得通，
 * 页头因此只剩导航与搜索入口，和其他页面对齐。
 */
function ChronicleBreadcrumb({ mode, onChange }: { mode: 'story' | 'archive'; onChange: (m: 'story' | 'archive') => void }) {
  const item = (value: 'story' | 'archive', label: string) => (
    <button
      onClick={() => onChange(value)}
      aria-current={mode === value ? 'page' : undefined}
      className={`ui-press rounded-sm transition-colors ${
        mode === value ? 'text-ink' : 'text-live hover:text-ink'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta uppercase tracking-[0.16em] text-live">
      <span>Chronicle</span>
      <span aria-hidden className="text-faint/50">·</span>
      <span>编年史</span>
      <span aria-hidden className="text-faint/50">·</span>
      <span role="group" aria-label="编年史模式" className="flex items-center gap-1.5">
        {item('story', '故事模式')}
        <span aria-hidden className="text-faint/40">/</span>
        {item('archive', '档案模式')}
      </span>
    </div>
  )
}
