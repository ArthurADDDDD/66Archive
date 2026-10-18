/**
 * 浏览器开播通知（Web Push）的前台辅助。
 *
 * 只在访客主动点击后申请通知权限、注册 service worker 并订阅；打开弹窗只做能力检测，
 * 不注册任何东西。订阅只对当前浏览器生效，服务端发回的设备令牌存进 IndexedDB——
 * 关闭、测试和浏览器轮换订阅都要它，光知道推送地址不够。
 */
const ORIGIN = (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, '')
export const PUSH_API = `${ORIGIN}/api/live-alerts/push`
const SW_PATH = '/sw.js'

export type PushAvailability = { enabled: false } | { enabled: true; mode: 'test' | 'public'; publicKey: string }
export type PushEnvironment = {
  kind: 'supported' | 'unsupported' | 'in-app' | 'ios-install' | 'ios-old' | 'insecure'
  browser: 'chrome' | 'edge' | 'firefox' | 'safari' | 'samsung' | 'opera' | 'other'
  platform: 'windows' | 'macos' | 'android' | 'ios' | 'linux' | 'other'
  standalone: boolean
}

export function detectPushEnvironment(): PushEnvironment {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const platform: PushEnvironment['platform'] = ios ? 'ios' : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'windows' : /Macintosh/.test(ua) ? 'macos' : /Linux|CrOS/.test(ua) ? 'linux' : 'other'
  const browser: PushEnvironment['browser'] = /Edg(e|A|iOS)?\//.test(ua) ? 'edge' : /OPR\/|Opera/.test(ua) ? 'opera' : /SamsungBrowser/.test(ua) ? 'samsung'
    : /Firefox|FxiOS/.test(ua) ? 'firefox' : /Chrome|CriOS|Chromium/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'other'
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const base = { browser, platform, standalone }
  // 应用内浏览器（微信、QQ、微博、抖音、钉钉、飞书、支付宝等）不提供可用的网页推送。
  if (/MicroMessenger|\bQQ\/|MQQBrowser.*QQ|Weibo|DingTalk|Lark|Feishu|AlipayClient|aweme|BytedanceWebview|NewsArticle/i.test(ua)) return { ...base, kind: 'in-app' }
  if (!window.isSecureContext) return { ...base, kind: 'insecure' }
  const apis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (ios) {
    const version = /OS (\d+)_(\d+)/.exec(ua)
    const tooOld = version ? Number(version[1]) < 16 || (Number(version[1]) === 16 && Number(version[2]) < 4) : false
    if (tooOld) return { ...base, kind: 'ios-old' }
    // iOS 只在主屏幕 Web App 里暴露推送接口；普通 Safari / Chrome 标签页不支持后台推送。
    if (!standalone) return { ...base, kind: 'ios-install' }
  }
  return { ...base, kind: apis ? 'supported' : 'unsupported' }
}

export async function readAvailability(signal?: AbortSignal): Promise<PushAvailability> {
  const response = await fetch(PUSH_API, { signal, cache: 'no-store', credentials: 'omit' })
  if (!response.ok) return { enabled: false }
  const body: unknown = await response.json()
  if (body && typeof body === 'object' && 'enabled' in body && body.enabled === true && 'publicKey' in body && typeof body.publicKey === 'string'
    && 'mode' in body && (body.mode === 'test' || body.mode === 'public')) return { enabled: true, mode: body.mode, publicKey: body.publicKey }
  return { enabled: false }
}

function store<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return new Promise(resolve => {
    try {
      const open = indexedDB.open('nvliu-live-alerts', 1)
      open.onupgradeneeded = () => open.result.createObjectStore('device')
      open.onerror = () => resolve(null)
      open.onsuccess = () => {
        const request = run(open.result.transaction('device', mode).objectStore('device'))
        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () => resolve(null)
      }
    } catch { resolve(null) }
  })
}
const readToken = async () => { const value = await store('readonly', s => s.get('token')); return typeof value === 'string' ? value : null }
const writeToken = (token: string) => store('readwrite', s => s.put(token, 'token'))
const clearToken = () => store('readwrite', s => s.delete('token'))

