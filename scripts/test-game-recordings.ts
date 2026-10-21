import assert from 'node:assert/strict'
import { getPublicDataset, toTimelineEntries, type TimelineEntry } from '../src/lib/data'
import { recordingsForGame, recordingsForSeries, recordingRange } from '../src/lib/game-recordings'
import { gameChapters, timelineTotals } from '../src/lib/game-chapters'
import { sessionGameTime } from '../src/lib/game-time'
import { isSeriesMember } from '../src/lib/series'
import { GameTimeline as GameTimelineSchema, type GameTimeline } from '../src/lib/schema'

const game = { id: 'minecraft', name: 'Minecraft' }
const basis = 'https://www.bilibili.com/video/BV1aaaaaaaaa'
const alternate = 'https://www.bilibili.com/video/BV1bbbbbbbbb'
const entry: TimelineEntry = {
  id: 'sample', type: 'live', date: '2026-10-20', title: 'Mixed recording', platform: 'bilibili',
  games: [game, { id: 'other', name: 'Other' }], tags: [], cover: null, primaryUrl: alternate,
  sources: [
    { url: alternate, kind: 'replay', status: 'alive', entryTitle: 'Alternate' },
    { url: basis, kind: 'replay', status: 'alive', entryTitle: 'Basis' },
  ],
  mergedEntryCount: 0, confidence: 'high', sourceCount: 2, aliveCount: 2, uncheckedCount: 0, deadCount: 0, bands: [],
}
const timeline: GameTimeline = {
  entry: entry.id, basis, coverage: 'complete', reviewed: '2026-10-20',
  parts: Array.from({ length: 5 }, (_, i) => ({ page: i + 1, id: i + 1, duration_sec: 600 })),
  spans: [
    { page: 1, at: '00:00:00', game: 'other', precision: 'part', evidence: 'part_title' },
    { page: 2, at: '00:00:00', game: game.id, precision: 'part', evidence: 'part_title' },
    { page: 5, at: '00:00:00', game: 'other', precision: 'part', evidence: 'part_title' },
  ],
}
const snapshot = structuredClone(entry)
const middle = recordingsForGame(entry, game, timeline)
assert.deepEqual(middle.clips.map(c => c.page), [2, 3, 4], 'P5 zero endpoint never creates a P5 clip')
assert.equal(middle.clips.reduce((sum, c) => sum + c.durationSec, 0), 1800)
assert.ok(middle.clips.every(c => c.url.startsWith(`${basis}/?p=`) && c.game.id === game.id))
assert.ok(middle.clips.every(c => !c.url.includes('BV1bbbbbbbbb')), 'never reuse timing on alternate sources')
assert.deepEqual(entry, snapshot, 'scoping must never mutate the complete archive record')

const switching: GameTimeline = { ...timeline, parts: [timeline.parts[0]], spans: [
  { page: 1, at: '00:00:00', game: game.id, precision: 'exact', evidence: 'human_watch' },
  { page: 1, at: '00:02:00', game: 'other', precision: 'approx', evidence: 'human_watch' },
  { page: 1, at: '00:04:00', game: game.id, precision: 'approx', evidence: 'human_watch' },
] }
const repeated = recordingsForGame(entry, game, switching).clips
assert.equal(repeated.length, 2, 'same-P return to a game stays independently collected')
assert.deepEqual(repeated.map(c => [c.startSec, c.endSec]), [[0, 120], [240, 600]])
assert.notEqual(repeated[0].id, repeated[1].id)
assert.equal(repeated[1].url, `${basis}/?p=1&t=240`)
assert.match(recordingRange(repeated[0]), /00:00:00–约 00:02:00/)
assert.match(recordingRange(repeated[1]), /约 00:04:00–00:10:00/)

const acBasis = 'https://www.acfun.cn/v/ac123'
const ac = recordingsForGame({ ...entry, sources: [{ ...entry.sources[1], url: acBasis }] }, game, { ...switching, basis: acBasis }).clips[1]
assert.equal(ac.url, acBasis)
assert.equal(ac.manualSeek, true)
assert.ok(!ac.url.includes('t='))
const acMulti = recordingsForGame({ ...entry, sources: [{ ...entry.sources[1], url: acBasis }] }, game, { ...timeline, basis: acBasis }).clips
assert.deepEqual(acMulti.map(c => c.url), [2, 3, 4].map(p => `${acBasis}_${p}`))

