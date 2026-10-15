import assert from 'node:assert/strict'
import { createLiveContentLoader } from '../src/lib/live-content-loader'
import { CONTENT_PATHS, parseSiteCopy, type LiveContent } from '../src/lib/live-content'

const empty: LiveContent = { copy: null, narrative: null, editorial: null }
const copy: LiveContent = { ...empty, copy: parseSiteCopy({ copy: { site: { title: '测试站点' }, hero: { title: '当前文案' } } }) }
assert.ok(copy.copy)
const narrative: LiveContent = { ...empty, narrative: { homeActs: [], storyActs: [], highlights: [], deletedIds: ['removed-beat'] } }
const editorial: LiveContent = { ...empty, editorial: { sections: [] } }
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

async function main() {
  const calls: string[] = []
  const pending = new Map<string, (value: LiveContent) => void>()
  const subscribe = createLiveContentLoader(([path]) => {
    calls.push(path)
    return new Promise((resolve) => pending.set(path, resolve))
  })
  const first: LiveContent[] = []
  const second: LiveContent[] = []
  const stopFirst = subscribe(Object.values(CONTENT_PATHS), (value) => first.push(value))
  await flush()
  // 快速从首页切去只读站点文案的页面，旧 effect 已清理，网络还在路上。
  stopFirst()
  const stopSecond = subscribe([CONTENT_PATHS.siteCopy], (value) => second.push(value))
  pending.get(CONTENT_PATHS.siteCopy)!(copy)
  await flush()
  assert.deepEqual(first, [], '旧页面不能再收响应')
  assert.deepEqual(second, [copy], '新页面必须收到在途文案，不等其他分片')
  assert.equal(calls.filter((path) => path === CONTENT_PATHS.siteCopy).length, 1)
  pending.get(CONTENT_PATHS.narrative)!(narrative)
  pending.get(CONTENT_PATHS.editorial)!(editorial)
  await flush()
  stopSecond()
  const returned: LiveContent[] = []
  subscribe(Object.values(CONTENT_PATHS), (value) => returned.push(value))
  await flush()
  assert.equal(returned.length, 3, '回首页复用此前所有成功分片')
  assert.equal(calls.length, 3, '切页不重复下载成功分片')

  let attempts = 0
  const retry = createLiveContentLoader(async () => {
    attempts++
    if (attempts === 1) return empty
    if (attempts === 2) throw new Error('network unavailable')
    return copy
  })
  const recovered: LiveContent[] = []
  for (let i = 0; i < 3; i++) {
    const stop = retry([CONTENT_PATHS.siteCopy], (value) => recovered.push(value))
    await flush()
    stop()
  }
  assert.equal(attempts, 3, '空值和异常不能永久占住已请求标记')
  assert.deepEqual(recovered, [copy], '失败不得覆盖已有烤入值')

  let strictCalls = 0
  const strict = createLiveContentLoader(async () => { strictCalls++; return copy })
  const cancelled: LiveContent[] = []
  const mounted: LiveContent[] = []
  strict([CONTENT_PATHS.siteCopy], (value) => cancelled.push(value))()
  strict([CONTENT_PATHS.siteCopy, CONTENT_PATHS.siteCopy], (value) => mounted.push(value))
  await flush()
  assert.equal(strictCalls, 1, 'Strict Mode 重建 effect 复用请求')
  assert.deepEqual(cancelled, [])
  assert.deepEqual(mounted, [copy])
  console.log('Live content loader: route races, independent arrival, retries, cached reuse and cleanup passed.')
}

void main().catch((error) => { console.error(error); process.exitCode = 1 })