async function post(path: string, body: unknown): Promise<Response> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000)
  try { return await fetch(`${PUSH_API}/${path}`, { method: 'POST', credentials: 'omit', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
  finally { clearTimeout(timer) }
}
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const raw = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}
function sameKey(subscription: PushSubscription, key: Uint8Array) {
  const current = subscription.options.applicationServerKey
  if (!current) return false
  const bytes = new Uint8Array(current)
  return bytes.length === key.length && bytes.every((b, i) => b === key[i])
}

/** 这台设备当前是否已开启：本地有订阅、有设备令牌，且服务端确认仍有效。不注册 service worker。 */
export async function deviceIsSubscribed(): Promise<boolean> {
  if (Notification.permission !== 'granted') return false
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  const token = await readToken()
  if (!subscription || !token) return false
  const response = await post('status', { token })
  if (!response.ok) throw new Error('unavailable')
  const body: unknown = await response.json()
  return !!body && typeof body === 'object' && 'status' in body && body.status === 'active'
}

export type EnableResult = 'on' | 'denied' | 'dismissed' | 'push-service' | 'rate-limited' | 'test-code' | 'unavailable'
/**
 * 必须直接在点击处理里调用：Safari 要求通知权限申请发生在用户手势之内，所以它是第一个 await。
 * 订阅成功、服务端也登记成功才算开启；任何一步失败都不显示成功。
 */
export async function enablePush(availability: Extract<PushAvailability, { enabled: true }>, env: PushEnvironment, testCode?: string): Promise<EnableResult> {
  let permission = Notification.permission
  if (permission !== 'granted') permission = await Notification.requestPermission()
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'dismissed'
  let registration: ServiceWorkerRegistration, subscription: PushSubscription
  const key = keyBytes(availability.publicKey)
  try {
    registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/', updateViaCache: 'none' })
    await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (existing && !sameKey(existing, key)) await existing.unsubscribe()
    subscription = existing && sameKey(existing, key) ? existing : await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  } catch { return 'push-service' } // 典型情况：浏览器连不上自己的推送服务（如部分网络下的 Chrome）
  // 已登记的推送地址只有原设备能重新登记：带上本机的设备令牌；令牌丢失时服务端会核对订阅密钥。
  // 仍被拒（409）说明服务端记录与本机不一致：换一个全新的浏览器订阅再试一次。
  const token = await readToken()
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response
    try {
      response = await post('subscribe', { subscription: subscription.toJSON(), consent: true, client: { browser: env.browser, platform: env.platform, standalone: env.standalone },
        ...(token && attempt === 0 ? { token } : {}), ...(testCode ? { testCode } : {}) })
    } catch { return 'unavailable' }
    if (response.status === 201) {
      const body: unknown = await response.json().catch(() => null)
      if (body && typeof body === 'object' && 'token' in body && typeof body.token === 'string') { await writeToken(body.token); return 'on' }
      return 'unavailable'
    }
    await subscription.unsubscribe().catch(() => {}) // 服务端没登记：不留下一个永远收不到的本地订阅
    if (response.status === 409 && attempt === 0) {
      try { subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) } catch { return 'push-service' }
      continue
    }
    if (response.status === 429) return 'rate-limited'
    if (response.status === 403 || (response.status === 400 && testCode)) return 'test-code'
    return 'unavailable'
  }
  return 'unavailable'
}

/** 关闭这台设备：先让服务端删除推送地址与密钥，再取消浏览器订阅。服务端失败时浏览器订阅同样取消，下一次推送会被自动清理。 */
export async function disablePush(): Promise<'off' | 'off-local'> {
  const token = await readToken()
  let server = false
  if (token) { try { server = (await post('unsubscribe', { token })).ok } catch {} }
  const registration = await navigator.serviceWorker.getRegistration('/')
  await (await registration?.pushManager.getSubscription())?.unsubscribe().catch(() => false)
  await clearToken()
  return server || !token ? 'off' : 'off-local'
}

export async function sendTestNotification(): Promise<'queued' | 'rate-limited' | 'inactive' | 'unavailable'> {
  const token = await readToken()
  if (!token) return 'inactive'
  try {
    const response = await post('test', { token })
    return response.status === 202 ? 'queued' : response.status === 429 ? 'rate-limited' : response.status === 404 ? 'inactive' : 'unavailable'
  } catch { return 'unavailable' }
}