const parent = { id: 'maplestory', name: '冒险岛' }
const child = { id: 'maplestory-classic', name: '冒险岛怀旧服' }
const seriesEntry = { ...entry, games: [parent, child] }
const series = recordingsForGame(seriesEntry, parent, { ...switching, spans: switching.spans.map(s => ({ ...s, game: child.id })) })
assert.equal(series.clips.length, 1, 'parent page inherits concrete game chapters and existing merge rules')
assert.deepEqual(series.clips[0].game, child, 'each inherited card has exactly its concrete game tag')
assert.equal(recordingsForGame(seriesEntry, parent).pending, false, 'parent and child are one game for related fallback')

assert.deepEqual(recordingsForGame(entry, game), { clips: [], pending: true })
assert.deepEqual(recordingsForGame({ ...entry, games: [game] }, game), { clips: [], pending: false })
const missingGame = { ...timeline, spans: timeline.spans.map(s => ({ ...s, game: 'other' })) }
assert.deepEqual(recordingsForGame(entry, game, missingGame), { clips: [], pending: true }, 'a timeline missing this game never projects a full-session game clip')
assert.equal(recordingsForGame({ ...entry, sources: [entry.sources[0]] }, game, timeline).clips.length, 0, 'missing basis must not borrow an alternate source')

const fractional = { ...switching, parts: [{ page: 1, id: 1, duration_sec: 600.7 }] }
assert.equal(recordingsForGame(entry, game, fractional).clips[1].endSec, 600.7, 'rounded chapter clock must never exceed the source part')

// ── 节目页：只切出带本节目的 break 段（同一套分 P 投影） ─────────────────────
const show = { id: 'xinling-pishuang', name: '心灵砒霜' }
const showTimeline: GameTimeline = {
  ...timeline,
  spans: [
    { page: 1, at: '00:00:00', game: 'other', precision: 'part', evidence: 'part_title' },
    { page: 2, at: '00:00:00', kind: 'break', series: show.id, precision: 'part', evidence: 'part_title' },
    { page: 4, at: '00:05:00', game: 'other', precision: 'approx', evidence: 'human_watch' },
    { page: 5, at: '00:00:00', kind: 'break', precision: 'part', evidence: 'part_title' },
  ],
}
const showClips = recordingsForSeries(entry, show, showTimeline)
assert.equal(showClips.pending, false, 'no unlocated fallback on the show page')
assert.deepEqual(showClips.clips.map(c => [c.page, c.startSec, c.endSec]), [[2, 0, 600], [3, 0, 600], [4, 0, 300]], 'a show segment spanning parts lists exactly the parts it covers')
assert.ok(showClips.clips.every(c => c.game.id === show.id && c.game.name === show.name && c.url.startsWith(`${basis}/?p=`) && !c.url.includes('BV1bbbbbbbbb')))
assert.equal(showClips.clips[0].url, `${basis}/?p=2`, 'part precision links to the part only')
assert.equal(recordingsForSeries(entry, { id: 'other-show', name: 'x' }, showTimeline).clips.length, 0, 'no segment of this show: whole session stays')
assert.equal(recordingsForSeries(entry, show).clips.length, 0, 'no timeline: whole session stays')
assert.equal(recordingsForSeries(entry, show, { ...showTimeline, spans: showTimeline.spans.map(({ series: _series, ...s }) => s as GameTimeline['spans'][number]) }).clips.length, 0, 'untagged breaks never leak into a show page')
assert.equal(recordingsForSeries({ ...entry, sources: [entry.sources[0]] }, show, showTimeline).clips.length, 0, 'missing basis must not borrow an alternate source')
assert.equal(recordingsForGame(entry, game, showTimeline).clips.length, 0, 'a show segment is never a game clip')

