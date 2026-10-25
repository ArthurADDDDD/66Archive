import assert from 'node:assert/strict'
import { getDataset, getGameTimelines, getPublicDataset } from '../src/lib/data'
import { SPECIFIC_GAME_PARENTS } from '../src/lib/games'
import { gameSessionSpans, recordedSec, resolveSpans } from '../src/lib/game-time'
import type { Entry, GameTimeline, TimelineSpan } from '../src/lib/schema'
import {
  EXPECTED_GAMES,
  RETIRED_GAME_TAGS,
  REVIEWED_CROSS_CHECKS,
  REVIEWED_GAPS,
  REVIEWED_LONG_UNKNOWNS,
  REVIEWED_SPAN_BOUNDS,
} from './game-timeline-dispositions'

const dataset = getDataset()
const entries = new Map(dataset.entries.map((entry) => [entry.id, entry]))
const timelines = getGameTimelines()
const timelineByEntry = new Map(timelines.map((timeline) => [timeline.entry, timeline]))

/** 系列父 ID 与具体作品同时出现时只算具体作品，避免把父 ID 当成缺失游戏。 */
function visibleGames(games: string[]): string[] {
  const present = new Set(games)
  return games.filter((id) => !Object.entries(SPECIFIC_GAME_PARENTS).some(([specific, parent]) => parent === id && present.has(specific)))
}

/** 具体作品的环节可以满足其系列父 ID。 */
function represented(game: string, timeline: GameTimeline): boolean {
  if (timeline.spans.some((span) => span.game === game)) return true
  return timeline.spans.some((span) => span.game && SPECIFIC_GAME_PARENTS[span.game] === game)
}

function hms(value: string): number {
  return value.split(':').reduce((total, part) => total * 60 + Number(part), 0)
}

