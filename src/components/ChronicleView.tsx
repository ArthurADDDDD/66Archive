'use client'

import { useEffect, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import type { ResolvedAct } from '@/lib/narrative'
import { SiteNav } from './SiteNav'
import { ActSection } from './ActSection'
import { Timeline } from './Timeline'

/**
 * 编年史双模式外壳：故事（默认）/ 档案。
 * - 故事模式：32 节详版三幕（SSR 的服务端内容，ActSection 渲染，SSR 仍在输出里）。
 * - 档案模式：完整 Timeline（搜索/筛选/年份/来源全部保留）。
 * - 深链：URL 带 y/m/q/p/t/g/alive 时进入档案模式并交还给 Timeline 恢复。
 * 切换刻意克制：两个文字按钮，不是 SaaS 分段控件。
 */
const ARCHIVE_PARAMS = ['y', 'm', 'q', 'p', 't', 'g', 'alive'] as const

export function ChronicleView({
  storyActs,
  total,
  latestYear,
  entries,
  isDemo,
  hiddenUnreviewed = 0,
}: {
  storyActs: ResolvedAct[]
  total: number
  latestYear: number
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
            搜索全部 {total.toLocaleString()} 条记录 →
          </button>
          <ModeToggle mode={mode} onChange={switchMode} />
        </div>
      </header>
      {/* mounted 后再亮出滚动显现，避免 SSR 闪现 */}
      <div className={mounted ? '' : 'no-reveal'}>
        <main className="ui-page-in mx-auto max-w-[1240px] px-4 pb-20 sm:px-6">
          <section className="ui-reveal py-8 sm:py-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-live">Chronicle · 编年史 · 故事模式</p>
            <h1 className="mt-4 max-w-2xl text-[30px] font-semibold leading-tight tracking-tight sm:text-[44px]">
              时间不是一条列表，是一路走过来的。
            </h1>
            <p className="mt-5 max-w-2xl text-[13px] leading-7 text-muted">
              故事按三幕讲：女流是怎么来的，156277 为什么后来不只是一个直播间，直播间之外她又怎么样了。
              共 {total.toLocaleString()} 条记录里的全部内容，在档案模式里可以逐条查到——包括这里没出现的每一次。
            </p>
          </section>

          {storyActs.map((act) => (
            <ActSection key={act.act.id} act={act} />
          ))}

          <p className="mt-8 font-mono text-[10px] leading-5 text-faint/70">
            故事模式只展示策展事件；如需逐条检索、筛选与来源核验，请切换到档案模式。
          </p>
        </main>
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
