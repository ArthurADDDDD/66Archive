import assert from 'node:assert/strict'
import { decodeHashTarget } from '../src/lib/hash-target'

// 正常深链仍能匹配 DOM id；只解码一次，且 + 不是锚点中的空格。
for (const id of ['story-year-2019', 'home-acts', 'live-wall-2020', '节目-第一期', 'a+b', 'literal%20']) {
  assert.equal(decodeHashTarget(`#${encodeURIComponent(id)}`), id)
}
assert.equal(decodeHashTarget('#a+b'), 'a+b')
assert.equal(decodeHashTarget(''), '')
assert.equal(decodeHashTarget('#'), '')

// 不完整转义、非法十六进制和无效 UTF-8 都不应让页面挂载抛错。
for (const fragment of ['%', '%2', '%GG', '%E4%B8', '%FF', 'story-beat-%E0%A4%A', '中文%']) {
  assert.equal(decodeHashTarget(`#${fragment}`), fragment)
}

console.log('Hash target regression checks passed.')