// 同一场多次出现分开列；A 站只跳分 P
const twice: GameTimeline = {
  ...showTimeline, parts: [timeline.parts[0]],
  spans: [
    { page: 1, at: '00:00:00', kind: 'break', series: show.id, precision: 'exact', evidence: 'human_watch' },
    { page: 1, at: '00:02:00', game: 'other', precision: 'approx', evidence: 'human_watch' },
    { page: 1, at: '00:04:00', kind: 'break', series: show.id, precision: 'approx', evidence: 'human_watch' },
  ],
}
const twiceClips = recordingsForSeries(entry, show, twice).clips
assert.deepEqual(twiceClips.map(c => [c.startSec, c.endSec]), [[0, 120], [240, 600]])
assert.equal(twiceClips[1].url, `${basis}/?p=1&t=240`)
const acShow = recordingsForSeries({ ...entry, sources: [{ ...entry.sources[1], url: acBasis }] }, show, { ...twice, basis: acBasis }).clips[1]
assert.equal(acShow.url, acBasis)
assert.equal(acShow.manualSeek, true)

// 带节目的 break 不被同款游戏吞掉，也不计入任何游戏时长；没带节目的 break 照旧并入
const sandwich = (series?: string): GameTimeline => ({
  ...timeline, parts: [timeline.parts[0]],
  spans: [
    { page: 1, at: '00:00:00', game: 'other', precision: 'exact', evidence: 'human_watch', scanned: true },
    { page: 1, at: '00:02:00', kind: 'break', ...(series ? { series } : {}), precision: 'exact', evidence: 'human_watch' },
    { page: 1, at: '00:06:00', game: 'other', precision: 'exact', evidence: 'human_watch', scanned: true },
  ],
})
assert.equal(gameChapters(sandwich()).length, 1, 'plain break between the same game still merges')
assert.equal(gameChapters(sandwich(show.id)).length, 3, 'a show break stays its own chapter')
assert.equal(gameChapters(sandwich(show.id))[1].series, show.id)
assert.equal(recordingsForSeries(entry, show, sandwich(show.id)).clips.length, 1)
const sandwiched = timelineTotals([sandwich(show.id)])
assert.equal(sandwiched.gameSec, 120 + 240, 'show break time is in no game total')
assert.equal(sandwiched.breakSec, 240)
assert.equal(sessionGameTime({ id: entry.id, games: [{ id: 'other' }] }, 'other', sandwich(show.id)).associatedSec, 360)
assert.equal(GameTimelineSchema.safeParse({ ...sandwich(show.id), entry: entry.id }).success, true)

// 成员判定与节目页同源
const member = { title: '某场', tags: [] as string[], seriesName: undefined as string | undefined }
assert.equal(isSeriesMember({ ...member, title: '狗年第一碗砒霜' }, 'xinling-pishuang', '心灵砒霜'), true)
assert.equal(isSeriesMember({ ...member, tags: ['心灵砒霜'] }, 'xinling-pishuang', '心灵砒霜'), true)
assert.equal(isSeriesMember(member, 'xinling-pishuang', '心灵砒霜'), false)
assert.equal(isSeriesMember({ ...member, title: '大周建国史' }, 'dazhou-mc', '大周MC'), true)
assert.equal(isSeriesMember({ ...member, title: '大周建国史' }, 'xinling-pishuang', '心灵砒霜'), false)

const ds = getPublicDataset()
let checked = 0
for (const actual of toTimelineEntries(ds)) {
  const t = ds.timelines.get(actual.id)
  if (!t) continue
  for (const g of actual.games) {
    for (const clip of recordingsForGame(actual, g, t).clips) {
      const part = t.parts.find(p => p.page === clip.page)!
      assert.ok(part && clip.startSec >= 0 && clip.endSec <= part.duration_sec && clip.endSec > clip.startSec)
      assert.ok(clip.url.includes('bilibili.com') || clip.url.includes('acfun.cn'))
      checked++
    }
  }
}
console.log(`OK game-only P projection, show-page segments, same-P switches, returns, series parents, unlocated fallbacks, basis-only links; ${checked} real clips checked`)
