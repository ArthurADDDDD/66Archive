'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  flushSiteAnalytics,
  isSiteAnalyticsEventName,
  trackPageView,
  trackSiteEvent,
} from '@/lib/site-analytics'

/**
 * One document-level listener keeps analytics out of component state and avoids
 * one network request per click. Elements opt in with stable data attributes;
 * input values and URL query parameters are never read.
 */
export function SiteAnalytics() {
  const pathname = usePathname()

  useEffect(() => trackPageView(pathname), [pathname])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // 只认用户真的按下去的那一下。脚本 `element.click()` 派发的事件
      // isTrusted 为 false——把它算进「点开次数」，排行就成了「谁的脚本跑得勤」。
      if (!event.isTrusted) return
      const target = event.target
      if (!(target instanceof Element)) return
      const element = target.closest<HTMLElement>('[data-analytics-event]')
      if (!element || element.dataset.analyticsTrigger === 'change') return
      const name = element.dataset.analyticsEvent
      if (!isSiteAnalyticsEventName(name)) return
      trackSiteEvent(name, element.dataset.analyticsTarget)
    }
    const onChange = (event: Event) => {
      if (!event.isTrusted) return
      const element = event.target
      if (!(element instanceof HTMLInputElement) || element.dataset.analyticsTrigger !== 'change') return
      if (!element.value.trim()) return
      const name = element.dataset.analyticsEvent
      if (isSiteAnalyticsEventName(name)) trackSiteEvent(name, element.dataset.analyticsTarget)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushSiteAnalytics()
    }

    document.addEventListener('click', onClick)
    document.addEventListener('change', onChange)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushSiteAnalytics)
    window.addEventListener('online', flushSiteAnalytics)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('change', onChange)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushSiteAnalytics)
      window.removeEventListener('online', flushSiteAnalytics)
    }
  }, [])

  return null
}
