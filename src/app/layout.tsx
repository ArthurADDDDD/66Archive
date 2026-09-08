import type { Metadata, Viewport } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { LiveContentProvider, LiveDocumentMeta } from '@/components/LiveContentProvider'
import { BgmPlayer } from '@/components/BgmPlayer'
import { LiveStatusIndicator } from '@/components/LiveStatusIndicator'
import { SiteAnalytics } from '@/components/SiteAnalytics'
import { RouteIntentPrefetch } from '@/components/RouteIntentPrefetch'
import { fetchBakedNavShell } from '@/lib/baked-content'
import { CONTENT_PATHS, EDITORIAL_ROUTES, NARRATIVE_ROUTES } from '@/lib/live-content'
import { siteOrigin } from '@/lib/site-url'
import { IMAGE_PROXY_ORIGIN } from '@/lib/platforms'

const display = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

/**
 * 只留 400 / 600。
 *
 * 每多声明一档字重就多预载一个 woff2，而这几个文件是 `<link rel=preload>` 里
 * 优先级最高的一批、且已经是压缩格式（不会再被 brotli 压掉）。实测三档合计
 * 30,232 B，在 `/archive/` 这种页面上是整页 HTML（8,775 B br）的 3.4 倍。
 *
 * 500 这一档全站只有一个用法（`GalleryBoard.tsx` 里 10px 的日期标签的
 * `font-mono ... font-medium`），少它一档，CSS 字体匹配会退到 400——
 * 10px 的等宽数字上这一步几乎看不出来，省下 10,060 B。
 *
 * **600 不能删**：站内 `font-mono` 绝大多数配的是 `font-bold`（700），
 * 而这里没有 700 的字面，CSS Fonts 4 的匹配会向下取最接近的 600。
 * 删掉 600，那些数字会一路退到 400，是肉眼可见的变化。
 */
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
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
  /**
   * 让各页 `alternates.canonical` 能写成相对路径（`'/archive/'`），由 Next 解析成绝对地址。
   *
   * **这里刻意不写 `alternates`。** Next 的 metadata 是父到子浅合并，根 layout 写下
   * `canonical: '/'` 会被每一个没有显式覆盖的页面继承——`/archive/`、`/chronicle/`、
   * 两千多个 `/e/[id]/` 会全部 canonical 到首页，等于告诉搜索引擎「这些页面都是首页的副本」。
   * canonical 只能各页自己声明。
   */
  metadataBase: new URL(siteOrigin()),
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
 * 覆盖文案的请求原本排在 React 水合之后（`LiveContentProvider` 的 effect 里），
 * 于是页面先画一遍构建期烤入的旧值，等 JS 跑完才纠正——这就是「刷新时短暂回滚」。
 * 实测线上首页：水合结束 ~400ms，三份内容到齐 ~590ms。
 *
 * 这些 URL 只由当前路由决定，不依赖任何页面状态，所以没有理由等 JS。放进 `<head>`
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
/**
 * 预取哪几份，和 `LiveContentProvider` 实际会拉哪几份，**必须是同一条界线**。
 * 所以这里不重写一遍判断，而是把 `live-content.ts` 里那两份路由清单原样内联进去：
 * 脚本在浏览器里跑，`location.pathname` 现成可读，判断只剩「在不在这张表里」。
 *
 * 两边错配的后果是静默的——脚本预取了客户端不认（白费一个请求），或者客户端要而
 * 脚本没预取（退回水合后再发，也就是这段脚本本来要消掉的那段延迟）。都不报错，
 * 所以宁可共用数据也不要各写各的 if。
 */
const CONTENT_BOOT_SCRIPT = `(function(){try{var o=${JSON.stringify(
  (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, ''),
)},P=${JSON.stringify(CONTENT_PATHS)},N=${JSON.stringify(NARRATIVE_ROUTES)},E=${JSON.stringify(
  EDITORIAL_ROUTES,
)},x=location.pathname,q=x.charAt(x.length-1)==='/'?x:x+'/',p=[P.siteCopy];if(N.indexOf(q)>=0)p.push(P.narrative);if(E.indexOf(q)>=0)p.push(P.editorial);var b={};for(var i=0;i<p.length;i++){(function(u){b[u]=fetch(o+u,{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})})(p[i])}window.__i6i6ContentBoot=b}catch(e){}})()`

/** 手机浏览器的地址栏跟着页面走——否则暗色页面顶上会顶着一条亮色浏览器 chrome。 */
export const viewport: Viewport = {
  themeColor: '#12141C',
  colorScheme: 'dark',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const baked = await fetchBakedNavShell()
  return (
    <html lang="zh-CN" className={`${display.variable} ${mono.variable}`}>
      <head>
        {/*
          全站的远程封面现在只有一个来源（见 lib/image-proxy-policy.ts），
          3,488 个导出页里有 3,158 个至少加载一张。但第一张图要等 DNS + TCP + TLS
          走完才开始传——实测这段握手约 210–230ms，而条目页和游戏页的封面正是
          那些页面的 LCP 元素。preconnect 让握手和 CSS / JS 的下载并行。

          **不能带 crossorigin**：站内都是普通 `<img src>`（no-CORS 请求），
          带上 crossorigin 会预热到另一个连接池条目，图片照样得自己再握一次手。
        */}
        <link rel="preconnect" href={IMAGE_PROXY_ORIGIN} />
      </head>
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
          {/* 站内链接一律 prefetch={false}，由它按鼠标 / 焦点 / 触摸的指向补回预热。 */}
          <RouteIntentPrefetch />
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
