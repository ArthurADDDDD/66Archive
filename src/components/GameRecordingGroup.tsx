'use client'

import Link from 'next/link'
import type { TimelineEntry } from '@/lib/data'
import { chapterClock, chapterDuration } from '@/lib/game-chapters'
import { recordingRange, type GameRecordings } from '@/lib/game-recordings'
import { PLATFORM_META } from '@/lib/platforms'
import { gameColor } from '@/lib/ui'
import { ResponsiveCover } from './ResponsiveCover'
import { useSiteTexts } from './LiveContentProvider'

/**
 * 读者文字 id。游戏页（`game-` 前缀）与节目页（`series-` 前缀）各自登记，跟着各自页面的烤入走；
 * 必须写成字面量，test:site-texts 才认得出用到了哪些。
 * 没有 `unscoped` 的一套（节目页）没有「整场兜底」：该场没有分段就不会用这个组件。
 */
export const RECORDING_TEXTS = {
  game: {
    count: 'game-rec-count', whole: 'game-rec-whole', archive: 'game-rec-archive', manualSeek: 'game-rec-manual-seek',
    open: 'game-rec-open', play: 'game-rec-play', dead: 'game-rec-dead', ariaPlay: 'game-rec-aria-play', ariaOpen: 'game-rec-aria-open',
    unscoped: 'game-rec-unscoped', source: 'game-rec-source', sourceDead: 'game-rec-source-dead', noSource: 'game-rec-no-source',
  },
  series: {
    count: 'series-rec-count', archive: 'series-rec-archive', manualSeek: 'series-rec-manual-seek',
    open: 'series-rec-open', play: 'series-rec-play', dead: 'series-rec-dead', ariaPlay: 'series-rec-aria-play', ariaOpen: 'series-rec-aria-open',
  },
} as const
export type RecordingTexts = { [K in keyof typeof RECORDING_TEXTS.game]?: string } & { [K in keyof typeof RECORDING_TEXTS.series]: string }

/** 一组分段卡片（网格 / 列表两种版式），游戏页与节目页共用。 */
export function RecordingClips({ entry, clips, grid, texts }: {
  entry: Pick<TimelineEntry, 'date'>
  clips: GameRecordings['clips']
  grid: boolean
  texts: RecordingTexts
}) {
  const t = useSiteTexts()
  return (
    <div className={grid ? 'grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-4' : 'space-y-3'}>
      {clips.map(clip => (
        <div key={clip.id} className={`overflow-hidden rounded-xl border border-line/80 bg-surface/35 ${grid ? '' : 'flex items-center gap-4 p-3'}`}>
          {grid && (
            <div className="relative aspect-video overflow-hidden bg-raised">
              {clip.cover ? (
                <ResponsiveCover src={clip.cover} widths={[320, 640]} sizes="(min-width: 640px) 296px, 92vw" alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-h3 text-ink/80" style={{ background: `${gameColor(clip.game.id)}18` }}>{clip.game.name}</div>
              )}
              <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-0.5 text-meta text-white">{chapterDuration(clip.durationSec)}</span>
            </div>
          )}
          <div className={`min-w-0 flex-1 ${grid ? 'p-4' : ''}`}>
            <p className="flex items-center gap-1.5 text-control text-ink"><span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: gameColor(clip.game.id) }} />{clip.game.name}</p>
            <p className="mt-1 font-mono text-meta text-muted tnum">{recordingRange(clip)}</p>
            <p className="mt-1 text-meta text-faint">{PLATFORM_META[clip.platform].name}{!grid ? ` · ${chapterDuration(clip.durationSec)}` : ''}</p>
            {clip.manualSeek && <p className="mt-1 text-meta text-muted">{t(texts.manualSeek, { time: chapterClock(clip.startSec) })}</p>}
            <a href={clip.url} target="_blank" rel="noopener noreferrer"
              aria-label={[clip.game.name, entry.date, recordingRange(clip), clip.manualSeek ? t(texts.ariaOpen) : t(texts.ariaPlay)].join(' ')}
              className="ui-press mt-3 inline-block rounded-full border border-live/40 px-3 py-1.5 text-meta text-live hover:bg-live/10">
              {clip.unavailable ? t(texts.dead) : clip.manualSeek ? t(texts.open) : t(texts.play)}
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Both layouts render the same scoped cards, without changing full archive entries. */
export function GameRecordingGroup({ entry, recordings, game, grid, expanded, onToggle, texts = RECORDING_TEXTS.game }: {
  entry: TimelineEntry
  recordings: GameRecordings
  game: { id: string; name: string }
  grid: boolean
  expanded: boolean
  onToggle: () => void
  texts?: RecordingTexts
}) {
  const t = useSiteTexts()
  const { clips } = recordings
  // 没有分段、也没有兜底文字的那一套（节目页）：这一场本来就不该走到这里。
  if (!clips.length && !texts.unscoped) return null
  return (
    <article id={`entry-${entry.id}`} className="entry-landing-row scroll-mt-24 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`game-recordings-${entry.id}`}
          className="ui-press flex min-w-0 items-center gap-3 rounded-lg py-2 text-left text-control text-ink">
          <span className="font-mono text-meta tnum">{entry.date}{entry.time ? ` ${entry.time}` : ''}</span>
          <span className="text-meta text-muted">{clips.length ? t(texts.count, { count: clips.length }) : texts.whole ? t(texts.whole) : null}</span>
          <span aria-hidden className="text-live">{expanded ? '−' : '+'}</span>
        </button>
        <Link prefetch={false} href={`/e/${entry.id}/`} className="ui-press rounded-sm text-meta text-faint hover:text-live">{t(texts.archive)}</Link>
      </div>
      {expanded && (
        <div id={`game-recordings-${entry.id}`} className="ui-panel-in mt-3">
          {clips.length ? (
            <RecordingClips entry={entry} clips={clips} grid={grid} texts={texts} />
          ) : (
            <div className="rounded-xl border border-line/80 bg-surface/35 p-4">
              <p className="text-control text-ink"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-sm" style={{ background: gameColor(game.id) }} />{game.name}</p>
              <p className="mt-2 text-meta text-muted">{texts.unscoped ? t(texts.unscoped) : null}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {entry.sources.map((source, index) => (
                  <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noopener noreferrer" className="ui-press rounded-full border border-line px-3 py-1.5 text-meta text-live">
                    {t((source.status === 'dead' ? texts.sourceDead : texts.source) ?? '', { index: entry.sources.length > 1 ? index + 1 : '' }).replace(/\s{2,}/g, ' ').trim()}
                  </a>
                ))}
                {entry.sources.length === 0 && <p className="text-meta text-faint">{texts.noSource ? t(texts.noSource) : null}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
