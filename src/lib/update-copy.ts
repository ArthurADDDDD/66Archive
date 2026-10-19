import { ARCHIVE_UPDATES, SITE_UPDATES } from './site-updates'

export type UpdateCategory = 'feature' | 'archive'
export type UpdateField = 'title' | 'text'
export type UpdateCopyEntry = { date: string; source?: string; title: string; text: string }

/**
 * A permanent text identity independent of titles, edit history and list order.
 * A new release can be inserted without renumbering existing editable text.
 */
export function updateCopyId(category: UpdateCategory, entry: UpdateCopyEntry, field: UpdateField): string {
  const source = (entry.source?.split(' / ')[0] ?? 'launch').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const day = entry.date.replace(/[^0-9]/g, '')
  return `updates-${category}-${day}-${source}-${field}`
}

/** Baseline text entries for the existing editable site-copy document. */
export const UPDATE_COPY_TEXTS = [
  ...SITE_UPDATES.flatMap((entry) => [
    { id: updateCopyId('feature', entry, 'title'), group: '更新记录 · 功能', label: `${entry.date} · 标题`, text: entry.title },
    { id: updateCopyId('feature', entry, 'text'), group: '更新记录 · 功能', label: `${entry.date} · 说明`, text: entry.text },
  ]),
  ...ARCHIVE_UPDATES.flatMap((entry) => [
    { id: updateCopyId('archive', entry, 'title'), group: '更新记录 · 补档', label: `${entry.date} · 标题`, text: entry.title },
    { id: updateCopyId('archive', entry, 'text'), group: '更新记录 · 补档', label: `${entry.date} · 说明`, text: entry.text },
  ]),
]
