import assert from 'node:assert/strict'
import { coverageOf, deriveSpans, insertCover, type PageInfo } from './collection-followups'

const games = [
  { id: 'where-winds-meet', terms: ['燕云十六声', 'wherewindsmeet', '燕云'] },
  { id: 'grand-theft-auto-vi', terms: ['侠盗猎车手6', 'gta6', 'gtavi'] },
]
const page = (n: number, part: string, duration = 3600): PageInfo => ({ page: n, cid: n, part, duration })

// 2026-11-27：P1–P4 燕云，P5–P7 GTA6，P4 后约 4 分钟空档
const nov27 = [
  page(1, '燕云支持dlss5啦_2026-11-27_19_58_21_女流66', 3601),
  page(2, '燕云支持dlss5啦_2026-11-27_20_58_21_女流66', 3600),
  page(3, '燕云支持dlss5啦_2026-11-27_21_58_20_女流66', 3600),
  page(4, '燕云支持dlss5啦_2026-11-27_22_58_20_女流66', 632),
  page(5, '20亿美金开发的游戏，gta6来啦_2026-11-27_23_13_11_女流66', 3602),
  page(6, '20亿美金开发的游戏，gta6来啦_2026-11-28_00_13_09_女流66', 3600),
  page(7, '20亿美金开发的游戏，gta6来啦_2026-11-28_01_13_08_女流66', 214),
]
assert.deepEqual(deriveSpans(nov27, games), [
  { page: 1, game: 'where-winds-meet' },
  { page: 5, game: 'grand-theft-auto-vi' },
])
assert.equal(coverageOf(nov27), 'complete')

// 一个分 P 认不出游戏 → 整场放弃
assert.equal(deriveSpans([nov27[0], page(2, '聊天_2026-11-27_20_58_21'), nov27[4]], games), null)
// 一个分 P 同时点名两款 → 放弃
assert.equal(deriveSpans([page(1, '燕云和gta6')], games), null)
// 条目里的某款游戏没在录像里出现 → 放弃
assert.equal(deriveSpans(nov27.slice(0, 4), games), null)
// 单游戏不生成
assert.equal(deriveSpans(nov27, games.slice(0, 1)), null)
// 同款游戏被另一款打断后回来：分别成段
assert.deepEqual(
  deriveSpans([page(1, '燕云'), page(2, 'gta6'), page(3, '燕云')], games)?.map((s) => s.page),
  [1, 2, 3],
)

// 空档超过 5 分钟、或读不出开始时刻：不能说整场
assert.equal(coverageOf([nov27[0], page(2, '燕云_2026-11-27_21_10_00', 600)]), 'unknown')
assert.equal(coverageOf([page(1, '1.燕云十六声 19:58'), page(2, '2.燕云十六声 20:38')]), 'unknown')

const yamlText = [
  '- id: 2026-11-25-live-01',
  '  type: live',
  '  sources:',
  '    - url: "https://www.bilibili.com/video/BV1S5yBzpEXP?p=1"',
  '- id: 2026-11-25-live-02',
  '  cover: "x"',
  '  sources:',
  '',
].join('\n')
assert.equal(
  insertCover(yamlText, '2026-11-25-live-01', 'http://i0.hdslb.com/f.jpg').split('\n')[2],
  '  cover: "http://i0.hdslb.com/f.jpg"',
)
assert.throws(() => insertCover(yamlText, '2026-11-25-live-02', 'y'), /已有封面/)
assert.throws(() => insertCover(yamlText, '2026-11-26-live-01', 'y'), /找不到/)

console.log('OK collection follow-ups: part-title spans, coverage, cover insertion')
