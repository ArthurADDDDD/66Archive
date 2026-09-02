'use client'

export type SiteAnalyticsEventName =
  | 'page.view'
  | 'nav.click'
  | 'content.open'
  | 'source.open'
  | 'search.use'
  | 'search.zero'
  | 'filter.use'
  | 'random.refresh'
  | 'gallery.open'
  | 'media.play'
  | 'media.pause'
  | 'calibration.open'
  | 'calibration.submit'

type ViewportClass = 'small' | 'medium' | 'large'
type Route =
  | { kind: 'home' | 'chronicle' | 'archive' | 'games' | 'series' | 'stats' | 'gallery' | 'contact' }
  | { kind: 'entry' | 'game' | 'series-detail'; id: string }

type QueuedEvent = {
  name: SiteAnalyticsEventName
  route: Route
  target?: string
  viewport: ViewportClass
}

const ENDPOINT = '/api/analytics/events'
const MAX_BATCH = 24
const MAX_QUEUE = 72
const FLUSH_DELAY_MS = 4_000
const EVENT_NAMES = new Set<SiteAnalyticsEventName>([
  'page.view', 'nav.click', 'content.open', 'source.open', 'search.use', 'search.zero',
  'filter.use', 'random.refresh', 'gallery.open', 'media.play', 'media.pause',
  'calibration.open', 'calibration.submit',
])

/**
 * 一次 Web Vitals 采样。
 *
 * **刻意不带 route。** LCP/INP/CLS 是 document 生命周期指标，而本站有客户端换页，
 * 上报时刻（pagehide）的 pathname 不等于指标实际所属的页面——按当时的 pathname 记
 * 会系统性地归错页。第一版只做全站 + 视口聚合。
 */
export type SiteVitalMetric = 'lcp' | 'inp' | 'cls'
type QueuedVital = { metric: SiteVitalMetric; value: number; viewport: ViewportClass }

/** 与服务端 Schema 的 `vitals: z.array(...).max(12)` 对齐。 */
const MAX_VITALS_BATCH = 12

let queue: QueuedEvent[] = []
let vitalsQueue: QueuedVital[] = []
let flushTimer: number | null = null
let lastPageViewPath: string | null = null

/**
 * 同一个目标在这段时间内只算一次。
 *
 * 「点开次数」要经得起看：双击、误触、手抖连点在人眼里是一次打开，逐次上报
 * 会让排行变成「谁手最抖」。窗口刻意短——真的隔一会儿再点开同一条，仍然算
 * 新的一次。
 */
const DUPLICATE_WINDOW_MS = 4_000
const lastReported = new Map<string, number>()

/**
 * 自动化浏览器不算人。
 *
 * UA 里带 bot/crawler 关键字的那批在服务端就被丢掉了，但 Puppeteer / Playwright
 * / Selenium 默认带的是正常 Chrome UA——服务端看不出来，浏览器自己知道：
 * WebDriver 控制的会话 `navigator.webdriver` 为 true。这一层挡不住铁了心伪造的
 * 请求（那属于服务端的限流与聚合口径要解决的问题），但能把「跑个脚本抓一遍全站」
 * 这类最常见的噪音挡在统计之外。
 */
function isAutomatedBrowser(): boolean {
  return typeof navigator !== 'undefined' && navigator.webdriver === true
}

/**
 * 自己人不算数：站长/开发者天天在线上调试，这些访问会把「访问与点击」刷成噪音。
 *
 * 打开 `?analytics=off` 任意一页，这台浏览器从此不再上报（记在 localStorage，
 * 刷新和翻页都保持——这是**长期偏好**，不是会话状态，所以不跟着刷新清空）。
 * 想恢复统计就打开 `?analytics=on`。
 *
 * 注意这是**客户端**的静音：它只让这台浏览器不再发请求。真正按来源过滤
 * （比如按 IP 剔除）必须在收数据的后端做——这个公开仓里没有那一端，
 * 也不该出现任何 IP、主机名或服务器路径。
 */
const OPT_OUT_KEY = 'chronicle-66-analytics-off'
let optedOut: boolean | null = null

function isOptedOut(): boolean {
  if (optedOut !== null) return optedOut
  try {
    const flag = new URLSearchParams(window.location.search).get('analytics')
    if (flag === 'off') window.localStorage.setItem(OPT_OUT_KEY, '1')
    else if (flag === 'on') window.localStorage.removeItem(OPT_OUT_KEY)
    optedOut = window.localStorage.getItem(OPT_OUT_KEY) === '1'
  } catch {
    // 隐私模式下读不到 localStorage：当作没选择过，照常统计
    optedOut = false
  }
  return optedOut
}

/** 这台浏览器当前是否被排除在统计之外（给调试时自查用） */
export function siteAnalyticsOptedOut(): boolean {
  return typeof window === 'undefined' ? false : isOptedOut()
}

function validPublicId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,119}$/.test(value)
}

