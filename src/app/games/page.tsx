import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { GamesLibrary } from '@/components/GamesLibrary'
import { getDataset } from '@/lib/data'
import { buildGameStats } from '@/lib/game-stats'
import { toGameCard } from '@/lib/game-stats-format'

export default function GamesPage() {
  const ds = getDataset()
  const all = buildGameStats(ds)
  const played = all.filter((g) => g.sessionCount > 0)
  const pending = all.filter((g) => g.sessionCount === 0)
  const onceOnly = played.filter((g) => g.sessionCount === 1).length
  const longest = [...played].sort((a, b) => b.spanDays - a.spanDays)[0]

  return (
    <main className="ui-page-in min-h-screen">
      <header className="ui-slide-down mx-auto flex max-w-[1400px] items-center px-4 py-5 sm:px-6">
        <SiteNav active="games" />
      </header>

      <section className="mx-auto max-w-[1400px] px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">她的游戏库</h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-8 text-muted">
          {played.length} 个游戏，其中 {onceOnly} 个只播过一次。
          <br />
          每个游戏的封面，是她第一次播它那天的直播截图——不是商店页的宣传图。
          {longest?.first && longest?.last && (
            <>
              {' '}
              跨得最长的一个是《{longest.name}》，从 {longest.firstDate} 到 {longest.lastDate}，
              {longest.spanDays.toLocaleString()} 天。
            </>
          )}
        </p>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6">
        <GamesLibrary games={played.map(toGameCard)} />
      </section>

      {pending.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6">
          <div className="border-t border-line pt-6">
            <h2 className="text-[14px] text-muted">已登记，但还没有场次打上对应标签。</h2>
            <p className="mt-2 max-w-2xl text-[12px] leading-6 text-faint">
              这些游戏已经录入 <code className="font-mono">games.yaml</code>，
              等采集侧把对应场次打上标签后会自动出现在上面的库里。
            </p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
              {pending.map((g) => (
                <span key={g.id} className="font-mono text-[11px] text-faint">
                  {g.name}
                </span>
              ))}
            </div>
            <Link href="/contact/" className="ui-press mt-5 inline-block rounded-sm font-mono text-[11px] text-live underline underline-offset-4">
              提供关联线索 →
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
