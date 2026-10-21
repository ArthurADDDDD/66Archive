import type { TimelineEntry } from './data'
import { chapterClock, chaptersForGame, chaptersForSeries, type GameChapter } from './game-chapters'
import { buildJump } from './game-time'
import { visibleGameIds } from './games'
import type { GameTimeline } from './schema'

/** A game-page view of a recording, never an archive entry or a new source. */
export type GameRecording = {
  id: string
  game: { id: string; name: string }
  page: number
  startSec: number
  endSec: number
  startApprox: boolean
  endApprox: boolean
  durationSec: number
  url: string
  platform: 'bilibili' | 'acfun'
  manualSeek: boolean
  cover: string | null
  unavailable: boolean
}

export type GameRecordings = {
  clips: GameRecording[]
  /** Related full recordings remain explicitly unlocated. */
  pending: boolean
}

const seconds = (clock: string) => clock.split(':').reduce((n, v) => n * 60 + Number(v), 0)

/**
 * Slice reviewed chapters into per-part clips on the timeline's own basis; alternate sources
 * have no shared clock. Shared by the game page (game chapters) and the show page (series breaks),
 * so both split a multi-part chapter the same way. The clip's `game` is whatever the page is
 * scoped to (a game, or a show); it only feeds the card title and colour.
 */
function clipsFromChapters(
  entry: TimelineEntry,
  timeline: GameTimeline | undefined,
  chapters: GameChapter[],
  subjectOf: (chapter: GameChapter) => { id: string; name: string } | null,
): GameRecording[] {
  const clips: GameRecording[] = []
  if (timeline?.entry !== entry.id) return clips
  const source = entry.sources.find(s => s.url === timeline.basis)
  for (const chapter of chapters) {
    const subject = subjectOf(chapter)
    const first = timeline.parts.findIndex(p => p.page === chapter.page)
    const last = timeline.parts.findIndex(p => p.page === chapter.endPage)
    const endBoundary = timeline.spans.find(s => s.page === chapter.endPage && s.at === chapter.endAt)
    if (first < 0 || last < first || !subject || !source) continue
    for (let i = first; i <= last; i++) {
      const part = timeline.parts[i]
      const startSec = i === first ? seconds(chapter.at) : 0
      const endSec = Math.min(part.duration_sec, i === last && endBoundary ? seconds(chapter.endAt) : part.duration_sec)
      // An end at P5 00:00 includes P4's end, never P5 itself.
      if (endSec <= startSec) continue
      const jump = buildJump(timeline.basis, part.page, startSec, i === first ? chapter.precision : 'exact')
      if (!jump) continue
      clips.push({
        id: `${entry.id}-${chapter.index}-${part.page}`,
        game: subject,
        page: part.page, startSec, endSec, durationSec: endSec - startSec,
        startApprox: i === first && chapter.precision !== 'exact',
        endApprox: i === last && Boolean(endBoundary && endBoundary.precision !== 'exact'),
        url: jump.url, platform: jump.platform,
        manualSeek: jump.platform === 'acfun' && startSec > 0,
        // 优先分 P 自身截图；缺失时可用同场原始封面作视觉锚点。
        // 封面只用于识别这一场，不代表该截图一定取自具体游戏的时间段。
        cover: source.partDetails?.find(p => p.page === part.page)?.cover
          ?? (source.coverUnreliable ? null : source.cover ?? null)
          ?? entry.cover ?? null,
        unavailable: source.status === 'dead',
      })
    }
  }
  return clips
}

/** Slice only reviewed chapters on their own basis; alternate sources have no shared clock. */
export function recordingsForGame(
  entry: TimelineEntry,
  game: { id: string; name: string },
  timeline?: GameTimeline,
): GameRecordings {
  const clips = timeline?.entry === entry.id
    ? clipsFromChapters(entry, timeline, chaptersForGame(timeline, game.id),
      chapter => chapter.gameId ? entry.games.find(g => g.id === chapter.gameId) ?? { id: chapter.gameId, name: game.name } : null)
    : []
  return {
    clips,
    pending: clips.length === 0 && (Boolean(timeline) || visibleGameIds([...new Set([...entry.games.map(g => g.id), game.id])]).length > 1),
  }
}

/**
 * Show-page view of one session: only the reviewed independent segments tagged with this show
 * (`series` on a `break` span). No clips means the show page keeps listing the whole session
 * (no timeline, or none of its segments were tagged), so there is never a pending state.
 * These segments never count toward game time (docs/game-time.md).
 */
export function recordingsForSeries(
  entry: TimelineEntry,
  series: { id: string; name: string },
  timeline?: GameTimeline,
): GameRecordings {
  const clips = timeline?.entry === entry.id
    ? clipsFromChapters(entry, timeline, chaptersForSeries(timeline, series.id), () => series)
    : []
  return { clips, pending: false }
}

export function recordingRange(clip: Pick<GameRecording, 'page' | 'startSec' | 'endSec' | 'startApprox' | 'endApprox'>): string {
  // 从分 P 开头算起时读者就是从头看，不必写「约 00:00:00」
  return `P${clip.page} · ${clip.startApprox && clip.startSec > 0 ? '约 ' : ''}${chapterClock(clip.startSec)}–${clip.endApprox ? '约 ' : ''}${chapterClock(clip.endSec)}`
}
