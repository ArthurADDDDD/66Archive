'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  contentPathsFor,
  fetchLiveContent,
  type LiveAct,
  type LiveContent,
  type LiveCopyBlock,
  type LiveEditorialSection,
  type LiveSiteCopy,
} from '@/lib/live-content'
import { fillSiteText, SITE_COPY, type SiteCopy, type SiteCopyBlock } from '@/lib/site-copy'
import { listenForLiveEditHost, type LiveEditDraft, type LiveEditSession } from '@/lib/live-edit'

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

/**
 * **必须只有这一个实例。** `LiveNarrativeSeed` 住在另一个文件里（见
 * `LiveNarrativeSeed.tsx` 顶部关于 chunk 归属的说明），它要往同一个 context 上
 * 叠一层。两个模块各自 `createContext` 会让首页与编年史的叙事覆盖静默失效——
 * 页面不报错，只是永远显示公开仓基线。
 */
export const LiveContentContext = createContext<LiveContent>(EMPTY_CONTENT)

/**
 * 后台的站点文案是否已经到达。
 *
 * 只给 `LiveCopySeed` 用：它需要区分「上下文里的 copy 还是构建期烤入的那份」和
 * 「已经换成内容服务的当前值」，好在后者到达时让位。做成独立的 context 而不是往
 * `LiveContent` 里加字段——那个类型是覆盖链路的契约，读它的地方很多，
 * 为一个内部信号改它的形状不划算。
 *
 * 拉失败时保持 false：那种情况下页面本来就该继续用烤入值，不是让位给 null。
 */
export const LiveCopyArrivedContext = createContext(false)

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
  const [copyArrived, setCopyArrived] = useState(false)
  const pathname = usePathname()
  // 已经拿到（或已经发出过）的分片。站内换页不该把 site-copy 再拉一遍，
  // 而换到首页 / 编年史时又必须补上此前没拉的 narrative。
  const requested = useRef<Set<string>>(new Set())
  // effect 的依赖必须是稳定值：`contentPathsFor` 每次返回新数组，直接当依赖会每帧重跑。
  const wanted = contentPathsFor(pathname).join('|')

  useEffect(() => {
    const missing = wanted.split('|').filter((path) => !requested.current.has(path))
    if (missing.length === 0) return
    for (const path of missing) requested.current.add(path)

    let active = true
    void fetchLiveContent(missing).then((live) => {
      if (!active) return
      if (live.copy) setCopyArrived(true)
      // 逐份回退，不能直接 setContent(live)：这次没拉的分片、以及拉失败的那一份
      // 都是 null，整份覆盖会把烤进来的内容清掉，页面反而退回公仓基线——
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
  }, [wanted])

  // 现场编辑（见 lib/live-edit.ts）：只有被后台嵌进 iframe 时才会建立会话，
  // 普通访客这里始终是 null，value 就是原来的 content。
  const [editSession, setEditSession] = useState<LiveEditSession | null>(null)
  const [editDraft, setEditDraft] = useState<LiveEditDraft | null>(null)
  useEffect(() => listenForLiveEditHost(setEditSession, setEditDraft), [])
  const value = useMemo(
    () => (editSession ? editSession.apply(content, editDraft) : content),
    [editSession, content, editDraft],
  )

  return (
    <LiveContentContext.Provider value={value}>
      {/* 编辑会话里内容一律以上下文为准，各页烤入的那份要让位，否则草稿会被盖住。 */}
      <LiveCopyArrivedContext.Provider value={copyArrived || editSession !== null}>{children}</LiveCopyArrivedContext.Provider>
    </LiveContentContext.Provider>
  )
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

const BASELINE_TEXTS = new Map(SITE_COPY.texts.map((item) => [item.id, item.text]))
const textTables = new WeakMap<LiveSiteCopy, Map<string, string>>()

/**
 * 页面文字的当前值表：基线打底，后台给了非空文字的覆盖上去。
 *
 * 按 copy 对象缓存——一页上几十处 `<SiteText>` 各自调一次 `useSiteCopy` 的话，
 * 每一处都要把整份文案合并一遍。空字符串按「恢复默认」处理：一句按钮文字被清空，
 * 页面上留下一个空按钮，比显示默认文字更糟。
 */
function textTable(copy: LiveSiteCopy | null): Map<string, string> {
  if (!copy || copy.texts.length === 0) return BASELINE_TEXTS
  const cached = textTables.get(copy)
  if (cached) return cached
  const table = new Map(BASELINE_TEXTS)
  for (const item of copy.texts) {
    if (BASELINE_TEXTS.has(item.id) && item.text.trim() !== '') table.set(item.id, item.text)
  }
  textTables.set(copy, table)
  return table
}

/** 一句页面文字的当前值。id 不在基线里时原样返回 id——漏登记一眼就能看出来。 */
export function useSiteText(id: string): string {
  const { copy } = useLiveContent()
  return textTable(copy).get(id) ?? id
}

/**
 * 取文字的函数，第二个参数填占位符。一个组件里要取很多句（且多半是字符串属性、
 * 三元表达式里的分支）时用它，省得每句写一个 hook。
 */
export function useSiteTexts(): (id: string, vars?: Record<string, string | number>) => string {
  const { copy } = useLiveContent()
  const table = textTable(copy)
  return useCallback((id: string, vars?: Record<string, string | number>) => fillSiteText(table.get(id) ?? id, vars), [table])
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
    // 与 `useSiteText` 同一条规则：按基线的 id 逐条覆盖，空文字等于没有覆盖。
    texts: baseline.texts.map((item) => {
      const override = live.texts.find((candidate) => candidate.id === item.id)
      return override && override.text.trim() !== '' ? { ...item, text: override.text } : item
    }),
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
