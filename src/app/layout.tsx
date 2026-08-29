import type { Metadata, Viewport } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { LiveContentProvider, LiveDocumentMeta } from '@/components/LiveContentProvider'
import { BgmPlayer } from '@/components/BgmPlayer'
import { LiveStatusIndicator } from '@/components/LiveStatusIndicator'
import { SiteAnalytics } from '@/components/SiteAnalytics'
import { fetchBakedShell } from '@/lib/baked-content'

const display = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

/**
 * 这里刻意保持静态，**不要**改成 `generateMetadata` 去读烤入的后台值。
 *
 * 实测：给根 layout 加 `generateMetadata` 会让 `/e/[id]`（两千多个页面）在预渲染时
 * 非确定性地失败——每次报错的页面都不一样，且只有这条高页数路由中招。
 * 换回静态 `metadata` 后构建稳定。
 *
 * 放弃它的代价很小：后台的站点标题与基线这里完全一致，简介也只是略短，
 * 为一个几乎相同的字符串去换一条 2695 页路由的构建失败，不划算。
 * 页面正文的烤入不受影响——那条路径走的是 `LiveContentProvider` 的初始值。
 */
export const metadata: Metadata = {
  title: '女流编年史',
  description:
    '2010 年至今的视频与直播索引。只收录链接，不搬运资源——每一次播放都回到原平台。',
  icons: {
    icon: '/images/avatars/v1_2015.jpg',
    apple: '/images/avatars/v1_2015.jpg',
  },
}

/**
 * 首屏预取脚本。
 *
 * 覆盖文案的三个请求原本排在 React 水合之后（`LiveContentProvider` 的 effect 里），
 * 于是页面先画一遍构建期烤入的旧值，等 JS 跑完才纠正——这就是「刷新时短暂回滚」。
 * 实测线上首页：水合结束 ~400ms，三份内容到齐 ~590ms。
 *
 * 这三个 URL 是固定的，不依赖任何页面状态，所以没有理由等 JS。放进 `<head>`
 * 用 `beforeInteractive` 发出去，请求就和 JS 下载并行，覆盖能赶在首帧附近落地。
 *
 * 脚本刻意写得极小且全程 try/catch + `.catch`：
 * - 它跑在框架之前，出错没有任何人接得住，必须自己兜住；
 * - 每个 promise 都自带 `.catch`，否则预取失败会变成 unhandled rejection
 *   （消费方要等到水合后才来 await，中间这段时间没人挂 handler）。
 *
 * 消费方在 `lib/live-content.ts` 的 `bootedJson`：拿不到就照常走原来的请求加重试，
 * 所以脚本没跑、被 CSP 拦掉、或者浏览器太老，行为都和从前一致。
 */
const CONTENT_BOOT_PATHS = ['/api/content/narrative', '/api/content/site-copy', '/api/content/editorial']

const CONTENT_BOOT_SCRIPT = `(function(){try{var o=${JSON.stringify(
  (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, ''),
)},p=${JSON.stringify(CONTENT_BOOT_PATHS)},b={};for(var i=0;i<p.length;i++){(function(u){b[u]=fetch(o+u,{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})})(p[i])}window.__i6i6ContentBoot=b}catch(e){}})()`

/** 手机浏览器的地址栏跟着页面走——否则暗色页面顶上会顶着一条亮色浏览器 chrome。 */
export const viewport: Viewport = {
  themeColor: '#12141C',
  colorScheme: 'dark',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const baked = await fetchBakedShell()
  return (
    <html lang="zh-CN" className={`${display.variable} ${mono.variable}`}>
      <body className="font-sans">
        {/*
          必须是原生 <script>，不能用 next/script 的 beforeInteractive：实测在 App Router
          下它会被序列化进 RSC 载荷，直到 React 处理到那一条才执行——正好回到
          「等 JS」这个要解决的问题上。原生标签由 HTML 解析器就地执行，而框架 chunk
          全是 defer 的，所以这一句稳稳跑在它们前面。
        */}
        <script dangerouslySetInnerHTML={{ __html: CONTENT_BOOT_SCRIPT }} />
        <LiveContentProvider initial={baked}>
          <LiveDocumentMeta />
          <SiteAnalytics />
          {children}
          {/* 直播状态属于全站浮层；挂在 layout 上，站内换页时保持显示与轮询。 */}
          <LiveStatusIndicator />
          {/* 背景音乐：挂在 layout 上，站内跳页时不会断掉重来 */}
          <BgmPlayer />
        </LiveContentProvider>
      </body>
    </html>
  )
}
