import type { TimelineEntry, TimelineSource } from './data'

/** Platform submission identity; an opening page is tracked separately. */
function contentKey(raw: string): string {
  try {
    const url = new URL(raw)
    if (/(^|\.)bilibili\.com$/.test(url.hostname)) {
      const id = url.pathname.match(/\/video\/(BV[0-9A-Za-z]{10}|av\d+)(?:\/|$)/)?.[1]
      if (id) return `bilibili:${id}`
    }
    if (/(^|\.)acfun\.cn$/.test(url.hostname)) {
      const id = url.pathname.match(/\/v\/ac(\d+)(?:_\d+)?\/?$/)?.[1]
      if (id) return `acfun:${id}`
    }
  } catch { /* Unrecognized addresses retain their exact identity. */ }
  return raw
}

/** Input is the public timeline, after explicitly linked same-session records merge. */
export function sharedSourceIds(entries: readonly Pick<TimelineEntry, 'id' | 'sources'>[]): ReadonlySet<string> {
  const owners = new Map<string, Set<string>>()
  for (const entry of entries) {
    for (const source of entry.sources) {
      // A related clip does not claim to be another complete session.
      if (source.kind === 'clip') continue
      const key = contentKey(source.url)
      const ids = owners.get(key) ?? new Set<string>()
      ids.add(entry.id)
      owners.set(key, ids)
    }
  }
  return new Set([...owners].filter(([, ids]) => ids.size > 1).map(([key]) => key))
}

/** Existing source-specific part declarations remain authoritative; no ranges are guessed. */
export function unscopedSharedSource(source: Pick<TimelineSource, 'url' | 'partDetails'>, shared: ReadonlySet<string>): boolean {
  if (!shared.has(contentKey(source.url)) || source.partDetails?.length) return false
  try {
    const url = new URL(source.url)
    const bili = /(^|\.)bilibili\.com$/.test(url.hostname)
    const acfun = /(^|\.)acfun\.cn$/.test(url.hostname)
    if ((bili && (/^[1-9]\d*$/.test(url.searchParams.get('p') ?? '')
      || (/^(?:\d+\.?\d*|\.\d+)$/.test(url.searchParams.get('t') ?? '') && Number(url.searchParams.get('t')) > 0)))
      || (acfun && /\/ac\d+_[1-9]\d*\/?$/.test(url.pathname))) return false
  } catch { /* No valid source-specific location. */ }
  return true
}
