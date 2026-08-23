import type { Metadata, Viewport } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { LiveContentProvider, LiveDocumentMeta } from '@/components/LiveContentProvider'
import { BgmPlayer } from '@/components/BgmPlayer'
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
        <LiveContentProvider initial={baked}>
          <LiveDocumentMeta />
          <SiteAnalytics />
          {children}
          {/* 背景音乐：挂在 layout 上，站内跳页时不会断掉重来 */}
          <BgmPlayer />
        </LiveContentProvider>
      </body>
    </html>
  )
}