function close(actual: number, expected: number, tolerance: number, message: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}：expected ${expected}, got ${actual}`)
}

function spanKey(entry: string, page: number, at: string): string {
  return `${entry}|${page}|${at}`
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
  // 2026-10-20 第二轮
  ['2017-12-09-live-01', 'reigns-her-majesty'],
  ['2017-06-05-live-01', 'puyo-puyo-tetris'],
  ['2018-05-10-live-01', 'in-death'],
  ['2018-11-02-live-01', 'lifeafter'],
  ['2019-08-15-live-01', 'doraemon-story-of-seasons'],
  ['2020-04-02-live-01', 'reading-people'],
  ['2020-09-18-live-01', 'pro-gymnast'],
  // 2026-10-20 第三轮：互补来源 / 标注纠错
  ['2015-01-27-live-01', 'super-mario-3d-world'],
  ['2017-12-13-live-01', 'pubg'],
  ['2017-12-13-live-01', 'the-long-dark'],
  ['2020-10-20-live-01', 'rolo-to-the-rescue'],
]

for (const [entryId, game] of expected) {
  const timeline = timelineByEntry.get(entryId)
  assert.ok(timeline, `missing timeline for ${entryId}`)
  const span = timeline.spans.find((item) => item.game === game)
  assert.ok(span, `${entryId} must keep the reviewed ${game} span`)
  assert.notEqual(span.evidence, 'human_watch', `${entryId} ${game} must not claim human_watch`)
  assert.notEqual(span.scanned, true, `${entryId} ${game} must not claim scanned`)
}

// ── 关键边界：不仅游戏还在，起点、终点和时长也不能被悄悄改掉 ─────────────
for (const bound of REVIEWED_SPAN_BOUNDS) {
  const timeline = timelineByEntry.get(bound.entry)
  assert.ok(timeline, `missing timeline for ${bound.entry}`)
  const resolved = resolveSpans(timeline)
  const index = resolved.findIndex(
    (item) => item.span.game === bound.game && item.span.page === bound.page && item.span.at === bound.at,
  )
  assert.ok(index >= 0, `${bound.entry} ${bound.game} must start at P${bound.page} ${bound.at}`)
  const raw = resolved[index]
  const tolerance = bound.toleranceSec ?? 0.5
  close(raw.endSec - raw.startSec, bound.durationSec, tolerance, `${bound.entry} ${bound.game} raw duration changed`)
  const session = gameSessionSpans(timeline).find((item) => item.sourceIndexes.includes(index))
  assert.ok(session, `${bound.entry} ${bound.game} must appear in the display projection`)
  close(session.endSec - session.startSec, bound.associatedSec, tolerance, `${bound.entry} ${bound.game} associated duration changed`)
  close(session.verifiedSec, bound.verifiedSec, tolerance, `${bound.entry} ${bound.game} verified duration changed`)
}

// 2017-06-05 P4 的旧分 P 标题为水墨苏绣；11 个位置的抽帧均为外景人群/古建/舞台灯，
// 已确认是独立非游戏环节，不能让 P3 的噗哟噗哟俄罗斯方块无边界跨到 P4，也不能再退回 unknown。
const embroideryTimeline = timelineByEntry.get('2017-06-05-live-01')
assert.ok(embroideryTimeline, '2017-06-05 timeline missing')
const embroideryP4 = embroideryTimeline.spans.find((span) => span.page === 4 && span.at === '00:00:00')
assert.ok(embroideryP4, '2017-06-05 P4 must have an explicit segment boundary')
assert.equal(embroideryP4.kind, 'break', '2017-06-05 P4 water-ink embroidery is a reviewed non-game segment')
assert.match(embroideryP4.note ?? '', /水墨苏绣/, '2017-06-05 P4 must keep the water-ink embroidery label')
assert.equal(embroideryP4.game, undefined, '2017-06-05 P4 must not be counted as a game without new evidence')

// ── 已确认的目录拆分 / 退役标签 ────────────────────────────────────────
for (const game of EXPECTED_GAMES) {
  assert.equal(dataset.games.get(game.id)?.name, game.name, `${game.id} catalog entry missing or renamed`)
}
for (const retired of RETIRED_GAME_TAGS) {
  for (const entryId of retired.entries ?? []) {
    const entry = entries.get(entryId)
    assert.ok(entry, `missing entry ${entryId}`)
    assert.ok(!entry.games.includes(retired.game), `${entryId} must not keep retired tag ${retired.game}: ${retired.reason}`)
  }
  if (!retired.entries) {
    assert.ok(!dataset.games.has(retired.game), `catalog must not keep retired game ${retired.game}: ${retired.reason}`)
  }
}

// Reigns 三作必须保持独立：2017-12-09 是 Her Majesty，2017-01-18 是原版，2018-10-24 仍是冰火王权。
assert.ok(entries.get('2017-12-09-live-01')?.games.includes('reigns-her-majesty'))
assert.ok(!entries.get('2017-12-09-live-01')?.games.includes('reigns'))
assert.ok(entries.get('2017-01-18-live-01')?.games.includes('reigns-classic'))
assert.ok(!entries.get('2017-01-18-live-01')?.games.includes('reigns'))
assert.ok(entries.get('2018-10-24-live-01')?.games.includes('reigns'))

// ── coverage: complete 的场次必须覆盖所有游戏；其余缺口按「单个游戏」审计 ──
// 同场不同游戏可能分别属于可播放互补源、缺失资源，不能按一整组游戏共用状态。
const gapKey = (entry: string, game: string) => `${entry}|${game}`
const currentGaps = new Map<string, { entry: string; game: string; coverage: string }>()
const completeGaps: string[] = []
for (const timeline of timelines) {
  const entry = entries.get(timeline.entry)
  if (!entry) continue
  const missing = visibleGames(entry.games ?? []).filter((game) => !represented(game, timeline))
  if (!missing.length) continue
  if (timeline.coverage === 'complete') {
    completeGaps.push(`${timeline.entry} (complete): ${missing.join(', ')}`)
  } else {
    for (const game of missing) currentGaps.set(gapKey(timeline.entry, game), { entry: timeline.entry, game, coverage: timeline.coverage })
  }
}
assert.deepEqual(completeGaps, [], `complete timelines missing entry games:\n${completeGaps.join('\n')}`)

const registeredGaps = new Map<string, (typeof REVIEWED_GAPS)[number]>()
for (const gap of REVIEWED_GAPS) {
  assert.ok(gap.games.length > 0, `${gap.entry} must list one or more missing games`)
  assert.ok(gap.reason.trim(), `${gap.entry}: every registered gap needs a reason`)
  for (const game of gap.games) {
    const key = gapKey(gap.entry, game)
    assert.ok(!registeredGaps.has(key), `duplicate game gap disposition: ${key}`)
    registeredGaps.set(key, gap)
  }
}
const unregisteredGaps = [...currentGaps.keys()].filter((key) => !registeredGaps.has(key))
assert.deepEqual(
  unregisteredGaps,
  [],
  `new partial/unknown-coverage game gaps need disposition:\n${unregisteredGaps
    .map((key) => {
      const gap = currentGaps.get(key)!
      return `  ${gap.entry} (${gap.coverage}): ${gap.game}`
    })
    .join('\n')}`,
)
const staleGaps = [...registeredGaps.keys()].filter((key) => !currentGaps.has(key))
assert.deepEqual(staleGaps, [], `registered game gaps no longer exist; remove stale exceptions:\n${staleGaps.join('\n')}`)

// ── 旧 segments 的游戏标签与新 unknown / break 区间的交叉核对 ─────────
function inferSegmentGame(entry: Entry, span: Entry['segments'][number]): string | undefined {
  if (span.game) return span.game
  const label = span.label ?? ''
  return (entry.games ?? []).find((game) => {
    const name = dataset.games.get(game)?.name
    return Boolean(name && label.includes(name))
  })
}

type CrossCheck = {
  entry: string
  segmentAt: string
  game: string
  kind: 'unknown' | 'break'
  page: number
  at: string
  overlapSec: number
}
const crossCheckKey = (item: Omit<CrossCheck, 'overlapSec'>) =>
  `${item.entry}|${item.segmentAt}|${item.game}|${item.kind}|${item.page}|${item.at}`
const currentCrossChecks = new Map<string, CrossCheck>()
for (const timeline of timelines) {
  const entry = entries.get(timeline.entry)
  if (!entry?.segments?.length) continue
  const resolved = resolveSpans(timeline)
  for (const [index, segment] of entry.segments.entries()) {
    const game = inferSegmentGame(entry, segment)
    if (!game) continue
    const start = hms(segment.at)
    const next = entry.segments[index + 1]
    const end = next ? hms(next.at) : (entry.duration_min ?? 0) * 60
    for (const raw of resolved) {
      if (raw.span.kind !== 'unknown' && raw.span.kind !== 'break') continue
      const overlap = Math.min(end, raw.endSec) - Math.max(start, raw.startSec)
      if (overlap < 300) continue
      const item: CrossCheck = {
        entry: timeline.entry,
        segmentAt: segment.at,
        game,
        kind: raw.span.kind,
        page: raw.span.page,
        at: raw.span.at,
        overlapSec: overlap,
      }
      currentCrossChecks.set(crossCheckKey(item), item)
    }
  }
}
const registeredCrossChecks = new Map<string, (typeof REVIEWED_CROSS_CHECKS)[number]>()
for (const item of REVIEWED_CROSS_CHECKS) {
  const key = crossCheckKey(item)
  assert.ok(item.reason.trim(), `${key}: every cross-check exception needs an evidence explanation`)
  assert.ok(!registeredCrossChecks.has(key), `duplicate cross-check exception: ${key}`)
  registeredCrossChecks.set(key, item)
}
const unregisteredCrossChecks = [...currentCrossChecks.keys()].filter((key) => !registeredCrossChecks.has(key))

const staleCrossChecks = [...registeredCrossChecks.keys()].filter((key) => !currentCrossChecks.has(key))
if (staleCrossChecks.length) {
  console.log(`Game timeline cross-check register has ${staleCrossChecks.length} stale exception(s); remove them:`)
  for (const key of staleCrossChecks) console.log(`  STALE ${key}`)
}

// ── 长时间 unknown 必须逐段复核并登记 ────────────────────────────────
const longUnknowns: string[] = []
for (const timeline of timelines) {
  for (const raw of resolveSpans(timeline)) {
    if (raw.span.kind !== 'unknown') continue
    if (raw.endSec - raw.startSec < 1800) continue
    longUnknowns.push(spanKey(timeline.entry, raw.span.page, raw.span.at))
  }
}
const unregisteredLong = longUnknowns.filter((key) => !REVIEWED_LONG_UNKNOWNS[key])
assert.deepEqual(
  unregisteredLong,
  [],
  `unknown spans of 30+ minutes must be sampled and added to REVIEWED_LONG_UNKNOWNS:\n${unregisteredLong
    .map((key) => `  ${key}`)
    .join('\n')}`,
)
const staleLong = Object.keys(REVIEWED_LONG_UNKNOWNS).filter((key) => !longUnknowns.includes(key))
if (staleLong.length) {
  console.log(`Game timeline long-unknown register has ${staleLong.length} stale entr(ies); remove them:`)
  for (const key of staleLong) console.log(`  STALE ${key}`)
}

// ── 已审阅的「游戏前聊」不再回退成 unknown ────────────────────────
// 回归锁：只保证不被意外改动，不证明正确；改数据时要连同证据一起更新。
const reviewedOpeningBreaks: Record<string, string> = {
  '2017-09-20-live-01': '游戏前聊20块钱的',
  '2017-11-17-live-01': '游戏前聊10块钱的',
  '2017-12-13-live-01': '游戏前聊10块钱的',
  '2018-03-31-live-01': '游戏前聊10块钱的',
  '2018-08-21-live-01': '游戏前聊10块钱的',
  '2019-04-06-live-01': '游戏前聊10块钱的',
  '2019-05-10-live-02': '游戏前说会儿封神',
  '2019-06-10-live-01': '游戏前聊10块钱的',
  '2019-08-29-live-01': '游戏前聊10块钱的',
  '2019-11-22-live-01': '游戏前聊10块钱的',
  '2019-12-20-live-01': '游戏前聊10块钱的',
  '2021-04-17-live-02': '游戏前聊10块钱的',
  '2021-05-04-live-01': '游戏前聊10块钱的',
}
for (const [entry, name] of Object.entries(reviewedOpeningBreaks)) {
  const timeline = timelineByEntry.get(entry)
  assert.ok(timeline, `missing reviewed opening-chat timeline: ${entry}`)
  const opening = resolveSpans(timeline)[0]
  assert.equal(opening?.span.page, 1, `${entry} opening must start at P1`)
  assert.equal(opening?.span.at, '00:00:00', `${entry} opening must start at 00:00:00`)
  assert.equal(opening?.span.kind, 'break', `${entry} reviewed opening chat must be an independent break`)
  assert.ok(opening.span.note?.includes(name), `${entry} must preserve its historical segment name`)
  assert.ok(opening.endSec - opening.startSec >= 300, `${entry} break must meet the 5-minute policy`)
  assert.notEqual(opening.span.evidence, 'human_watch', `${entry} must not claim human_watch without continuous human review`)
}

// ── 两款已识别游戏之间的短切换，不能再次保留泛称 unknown ──────────────
// docs/game-time.md：不足五分钟的切换/短聊并入前一款游戏；若真的怀疑有
// 尚未识别的第三款游戏，必须在 note 写出具体画面证据，而不是泛称“聊天/切换”。
// 回归锁：只保证不被意外改动，不证明正确；改数据时要连同证据一起更新。
const unresolvedShortTransitions: string[] = []
for (const timeline of timelines) {
  const resolved = resolveSpans(timeline)
  for (let i = 1; i < resolved.length - 1; i++) {
    const previous = resolved[i - 1].span
    const middle = resolved[i]
    const following = resolved[i + 1].span
    if (middle.span.kind !== 'unknown' || !previous.game || !following.game) continue
    const duration = middle.endSec - middle.startSec
    if (duration >= 300) continue
    const note = middle.span.note?.trim() ?? ''
    if (!note || note === '休息 / 切换' || note === '聊天' || note === '未归类片段') {
      unresolvedShortTransitions.push(`${timeline.entry} P${middle.span.page} ${middle.span.at} (${duration}s): ${previous.game} → ${following.game}`)
    }
  }
}
assert.deepEqual(
  unresolvedShortTransitions,
  [],
  `sub-five-minute generic transitions must be attributed to the preceding game, or carry concrete evidence for a genuinely unresolved third game:\n${unresolvedShortTransitions.join('\n')}`,
)

// ── 守恒与证据等级 ───────────────────────────────────────────────────
let totalVerified = 0
for (const timeline of timelines) {
  const resolved = resolveSpans(timeline)
  const covered = resolved.reduce((sum, raw) => sum + raw.endSec - raw.startSec, 0)
  close(covered, recordedSec(timeline), 0.01, `${timeline.entry} spans must cover the recorded parts`)
  for (const session of gameSessionSpans(timeline)) totalVerified += session.verifiedSec
  // unknown 只是待归属，不能因为补了标签或说明就变成人工核实。
  for (const span of timeline.spans as TimelineSpan[]) {
    if (span.kind !== 'unknown') continue
    assert.notEqual(span.evidence, 'human_watch', `${timeline.entry} unknown must not claim human_watch`)
    assert.notEqual(span.scanned, true, `${timeline.entry} unknown must not claim scanned`)
  }
}
// 本轮没有新增人工核实；这个数字变化时必须说明证据来源。
// 回归锁：只保证不被意外改动，不证明正确；改数据时要连同证据一起更新。
assert.equal(totalVerified, 186628, 'verified game time must not change without human review evidence')

// 先执行其余回归检查，再统一报告未确认的交叉冲突。
assert.deepEqual(
  unregisteredCrossChecks,
  [],
  `old segments name a game over an unknown or break span of at least five minutes; review it before changing the timeline:\n${unregisteredCrossChecks
    .map((key) => {
      const item = currentCrossChecks.get(key)!
      return `  ${item.entry} @ ${item.segmentAt}: ${item.game} overlaps ${item.kind} P${item.page} ${item.at} by ${item.overlapSec.toFixed(3)} sec`
    })
    .join('\n')}`,
)

const publicGameCount = getPublicDataset().games.size
console.log(
  `OK game timeline gaps: ${expected.length} reviewed spans present, ${timelines.length} timelines checked, ` +
    `${currentGaps.size} registered gaps, ${currentCrossChecks.size} cross-check exceptions, ` +
    `${longUnknowns.length} long unknown(s) reviewed, ${publicGameCount} public games`,
)
