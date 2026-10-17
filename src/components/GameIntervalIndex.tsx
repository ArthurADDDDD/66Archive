'use client'
import Link from 'next/link'
import { SiteText } from './SiteText'
import { useEntryFilter } from './EntryFilters'
import { chapterDuration, type GameChapter } from '@/lib/game-chapters'

export type GameIntervalSession={entry:string;date:string;title:string;coverage:string;chapters:GameChapter[]}
export function GameIntervalIndex({sessions}:{sessions:GameIntervalSession[]}) {
  const {year}=useEntryFilter()
  const visible=sessions.filter(s=>year===null || Number(s.date.slice(0,4))===year)
  if(!visible.length)return null
  return <section className="mb-10" aria-labelledby="game-intervals-title" data-testid="game-interval-index">
    <h2 id="game-intervals-title" className="text-h3 font-semibold text-ink"><SiteText id="game-intervals-title" /></h2>
    <p className="mt-2 max-w-3xl text-meta leading-relaxed text-muted"><SiteText id="game-intervals-hint" /></p>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {visible.map(s=><article key={s.entry} className="min-w-0 rounded-xl border border-line bg-surface/30 p-4 sm:p-5" data-entry={s.entry}>
        <Link prefetch={false} href={`/e/${s.entry}/#game-chapters-title`} className="text-control font-medium text-ink underline decoration-line underline-offset-4 hover:text-live"><time>{s.date}</time> · 查看整场章节 →</Link>
        <p className="mt-2 text-meta text-muted">本场该游戏约 {chapterDuration(s.chapters.reduce((n,c)=>n+c.durationSec,0))} · {s.chapters.length} 段{s.coverage!=='complete' ? ' · 现存录像下限' : ''}</p>
        <ol className="mt-3 space-y-3">
          {s.chapters.map((c,i)=><li key={c.index} className="rounded-lg border border-line/60 p-3">
            <p className="text-meta text-ink">第 {i+1} 段 · 约 {chapterDuration(c.durationSec)} · <span className={c.verified?'text-live':'text-faint'}>{c.verified?'已核实':'关联录像'}</span></p>
            <p className="mt-1 break-words font-mono text-meta text-muted">P{c.page} {c.at} → P{c.endPage} {c.endAt}</p>
            {c.jump && <a href={c.jump.url} target="_blank" rel="noopener noreferrer" className="ui-press mt-2 inline-flex min-h-11 items-center rounded-full bg-live/10 px-4 py-2 text-control text-live hover:bg-live/20" data-segment-index={c.index}>
              {c.jump.platform==='acfun' || c.precision==='part' ? `打开第 ${c.page} P` : `播放第 ${i+1} 段${c.precision==='approx'?'（约）':''}`} ↗
            </a>}
            {c.jump?.platform==='acfun' && <p className="mt-1 text-meta text-faint">打开分P后，手动定位到 {c.at}</p>}
          </li>)}
        </ol>
      </article>)}
    </div>
  </section>
}
