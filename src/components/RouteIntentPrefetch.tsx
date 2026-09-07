'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * 全站「意图预取」：只预热鼠标 / 焦点 / 触摸真正指向的那一条链接。
 *
 * 为什么需要它：Next 的 `<Link>` 默认在链接**进入视口**时就去拉该路由的 RSC 载荷。
 * 静态导出下那是一份完整的 `index.txt`。实测线上 `/games/` 首屏静止不动就发出 15 条
 * 预取、144 KB；而这一页有 745 张游戏卡，往下滚会把预取拖成无上限的后台下载
 * （全部拉完约 7.5 MB），正好和 60 张封面抢带宽。列表页用户最多点开其中一条，
 * 剩下的全是浪费。
 *
 * 所以站内链接统一写 `prefetch={false}`（Next 15 下它同时关掉视口预取和 hover 预取，
 * 见 `next/dist/client/app-dir/link.js` 的 `prefetchEnabled`），再由这里补回
 * 「指向哪条就预热哪条」。做法与 `SiteNav` 的 `useNavIntentPrefetch` 一致，
 * 只是改成事件委托：挂一次就覆盖全站每一条链接，包括服务端组件渲染的那些，
 * 不用把它们逐个变成客户端组件（那会往每页的 RSC 载荷里塞进几十条客户端引用）。
 *
 * 预算是有意设的：同一路由只预热一次，单页最多预热 12 条。鼠标扫过一整面封面墙
 * 不该变成另一种形式的整排预取。
 *
 * 「单页」两个字要当真：这份名额必须**跟着导航重置**。挂在文档生命周期上的话，
 * 站内翻几页就把 12 个名额用光，之后整个会话再怎么 hover 都不再预热——而且是静默的。
 * 所以 `warmed` 由 `pathname` 驱动清空。
 *
 * 预热的 key 还要**去掉查询串**。站内有一批 `/archive/?y=YYYY` 这样的链接
 * （/stats/ 上 16 条、/gallery/ 上 10 条，条目页页头还有一条 `?y=&m=`），
 * 它们指向的是同一份 `/archive/index.txt`——查询串是前台自己解析的。
 * 按原样当 key 会把同一份 6,380 B 的载荷重复下十几遍，还顺带把名额烧光。
 */
const INTENT_DELAY_MS = 100
const MAX_PREFETCH_PER_PAGE = 12

export function RouteIntentPrefetch() {
  const router = useRouter()
  const pathname = usePathname()
  const warmedRef = useRef<Set<string>>(new Set())

  // 换页就把名额还回来：12 条是「这一页最多预热多少」，不是「这个标签页一辈子」。
  useEffect(() => {
    warmedRef.current.clear()
  }, [pathname])

  useEffect(() => {
    const warmed = warmedRef.current
    let timer: number | null = null

    const cancel = () => {
      if (timer === null) return
      window.clearTimeout(timer)
      timer = null
    }

    /** 只认站内、当前页以外、且没被显式排除的普通链接。 */
    const targetOf = (event: Event): string | null => {
      const node = event.target
      if (!(node instanceof Element)) return null
      const anchor = node.closest('a')
      if (!anchor) return null
      if (anchor.target && anchor.target !== '_self') return null
      if (anchor.hasAttribute('download')) return null
      const href = anchor.getAttribute('href')
      // 站内相对路径才预取：外链、锚点、mailto: 都不该走 router.prefetch。
      if (!href || !href.startsWith('/') || href.startsWith('//')) return null
      // 查询串一并去掉——`/archive/?y=2010` 和 `/archive/` 是同一份 RSC 载荷，
      // 年份是前台自己解析的。留着它等于把同一份载荷按年份重复下一遍。
      const path = href.split('#')[0].split('?')[0]
      if (!path || path === window.location.pathname) return null
      return path
    }

    const warm = (path: string) => {
      if (warmed.has(path) || warmed.size >= MAX_PREFETCH_PER_PAGE) return
      warmed.add(path)
      try {
        router.prefetch(path)
      } catch {
        // 预取失败没有任何用户可见后果，点击时照常走正常导航。
      }
    }

    const onIntent = (event: Event) => {
      cancel()
      const path = targetOf(event)
      if (!path) return
      timer = window.setTimeout(() => {
        timer = null
        warm(path)
      }, INTENT_DELAY_MS)
    }

    // 触摸与按下没有「悬停一会儿」这个过程，直接预热，抢在导航之前。
    const onCommit = (event: Event) => {
      cancel()
      const path = targetOf(event)
      if (path) warm(path)
    }

    document.addEventListener('pointerover', onIntent, { passive: true })
    document.addEventListener('focusin', onIntent, { passive: true })
    document.addEventListener('pointerdown', onCommit, { passive: true })
    document.addEventListener('touchstart', onCommit, { passive: true })
    document.addEventListener('pointerout', cancel, { passive: true })

    return () => {
      cancel()
      document.removeEventListener('pointerover', onIntent)
      document.removeEventListener('focusin', onIntent)
      document.removeEventListener('pointerdown', onCommit)
      document.removeEventListener('touchstart', onCommit)
      document.removeEventListener('pointerout', cancel)
    }
  }, [router])

  return null
}
