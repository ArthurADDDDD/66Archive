'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StorySection } from '@/lib/story-years'
import { SiteNav } from './SiteNav'
import { BackToTop } from './ScrollAffordances'
import { SearchField } from './SearchField'
import { StoryTimeline } from './StoryTimeline'
import { ChronicleRail } from './ChronicleRail'
import { ChronicleEraCompact } from './ChronicleEraTabs'
import { ChronicleMobileNav } from './ChronicleMobileNav'
import { flashLandedTarget } from '@/lib/landing-flash'
import { SiteFooter } from './primitives'
import { CHRONICLE_ERAS, DEFAULT_CHRONICLE_ERA, eraOfYear, isChronicleEra, type ChronicleEraId } from '@/lib/chronicle-eras'

/**
 * 编年史：故事模式。年份脊柱时间线，条目仍由 STORY_ACTS 策展。
 * 完整逐条档案在 /archive/（录播室）——两者是各自独立的页面，靠链接互通，
 * 不再是同一页面里的客户端模式切换（历史行为见 git 历史）。
 */
const ARCHIVE_PARAMS = ['y', 'm', 'q', 'p', 't', 'g', 'alive'] as const

export function ChronicleView({
  storySections,
  latestYear,
}: {
  storySections: StorySection[]
  latestYear: number
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [storySearch, setStorySearch] = useState('')
  const [era, setEra] = useState<ChronicleEraId>(DEFAULT_CHRONICLE_ERA)
  // 正文顶部的大分段按钮看不见时，页头里的紧凑分段才出现。
  const [tabsOffscreen, setTabsOffscreen] = useState(false)
  useEffect(() => {
    const node = document.getElementById('chronicle-era-tabs')
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setTabsOffscreen(!entry.isIntersecting), { rootMargin: '-64px 0px 0px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // 旧书签/外链可能还带着档案模式的查询参数（?y=/?q=…）——原样接到 /archive/，不让它们 404 在故事页里。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const p = new URLSearchParams(window.location.search)
    if (ARCHIVE_PARAMS.some((k) => p.has(k))) {
      router.replace(`/archive/${p.toString() ? `?${p.toString()}` : ''}`)
      return
    }
    // 分段：?era= 优先；旧的 #story-year-2019 / #story-beat-xxx 链接按它所在的年份切到对应时代。
    const fromQuery = p.get('era')
    const hash = decodeURIComponent(window.location.hash.slice(1))
    const hashYear = /^story-year-(\d{4})$/.exec(hash)?.[1]
    const beatYear = hash.startsWith('story-beat-')
      ? storySections.find((section) => [...section.featured, ...section.secondary].some((beat) => `story-beat-${beat.id}` === hash))?.year
      : undefined
    const initial = isChronicleEra(fromQuery)
      ? fromQuery
      : hashYear ? eraOfYear(Number(hashYear)) : beatYear ? eraOfYear(beatYear) : null
    if (initial && initial !== DEFAULT_CHRONICLE_ERA) {
      setEra(initial)
      if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }))
    }
  }, [router, storySections])

  // 切时代之后要落到哪里：null = 这一段的开头（分段按钮处）；右侧轨道跨时代跳转时是那张卡的 id。
  const pendingTarget = useRef<string | null>(null)
  const changeEra = (next: ChronicleEraId, targetId: string | null = null) => {
    pendingTarget.current = targetId
    setEra(next)
  }
  // 新时代的内容渲染出来以后再滚、再写地址：
  // - 目标卡在切换前还不在页面上；刚渲染时封面还在加载、高度会变，所以落一次、稍后再校准一次。
  // - 地址要在 Next 路由同步完 hash（轨道跳转会先写一次 #id）之后再写，否则 ?era= 会被覆盖掉。
  // 用 setTimeout 而不是 rAF：标签页在后台时 rAF 不跑，切回来会停在错的位置。
  useEffect(() => {
    if (!mounted) return
    const targetId = pendingTarget.current
    pendingTarget.current = null
    const land = () => {
      const target = targetId ? document.getElementById(targetId) : document.getElementById('chronicle-era-tabs')
      target?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior })
      return target
    }
    const writeUrl = () => {
      const url = new URL(window.location.href)
      if (era === DEFAULT_CHRONICLE_ERA) url.searchParams.delete('era')
      else url.searchParams.set('era', era)
      url.hash = targetId ?? ''
      if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url)
    }
    const first = window.setTimeout(() => {
      const target = land()
      if (targetId && target) flashLandedTarget(targetId, CHRONICLE_ERAS.find((item) => item.id === era)?.color ?? '#5BC8E8')
      writeUrl()
    }, 0)
    // 轨道跳转时 Next 会在稍后用它记下的地址（没有 ?era=）再同步一次，所以这里再写一遍。
    const settle = window.setTimeout(() => {
      land()
      writeUrl()
    }, 400)
    return () => {
      window.clearTimeout(first)
      window.clearTimeout(settle)
    }
    // 只在时代变化时跑；mounted 只用来跳过首屏
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [era])

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
            placeholder="搜标题、游戏、日期…"
            ariaLabel="搜索全部记录"
            iconClassName="ml-auto sm:hidden"
            inputClassName="hidden"
          />
          {/* 和游戏 / 节目 / 数据各页一致：这条入口固定贴在页头最右端，去录播室看完整档案。 */}
          <ChronicleEraCompact era={era} onChange={(next) => changeEra(next)} visible={tabsOffscreen} />
          <a
            href="/archive/"
            className="ui-press ml-auto hidden shrink-0 rounded-sm text-meta text-live tnum sm:block"
          >
            去录播室搜一场 →
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
          era={era}
          onEraChange={(next) => changeEra(next)}
        />
      </div>
      <ChronicleRail sections={storySections} onJumpToEra={(next, targetId) => changeEra(next, targetId)} />
      <ChronicleMobileNav era={era} onEraChange={(next) => changeEra(next)} />
      <SiteFooter />
      <BackToTop />
    </>
  )
}

/** 面包屑：Chronicle · 大事件（页面原名「编年史」，网址仍是 /chronicle/）。故事/档案不再是同一页里的两个模式，切换靠真链接。 */
function ChronicleBreadcrumb() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta uppercase tracking-[0.16em] text-live">
      <span>Chronicle</span>
      <span aria-hidden className="text-faint/50">·</span>
      <span>大事件</span>
    </div>
  )
}
