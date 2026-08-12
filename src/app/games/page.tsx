import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { GameShelf, type GameCardData } from '@/components/GameShelf'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { CURATED_GAMES, getGameProfile } from '@/lib/narrative'

/**
 * 游戏收藏架：封面优先的瓦片墙，搜索 / 排序 / 空游戏开关在客户端。
 * 覆盖 games.yaml 全部已登记游戏 + 策展游戏（CURATED_GAMES）。
 * 游戏字段的补录进度如实说明——覆盖率是派生值，不是口号。
 */
export default function GamesPage() {
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)

  const ids = [...ds.games.keys(), ...Object.keys(CURATED_GAMES)]
  const profiles = ids
    .map((id) => getGameProfile(ds, timeline, id))
    .filter((p): p is NonNullable<typeof p> => p !== null)

  const shelf: GameCardData[] = profiles.map((p) => ({
    id: p.id,
    name: p.name,
    cover: p.cover,
    sessions: p.sessions,
    totalMinutes: p.totalMinutes,
    hoursLabel: p.hoursLabel,
    firstDate: p.firstDate,
    lastDate: p.lastDate,
    curated: Boolean(p.curated),
  }))

  const withGames = timeline.filter((e) => e.games.length > 0).length
  const coverage = timeline.length ? Math.round((withGames / timeline.length) * 100) : 0

  return (
    <main className="ui-page-in min-h-screen overflow-hidden">
      <header className="ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center justify-between px-4 py-5 sm:px-6">
        <SiteNav active="games" />
        <Link href="/chronicle/" className="ui-press hidden rounded-sm font-mono text-[11px] text-live underline-offset-4 hover:underline sm:block">
          打开全部 {timeline.length.toLocaleString()} 条记录 →
        </Link>
      </header>

      <section className="mx-auto max-w-[1240px] px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-video">Games · 游戏收藏架</p>
        <h1 className="mt-3 max-w-2xl text-[32px] font-semibold leading-tight tracking-tight sm:text-[46px]">
          和女流一起玩过的游戏
        </h1>
        <p className="mt-4 max-w-xl text-[13px] leading-7 text-muted">
          封面的优先级高于一切——先记住画面，再看数据。
          每一格都可以点进去，看这款游戏和女流之间发生过什么。
        </p>
        <p className="mt-3 font-mono text-[10px] leading-5 text-faint/70">
          ⓘ 条目的游戏字段仍在补录中（目前标记率约 {coverage}%）；这里的场次只统计已标记的部分，补录后会自动出现。
        </p>

        <div className="mt-10">
          <GameShelf profiles={shelf} />
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1240px] flex-col justify-between gap-4 px-4 py-10 font-mono text-[10px] text-faint sm:flex-row sm:px-6">
        <span>只索引，不搬运 · 所有播放回到原平台</span>
        <Link href="/contact/" className="ui-press rounded-sm transition-colors hover:text-live">资料纠错与联系 →</Link>
      </footer>
    </main>
  )
}
