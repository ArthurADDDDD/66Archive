'use client'

import { useMemo } from 'react'
import type { LiveNarrative } from '@/lib/live-content'
import { LiveContentContext, useLiveContent } from './LiveContentProvider'

/**
 * 为什么它单独一个文件，而不是留在 `LiveContentProvider.tsx` 里。
 *
 * 只有首页和编年史用得到它，于是这两个**页面级服务端组件**会 import
 * `LiveContentProvider.tsx`。而根 layout 的客户端边界（`LiveContentProvider` 本身）
 * 也在那个文件里。Next 生成 client-reference-manifest 时，会把该模块解析到它所在的
 * chunk group——因为首页也引了它，那个 group 就是**首页的 page chunk**。
 * 结果是每一个页面为了拿到根 layout 的 Provider，都得下载首页的 bundle：
 * 实测 3,488 个导出页面里有 3,487 个带着 `chunks/app/page-*.js`，
 * 连同 484 / 50 两个 chunk 一共 26,838 B br、84,968 B 的 JS 解析，
 * 在 `/e/[id]/` 上占该路由全部非 polyfill JS 的 16.7%。
 *
 * 把它挪出来之后，没有任何页面级组件再 import 那个文件，根 layout 的客户端边界
 * 就落回 layout 自己的 chunk group。
 *
 * **context 必须仍是同一个实例**，所以这里从 `LiveContentProvider` 导入
 * `LiveContentContext`，不自己 `createContext`。写错的话首页和编年史的叙事覆盖会
 * 静默失效——不报错，只是永远显示公开仓基线。
 */

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
