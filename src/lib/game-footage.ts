import type { TimelineEntry } from './data'
import { REVIEWED_GAPS } from './game-footage-evidence'
import { SPECIFIC_GAME_PARENTS, visibleGameIds } from './games'
import { unscopedSharedSource } from './source-scope'

function matches(candidate: string, game: string): boolean {
  return candidate === game || SPECIFIC_GAME_PARENTS[candidate] === game
}

/**
 * Game-page projection only. A missing game chapter never falls back to the
 * whole session or its alternate sources. Historical archive records stay intact.
 */
export function gameFootageEntry(entry: TimelineEntry, game: string, shared: ReadonlySet<string> = new Set<string>()): TimelineEntry {
  const unavailable = (notice: NonNullable<TimelineEntry['gameFootageNotice']>): TimelineEntry => ({
    ...entry,
    games: entry.games.filter(candidate => matches(candidate.id, game)),
    gameFootageNotice: notice,
    sources: [], primaryUrl: null,
    sourceCount: 0, aliveCount: 0, uncheckedCount: 0, deadCount: 0,
    cover: null, duration_min: undefined, bands: [],
    chapters: undefined, chapterBasis: undefined, chapterReviewed: undefined, chapterCoverage: undefined,
    missingFootage: undefined,
  })
  const gap = REVIEWED_GAPS.find(gap => gap.entry === entry.id && gap.games.some(id => matches(id, game)))
  if (gap && gap.status !== 'playable_complement') {
    const unchecked = entry.sources.some(source => source.status === 'unchecked')
    return unavailable(gap.status === 'no_known_replay' && !unchecked ? 'missing' : 'unverified')
  }
  const alive = entry.sources.filter(source => source.status === 'alive')
  if (!alive.length) {
    return unavailable(entry.sources.some(source => source.status === 'unchecked') ? 'unverified' : 'missing')
  }
  if (gap?.status === 'playable_complement' && !entry.chapters?.some(chapter => chapter.gameId && matches(chapter.gameId, game))) {
    return unavailable('unverified')
  }
  if (alive.every(source => source.kind === 'clip')) return unavailable('partial')
  if (entry.chapters) {
    const hasGame = entry.chapters.some(chapter => chapter.gameId && matches(chapter.gameId, game))
    const basis = alive.find(source => source.url === entry.chapterBasis && source.kind !== 'clip')
    return hasGame && basis ? entry : unavailable('unverified')
  }
  // The anniversary's default source is a 97-minute edited show; its MC sources
  // have no reviewed game chapters yet. Keep them in the complete archive only.
  if (entry.id === '2016-01-24-live-01') return unavailable('unverified')
  if (!entry.games.some(candidate => matches(candidate.id, game)) || visibleGameIds(entry.games.map(game => game.id)).length > 1) {
    return unavailable('unverified')
  }
  // A single-game recording without chapter timing can still be shown as a
  // related recording. Clips and unavailable links cannot be playback fallbacks.
  const recordings = alive.filter(source => source.kind !== 'clip')
  const sources = recordings.filter(source => !unscopedSharedSource(source, shared))
  // A shared collection without a declared location is not evidence of absence.
  if (!sources.length) return unavailable('unverified')
  const replacedPrimary = entry.primaryUrl !== sources[0].url && recordings.some(source => unscopedSharedSource(source, shared))
  return {
    ...entry, sources, primaryUrl: sources[0].url,
    ...(replacedPrimary ? { cover: sources[0].coverUnreliable ? null : sources[0].cover ?? null } : {}),
    sourceCount: sources.length, aliveCount: sources.length, uncheckedCount: 0, deadCount: 0,
  }
}
