import assert from 'node:assert/strict'
import { getPublicDataset, toTimelineEntries } from '../src/lib/data'
import { decodeArchiveEntry, encodeArchiveEntry } from '../src/lib/archive-payload'
import { gameFootageEntry } from '../src/lib/game-footage'
import { getGameFootageCopy } from '../src/lib/game-footage-copy'
import { recordingsForGame } from '../src/lib/game-recordings'
import { REVIEWED_GAPS } from '../src/lib/game-footage-evidence'

const ds = getPublicDataset()
const entries = toTimelineEntries(ds)
const get = (id: string) => {
  const entry = entries.find(entry => entry.id === id)
  assert.ok(entry, id)
  return entry
}
for (const gap of REVIEWED_GAPS.filter(gap => gap.status !== 'playable_complement')) {
  for (const game of gap.games) {
    const original = get(gap.entry)
    const copy = JSON.stringify(original)
    const projected = gameFootageEntry(original, game)
    assert.ok(projected.gameFootageNotice, `${gap.entry}/${game} must explicitly state missing footage`)
    assert.deepEqual(projected.sources, [])
    assert.equal(projected.primaryUrl, null)
    assert.equal(projected.cover, null)
    assert.equal(projected.chapters, undefined)
    assert.deepEqual(projected.bands, [])
    assert.equal(projected.duration_min, undefined)
    assert.equal(JSON.stringify(original), copy, 'archive record must remain unchanged')
    assert.deepEqual(decodeArchiveEntry(encodeArchiveEntry(projected)), projected)
  }
}
for (const entry of entries.filter(entry => entry.sources.length && entry.sources.every(source => source.kind === 'clip'))) {
  for (const game of entry.games) {
    const projected = gameFootageEntry(entry, game.id)
    assert.equal(projected.sources.length, 0, 'clip-only records must not fill a game replay slot')
    assert.ok(projected.gameFootageNotice)
  }
}
let checked = 0, missing = 0
for (const entry of entries) {
  for (const game of entry.games) {
    const projected = gameFootageEntry(entry, game.id)
    assert.deepEqual(decodeArchiveEntry(encodeArchiveEntry(projected)), projected)
    const playback = recordingsForGame(projected, game, ds.timelines.get(entry.id))
    if (projected.gameFootageNotice) {
      assert.equal(projected.sources.length, 0)
      assert.equal(playback.clips.length, 0)
    } else if (projected.chapters) {
      assert.ok(playback.clips.length > 0)
      assert.ok(playback.clips.every(clip => !clip.unavailable))
    } else {
      assert.ok(projected.sources.every(source => source.status === 'alive' && source.kind !== 'clip'))
    }
    if (projected.gameFootageNotice) assert.equal(projected.chapters, undefined)
    if (projected.gameFootageNotice) missing++
    checked++
  }
}
const sample = get('2015-07-06-live-01')
const dogEntry = get('2015-07-10-live-01')
const dogMinecraft = gameFootageEntry(dogEntry, 'minecraft')
assert.equal(dogMinecraft.gameFootageNotice, 'missing')
const dogLead = getGameFootageCopy(dogMinecraft).relatedLead
assert.ok(dogLead, '07-10 Minecraft notice retains the undated edit lead')
assert.equal(getGameFootageCopy(dogMinecraft).label, '整场未确认')
assert.doesNotMatch(getGameFootageCopy(dogMinecraft).title, /缺失|未找到对应游戏录像/)
assert.equal(dogLead.url, 'https://v.youku.com/v_show/id_XMTI4NDc4OTIyOA==.html')
assert.match(dogLead.detail, /不能作为本场整场录像/)
assert.equal(dogMinecraft.sources.length, 0, 'the edit lead never enters playback sources')
assert.equal(dogMinecraft.primaryUrl, null)
assert.equal(dogMinecraft.duration_min, undefined)
assert.equal(getGameFootageCopy(gameFootageEntry(dogEntry, 'besiege')).relatedLead, undefined, 'lead does not leak to another game')
assert.equal(getGameFootageCopy(gameFootageEntry(get('2015-07-13-live-01'), 'minecraft')).relatedLead, undefined, 'undated lead is not assigned to another date')
assert.equal(gameFootageEntry(sample, 'minecraft').gameFootageNotice, 'missing')
assert.equal(gameFootageEntry(sample, 'besiege').gameFootageNotice, 'partial')
assert.equal(gameFootageEntry(get('2018-08-10-live-01'), 'minecraft').gameFootageNotice, 'partial')
const missingCopy = getGameFootageCopy(gameFootageEntry(sample, 'minecraft'))
const partialCopy = getGameFootageCopy(gameFootageEntry(sample, 'besiege'))
assert.notEqual(missingCopy.label, partialCopy.label)
assert.match(partialCopy.detail, /不能当作整场录像/)
const uncheckedEntry = { ...sample, sources: sample.sources.map(source => ({ ...source, status: 'unchecked' as const })) }
const unchecked = gameFootageEntry(uncheckedEntry, 'besiege')
assert.equal(unchecked.gameFootageNotice, 'unverified', 'unchecked source is not a confirmed missing recording')
assert.equal(unchecked.primaryUrl, null)
assert.equal(unchecked.duration_min, undefined)
assert.match(getGameFootageCopy(unchecked).detail, /尚未核实/)
const unlocatedComplement = gameFootageEntry(get('2015-01-27-live-01'), 'i-wanna-be-the-xylem')
assert.equal(unlocatedComplement.gameFootageNotice, 'unverified')
assert.match(getGameFootageCopy(unlocatedComplement).title, /尚未定位/)
assert.equal(unlocatedComplement.sources.length, 0, 'unlocated complement is not used as game playback')
const working = get('2025-06-10-live-04')
assert.equal(gameFootageEntry(working, 'dune-awakening').sources.length, 0)
assert.ok(gameFootageEntry(working, 'wuzhu-xingyuan').sources.length > 0, 'missing second game must not hide the recorded first game')
const unavailable = gameFootageEntry({ ...working, sources: working.sources.map(source => ({ ...source, status: 'dead' })) }, 'wuzhu-xingyuan')
assert.equal(unavailable.primaryUrl, null, 'dead sources never become fallback playback links')
console.log(`OK ${checked} game/session projections; ${missing} explicit missing or unverified states; clips, wrong games, dead links and payload round trips checked`)

const knownComplement = gameFootageEntry(get('2017-04-04-live-01'), 'zelda-botw')
assert.equal(knownComplement.gameFootageNotice, 'unverified', 'an unlocated playable complement is not missing footage')
assert.match(getGameFootageCopy(knownComplement).title, /尚未定位/)
assert.equal(knownComplement.sources.length, 0, 'unlocated alternate recordings stay out of the game playback slot')
const verified = get('2017-01-21-live-01')
assert.strictEqual(gameFootageEntry(verified, verified.chapters!.find(chapter => chapter.gameId)!.gameId!), verified, 'located game chapters retain the existing per-part playback projection')
assert.ok(gameFootageEntry(get('2016-01-24-live-01'), 'minecraft').gameFootageNotice, 'edited show source cannot stand in for MC recording')
