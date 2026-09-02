'use client'

import { trackWebVital } from './site-analytics'

/**
 * 自采 Core Web Vitals（LCP / INP / CLS）。
 *
 * 为什么要自己采：面板原来的三项来自 Cloudflare RUM，而 RUM 依赖 Cloudflare 代理时
 * 自动注入的 beacon 脚本。主站 apex 迁到 EdgeOne 之后 Cloudflare 拿不到 HTML，
 * 注入不了，三项就恒为空。自采还有一个 Cloudflare RUM 给不了的好处：它走
 * `/api/analytics/events`，因此后端的 `ANALYTICS_EXCLUDED_IPS` 对性能样本同样生效，
 * 站长自己的设备不会再污染这里——Cloudflare RUM 没有「按来源排除」这种概念。
 *
 * **库是动态引入的。** 为了测速反而给首屏加一个同步依赖，属于自己把自己测慢；
 * 放进 effect 里异步取，测量本身也不会被它影响。
 *
 * 上报时机不需要在这里操心：web-vitals 自己在 `visibilitychange(hidden)` / `pagehide`
 * 吐终值，而 `SiteAnalytics` 早就监听了同样两个事件做 flush。只要本模块的监听器
 * **先于** flush 监听器注册（见 SiteAnalytics 里两个 effect 的顺序），终值就能赶上
 * 那一次 flush；万一没赶上，`trackWebVital` 在页面已隐藏时会自己立刻 flush。
 */
let started = false

export function startWebVitalsReporting(): void {
  if (started || typeof window === 'undefined') return
  started = true
  void import('web-vitals')
    .then(({ onLCP, onINP, onCLS }) => {
      onLCP((metric) => trackWebVital('lcp', metric.value))
      onINP((metric) => trackWebVital('inp', metric.value))
      onCLS((metric) => trackWebVital('cls', metric.value))
    })
    .catch(() => {
      // 取不到库就当没有性能采样——它不该影响页面任何功能。
      started = false
    })
}
