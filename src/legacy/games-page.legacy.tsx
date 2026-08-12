import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { GamesGrid } from './GamesGrid.legacy'
import { getDataset } from '@/lib/data'
import { buildGameStats } from '@/lib/game-stats'
import { gameColor } from '@/lib/ui'

export default function GamesPage() {
  const ds = getDataset()
  const all = buildGameStats(ds)
  const played = all.filter((g) => g.sessionCount > 0)
  const pending = all.filter((g) => g.sessionCount === 0)

  return (
    <main className="ui-page-in min-h-screen overflow-hidden">
      <header className="ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center px-4 py-5 sm:px-6">
        <SiteNav active="games" />
      </header>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-12 pt-14 sm:px-6 sm:pt-20">
        <div className="pointer-events-none absolute -right-20 -top-32 h-[420px] w-[420px] rounded-full bg-live/10 blur-[110px]" />
        <div className="ui-reveal relative max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-live">Games · What she played</p>
          <h1 className="mt-4 text-[42px] font-semibold leading-[1.08] tracking-tight sm:text-[64px]">她打过的游戏。</h1>
          <p className="mt-6 max-w-2xl text-[14px] leading-8 text-muted">
            按游戏聚合的出场记录，每张卡片背后是若干场直播 / 视频的合集。游戏标签目前覆盖率不高，这里只呈现已经确认关联的部分——没被打上标签的场次仍在编年史里，只是还没接进这张索引。
          </p>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-3 border-y border-line py-4 font-mono text-[10px] text-faint">
          <div>
            <span className="block font-display text-2xl font-bold text-ink">{played.length}</span>
            <span className="mt-1 block">已出场游戏</span>
          </div>
          <div>
            <span className="block font-display text-2xl font-bold text-ink">
              {played.reduce((n, g) => n + g.sessionCount, 0)}
            </span>
            <span className="mt-1 block">已关联场次</span>
          </div>
          <div>
            <span className="block font-display text-2xl font-bold text-ink">{pending.length}</span>
            <span className="mt-1 block">登记待补录</span>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
        <GamesGrid games={played} />
      </section>

      {pending.length > 0 && (
        <section className="relative mx-auto max-w-[1240px] px-4 pb-24 sm:px-6">
          <div className="ui-card rounded-2xl border border-dashed border-line bg-surface/25 p-5 sm:p-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Registered, not yet linked</p>
            <h2 className="mt-3 text-[20px] font-medium tracking-tight text-ink">已登记游戏库，还没关联到具体场次。</h2>
            <p className="mt-3 max-w-2xl text-[13px] leading-7 text-muted">
              这些游戏已经录入 <code className="rounded-sm bg-raised px-1 py-0.5 font-mono text-[11px]">games.yaml</code>，等采集侧把对应场次打上标签后会自动出现在上面的网格里。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {pending.map((g) => (
                <span key={g.id} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-mono text-[10px] text-faint">
                  <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: gameColor(g.id) }} />
                  {g.name}
                </span>
              ))}
            </div>
            <Link href="/contact/" className="ui-press mt-6 inline-block rounded-sm font-mono text-[11px] text-live underline underline-offset-4">
              提供关联线索 →
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
