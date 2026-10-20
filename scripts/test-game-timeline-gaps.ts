import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { SPECIFIC_GAME_PARENTS } from '../src/lib/games'

type Entry = { id: string; games?: string[] }
type Span = { game?: string; kind?: string; evidence?: string; scanned?: boolean }
type Timeline = { entry: string; coverage: string; spans: Span[] }

const root = process.cwd()
const entries = new Map<string, Entry>()
for (const file of fs.readdirSync(path.join(root, 'data/entries'))) {
  if (!/\.ya?ml$/i.test(file)) continue
  const list = yaml.load(fs.readFileSync(path.join(root, 'data/entries', file), 'utf8')) as Entry[] | null
  for (const entry of list ?? []) entries.set(entry.id, entry)
}
const timelines = yaml.load(fs.readFileSync(path.join(root, 'data/game-timelines.yaml'), 'utf8')) as Timeline[]

/** 系列父 ID 与具体作品同时出现时只算具体作品，避免把父 ID 当成缺失游戏。 */
function visibleGames(games: string[]): string[] {
  const present = new Set(games)
  return games.filter((id) => !Object.entries(SPECIFIC_GAME_PARENTS).some(([specific, parent]) => parent === id && present.has(specific)))
}

/** 具体作品的环节可以满足其系列父 ID。 */
function represented(game: string, timeline: Timeline): boolean {
  if (timeline.spans.some((span) => span.game === game)) return true
  return timeline.spans.some((span) => span.game && SPECIFIC_GAME_PARENTS[span.game] === game)
}

// 本轮实际复核并补回的游戏段：任何一项从时间轴消失都视为回归。
const expected: [string, string][] = [
  ['2017-11-22-live-01', 'super-mario-odyssey'],
  ['2018-12-07-live-01', 'gujian-qitan-3'],
  ['2021-04-27-live-01', 'world-games-51'],
  ['2020-11-27-live-01', 'world-of-warcraft'],
  ['2021-03-18-live-01', 'hades'],
  ['2018-12-01-live-01', 'gujian-qitan-3'],
  ['2020-09-26-live-01', 'rise-of-kingdoms'],
  ['2020-10-06-live-01', 'art-of-rally'],
  ['2017-10-11-live-01', 'dont-cut-your-hand'],
  ['2018-03-31-live-01', 'mom-hid-my-game'],
  ['2021-01-15-live-01', 'stardew-valley'],
  ['2021-01-15-live-01', 'yu-gi-oh-duel-links'],
  ['2020-04-02-live-01', 'animal-crossing-nh'],
  ['2021-08-04-live-01', 'sudoku'],
  ['2026-09-11-live-01', 'maplestory-classic'],
  ['2019-08-29-live-01', 'bleach-soul-resonance'],
  ['2025-12-05-live-02', 'a-little-to-the-left'],
]

for (const [entryId, game] of expected) {
  const timeline = timelines.find((item) => item.entry === entryId)
  assert.ok(timeline, `missing timeline for ${entryId}`)
  const span = timeline.spans.find((item) => item.game === game)
  assert.ok(span, `${entryId} must keep the reviewed ${game} span`)
  assert.notEqual(span.evidence, 'human_watch', `${entryId} ${game} must not claim human_watch`)
  assert.notEqual(span.scanned, true, `${entryId} ${game} must not claim scanned`)
}

// coverage: complete 的场次应覆盖条目的全部游戏；partial/unknown 只提示，不自动归类。
const completeGaps: string[] = []
const partialGaps: string[] = []
for (const timeline of timelines) {
  const entry = entries.get(timeline.entry)
  if (!entry) continue
  const missing = visibleGames(entry.games ?? []).filter((game) => !represented(game, timeline))
  if (!missing.length) continue
  const line = `${timeline.entry} (${timeline.coverage}): ${missing.join(', ')}`
  if (timeline.coverage === 'complete') completeGaps.push(line)
  else partialGaps.push(line)
}
assert.deepEqual(completeGaps, [], `complete timelines missing entry games:\n${completeGaps.join('\n')}`)

if (partialGaps.length) {
  console.log(`Game timeline risk list: ${partialGaps.length} partial/unknown-coverage entries have games without a timeline span`)
  for (const line of partialGaps) console.log(`  WARN ${line}`)
}

console.log(`OK game timeline gaps: ${expected.length} reviewed spans present, ${timelines.length} timelines checked`)