export function analyticsRoute(pathname: string): Route | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { kind: 'home' }
  const staticRoutes = new Map<string, Route['kind']>([
    ['/chronicle', 'chronicle'], ['/archive', 'archive'], ['/games', 'games'],
    ['/series', 'series'], ['/stats', 'stats'], ['/gallery', 'gallery'], ['/contact', 'contact'],
  ])
  const staticKind = staticRoutes.get(path)
  if (staticKind) return { kind: staticKind } as Route

  const detail = path.match(/^\/(e|games|series)\/([^/]+)$/)
  if (!detail || !validPublicId(detail[2])) return null
  const kind = detail[1] === 'e' ? 'entry' : detail[1] === 'games' ? 'game' : 'series-detail'
  return { kind, id: detail[2] }
}

function viewportClass(): ViewportClass {
  if (window.innerWidth < 640) return 'small'
  if (window.innerWidth < 1024) return 'medium'
  return 'large'
}

function scheduleFlush() {
  if (flushTimer !== null) return
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    flushSiteAnalytics()
  }, FLUSH_DELAY_MS)
}

function deliver(events: QueuedEvent[], vitals: QueuedVital[]) {
  if (events.length === 0 && vitals.length === 0) return
  const body = JSON.stringify({ version: 1, events, vitals })
  const blob = new Blob([body], { type: 'application/json' })
  if (navigator.sendBeacon?.(ENDPOINT, blob)) return
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'omit',
  }).catch(() => undefined)
}

export function flushSiteAnalytics() {
  if (typeof window === 'undefined' || (queue.length === 0 && vitalsQueue.length === 0)) return
  if (isOptedOut()) {
    queue = []
    vitalsQueue = []
    return
  }
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
  // 两个队列配对发出；一边先空了就发只带另一边的批次——服务端允许 events 或
  // vitals 单独为空，只是不能两边都空（deliver 里已经挡掉那种情况）。
  while (queue.length > 0 || vitalsQueue.length > 0) {
    deliver(queue.splice(0, MAX_BATCH), vitalsQueue.splice(0, MAX_VITALS_BATCH))
  }
}

export function trackSiteEvent(name: SiteAnalyticsEventName, target?: string) {
  if (typeof window === 'undefined' || isOptedOut() || isAutomatedBrowser()) return
  const route = analyticsRoute(window.location.pathname)
  if (!route) return
  const dedupeKey = `${name}\u0000${target ?? ''}\u0000${route.kind}${'id' in route ? `:${route.id}` : ''}`
  const now = Date.now()
  const previous = lastReported.get(dedupeKey)
  if (previous !== undefined && now - previous < DUPLICATE_WINDOW_MS) return
  lastReported.set(dedupeKey, now)
  // 只保留还在窗口内的记录，避免长时间停留的页面把这张表越攒越大。
  if (lastReported.size > 200) {
    for (const [key, at] of lastReported) if (now - at >= DUPLICATE_WINDOW_MS) lastReported.delete(key)
  }
  queue.push({ name, route, ...(target ? { target } : {}), viewport: viewportClass() })
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE)
  if (queue.length >= MAX_BATCH) flushSiteAnalytics()
  else scheduleFlush()
}

/**
 * 记一次 Web Vitals 采样。
 *
 * 与 `trackSiteEvent` 共用同一条上报链路（因此后端的 Origin 校验、机器人过滤、
 * `ANALYTICS_EXCLUDED_IPS` 排除名单对性能样本一并生效），但**落库时走的是另一张表**，
 * 不会进入 PV / 交互 / 访客 / 地区 / 内容排行任何一个口径。
 *
 * 原始数值只在请求里出现一次，服务端映射成固定直方图桶之后即丢弃，不落库。
 */
export function trackWebVital(metric: SiteVitalMetric, value: number) {
  if (typeof window === 'undefined' || isOptedOut() || isAutomatedBrowser()) return
  if (!Number.isFinite(value) || value < 0) return
  vitalsQueue.push({ metric, value, viewport: viewportClass() })
  if (vitalsQueue.length > MAX_VITALS_BATCH) vitalsQueue = vitalsQueue.slice(-MAX_VITALS_BATCH)
  // 页面已经隐藏时不能再等定时器：web-vitals 的终值正是在 pagehide / visibilitychange
  // 那一刻才吐出来，而那时全站的 flush 监听可能已经跑过了，攒着就等于丢掉。
  if (document.visibilityState === 'hidden') flushSiteAnalytics()
  else scheduleFlush()
}

export function trackPageView(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (lastPageViewPath === normalized) return
  lastPageViewPath = normalized
  trackSiteEvent('page.view')
}

export function isSiteAnalyticsEventName(value: string | undefined): value is SiteAnalyticsEventName {
  return Boolean(value && EVENT_NAMES.has(value as SiteAnalyticsEventName))
}

export function analyticsSourceTarget(platform: string | null | undefined): string {
  return platform && ['bilibili', 'youku', 'youtube', 'douyu', 'douyin'].includes(platform) ? platform : 'other'
}
