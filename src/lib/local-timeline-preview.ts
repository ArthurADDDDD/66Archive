import fs from 'node:fs'
import { GameTimelinesFile, type GameTimeline } from './schema'

/** Explicit development-only overlay. Never changes or silently ships formal data. */
export function readLocalTimelinePreview(file: string | undefined, mode = process.env.NODE_ENV): GameTimeline[] {
  if (!file) return []
  if (mode !== 'development') throw new Error('Timeline preview is allowed only in local development; unset ARCHIVE_TIMELINE_PREVIEW before building')
  const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(raw) || raw.some(t => !t || typeof t !== 'object' || 'draft' in t)) throw new Error('Preview requires reviewed timelines, never machine drafts')
  const timelines = GameTimelinesFile.parse(raw)
  if (new Set(timelines.map(t => t.entry)).size !== timelines.length) throw new Error('Duplicate preview timeline')
  return timelines
}
