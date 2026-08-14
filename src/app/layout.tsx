import type { Metadata, Viewport } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { LiveContentProvider, LiveDocumentMeta } from '@/components/LiveContentProvider'

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${display.variable} ${mono.variable}`}>
      <body className="font-sans">
        <LiveContentProvider>
          <LiveDocumentMeta />
          {children}
        </LiveContentProvider>
      </body>
    </html>
  )
}
