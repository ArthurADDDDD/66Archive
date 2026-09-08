import type { Metadata } from 'next'
import { BackToTop } from '@/components/ScrollAffordances'
import { ArchiveLoader } from '@/components/ArchiveLoader'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { buildArchiveNav } from '@/lib/archive-nav'
import { archiveDataUrl } from '@/lib/archive-data-url'

/** canonical 指向自身的 apex 地址。根 layout 只给 metadataBase，canonical 必须各页自己声明。 */
export const metadata: Metadata = {
  alternates: { canonical: '/archive/' },
}

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
 * 不带 `cache` 选项是有意的：响应头是 `max-age=0, stale-while-revalidate=86400`，
 * 浏览器仍然每次都再验证，但回访时可以先拿缓存里的那份立刻渲染、后台再刷新。
 * 原先写死的 `cache: 'no-cache'` 会把这条路堵掉，让每次进录播室都从零下载。
 *
 * 这条之所以现在还安全，是因为地址带上了按载荷字节算出来的版本号
 * （见 `lib/archive-data-url.ts`）：缓存按完整 URL 建键，新发布换新 URL，
 * 旧条目命不中，所以「先拿缓存那份」拿到的一定是这次发布自己的载荷。
 * 没有版本号的时候这里是个真问题——实测浏览器能拿着 24 小时前的字节
 * `transferSize: 0` 直接渲染，一次网络都不发。
 */
function archiveBootScript(dataUrl: string): string {
  return `(function(){try{window.__i6i6ArchiveBoot=fetch(${JSON.stringify(dataUrl)}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})}catch(e){}})()`
}

/**
 * 录播室：档案模式。完整 Timeline，能力一条不丢，搜索/筛选/年份/来源全部保留。
 * 深链（?y=/?m=/?q=/?p=/?t=/?g=/?alive=）由 Timeline 自己在客户端恢复
 * （静态导出无法在服务端读 searchParams）。
 */
export default function ArchivePage() {
  // 首屏「时间定位」的构建期版本。它不依赖那份 2.7MB 的载荷——只是各年各时期的条数
  // 与标题——所以没有理由让用户先看一屏脉冲占位再等请求回来。见 lib/archive-nav.ts。
  const nav = buildArchiveNav(toTimelineEntries(getDataset()))
  // 预取脚本与 ArchiveLoader 必须取同一个地址：两边各写一份字面量的话，
  // 只改其中一处就会让预取永远落空或者让「重新加载」悄悄换一个版本，且不报错。
  const dataUrl = archiveDataUrl()
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: archiveBootScript(dataUrl) }} />
      <ArchiveLoader nav={nav} dataUrl={dataUrl} />
      <BackToTop />
    </>
  )
}
