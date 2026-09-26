'use client'

import { analyticsRoute, currentViewportClass, trackPerfSample, trackWebVital, type SitePerfSample } from './site-analytics'
import { IMAGE_PROXY_ORIGIN } from './platforms'

/**
 * 自采 Core Web Vitals（LCP / INP / CLS），外加一份首屏加载专项诊断。
 *
 * 为什么要自己采：面板原来的三项来自 Cloudflare RUM，而 RUM 依赖 Cloudflare 代理时
 * 自动注入的 beacon 脚本。主站 apex 迁到 EdgeOne 之后 Cloudflare 拿不到 HTML，
 * 注入不了，三项就恒为空。自采还有一个 Cloudflare RUM 给不了的好处：它走
 * `/api/analytics/events`，因此后端的 `ANALYTICS_EXCLUDED_IPS` 对性能样本同样生效，
 * 站长自己的设备不会再污染这里——Cloudflare RUM 没有「按来源排除」这种概念。
 *
 * **库是动态引入的。** 为了测速反而给首屏加一个同步依赖，属于自己把自己测慢；
 * 放进 effect 里异步取，测量本身也不会被它影响。用的是 attribution 构建：
 * 同样的三项数值，另外给出 LCP 的四段拆分和 LCP 元素，专项诊断靠它。
 *
 * 上报时机不需要在这里操心：web-vitals 自己在 `visibilitychange(hidden)` / `pagehide`
 * 吐终值，而 `SiteAnalytics` 早就监听了同样两个事件做 flush。只要本模块的监听器
 * **先于** flush 监听器注册（见 SiteAnalytics 里两个 effect 的顺序），终值就能赶上
 * 那一次 flush；万一没赶上，`trackWebVital` 在页面已隐藏时会自己立刻 flush。
 *
 * **专项诊断（2026-09-26）**：电脑端 LCP 长期约四成偏慢，但全站 vitals 看不出是哪一页、
 * 慢在哪一段。于是每次页面加载额外记一份样本：落地页类型、LCP / FCP / TTFB、
 * LCP 四段（服务器响应 / 加载前等待 / 下载 / 渲染等待）、LCP 是图还是字、图从哪来、
 * 网络与进入方式。这三项只属于**首次加载的 document**，所以落地页在这里（模块启动时）
 * 就记下，不在上报时读 pathname——站内换页不会把它归错。
 */
let started = false

type NavigationType = 'navigate' | 'reload' | 'back-forward' | 'back-forward-cache' | 'prerender' | 'restore' | 'soft-navigation'

function navClass(type: NavigationType): SitePerfSample['nav'] {
  if (type === 'back-forward-cache') return 'restore'
  if (type === 'navigate' || type === 'reload' || type === 'back-forward' || type === 'prerender' || type === 'restore') return type
  return 'other'
}

function netClass(): SitePerfSample['net'] {
  const type = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType
  return type === '4g' || type === '3g' || type === '2g' || type === 'slow-2g' ? type : 'unknown'
}

/** 只分「站内 / 图片代理 / 第三方」三类，不上报地址本身。 */
function sourceClass(url: string | undefined): SitePerfSample['lcpSource'] {
  if (!url) return 'none'
  if (url.startsWith(`${IMAGE_PROXY_ORIGIN}/`)) return 'proxy'
  try {
    return new URL(url, window.location.href).origin === window.location.origin ? 'local' : 'remote'
  } catch {
    return 'remote'
  }
}

function elementClass(element: Element | null | undefined, url: string | undefined): SitePerfSample['lcpElement'] {
  const tag = element?.tagName.toLowerCase()
  if (tag === 'video') return 'video'
  if (tag === 'img' || tag === 'image' || url) return 'image'
  return element ? 'text' : 'none'
}

const round = (value: number) => Math.max(0, Math.round(value))

function startPerfSample(lib: typeof import('web-vitals/attribution')) {
  const route = analyticsRoute(window.location.pathname)?.kind ?? 'other'
  const sample: SitePerfSample = {
    route,
    viewport: currentViewportClass(),
    net: netClass(),
    nav: 'navigate',
    lcpElement: 'none',
    lcpSource: 'none',
  }
  let sent = false
  const send = () => {
    if (sent || (sample.lcp === undefined && sample.fcp === undefined && sample.ttfb === undefined)) return
    sent = true
    trackPerfSample(sample)
  }

  // 只记第一次加载：从往返缓存恢复时 web-vitals 会再报一轮，那已经是另一次「加载」了。
  lib.onTTFB((metric) => {
    if (sent || sample.ttfb !== undefined) return
    sample.ttfb = round(metric.value)
    sample.nav = navClass(metric.navigationType)
  })
  lib.onFCP((metric) => {
    if (sent || sample.fcp !== undefined) return
    sample.fcp = round(metric.value)
  })
  lib.onLCP((metric) => {
    if (sent) return
    const { attribution } = metric
    sample.lcp = round(metric.value)
    sample.nav = navClass(metric.navigationType)
    sample.lcpElement = elementClass(attribution.lcpEntry?.element, attribution.url)
    sample.lcpSource = sample.lcpElement === 'image' ? sourceClass(attribution.url) : 'none'
    sample.lcpPhases = {
      ttfb: round(attribution.timeToFirstByte),
      loadDelay: round(attribution.resourceLoadDelay),
      loadTime: round(attribution.resourceLoadDuration),
      renderDelay: round(attribution.elementRenderDelay),
    }
    // LCP 在第一次交互或页面隐藏时才定稿；定稿就发，不再等。
    send()
  })
  // LCP 始终没有定稿（比如还没画出主要内容就离开了）：离开时把已有的 FCP / TTFB 发出去。
  // 注册在 onLCP 之后，同一个 hidden 事件里 LCP 的终值会先到。
  const onHidden = () => {
    if (document.visibilityState === 'hidden') send()
  }
  document.addEventListener('visibilitychange', onHidden)
  window.addEventListener('pagehide', send)
}

export function startWebVitalsReporting(): void {
  if (started || typeof window === 'undefined') return
  started = true
  void import('web-vitals/attribution')
    .then((lib) => {
      lib.onLCP((metric) => trackWebVital('lcp', metric.value))
      lib.onINP((metric) => trackWebVital('inp', metric.value))
      lib.onCLS((metric) => trackWebVital('cls', metric.value))
      startPerfSample(lib)
    })
    .catch(() => {
      // 取不到库就当没有性能采样——它不该影响页面任何功能。
      started = false
    })
}
