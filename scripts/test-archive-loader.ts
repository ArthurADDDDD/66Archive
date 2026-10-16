import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { archiveBootScript, createArchiveLoader, type ArchiveBootHolder } from '../src/lib/archive-loader'

const payload = { entries: [], isDemo: false, hiddenUnreviewed: 0 }
const response = () => Response.json(payload)
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('matching prefetch is consumed once and reused without downloading', async () => {
  const holder: ArchiveBootHolder = { __i6i6ArchiveBoot: { url: '/v1', promise: Promise.resolve(payload) } }
  const load = createArchiveLoader({ holder, fetcher: async () => { throw new Error('unexpected fetch') } })
  const first = load('/v1')
  assert.equal(load('/v1'), first)
  assert.deepEqual(await first, payload)
  assert.equal(holder.__i6i6ArchiveBoot, undefined)
})
test('unknown and different-version prefetches are never accepted', async () => {
  for (const boot of [Promise.resolve(payload), { url: '/old', promise: Promise.resolve(payload) }]) {
    const calls: string[] = []
    const load = createArchiveLoader({ holder: { __i6i6ArchiveBoot: boot }, fetcher: async (url) => {
      calls.push(String(url)); return response()
    } })
    await load('/new')
    assert.deepEqual(calls, ['/new'])
  }
})
test('null, malformed and rejected prefetches fall back to the requested URL', async () => {
  for (const value of [null, {}, { entries: [null] }, payload]) {
    let calls = 0
    const boot = value === payload ? Promise.reject(new Error('network')) : Promise.resolve(value)
    const load = createArchiveLoader({ holder: { __i6i6ArchiveBoot: { url: '/v1', promise: boot } },
      fetcher: async () => { calls++; return response() } })
    assert.deepEqual(await load('/v1'), payload)
    assert.equal(calls, 1)
  }
})
test('failed HTTP and malformed JSON responses can be retried', async () => {
  for (const bad of [new Response('', { status: 503 }), new Response('invalid json'), Response.json({})]) {
    let calls = 0
    const load = createArchiveLoader({ fetcher: async () => ++calls === 1 ? bad : response() })
    await assert.rejects(load('/v1'))
    assert.deepEqual(await load('/v1'), payload)
    assert.equal(calls, 2)
  }
})
test('an old request failing cannot evict a newer version', async () => {
  const old = deferred<Response>()
  let calls = 0
  const load = createArchiveLoader({ fetcher: async () => ++calls === 1 ? old.promise : response() })
  const first = load('/old')
  const second = load('/new')
  await second
  old.reject(new Error('old failed'))
  await assert.rejects(first)
  assert.equal(load('/new'), second)
  assert.equal(calls, 2)
})
test('stalled requests abort and a new attempt can succeed', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  const load = createArchiveLoader({ timeoutMs: 100, fetcher: async (_url, options) => {
    if (++calls > 1) return response()
    return new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
  } })
  const first = load('/v1')
  const failure = assert.rejects(first, /aborted/)
  t.mock.timers.tick(100)
  await failure
  assert.deepEqual(await load('/v1'), payload)
})
test('generated boot script records identity, aborts stalls, and clears its timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const holder: ArchiveBootHolder = {}
  let cleared = 0
  runInNewContext(archiveBootScript('/data?v=1'), { window: holder, AbortController, setTimeout,
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => { cleared++; clearTimeout(timer) },
    fetch: (_url: string, options: RequestInit) => new Promise((_resolve, reject) =>
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
  })
  const boot = holder.__i6i6ArchiveBoot!
  assert.ok('url' in boot)
  assert.equal(boot.url, '/data?v=1')
  t.mock.timers.tick(60_000)
  assert.equal(await boot.promise, null)
  assert.equal(cleared, 1)
  assert.ok(!archiveBootScript('</script>').includes('</script>'))
})
