import { buildJump, gameSessionSpans, type GameJump } from './game-time'
import { SPECIFIC_GAME_PARENTS } from './games'
import type { GameTimeline, TimelineSpan } from './schema'

export type GameChapter = {
  index: number
  gameId: string | null
  kind: 'game' | 'break' | 'unknown'
  /** 仅 kind: break 可带：这一段属于哪个节目（series.yaml id）。 */
  series?: string
  page: number
  at: string
  endPage: number
  endAt: string
  durationSec: number
  verified: boolean
  /** 合并环节中原有证据支持的已核实秒数，休息不会自动升级。 */
  verifiedSec: number
  precision: TimelineSpan['precision']
  jump: GameJump | null
  /** 公开短标签：聊天 / 休息 / 切换 / 未归类片段。 */
  note?: string
}

export function chapterClock(seconds: number): string {
  const n = Math.max(0, Math.round(seconds))
  return `${String(Math.floor(n / 3600)).padStart(2,'0')}:${String(Math.floor(n % 3600 / 60)).padStart(2,'0')}:${String(n % 60).padStart(2,'0')}`
}

export function chapterDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return minutes >= 60 ? `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}` : `${minutes} 分钟`
}

export function gameChapters(timeline: GameTimeline): GameChapter[] {
  return gameSessionSpans(timeline).map((r,index) => {
    const next = timeline.spans[r.sourceIndexes[r.sourceIndexes.length - 1] + 1]
    const last = timeline.parts[timeline.parts.length-1]
    const offset = r.span.at.split(':').reduce((n,v)=>n*60+Number(v),0)
    return { index, gameId:r.span.game ?? null, kind:r.span.game ? 'game' : r.span.kind!,
      page:r.span.page, at:r.span.at, endPage:next?.page ?? last.page, endAt:next?.at ?? chapterClock(last.duration_sec),
      durationSec:r.endSec-r.startSec, verified:Boolean(r.span.game && Math.abs(r.verifiedSec - (r.endSec-r.startSec)) < 1e-6), verifiedSec:r.verifiedSec,
      ...(r.span.series ? {series:r.span.series} : {}),
      precision:r.span.precision, jump:buildJump(timeline.basis,r.span.page,offset,r.span.precision), note:r.span.note }
  })
}

export function chaptersForGame(timeline: GameTimeline, gameId: string): GameChapter[] {
  return gameChapters(timeline).filter(c => c.gameId === gameId || Boolean(c.gameId && SPECIFIC_GAME_PARENTS[c.gameId] === gameId))
}

/** Reviewed independent segments that belong to one show; they never count as game time. */
export function chaptersForSeries(timeline: GameTimeline, seriesId: string): GameChapter[] {
  return gameChapters(timeline).filter(c => c.kind === 'break' && c.series === seriesId)
}

/** Global verified total counts each actual interval once, including series parents. */
export function timelineTotals(timelines: GameTimeline[]) {
  const chapters=timelines.flatMap(gameChapters)
  return {sessions:timelines.length, gameSec:chapters.filter(c=>c.kind==='game').reduce((n,c)=>n+c.durationSec,0),
    verifiedSec:chapters.reduce((n,c)=>n+c.verifiedSec,0),
    breakSec:chapters.filter(c=>c.kind==='break').reduce((n,c)=>n+c.durationSec,0),
    unknownSec:chapters.filter(c=>c.kind==='unknown').reduce((n,c)=>n+c.durationSec,0)}
}
