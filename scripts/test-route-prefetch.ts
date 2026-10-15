import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createRoutePrefetch, prefetchPath } from '../src/lib/route-prefetch'

for (const href of ['https://example.com/', '//example.com/', '#part', 'mailto:test@example.com', null]) {
  assert.equal(prefetchPath(href, '/'), null)
}
assert.equal(prefetchPath('/games?genre=rpg', '/games/'), null)
assert.equal(prefetchPath('/archive/?y=2015#entry', '/games/'), '/archive/')

mock.timers.enable({ apis: ['setTimeout'] })
try {
  const calls: string[] = []
  const intent = createRoutePrefetch((path) => calls.push(path))
  intent.queue('/games/')
  mock.timers.tick(60)
  intent.queue('/games/') // 链接内从封面移到文字，不重置 100ms 计时。
  mock.timers.tick(40)
  assert.deepEqual(calls, ['/games/'])
  intent.commit('/games/')
  assert.equal(calls.length, 1, '悬停后按下只预取一次')
  intent.queue('/archive/')
  intent.cancel() // 鼠标移开、焦点移出或路由 effect 清理。
  mock.timers.tick(100)
  assert.equal(calls.length, 1)
  intent.queue('/old/')
  intent.queue('/new/')
  mock.timers.tick(100)
  assert.deepEqual(calls, ['/games/', '/new/'])
  for (let i = 0; i < 20; i++) intent.commit(`/game-${i}/`)
  assert.equal(calls.length, 12, '导航和正文共用 12 条预算')
  const nextPage = createRoutePrefetch((path) => calls.push(path))
  nextPage.commit('/games/')
  assert.equal(calls.length, 13, '新页面得到新预算')
  let attempts = 0
  const failing = createRoutePrefetch(() => { if (++attempts === 1) throw new Error('prefetch failed') })
  failing.commit('/retry/')
  failing.commit('/retry/')
  assert.equal(attempts, 2, '同步失败不能耗掉名额或锁死链接')
} finally {
  mock.timers.reset()
}
console.log('Route prefetch: targets, hover timing, cancellation, deduplication and page budget passed.')
