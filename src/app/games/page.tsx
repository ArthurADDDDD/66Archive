import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { GamesLibrary, type LibraryGame } from '@/components/GamesLibrary'
import { SiteFooter } from '@/components/primitives'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { allGameIds, getGameProfile } from '@/lib/narrative'
import { LivePageHeading } from '@/components/LiveSection'

/**
 * 游戏收藏架（v2 设计）：封面墙 + 「她的游戏库」页头。
 * 封面优先是首播那天的直播截图（face）；默认按「从新到旧」排，游戏列表按页展示。
 * 覆盖 games.yaml 已登记 + 策展游戏；只展示有场次的游戏（v2 口径），
 * 游戏字段的补录进度如实说明——覆盖率是派生值，不是口号。
 */
export default function GamesPage() {
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)

  const profiles = allGameIds(ds)
    .map((id) => getGameProfile(ds, timeline, id))
    .filter((p): p is NonNullable<typeof p> => p !== null)

  const played = profiles.filter((p) => p.sessions > 0)
  const longest = [...played].sort((a, b) => b.spanDays - a.spanDays)[0]
  const latestArchiveDate = timeline.reduce<string | null>(
    (latest, entry) => (!latest || entry.date > latest ? entry.date : latest),
    null,
  )

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

  return (
    <main className="ui-page-in min-h-screen">
      <MobileQuickNav active="games" />
      <BackToTop />
      <header className="ui-slide-down site-header-container flex items-center justify-between px-page py-5">
        <SiteNav active="games" />
        <Link href="/archive/" prefetch={false} className="ui-press hidden whitespace-nowrap rounded-sm text-meta text-live tnum lg:block">
          打开全部 {timeline.length.toLocaleString()} 条记录 →
        </Link>
      </header>

      <section className="site-container-wide px-page pb-8 pt-10 sm:pt-14">
        <LivePageHeading pageId="games" titleClassName="text-h1 font-semibold" />
        <p className="measure-body mt-5 text-body text-muted">
          {played.length} 个游戏，档案收录至 {latestArchiveDate ?? '待补录'}。
          {longest?.firstDate && longest?.lastDate && (
            <>
              {' '}跨得最长的是《{longest.name}》，从 {longest.firstDate} 到 {longest.lastDate}，
              {longest.spanDays.toLocaleString()} 天。
            </>
          )}
        </p>
      </section>

      <section className="site-container-wide px-page pb-20">
        <GamesLibrary games={library} />
      </section>

      <SiteFooter />
    </main>
  )
}
