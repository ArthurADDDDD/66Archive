import { buildJump, resolveSpans, type GameJump } from './game-time'
import { SPECIFIC_GAME_PARENTS } from './games'
import type { GameTimeline, TimelineSpan } from './schema'

export type GameChapter = {
  index: number
  gameId: string | null
  kind: 'game' | 'break' | 'unknown'
  page: number
  at: string
  endPage: number
  endAt: string
  durationSec: number
  verified: boolean
  precision: TimelineSpan['precision']
  jump: GameJump | null
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
  return resolveSpans(timeline).map((r,index) => {
    const next = timeline.spans[index+1]
    const last = timeline.parts[timeline.parts.length-1]
    const offset = r.span.at.split(':').reduce((n,v)=>n*60+Number(v),0)
    return { index, gameId:r.span.game ?? null, kind:r.span.game ? 'game' : r.span.kind!,
      page:r.span.page, at:r.span.at, endPage:next?.page ?? last.page, endAt:next?.at ?? chapterClock(last.duration_sec),
      durationSec:r.endSec-r.startSec, verified:Boolean(r.span.game && r.startChecked && r.endChecked && r.span.scanned),
      precision:r.span.precision, jump:buildJump(timeline.basis,r.span.page,offset,r.span.precision) }
  })
}

export function chaptersForGame(timeline: GameTimeline, gameId: string): GameChapter[] {
  return gameChapters(timeline).filter(c => c.gameId === gameId || Boolean(c.gameId && SPECIFIC_GAME_PARENTS[c.gameId] === gameId))
}

/** Global verified total counts each actual interval once, including series parents. */
export function timelineTotals(timelines: GameTimeline[]) {
  const chapters=timelines.flatMap(gameChapters)
  return {sessions:timelines.length, gameSec:chapters.filter(c=>c.kind==='game').reduce((n,c)=>n+c.durationSec,0),
    verifiedSec:chapters.filter(c=>c.verified).reduce((n,c)=>n+c.durationSec,0),
    breakSec:chapters.filter(c=>c.kind==='break').reduce((n,c)=>n+c.durationSec,0),
    unknownSec:chapters.filter(c=>c.kind==='unknown').reduce((n,c)=>n+c.durationSec,0)}
}
