'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  fetchLiveContent,
  type LiveAct,
  type LiveContent,
  type LiveCopyBlock,
  type LiveEditorialSection,
  type LiveNarrative,
  type LiveSiteCopy,
} from '@/lib/live-content'
import { SITE_COPY, type SiteCopy, type SiteCopyBlock } from '@/lib/site-copy'

/**
 * 实时内容上下文。
 *
 * 挂在根布局上，首屏渲染完成之后拉一次 `/api/content/*`，把内容服务里的当前值
 * 覆盖到页面上。拉失败就什么都不做——服务端渲染出来的已经是基线，页面本来就是对的。
 *
 * 为什么是客户端：公开站是静态导出的，构建产物里不可能带上「此刻」的内容服务数据。
 * 服务端渲染基线 + 客户端打覆盖，正好也是接口挂掉时页面照常的实现方式。
 */

const EMPTY_CONTENT: LiveContent = { narrative: null, copy: null, editorial: null }

const LiveContentContext = createContext<LiveContent>(EMPTY_CONTENT)

/**
 * `initial` 是构建期烤进来的后台文案（见 `lib/baked-content.ts`）。
 * 它让 SSG 出来的 HTML 直接就是后台文案：静态导出时客户端组件同样会被
 * 服务端渲染一遍，这里带着内容渲染，读 context 的组件在那一遍就把覆盖应用上了。
 * 没有 `initial`（本地 dev、烤入被关掉）时退回空值，行为与从前一致。
 */
export function LiveContentProvider({
  children,
  initial,
}: {
  children: React.ReactNode
  initial?: LiveContent
}) {
  const [content, setContent] = useState<LiveContent>(initial ?? EMPTY_CONTENT)

  useEffect(() => {
    let active = true
    void fetchLiveContent().then((live) => {
      if (!active) return
      // 逐份回退，不能直接 setContent(live)：实时请求失败时那一份是 null，
      // 整份覆盖会把烤进来的内容清掉，页面反而退回公仓基线——
      // 那正是烤入要解决的问题，写成整份覆盖等于白做。
      setContent((prev) => ({
        narrative: live.narrative ?? prev.narrative,
        copy: live.copy ?? prev.copy,
        editorial: live.editorial ?? prev.editorial,
      }))
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

/**
 * 把构建期烤入的 narrative 补进上下文，只包在真正渲染叙事内容的页面外面。
 *
 * 为什么不直接放进根 layout 的 `initial`：narrative 约 28KB，是三份内容里最大的一份，
 * 而站内两千多个条目页根本不读它。整份放进根 layout 会让每个页面的 RSC 载荷都背上它
 * ——实测 `out/` 从 231M 涨到 610M、条目页 HTML 几乎翻倍。
 *
 * 实时内容到达后 `parent.narrative` 就不再是 null，这里自动让位给它，
 * 所以不会盖住后台的最新改动。
 */
export function LiveNarrativeSeed({
  narrative,
  children,
}: {
  narrative: LiveNarrative | null
  children: React.ReactNode
}) {
  const parent = useLiveContent()
  const value = useMemo(
    () => (parent.narrative ? parent : { ...parent, narrative }),
    [parent, narrative],
  )
  return <LiveContentContext.Provider value={value}>{children}</LiveContentContext.Provider>
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
    // 名单是整份替换，不逐个按 id 覆盖——排序、加人、删人都要能生效，
    // 而按 id 合并只能改字段，改不了「有谁、谁在前面」。
    // 空数组按「没有覆盖」处理：内容服务里还没有这份名单时，页面照常显示基线。
    maintainers: live.maintainers.length > 0 ? live.maintainers.map((person) => ({ ...person })) : baseline.maintainers,
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
