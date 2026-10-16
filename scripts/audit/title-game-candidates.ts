import type { Entry, Game } from '../../src/lib/schema'

type AuditGame = Pick<Game, 'id' | 'name' | 'aliases'>
type AuditEntry = Pick<Entry, 'id' | 'title' | 'games'>
export type ReviewReason = 'name-match' | 'alias-only' | 'shared-term' | 'covered-by-tagged-game'
export interface TitleGameCandidate {
  entryId: string
  title: string
  gameId: string
  matched: string
  reviewReason: ReviewReason
  relatedGameIds: string[]
}
interface Match { term: string; start: number; end: number; isName: boolean }
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().trim()

function matches(title: string, game: AuditGame): Match[] {
  const result: Match[] = []
  for (const term of new Set([game.name, ...game.aliases])) {
    const normalized = normalize(term)
    if (normalized.length < 2) continue
    let start = title.indexOf(normalized)
    while (start !== -1) {
      const end = start + normalized.length
      // Keep Latin words from matching inside another word or sequel number.
      const bounded = !/^[a-z0-9]+$/.test(normalized)
        || (!/[a-z0-9]/.test(title[start - 1] ?? '') && !/[a-z0-9]/.test(title[end] ?? ''))
      if (bounded) result.push({ term, start, end, isName: normalize(game.name) === normalized })
      start = title.indexOf(normalized, start + 1)
    }
  }
  return result.sort((a, b) => (b.end - b.start) - (a.end - a.start) || Number(b.isName) - Number(a.isName))
}

/** Textual leads only: retain overlapping and ambiguous matches for human review. */
export function findTitleGameCandidates(entries: AuditEntry[], games: AuditGame[]): TitleGameCandidate[] {
  const candidates: TitleGameCandidate[] = []
  const owners = new Map<string, Set<string>>()
  for (const game of games) {
    for (const term of [game.name, ...game.aliases]) {
      const key = normalize(term)
      const ids = owners.get(key) ?? new Set<string>()
      ids.add(game.id)
      owners.set(key, ids)
    }
  }
  for (const entry of entries) {
    const title = normalize(entry.title)
    const found = games.map((game) => ({ game, matches: matches(title, game) }))
    const tagged = found.filter(({ game }) => entry.games.includes(game.id))
    for (const item of found) {
      if (entry.games.includes(item.game.id) || !item.matches.length) continue
      const coveringIds = new Set<string>()
      const uncovered = item.matches.filter((match) => {
        const covering = tagged.filter((other) => other.matches.some((span) =>
          span.start <= match.start && span.end >= match.end
          && span.end - span.start > match.end - match.start))
        covering.forEach(({ game }) => coveringIds.add(game.id))
        return covering.length === 0
      })
      // Prefer a separate mention over a substring contained in an existing tag.
      const best = (uncovered.length ? uncovered : item.matches)[0]
      const sharedIds = [...(owners.get(normalize(best.term)) ?? [])].filter((id) => id !== item.game.id)
      const reviewReason: ReviewReason = !uncovered.length ? 'covered-by-tagged-game'
        : sharedIds.length ? 'shared-term' : best.isName ? 'name-match' : 'alias-only'
      candidates.push({ entryId: entry.id, title: entry.title, gameId: item.game.id,
        matched: best.term, reviewReason,
        relatedGameIds: reviewReason === 'covered-by-tagged-game' ? [...coveringIds].sort() : sharedIds.sort() })
    }
  }
  const priority: Record<ReviewReason, number> = {
    'name-match': 0, 'alias-only': 1, 'shared-term': 2, 'covered-by-tagged-game': 3,
  }
  return candidates.sort((a, b) => priority[a.reviewReason] - priority[b.reviewReason])
}
