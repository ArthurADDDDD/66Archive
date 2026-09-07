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

  // 非法 target 必须在发出前就被丢掉：服务端是整批校验，一条不过就 400，
  // 同一批里的页面浏览、导航点击会跟着一起没。
  sent.length = 0
  trackSiteEvent('content.open', 'gallery:0022Ya6rly1gyllg2qn86j60sn0c4wg902') // 大写字母
  trackSiteEvent('content.open', 'entry:-leading-hyphen')
  trackSiteEvent('content.open', undefined)
  trackSiteEvent('nav.click', 'archive')
  flushSiteAnalytics()
  const guarded = JSON.parse(await (sent[0] as Blob).text()) as { events: { name: string }[] }
  const names = guarded.events.map((event) => event.name).join(',')
  if (names !== 'nav.click') throw new Error(`非法 target 没有被拦下，批次里是：${names}`)

  fakeNavigator.webdriver = true
  sent.length = 0
  trackSiteEvent('content.open', 'entry:c')
  flushSiteAnalytics()
  if (sent.length !== 0) throw new Error('WebDriver 会话仍然上报了事件')

  await checkContentOpenTarget()

  console.log('✓ 上报口径：重复点击合并、自动化会话不计入、站内链接解析正确')
}

/**
 * 编年史 / 三幕 / 高光的节点卡只拿得到一个最终 href，目标是从它反推的。
 * 解析错了不会报错，只会静静地把点击算到别的内容头上，或者发出一个被服务端
 * 整批拒掉的事件——两种都要靠这里挡住。
 */
async function checkContentOpenTarget() {
  const { contentOpenTarget } = await import('../src/lib/analytics-target')
  const cases: [string | null, string | undefined][] = [
    ['/e/2015-07-05-live-01/', 'entry:2015-07-05-live-01'],
    ['/games/maplestory/', 'game:maplestory'],
    ['/series/xinling-pishuang/', 'series:xinling-pishuang'],
    ['/e/2015-07-05-live-01', 'entry:2015-07-05-live-01'],
    // 外链、纯文案卡、列表页、带查询串的跳转都不是「点开一条内容」
    ['https://www.bilibili.com/video/BV1zs411R7nJ', undefined],
    [null, undefined],
    ['/archive/', undefined],
    ['/archive/?y=2026', undefined],
    ['/e/2015-07-05-live-01/?from=story', undefined],
    // 服务端 schema 只收 [a-z0-9][a-z0-9_-]* 开头的 ID
    ['/e/-bad-id/', undefined],
    ['/e/Bad-Id/', undefined],
  ]
  for (const [href, expected] of cases) {
    const actual = contentOpenTarget(href)
    if (actual !== expected) throw new Error(`${href} → ${actual}，应为 ${expected}`)
  }
}

void main()
