'use client'

import { useContext, useMemo } from 'react'
import type { LiveEditorial, LiveSiteCopy } from '@/lib/live-content'
import { LiveContentContext, LiveCopyArrivedContext, useLiveContent } from './LiveContentProvider'

/**
 * 把这一页真正会渲染的那部分后台文案补进上下文。
 *
 * 和 `LiveNarrativeSeed` 是同一条思路，只是这次分的是 site-copy 与 editorial。
 *
 * 根 layout 原本把**整份** site-copy（hero / homeSections / rooms / pages / maintainers）
 * 和整份 editorial 烤进每一个页面。实测这在条目页上占 3,860 B br（该页的 32%）、
 * 在 `/archive/` 上占 3,919 B（44%）、在游戏详情页上占 3,846 B——而这三类页面
 * 一个字都不渲染它们：它们只用到 `site`（标题）和 `nav`（导航标签）。
 * 全站 3,488 个导出页里有 3,483 个属于这一类。
 *
 * 所以根 layout 改成只烤 `{site, nav}`，真正要用的页面在这里自己补齐。
 *
 * **让位规则**：内容服务的当前值一旦到达（`LiveCopyArrivedContext`），这里立刻退开，
 * 否则烤入值会盖住管理员刚改的文案——那正是烤入要避免的反效果。
 * 拉失败时该 context 保持 false，页面继续用烤入值，行为与从前一致。
 *
 * **必须复用 `LiveContentProvider` 导出的 context 实例**，不能自己 `createContext`；
 * 理由见那边的注释（写错不会报错，只会让覆盖静默失效）。
 */
export function LiveCopySeed({
  copy,
  editorial,
  children,
}: {
  copy: LiveSiteCopy | null
  editorial?: LiveEditorial | null
  children: React.ReactNode
}) {
  const parent = useLiveContent()
  const arrived = useContext(LiveCopyArrivedContext)

  const value = useMemo(() => {
    if (arrived) return parent
    return {
      ...parent,
      copy: copy ?? parent.copy,
      editorial: editorial ?? parent.editorial,
    }
  }, [arrived, parent, copy, editorial])

  return <LiveContentContext.Provider value={value}>{children}</LiveContentContext.Provider>
}
