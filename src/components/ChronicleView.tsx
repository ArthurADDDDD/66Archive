'use client'

import { useEffect, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import type { ChronicleStory } from '@/lib/chronicle-story'
import { SiteNav } from './SiteNav'
import { StoryTimeline } from './StoryTimeline'
import { Timeline } from './Timeline'

/**
 * 编年史双模式外壳：故事（默认）/ 档案。
 * - 故事模式：SSR 的服务端内容（children 数据化后由 StoryTimeline 渲染，SSR 仍在输出里）。
 * - 档案模式：完整 Timeline（搜索/筛选/年份/来源全部保留）。
 * - 深链：URL 带 y/m/q/p/t/g/alive 时进入档案模式并交还给 Timeline 恢复。
 * 切换刻意克制：两个文字按钮，不是 SaaS 分段控件。
 */
const ARCHIVE_PARAMS = ['y', 'm', 'q', 'p', 't', 'g', 'alive'] as const

export function ChronicleView({
  story,
  entries,
  isDemo,
  hiddenUnreviewed = 0,
}: {
  story: ChronicleStory
  entries: TimelineEntry[]
  isDemo: boolean
  hiddenUnreviewed?: number
}) {
  const [mode, setMode] = useState<'story' | 'archive'>('story')
  const [mounted, setMounted] = useState(false)

  // 深链：URL 带档案参数时直接从档案模式开始（Timeline 自己会恢复 y/q/…）
  // 静态导出无法在服务端读 searchParams，初始模式只能在客户端 effect 里定，一次性且无外部依赖。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const p = new URLSearchParams(window.location.search)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ARCHIVE_PARAMS.some((k) => p.has(k))) setMode('archive')
  }, [])

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
      window.history.replaceState(null, '', `/chronicle/?y=${story.latestYear}`)
    }
    setMode(next)
  }

  if (mode === 'archive') {
    return <Timeline entries={entries} isDemo={isDemo} hiddenUnreviewed={hiddenUnreviewed} extra={<ModeToggle mode={mode} onChange={switchMode} />} />
  }

  return (
    <>
      <header className="ui-slide-down sticky top-0 z-30 border-b border-line bg-base/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
          <SiteNav active="chronicle" />
          <button
            onClick={() => switchMode('archive')}
            className="ui-press ml-auto shrink-0 rounded-sm px-1 py-2 font-mono text-[11px] text-live underline-offset-4 hover:underline sm:ml-auto sm:py-0"
          >
            搜索全部 {story.total.toLocaleString()} 条记录 →
          </button>
          <ModeToggle mode={mode} onChange={switchMode} />
        </div>
      </header>
      {/* mounted 后再亮出滚动显现，避免 SSR 闪现 */}
      <div className={mounted ? '' : 'no-reveal'}>
        <StoryTimeline story={story} latestYear={story.latestYear} onOpenArchive={openArchiveYear} />
      </div>
    </>
  )
}

/** 故事/档案切换：克制文字切换 */
function ModeToggle({ mode, onChange }: { mode: 'story' | 'archive'; onChange: (m: 'story' | 'archive') => void }) {
  return (
    <div role="group" aria-label="编年史模式" className="flex shrink-0 items-center gap-1 font-mono text-[11px]">
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
