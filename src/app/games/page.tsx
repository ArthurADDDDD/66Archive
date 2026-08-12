import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { GamesLibrary, type LibraryGame } from '@/components/GamesLibrary'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { CURATED_GAMES, getGameProfile } from '@/lib/narrative'

/**
 * 游戏收藏架（v2 设计）：封面墙 + 「她的游戏库」页头。
 * 封面是首播那天的直播截图（face）；默认按「最近玩过」排，往下滚封面年代往回退。
 * 覆盖 games.yaml 已登记 + 策展游戏；只展示有场次的游戏（v2 口径），
 * 游戏字段的补录进度如实说明——覆盖率是派生值，不是口号。
 */
export default function GamesPage() {
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)

  const ids = [...ds.games.keys(), ...Object.keys(CURATED_GAMES)]
  const profiles = ids
    .map((id) => getGameProfile(ds, timeline, id))
    .filter((p): p is NonNullable<typeof p> => p !== null)

  const played = profiles.filter((p) => p.sessions > 0)
  const onceOnly = played.filter((p) => p.sessions === 1).length
  const longest = [...played].sort((a, b) => b.spanDays - a.spanDays)[0]

  const library: LibraryGame[] = played.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: p.aliases,
    face: p.face,
    sessions: p.sessions,
    totalMinutes: p.totalMinutes,
    knownDurationCount: p.knownDurationCount,
    firstDate: p.firstDate,
    lastDate: p.lastDate,
    comebackDays: p.comebackDays,
  }))

  const withGames = timeline.filter((e) => e.games.length > 0).length
  const coverage = timeline.length ? Math.round((withGames / timeline.length) * 100) : 0

  return (
    <main className="ui-page-in min-h-screen">
      <header className="ui-slide-down mx-auto flex max-w-[1400px] items-center justify-between px-4 py-5 sm:px-6">
        <SiteNav active="games" />
        <Link href="/chronicle/" className="ui-press hidden rounded-sm font-mono text-[11px] text-live underline-offset-4 hover:underline sm:block">
          打开全部 {timeline.length.toLocaleString()} 条记录 →
        </Link>
      </header>

      <section className="mx-auto max-w-[1400px] px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">她的游戏库</h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-8 text-muted">
          {played.length} 个游戏，其中 {onceOnly} 个只播过一次。
          <br />
          每个游戏的封面，是她第一次播它那天的直播截图——不是商店页的宣传图。
          {longest?.firstDate && longest?.lastDate && (
            <>
              {' '}
              跨得最长的一个是《{longest.name}》，从 {longest.firstDate} 到 {longest.lastDate}，
              {longest.spanDays.toLocaleString()} 天。
            </>
          )}
        </p>
        <p className="mt-3 font-mono text-[10px] leading-5 text-faint/70">
          ⓘ 条目的游戏字段仍在补录中（目前标记率约 {coverage}%）；这里只收录已标记的场次，补录后会自动出现。
        </p>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6">
        <GamesLibrary games={library} />
      </section>

      <footer className="mx-auto flex max-w-[1400px] flex-col justify-between gap-4 px-4 py-10 font-mono text-[10px] text-faint sm:flex-row sm:px-6">
        <span>只索引，不搬运 · 所有播放回到原平台</span>
        <Link href="/contact/" className="ui-press rounded-sm transition-colors hover:text-live">资料纠错与联系 →</Link>
      </footer>
    </main>
  )
}
