'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  fetchLiveContent,
  type LiveAct,
  type LiveContent,
  type LiveCopyBlock,
  type LiveEditorialSection,
  type LiveSiteCopy,
} from '@/lib/live-content'
import { SITE_COPY, type SiteCopy, type SiteCopyBlock } from '@/lib/site-copy'

/**
 * 实时内容上下文。
 *
 * 挂在根布局上，首屏渲染完成之后拉一次 `/api/content/*`，把管理后台里的当前值
 * 覆盖到页面上。拉失败就什么都不做——服务端渲染出来的已经是基线，页面本来就是对的。
 *
 * 为什么是客户端：公开站是静态导出的，构建产物里不可能带上「此刻」的后台内容。
 * 服务端渲染基线 + 客户端打覆盖，正好也是接口挂掉时页面照常的实现方式。
 */

const LiveContentContext = createContext<LiveContent>({ narrative: null, copy: null, editorial: null })

export function LiveContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<LiveContent>({ narrative: null, copy: null, editorial: null })

  useEffect(() => {
    let active = true
    void fetchLiveContent().then((live) => {
      if (active) setContent(live)
    })
    return () => {
      active = false
    }
  }, [])

  return <LiveContentContext.Provider value={content}>{children}</LiveContentContext.Provider>
}

export function useLiveContent(): LiveContent {
  return useContext(LiveContentContext)
}

/** 当前生效的站点文案：后台有就用后台的，没有就用公开仓基线。 */
export function useSiteCopy(): SiteCopy {
  const { copy } = useLiveContent()
  return useMemo(() => mergeSiteCopy(SITE_COPY, copy), [copy])
}

/** 按 id 取一个区块的文案（首页区块 / 子页页头）。 */
export function useCopyBlock(scope: 'homeSections' | 'pages', id: string): SiteCopyBlock {
  const copy = useSiteCopy()
  return copy[scope].find((block) => block.id === id) ?? { id, eyebrow: '', title: '', lede: '' }
}

/**
 * 站点文案合并：逐字段覆盖，后台给空字符串就是「这一项不显示」，
 * 后台没有这个 id 就沿用基线。基线里没有的 id 直接忽略——前台没有对应的位置放它。
 */
export function mergeSiteCopy(baseline: SiteCopy, live: LiveSiteCopy | null): SiteCopy {
  if (!live) return baseline
  const mergeBlocks = (baselineBlocks: SiteCopyBlock[], liveBlocks: LiveCopyBlock[]): SiteCopyBlock[] =>
    baselineBlocks.map((block) => {
      const override = liveBlocks.find((candidate) => candidate.id === block.id)
      return override ? { id: block.id, eyebrow: override.eyebrow, title: override.title, lede: override.lede } : block
    })

  return {
    version: 1,
    site: { title: live.site.title || baseline.site.title, description: live.site.description || baseline.site.description },
    nav: baseline.nav.map((item) => {
      const override = live.nav.find((candidate) => candidate.id === item.id)
      return override?.label ? { ...item, label: override.label } : item
    }),
    hero: {
      status: live.hero.status,
      eyebrow: live.hero.eyebrow,
      title: live.hero.title || baseline.hero.title,
      body: live.hero.body.length > 0 ? live.hero.body : baseline.hero.body,
      primaryAction: live.hero.primaryAction,
      secondaryAction: live.hero.secondaryAction,
    },
    homeSections: mergeBlocks(baseline.homeSections, live.homeSections),
    rooms: baseline.rooms.map((room) => {
      const override = live.rooms.find((candidate) => candidate.id === room.id)
      return override ? { ...room, kicker: override.kicker, title: override.title || room.title, body: override.body } : room
    }),
    pages: mergeBlocks(baseline.pages, live.pages),
  }
}

/** 取某一幕的实时覆盖；没有就返回 null，调用方继续用基线。 */
export function useLiveAct(scope: 'homeActs' | 'storyActs', actId: string): LiveAct | null {
  const { narrative } = useLiveContent()
  return narrative?.[scope].find((act) => act.id === actId) ?? null
}

/** 取某个板块的实时编排；后台没有这个板块（或整份没拉到）时返回 null。 */
export function useLiveSection(sectionId: string): LiveEditorialSection | null {
  const { editorial } = useLiveContent()
  return editorial?.sections.find((section) => section.id === sectionId) ?? null
}

/**
 * 板块是否显示。公开接口只返回启用中的板块，所以「拉到了整份、但里面没有这个 id」
 * 就等于管理员把它关掉了；整份没拉到（editorial 为 null）时一律按显示处理。
 */
export function useSectionEnabled(sectionId: string): boolean {
  const { editorial } = useLiveContent()
  if (!editorial) return true
  return editorial.sections.some((section) => section.id === sectionId)
}

/**
 * 站点标题与简介的实时覆盖。
 *
 * 静态导出的站点里 `metadata` 是构建期定的，改后台不会动到 HTML 源码里的
 * `<title>`——所以这里在浏览器里改。**爬虫看到的仍然是构建期那一份**：
 * 这是静态站的固有限制，不是漏实现；需要 SEO 跟着变的话得重新构建公开仓。
 */
export function LiveDocumentMeta() {
  const { copy } = useLiveContent()

  useEffect(() => {
    if (!copy) return
    if (copy.site.title) document.title = copy.site.title
    if (copy.site.description) {
      const meta = document.querySelector('meta[name="description"]')
      if (meta) meta.setAttribute('content', copy.site.description)
    }
  }, [copy])

  return null
}
