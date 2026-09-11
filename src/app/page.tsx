import { LiveCopySeed } from '@/components/LiveCopySeed'
import { SiteText } from '@/components/SiteText'
import type { Metadata } from 'next'
import { pageMetadata, SITE_DESCRIPTION } from '@/lib/page-metadata'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { HomeHero } from '@/components/HomeHero'
import { ResumeStrip } from '@/components/Trail'
import { HomeActRail, type HomeActRailItem, type HomeSectionRailItem } from '@/components/HomeActRail'
import { TimelineProgress } from '@/components/TimelineProgress'
import { HomeActStage } from '@/components/HomeActStage'
import type { ExplorePromoData } from '@/components/HomeExplorePromo'
import { HighlightStrip } from '@/components/HighlightStrip'
import { LiveNarrativeSeed } from '@/components/LiveNarrativeSeed'
import { fetchBakedContent, fetchBakedHomeNarrative, pickTexts } from '@/lib/baked-content'
import { HomeStats } from '@/components/HomeStats'
import { GameCard } from '@/components/GameCard'
import type { GameCardData } from '@/lib/games'
import { RandomMemory, type MemoryCandidate } from '@/components/RandomMemory'
import { TodayInHistoryList, type TodayHistoryRow } from '@/components/TodayInHistoryList'
import { Eyebrow, SiteFooter } from '@/components/primitives'
import { LiveRooms, LiveSectionGate, LiveSectionHeading } from '@/components/LiveSection'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { allGameIds, getGameProfile, resolveHomepage } from '@/lib/narrative'
import { getGalleryCollections } from '@/lib/gallery-photos-manifest'

/** 首页不覆盖标题（保持站名本身），只补 canonical 与社交卡片。 */
export const metadata: Metadata = pageMetadata({
  path: '/',
  description: SITE_DESCRIPTION,
})

/**
 * 首页 = 三幕 + 幕间 + 高光 + 记忆（随机一晚 / 历史上的今天）+ 游戏预告 + 四个房间入口。
 * 第一屏只有人，没有数字（数字在第二屏「这一切加起来」）；
 * 一切计数来自 resolveHomepage 的构建期派生，文案不硬编码数字。
 * 「历史上的今天」以构建日期为准（静态站约束），同月同日、一年一条。
 */
