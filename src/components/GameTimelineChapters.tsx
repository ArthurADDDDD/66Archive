import Link from 'next/link'
import { SiteText } from './SiteText'
import { chapterDuration, type GameChapter } from '@/lib/game-chapters'

export function GameTimelineChapters({chapters, names, reviewed, coverage}: {
  chapters:GameChapter[]; names:Record<string,string>; reviewed:string; coverage:string
}) {
  return <section className="site-container px-page py-10 sm:py-14" aria-labelledby="game-chapters-title" data-testid="recording-game-chapters">
    <h2 id="game-chapters-title" className="scroll-mt-24 text-h3 font-semibold text-ink"><SiteText id="entry-game-chapters-title" /></h2>
    <p className="mt-2 max-w-3xl text-meta leading-relaxed text-muted"><SiteText id="entry-game-chapters-hint" vars={{ platform: chapters[0]?.jump?.platform === 'bilibili' ? 'B站' : 'AcFun', reviewed }} />{coverage === 'complete' ? '基准录像覆盖整场。' : '仅覆盖现存录像，时长为下限。'}同款游戏中途休息计入同一环节。</p>
    <ol className="mt-5 divide-y divide-line rounded-xl border border-line px-4 sm:px-6">
      {chapters.map(c=><li key={c.index} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-ink">{c.gameId ? <Link prefetch={false} href={`/games/${c.gameId}/`} className="underline decoration-line underline-offset-4 hover:text-live">{names[c.gameId] ?? c.gameId}</Link> : c.kind === 'break' ? (c.note ?? <SiteText id="entry-detail-game-kind-independent" />) : c.note && c.note !== '未归类片段' ? <>{c.note} · <SiteText id="entry-detail-game-kind-unclassified" /></> : <SiteText id="entry-detail-game-kind-unclassified" />}</p>
          <p className="mt-1 font-mono text-meta text-muted">P{c.page} {c.at} → P{c.endPage} {c.endAt}</p>
          <p className="mt-1 text-meta text-faint">约 {chapterDuration(c.durationSec)} · {c.kind === 'game'
            ? (c.verified ? '已核实游戏环节' : '关联录像，内部或边界尚未全部核实')
            : c.kind === 'unknown'
              ? <SiteText id="entry-detail-game-unknown-note" />
              : <SiteText id="entry-detail-game-break-note" />}</p>
        </div>
        {c.jump && <a href={c.jump.url} target="_blank" rel="noopener noreferrer" className="ui-press inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-live/40 px-4 py-2 text-control text-live hover:bg-live/10" data-chapter-index={c.index}>
          {c.jump.platform === 'acfun' || c.precision === 'part' ? `从第 ${c.page} P 看` : `从${c.precision === 'approx' ? '约 ' : ''}${c.at} 看`} ↗
        </a>}
      </li>)}
    </ol>
    {chapters.some(c=>c.jump?.platform==='acfun') && <p className="mt-3 text-meta text-faint"><SiteText id="entry-game-chapters-acfun-hint" /></p>}
  </section>
}
