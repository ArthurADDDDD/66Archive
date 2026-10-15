'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createRoutePrefetch, prefetchPath } from '@/lib/route-prefetch'

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
 * 「指向哪条就预热哪条」。页头、浮动导航和正文共用事件委托：挂一次就覆盖全站每一条链接，包括服务端组件渲染的那些，
 * 不用把它们逐个变成客户端组件（那会往每页的 RSC 载荷里塞进几十条客户端引用）。
 *
 * 预算是有意设的：同一路由只预热一次，单页最多预热 12 条。鼠标扫过一整面封面墙
 * 不该变成另一种形式的整排预取。
 *
 * 「单页」两个字要当真：这份名额必须**跟着导航重置**。挂在文档生命周期上的话，
 * 站内翻几页就把 12 个名额用光，之后整个会话再怎么 hover 都不再预热——而且是静默的。
 * 所以监听器与预算随 `pathname` 重建，旧页面的计时器同时清理。
 *
 * 预热的 key 还要**去掉查询串**。站内有一批 `/archive/?y=YYYY` 这样的链接
 * （/stats/ 上 16 条、/gallery/ 上 10 条，条目页页头还有一条 `?y=&m=`），
 * 它们指向的是同一份 `/archive/index.txt`——查询串是前台自己解析的。
 * 按原样当 key 会把同一份 6,380 B 的载荷重复下十几遍，还顺带把名额烧光。
 */
export function RouteIntentPrefetch() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const intent = createRoutePrefetch((path) => router.prefetch(path))
    const targetOf = (node: EventTarget | null): string | null => {
      if (!(node instanceof Element)) return null
      const anchor = node.closest('a')
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return null
      return prefetchPath(anchor.getAttribute('href'), window.location.pathname)
    }
    const onIntent = (event: Event) => {
      const path = targetOf(event.target)
      if (path) intent.queue(path)
      else intent.cancel()
    }
    const onLeave = (event: MouseEvent | FocusEvent) => {
      // 在同一个链接的图片、文字之间移动，不重新计时或取消真实悬停。
      const from = targetOf(event.target)
      if (from && from === targetOf(event.relatedTarget)) return
      intent.cancel()
    }
    const onCommit = (event: PointerEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const path = targetOf(event.target)
      if (path) intent.commit(path)
      else intent.cancel()
    }

    document.addEventListener('pointerover', onIntent, { passive: true })
    document.addEventListener('focusin', onIntent, { passive: true })
    document.addEventListener('pointerdown', onCommit, { passive: true })
    document.addEventListener('pointerout', onLeave, { passive: true })
    document.addEventListener('focusout', onLeave, { passive: true })
    return () => {
      intent.cancel()
      document.removeEventListener('pointerover', onIntent)
      document.removeEventListener('focusin', onIntent)
      document.removeEventListener('pointerdown', onCommit)
      document.removeEventListener('pointerout', onLeave)
      document.removeEventListener('focusout', onLeave)
    }
  }, [router, pathname])

  return null
}
