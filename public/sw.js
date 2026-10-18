/*
 * 女流档案馆 · 开播浏览器通知 service worker.
 *
 * Deliberately minimal: it only shows notifications and opens the livestream on click.
 * There is NO fetch handler, no cache and no offline behaviour, so it never serves or
 * stores site pages, data or API responses. It is registered only after a visitor turns
 * browser notifications on. Versioning, rollback and the kill switch: docs/live-alert-push.md.
 */
const SW_VERSION = '2026-10-18.1'
const ROOM_HOST = 'live.douyin.com'
const API = '/api/live-alerts/push'

// Activate updates immediately; with no fetch handler there is no page state to keep consistent.
self.addEventListener('install', () => self.skipWaiting())

function safeUrl(value) {
  try {
    const url = new URL(value, self.location.origin)
    if (url.origin === self.location.origin) return url.href
    if (url.protocol === 'https:' && url.hostname === ROOM_HOST) return url.href
  } catch {}
  return `${self.location.origin}/`
}
const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '')

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}
  const live = data.kind === 'live'
  let body = text(data.body, 160)
  // The push service enforces the TTL; this only covers late arrival on a sleeping device or a skewed clock.
  if (live && typeof data.expiresAt === 'number' && Date.now() > data.expiresAt + 5 * 60_000) body = '这条开播提醒送达较晚，直播可能已经结束。点开查看直播间。'
  const tag = typeof data.tag === 'string' && /^(live|test)-[0-9a-f]{8,32}$/.test(data.tag) ? data.tag : 'nvliu-alert'
  // Browsers require a visible notification for every push. A repeat with the same tag replaces the earlier one.
  event.waitUntil(self.registration.showNotification(text(data.title, 60) || '女流档案馆', {
    body, tag, renotify: false, lang: 'zh-CN', icon: '/icons/icon-192.png',
    timestamp: typeof data.detectedAt === 'number' ? data.detectedAt : Date.now(),
    data: { url: safeUrl(data.url), v: SW_VERSION },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = safeUrl(event.notification.data && event.notification.data.url)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find(client => client.url === url)
    if (open && 'focus' in open) return open.focus()
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})

// Device token written by the page (IndexedDB); needed to prove this device when the browser rotates the subscription.
function readToken() {
  return new Promise(resolve => {
    try {
      const open = indexedDB.open('nvliu-live-alerts', 1)
      open.onupgradeneeded = () => open.result.createObjectStore('device')
      open.onerror = () => resolve(null)
      open.onsuccess = () => {
        const read = open.result.transaction('device', 'readonly').objectStore('device').get('token')
        read.onsuccess = () => resolve(typeof read.result === 'string' ? read.result : null)
        read.onerror = () => resolve(null)
      }
    } catch { resolve(null) }
  })
}
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    const token = await readToken()
    if (!token) return
    let subscription = event.newSubscription
    if (!subscription) {
      const key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey
      if (!key) return
      subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    }
    await fetch(`${API}/renew`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, subscription: subscription.toJSON() }) })
  })().catch(() => {}))
})
