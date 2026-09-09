'use client'

import { Eyebrow } from './primitives'
import { useCopyBlock } from './LiveContentProvider'

/**
 * 节目详情页上那些「不属于任何一个节目」的文字。
 *
 * 分类小标、区块小标、列表提示、一起See 的归档说明——它们原本硬编码在
 * `src/app/series/[id]/page.tsx` 里，改一个字要发一次版。这里把它们接到
 * 后台「站点文案 · 子页页头」上（id 见 `lib/site-copy.ts` 的 series-detail-*）。
 *
 * 节目自己的名字、简介、期数和日期不在这里：那些是史料，真源在 `data/series.yaml`
 * 与 `data/entries/**`，后台走「目录维护」改，不该在文案表里出现第二份。
 *
 * 都是客户端组件：静态站的 HTML 里是构建期烤入值，覆盖在浏览器里打上去，
 * 后台不可用时页面保持烤入值，不会空。
 */

export type SeriesKind = 'live' | 'themed' | 'video'

/** 标题上方那行分类小标（长期直播节目 / 主题栏目 / 视频系列）。 */
export function SeriesKindEyebrow({ kind, color }: { kind: SeriesKind; color: string }) {
  const block = useCopyBlock('pages', `series-detail-kind-${kind}`)
  if (!block.title) return null
  return (
    <Eyebrow color={color} dot>
      {block.title}
    </Eyebrow>
  )
}

/** 区块小标（活跃年份 / Episodes · 全部记录），文字取自后台，版式不变。 */
export function SeriesSectionEyebrow({ pageId }: { pageId: string }) {
  const block = useCopyBlock('pages', pageId)
  if (!block.eyebrow) return null
  return <Eyebrow className="text-muted">{block.eyebrow}</Eyebrow>
}

/** 只在部分节目上出现的说明段（目前是一起See 的归档口径）。 */
export function SeriesNote({ pageId, className = '' }: { pageId: string; className?: string }) {
  const block = useCopyBlock('pages', pageId)
  if (!block.lede) return null
  return <p className={className}>{block.lede}</p>
}
