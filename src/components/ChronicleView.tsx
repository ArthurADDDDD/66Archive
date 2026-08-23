'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StorySection } from '@/lib/story-years'
import { SiteNav } from './SiteNav'
import { BackToTop } from './ScrollAffordances'
import { SearchField } from './SearchField'
import { StoryTimeline } from './StoryTimeline'
import { ChronicleRail } from './ChronicleRail'

/**
 * 编年史：故事模式。年份脊柱时间线，条目仍由 STORY_ACTS 策展。
 * 完整逐条档案在 /archive/（录播室）——两者是各自独立的页面，靠链接互通，
 * 不再是同一页面里的客户端模式切换（历史行为见 git 历史）。
 */
const ARCHIVE_PARAMS = ['y', 'm', 'q', 'p', 't', 'g', 'alive'] as const

export function ChronicleView({
  storySections,
  total,
  latestYear,
}: {
  storySections: StorySection[]
  total: number
  latestYear: number
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [storySearch, setStorySearch] = useState('')

  // 旧书签/外链可能还带着档案模式的查询参数（?y=/?q=…）——原样接到 /archive/，不让它们 404 在故事页里。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const p = new URLSearchParams(window.location.search)
    if (ARCHIVE_PARAMS.some((k) => p.has(k))) {
      router.replace(`/archive/${p.toString() ? `?${p.toString()}` : ''}`)
    }
  }, [router])

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
              router.push(`/archive/?q=${encodeURIComponent(value)}`)
            }}
            placeholder={`搜索全部 ${total.toLocaleString()} 条记录`}
            ariaLabel="搜索全部记录"
            iconClassName="ml-auto sm:hidden"
            inputClassName="hidden"
          />
          {/* 和游戏 / 节目 / 数据各页一致：这条入口固定贴在页头最右端，去录播室看完整档案。 */}
          <a
            href="/archive/"
            className="ui-press ml-auto hidden shrink-0 rounded-sm text-meta text-live tnum sm:block"
          >
            搜索全部 {total.toLocaleString()} 条记录 →
          </a>
        </div>
      </header>
      {/* mounted 后再亮出滚动显现，避免 SSR 闪现 */}
      <div className={mounted ? '' : 'no-reveal'}>
        <StoryTimeline
          sections={storySections}
          latestYear={latestYear}
          onOpenArchive={(year) => router.push(`/archive/?y=${year}`)}
          eyebrow={<ChronicleBreadcrumb />}
        />
      </div>
      <ChronicleRail sections={storySections} />
      <BackToTop />
    </>
  )
}

/** 面包屑：Chronicle · 编年史。故事/档案不再是同一页里的两个模式，切换靠真链接。 */
function ChronicleBreadcrumb() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta uppercase tracking-[0.16em] text-live">
      <span>Chronicle</span>
      <span aria-hidden className="text-faint/50">·</span>
      <span>编年史</span>
    </div>
  )
}
