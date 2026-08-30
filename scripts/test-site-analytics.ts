/**
 * 上报口径的回归测试：一次真实点击才算一次。
 *
 * 「水友们最爱看」的排行只有在「一次计数 = 有人真的点开了它」时才值得展示，
 * 所以这两条防线不能在后续改动里被顺手删掉：
 * - 同一个目标在去重窗口内只算一次（双击、误触连点是一次打开）；
 * - WebDriver 控制的自动化会话完全不上报。
 *
 * 「只认 isTrusted 的真实点击」由 SiteAnalytics 的 document 监听器负责，需要真实
 * 事件对象，不在这个纯逻辑测试的覆盖范围里。
 *
 * 用法：npm run test:analytics
 */
const sent: unknown[] = []

const fakeWindow = {
  location: { pathname: '/archive/', search: '' },
  innerWidth: 1280,
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (id: number) => clearTimeout(id),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}
const fakeNavigator = {
  webdriver: false,
  sendBeacon: (_url: string, body: unknown) => {
    sent.push(body)
    return true
  },
}
;(globalThis as Record<string, unknown>).window = fakeWindow
Object.defineProperty(globalThis, 'navigator', { value: fakeNavigator, configurable: true, writable: true })

async function main() {
  const { trackSiteEvent, flushSiteAnalytics } = await import('../src/lib/site-analytics')

  trackSiteEvent('content.open', 'entry:a')
  trackSiteEvent('content.open', 'entry:a') // 去重窗口内的重复点击
  trackSiteEvent('content.open', 'entry:b')
  flushSiteAnalytics()

  const batch = JSON.parse(await (sent[0] as Blob).text()) as { events: { target: string }[] }
  const targets = batch.events.map((event) => event.target).join(',')
  if (targets !== 'entry:a,entry:b') throw new Error(`重复点击没有被合并：${targets}`)

  fakeNavigator.webdriver = true
  sent.length = 0
  trackSiteEvent('content.open', 'entry:c')
  flushSiteAnalytics()
  if (sent.length !== 0) throw new Error('WebDriver 会话仍然上报了事件')

  console.log('✓ 上报口径：重复点击合并、自动化会话不计入')
}

void main()
