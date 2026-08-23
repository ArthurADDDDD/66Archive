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
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
  while (queue.length > 0) deliver(queue.splice(0, MAX_BATCH))
}

export function trackSiteEvent(name: SiteAnalyticsEventName, target?: string) {
  if (typeof window === 'undefined') return
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
