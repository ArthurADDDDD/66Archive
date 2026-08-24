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

let queue: QueuedEvent[] = []
let flushTimer: number | null = null
let lastPageViewPath: string | null = null

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

function deliver(events: QueuedEvent[]) {
  const body = JSON.stringify({ version: 1, events })
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
  if (typeof window === 'undefined' || queue.length === 0) return
  if (isOptedOut()) {
    queue = []
    return
  }
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
  while (queue.length > 0) deliver(queue.splice(0, MAX_BATCH))
}

export function trackSiteEvent(name: SiteAnalyticsEventName, target?: string) {
  if (typeof window === 'undefined' || isOptedOut()) return
  const route = analyticsRoute(window.location.pathname)
  if (!route) return
  queue.push({ name, route, ...(target ? { target } : {}), viewport: viewportClass() })
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE)
  if (queue.length >= MAX_BATCH) flushSiteAnalytics()
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