export default async function HomePage() {
  // 根 layout 只烤 {site, nav}（见 baked-content.ts 的 fetchBakedNavShell）。
  // 这一页真的会渲染后台文案，所以在这里把它需要的那份补回来。
  // 页面文字只带首页用得到的那几组（全站通用的 `site-` 由 pickTexts 自己带上）。
  const { copy: bakedFullCopy, editorial: bakedEditorial } = await fetchBakedContent()
  const bakedCopy = bakedFullCopy ? { ...bakedFullCopy, texts: pickTexts(bakedFullCopy, ['home-', 'trail-', 'form-']) } : null

  // 首页渲染的是三幕与高光，不碰编年史那份 storyActs——所以只烤这一半。
  // 其余页面由根 layout 烤入的站点文案与板块编排即可，详见 lib/baked-content.ts。
  const bakedNarrative = await fetchBakedHomeNarrative()
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)
  const data = resolveHomepage(ds, timeline)

  // 随机记忆池：有封面 / 有游戏 / 有栏目 的条目才配进入（宁缺毋滥）。
  // 全时间线等距抽样——不偏向任何时期，构建期确定，无随机数。
  //
  // 抽 60 条而不是 400：这个池整份要序列化进首页的 RSC 载荷，而卡片一次只显示一条。
  // 实测 400 条占首页 flight 的 23.5%（27,042 / 114,871 字符），其中 380 条在渲染出来的
  // DOM 里一次都没出现过；收到 60 条后首页 HTML 少 7,130 B、`index.txt` 少 6,880 B（brotli）。
  // 代价是「随便回到一个晚上」的不同结果从 400 种降到 60 种——按钮可以反复点，
  // 60 种对一个随机入口足够，为剩下 340 种付这份带宽不划算。
  // 文案里的总数由下面的 `total` 单独给，仍然是全部符合条件的条目数。
  const meaningful = timeline.filter((e) => e.cover || e.games.length > 0 || e.seriesName)
  const step = Math.max(1, Math.ceil(meaningful.length / 60))
  const memoryPool: MemoryCandidate[] = meaningful
    .filter((_, i) => i % step === 0)
    .map((e) => ({ id: e.id, date: e.date, title: e.title }))

  // 历史上的今天：与构建日「同月同日」的记录，一年一条，从最早的一年数到去年。
  // 不做 ±N 天的模糊匹配——那一年的这天没有录像，就该留个空，空也是记录。
  const today = new Date()
  const todayMd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const currentYear = today.getFullYear()

  const sameDay = new Map<number, (typeof timeline)[number][]>()
  for (const e of timeline) {
    if (e.date.slice(5) !== todayMd) continue
    const y = Number(e.date.slice(0, 4))
    // 今年不算——「历史上的今天」看的是过去
    if (!y || y >= currentYear) continue
    sameDay.set(y, [...(sameDay.get(y) ?? []), e])
  }

  const firstYear = timeline.reduce((min, e) => {
    const y = Number(e.date.slice(0, 4))
    return y && y < min ? y : min
  }, currentYear)

  const todayRows: TodayHistoryRow[] = []
  for (let year = firstYear; year < currentYear; year += 1) {
    const found = sameDay.get(year) ?? []
    // 同一天有多条时，优先挑有画面/有游戏的那条，再按开播时间取最早的
    const picked = [...found].sort((a, b) => {
      const rich = (e: (typeof timeline)[number]) => (e.cover || e.games.length > 0 ? 0 : 1)
      return rich(a) - rich(b) || (a.time ?? '').localeCompare(b.time ?? '')
    })[0]
    todayRows.push({
      year,
      yearsAgo: currentYear - year,
      item: picked
        ? {
            id: picked.id,
            date: picked.date,
            title: picked.title,
            games: picked.games.map((g) => g.name),
            extra: found.length - 1,
          }
        : null,
    })
  }

  // 游戏预告：有场次的游戏按时长取前 8
  const gamePreview: GameCardData[] = allGameIds(ds)
    .map((id) => getGameProfile(ds, timeline, id))
    .filter((p): p is NonNullable<typeof p> => p !== null && p.sessions > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 8)
    .map((p) => ({
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

  const actI = data.acts.find((a) => a.act.id === 'act-i')!
  const actII = data.acts.find((a) => a.act.id === 'act-ii')!
  const actIII = data.acts.find((a) => a.act.id === 'act-iii')!
  const homeActRail: HomeActRailItem[] = [actI, actII, actIII].map(({ act, beats }) => ({
    id: act.id,
    label: act.kicker,
    years: act.years,
    color: act.color,
    beats: beats.map((beat) => ({ id: beat.id, date: beat.date, title: beat.title })),
    closer: act.closer?.line,
  }))
  // 三幕讲完之后的去处：编年史（按条读）与画廊（按年看）。
  // 预览用的是真数据——缩略图取自纪念版的等距抽样，不挑“好看的那几张”。
  const gallery = getGalleryCollections()
  const galleryYears = [...new Set(gallery.all.map((p) => p.year).filter((y): y is string => y !== null))].sort()
  const thumbStep = Math.max(1, Math.floor(gallery.featured.length / 8))
  const explorePromo: ExplorePromoData = {
    chronicle: {
      acts: [actI, actII, actIII].map(({ act }) => ({ id: act.id, years: act.years, color: act.color })),
      entries: data.totals.entries,
      years: data.totals.years,
    },
    gallery: {
      thumbs: gallery.featured.filter((_, i) => i % thumbStep === 0).slice(0, 8).map((p) => ({ id: p.id, src: p.thumb })),
      featured: gallery.featured.length,
      total: gallery.all.length,
      span: galleryYears.length > 1 ? `${galleryYears[0]}–${galleryYears[galleryYears.length - 1]}` : galleryYears[0] ?? null,
    },
  }

  const homeSections: HomeSectionRailItem[] = [
    { id: 'home-top', label: '首页', meta: 'START', color: '#E6E4EF' },
    { id: 'home-highlights', label: '一些记得住的时刻', meta: 'LIVE MEMES', color: '#5BC8E8' },
    { id: 'home-memory', label: '回到过去，只需要一晚', meta: 'MEMORY', color: '#A78BFA' },
    ...(gamePreview.length > 0 ? [{ id: 'home-games', label: '陪得最久的几款', meta: 'GAMES', color: '#E0A244' }] : []),
    { id: 'home-rooms', label: '四个房间', meta: 'ROOMS', color: '#FF6B75' },
    { id: 'home-stats', label: '这一切加起来', meta: 'TOTALS', color: '#E5568A' },
  ]

  return (
    <LiveCopySeed copy={bakedCopy} editorial={bakedEditorial}>
      <LiveNarrativeSeed narrative={bakedNarrative}>
        <HomeActRail acts={homeActRail} sections={homeSections} />
        <main className="ui-page-in flex min-h-screen flex-col overflow-x-clip">
        <MobileQuickNav active="home" />
        <BackToTop />
        <TimelineProgress />

        <div className="flex flex-col lg:min-h-[100svh]">
          <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
            <SiteNav active="home" />
            <Link
              href="/archive/"
              prefetch={false}
              className="ui-press hidden whitespace-nowrap rounded-sm text-meta tnum text-live lg:block"
            >
              <SiteText id="home-search-link" />
            </Link>
          </header>

          {/*
            回来的人会看到「接着上次」。浮层，不进文档流——第一次来的人
            什么都不会看到，首屏保持干净。
          */}
          <ResumeStrip />

          {/* 第一屏：人物，不是数据。PC 端连同导航占满一整个视口，不提前露出 ACT I。 */}
          <HomeHero nowYear={data.now.year} historyYears={data.totals.years} />
        </div>

        {/* 三幕在桌面与手机共用一张满屏翻页卡，页面纵向滚动始终保持原生。 */}
        <div id="home-acts" className="scroll-mt-0">
          <HomeActStage acts={[actI, actII, actIII]} now={{ year: data.now.year, label: data.now.label, count: data.now.count }} promo={explorePromo} />
        </div>

        {/* 高光：一些记得住的时刻（用户后续会给新的事件列表替换） */}
        <HighlightStrip beats={data.highlights} emphasisVars={data.emphasisVars} memeMontages={data.memeMontages} />

        {/* 记忆：随机一晚 + 历史上的今天 */}
        <LiveSectionGate sectionId="home-memory">
        <section id="home-memory" className="scroll-mt-4 border-t border-line bg-surface/15">
          <div className="home-content-container px-page py-12 sm:py-16">
            <LiveSectionHeading sectionId="home-memory" />
            <div className="memory-cards mt-6 grid items-start gap-5 lg:grid-cols-2">
              <RandomMemory pool={memoryPool} total={meaningful.length} />
              <TodayInHistory rows={todayRows} />
            </div>
          </div>
        </section>

        </LiveSectionGate>

        {/* 游戏预告 */}
        {gamePreview.length > 0 && (
          <LiveSectionGate sectionId="home-games">
          <section id="home-games" className="scroll-mt-4 border-t border-line">
            <div className="home-content-container px-page py-12 sm:py-16">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <LiveSectionHeading sectionId="home-games" eyebrowColor="#E0A244" />
                </div>
                <Link prefetch={false} href="/games/" className="ui-press -my-2 rounded-sm py-2 text-meta text-live underline underline-offset-4">
                  <SiteText id="home-games-all" />
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {gamePreview.map((p) => (
                  <GameCard key={p.id} profile={p} />
                ))}
              </div>
            </div>
          </section>
          </LiveSectionGate>
        )}

        {/* 四个房间 */}
        <LiveSectionGate sectionId="home-rooms">
        <section id="home-rooms" className="scroll-mt-4 border-t border-line">
          <div className="home-content-container px-page py-12 sm:py-16">
            <LiveSectionHeading sectionId="home-rooms" />
            <LiveRooms />
          </div>
        </section>
        </LiveSectionGate>

        <HomeStats data={data} />

        <div className="mt-auto w-full border-t border-line">
          <SiteFooter />
        </div>
        </main>
      </LiveNarrativeSeed>
    </LiveCopySeed>
  )
}

/** 历史上的今天：同月同日、一年一条，构建期派生（静态站以构建日为「今天」）。 */
function TodayInHistory({ rows }: { rows: TodayHistoryRow[] }) {
  // 标题说清楚这一天最早能回到哪一年——比「N 年前」更有信息量，也随日期自己变。
  const earliest = rows.find((r) => r.item)?.year ?? null
  return (
    <div className="flex flex-col rounded-2xl border border-line/80 bg-surface/25 p-6 sm:p-8 lg:min-h-[var(--memory-card-h)]">
      <Eyebrow><SiteText id="home-today-eyebrow" /></Eyebrow>
      {/* 卡片内标题：比节标题低一级，不和「回到过去，只需要一晚。」抢主次 */}
      <h3 className="mt-3 text-h3 font-semibold text-ink">
        {earliest ? <SiteText id="home-today-title" vars={{ year: earliest }} /> : <SiteText id="home-today-empty" />}
      </h3>
      <TodayInHistoryList rows={rows} />
    </div>
  )
}

/** 四个房间的入口瓦片 */
