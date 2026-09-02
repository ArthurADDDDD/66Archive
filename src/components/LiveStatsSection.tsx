'use client'

import type React from 'react'
import { useCopyBlock } from './LiveContentProvider'
import { StatsSection } from './StatsSection'

/**
 * 数据页的一节，提问从内容服务取。
 *
 * 这八个提问原本硬编码在 `app/stats/page.tsx` 里——改一个字要改代码、跑一次 CI、
 * 发一次版。它们和其他页头文案是同一类东西（页面上的固定文字，不是史料），
 * 没有理由走不同的路。
 *
 * 单独包一层而不是改 StatsSection：后者要能在**服务端与客户端都用**（有些小节
 * 要等内容服务回话才知道渲不渲染），把 hook 塞进去会让它只能在客户端用。
 * 取文案放外面，StatsSection 保持是一个纯展示组件。
 *
 * 后台把 title 清空时回落到 `fallback`——那是构建期烤进 HTML 的基线值。
 * 不回落的话，误清空一个字段的后果是页面上出现一个没有标题的小节，
 * 而那看起来像渲染坏了，不像「有人清空了一个字段」。
 */
export function LiveStatsSection({
  questionId,
  fallback,
  accent,
  legend,
  children,
}: {
  questionId: string
  fallback: string
  accent: string
  legend?: string
  children: React.ReactNode
}) {
  const block = useCopyBlock('pages', questionId)
  return (
    <StatsSection question={block.title || fallback} accent={accent} legend={legend}>
      {children}
    </StatsSection>
  )
}
