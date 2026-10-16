import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/page-metadata'
import { BackToTop } from '@/components/ScrollAffordances'
import { ArchiveLoader } from '@/components/ArchiveLoader'
import { getPublicDataset, toTimelineEntries } from '@/lib/data'
import { buildArchiveNav } from '@/lib/archive-nav'
import { archiveDataUrl } from '@/lib/archive-data-url'
import { archiveBootScript } from '@/lib/archive-loader'
import { fetchBakedPageCopy } from '@/lib/baked-content'
import { LiveCopySeed } from '@/components/LiveCopySeed'

/** 标题、简介、canonical 与社交卡片都由 `pageMetadata()` 一次给齐（见该文件注释）。 */
export const metadata: Metadata = pageMetadata({
  path: '/archive/',
  title: '录播室',
  description: '按年份和月份翻，或者直接搜标题——找到你记得的那一场。',
  shareId: 'archive',
})

/**
 * 档案载荷的首屏预取。
 *
 * 原先 `ArchiveLoader` 把 fetch 写在 `useEffect` 里，于是这份 2.7MB 的数据必须等
 * 十几个 chunk 全部下载、解析、React 水合完才发得出去。线上实测：最后一个 JS 在
 * 3463ms 落地，请求在 3517ms 才出现——中间 2.1 秒纯粹在排队等 JS，网络是空的。
 *
 * 这个 URL 是固定的，不依赖任何页面状态，所以没有理由等 JS。放在页面正文最前面
 * 用原生 `<script>` 发出去，请求就和 JS 下载并行。做法与根 layout 里的
 * `CONTENT_BOOT_SCRIPT` 完全一致（见 `app/layout.tsx` 的注释）：必须是原生标签，
 * `next/script` 的 beforeInteractive 在 App Router 下会被序列化进 RSC 载荷，
 * 要等 React 处理到那一条才执行，正好绕回「等 JS」这个要解决的问题。
 *
 * 脚本自带 `.catch`：它跑在框架之前，出错没有任何人接得住；而消费方要到水合后
 * 才来 await，中间这段时间没有 handler，不兜住就是 unhandled rejection。
 *
 * 消费方在 `ArchiveLoader` 的 `fetchArchive`：拿不到就照常自己发请求，所以脚本
 * 没跑、被 CSP 拦掉、或者浏览器太老，行为都和从前一致。
 *
 * 预取记录 URL，消费方只接收同版本载荷。请求有超时，失败可重新加载。
 * 不覆盖浏览器默认缓存策略；版本身份由 dataUrl 保证。
 */

/**
 * 录播室：档案模式。完整 Timeline，能力一条不丢，搜索/筛选/年份/来源全部保留。
 * 深链（?y=/?m=/?q=/?p=/?t=/?g=/?alive=）由 Timeline 自己在客户端恢复
 * （静态导出无法在服务端读 searchParams）。
 */
export default async function ArchivePage() {
  // 页面固定文字：录播室自己的（`archive-`）、「接着上次」浮条（`trail-`），
  // 以及展开某一条时出现的条目文字（`entry-`）。
  const bakedCopy = await fetchBakedPageCopy([], { texts: ['archive-', 'trail-', 'entry-'] })
  // 首屏「时间定位」的构建期版本。它不依赖那份 2.7MB 的载荷——只是各年各时期的条数
  // 与标题——所以没有理由让用户先看一屏脉冲占位再等请求回来。见 lib/archive-nav.ts。
  const nav = buildArchiveNav(toTimelineEntries(getPublicDataset()))
  // 预取脚本与 ArchiveLoader 必须取同一个地址：两边各写一份字面量的话，
  // 只改其中一处就会让预取永远落空或者让「重新加载」悄悄换一个版本，且不报错。
  const dataUrl = archiveDataUrl()
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: archiveBootScript(dataUrl) }} />
      <LiveCopySeed copy={bakedCopy}>
        <ArchiveLoader nav={nav} dataUrl={dataUrl} />
      </LiveCopySeed>
      <BackToTop />
    </>
  )
}
