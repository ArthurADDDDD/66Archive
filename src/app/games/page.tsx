import { fetchBakedPageCopy } from '@/lib/baked-content'
import { LiveCopySeed } from '@/components/LiveCopySeed'
import { SiteText } from '@/components/SiteText'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/page-metadata'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { GamesLibrary } from '@/components/GamesLibrary'
import { SiteFooter } from '@/components/primitives'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { LIBRARY_COLUMNS, type LibraryColumns, type LibraryGame } from '@/lib/games'
import { allGameIds, getGameProfile } from '@/lib/narrative'
import { LivePageHeading } from '@/components/LiveSection'

/** 标题、简介、canonical 与社交卡片都由 `pageMetadata()` 一次给齐（见该文件注释）。 */
export const metadata: Metadata = pageMetadata({
  path: '/games/',
  title: '游戏厅',
  description: '她玩过的每一款游戏：第一次是哪天，后来又回来过几次。',
})

/**
 * 游戏收藏架（v2 设计）：封面墙 + 「她的游戏库」页头。
 * 封面优先是首播那天的直播截图（face）；默认按「从新到旧」排，游戏列表按页展示。
 * 覆盖 games.yaml 已登记 + 策展游戏；只展示有场次的游戏（v2 口径），
 * 游戏字段的补录进度如实说明——覆盖率是派生值，不是口号。
 */
export default async function GamesPage() {
  // 根 layout 只烤 {site, nav}（见 baked-content.ts 的 fetchBakedNavShell）。
  // 这一页真的会渲染后台文案，所以在这里把它需要的那份补回来。
  const bakedCopy = await fetchBakedPageCopy(['games'], { texts: ['games-'] })

  const ds = getDataset()
  const timeline = toTimelineEntries(ds)

  const profiles = allGameIds(ds)
    .map((id) => getGameProfile(ds, timeline, id))
    .filter((p): p is NonNullable<typeof p> => p !== null)

  const played = profiles.filter((p) => p.sessions > 0)
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

  // 列存转置：搜索和排序仍然跑在全部 745 个游戏上，只是换个形状过 RSC 载荷。
  // 理由与还原方式见 lib/games.ts 里 LIBRARY_COLUMNS 上方的说明。
  const libraryColumns = LIBRARY_COLUMNS.map((key) => library.map((game) => game[key])) as LibraryColumns

  return (
    <LiveCopySeed copy={bakedCopy}>
      <main className="ui-page-in min-h-screen">
        <MobileQuickNav active="games" />
        <BackToTop />
        <header className="ui-slide-down site-header-container flex items-center justify-between px-page py-5">
          <SiteNav active="games" />
          <Link href="/archive/" prefetch={false} className="ui-press hidden whitespace-nowrap rounded-sm text-meta text-live tnum lg:block">
            <SiteText id="games-archive-link" />
          </Link>
        </header>

        <section className="site-container-wide px-page pb-8 pt-10 sm:pt-14">
          <LivePageHeading pageId="games" titleClassName="text-h1 font-semibold" />
          <p className="measure-body mt-5 text-body text-muted">
            {/* 日期一律包成不换行：`2010-07-11` 里的连字符是浏览器的断行点，
                正文折到这里会把日期折成「2010-」+「07-11」两行。 */}
            {/* 「档案收录至 <日期>」是补档进度，读者用不上；跨度那句是真事实，留着。 */}
            <SiteText id="games-summary" vars={{ count: played.length }} />
            {longest?.firstDate && longest?.lastDate && (
              <>
                {' '}
                <SiteText
                  id="games-summary-longest"
                  vars={{
                    name: longest.name,
                    from: <span className="whitespace-nowrap tnum">{longest.firstDate}</span>,
                    to: <span className="whitespace-nowrap tnum">{longest.lastDate}</span>,
                    days: longest.spanDays.toLocaleString(),
                  }}
                />
              </>
            )}
          </p>
        </section>

        <section className="site-container-wide px-page pb-20">
          <GamesLibrary columns={libraryColumns} />
        </section>

        <SiteFooter />
      </main>
    </LiveCopySeed>
  )
}
