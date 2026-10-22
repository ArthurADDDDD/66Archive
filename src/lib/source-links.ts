import type { TimelineSource } from './data'
import { buildJump } from './game-time'

/** Open the entry's declared part range, without changing source identity. */
export function sourceStartHref(source: Pick<TimelineSource, 'url' | 'partDetails'>): string {
  const first = source.partDetails?.[0]
  if (!first || first.page <= 1) return source.url
  try {
    const url = new URL(source.url)
    // An explicitly located source takes precedence over a collection snapshot.
    if (url.searchParams.has('p') || url.searchParams.has('t') || url.hash
      || /\/ac\d+_\d+\/?$/.test(url.pathname)) return source.url
  } catch {
    return source.url
  }
  return buildJump(source.url, first.page, 0, 'part')?.url ?? source.url
}
