import { ARCHIVE_UPDATES, SITE_UPDATES } from './site-updates'

/**
 * Only curated, visitor-facing SITE_UPDATES trigger a new notice.
 * Routine recording imports and technical-only deploys must not cause a popup.
 *
 * To announce a future version, prepend a dated entry with a new source identifier
 * in site-updates.ts. The newest entry becomes the notice identity automatically.
 */
export const UPDATE_NOTICE_STORAGE_KEY = 'nvliu:site-updates:seen:v1'

export type VisitorUpdate = {
  date: string
  source?: string
  title: string
  text: string
  tags?: readonly string[]
}

export type UpdateNoticeData = {
  version: string
  updates: VisitorUpdate[]
  tags: string[]
}

const DAY_MS = 86_400_000
const UPDATE_WINDOW_DAYS = 30

function utcDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp
    : Number.NaN
}

export function getUpdateNotice(
  now: Date = new Date(),
  updates: readonly VisitorUpdate[] = SITE_UPDATES,
): UpdateNoticeData | null {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const recent = updates.filter((update) => {
    const date = utcDay(update.date)
    return Number.isFinite(date) && date <= today && today - date <= UPDATE_WINDOW_DAYS * DAY_MS
  })

  // Site updates are newest-first; an old log must never create a stale notification.
  if (recent.length === 0) return null
  const newest = recent[0]
  const version = `${newest.date}:${newest.source ?? newest.title}`
  const tags = Array.from(new Set(recent.flatMap((update) => update.tags ?? []))).slice(0, 8)
  return { version, updates: recent, tags }
}

/** Deterministic predicate for repeat visits and newer feature announcements. */
export function shouldShowUpdateNotice(seenVersion: string | null, notice: UpdateNoticeData | null): boolean {
  return notice !== null && seenVersion !== notice.version
}

/** The archive viewer includes every logged feature and collection update, even older than 30 days. */
export type UpdateHistoryItem = VisitorUpdate & { category: '功能' | '收录' }

export function getUpdateHistory(
  siteUpdates: readonly VisitorUpdate[] = SITE_UPDATES,
  archiveUpdates: readonly VisitorUpdate[] = ARCHIVE_UPDATES,
): UpdateHistoryItem[] {
  return [
    ...siteUpdates.map((update) => ({ ...update, category: '功能' as const })),
    ...archiveUpdates.map((update) => ({ ...update, category: '收录' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date))
}
