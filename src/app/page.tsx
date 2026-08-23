import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { HomeHero } from '@/components/HomeHero'
import { HomeActRail, type HomeActRailItem, type HomeSectionRailItem } from '@/components/HomeActRail'
import { TimelineProgress } from '@/components/TimelineProgress'
import { HomeActSections } from '@/components/HomeActSections'
import { HomeActStage } from '@/components/HomeActStage'
import { HighlightStrip } from '@/components/HighlightStrip'
import { LiveNarrativeSeed } from '@/components/LiveContentProvider'
import { fetchBakedContent } from '@/lib/baked-content'
import { HomeStats } from '@/components/HomeStats'
import { GameCard } from '@/components/GameCard'
import type { GameCardData } from '@/lib/games'
import { RandomMemory, type MemoryCandidate } from '@/components/RandomMemory'
import { TodayInHistoryList, type TodayHistoryRow } from '@/components/TodayInHistoryList'
import { Eyebrow, SiteFooter } from '@/components/primitives'
import { LiveRooms, LiveSectionGate, LiveSectionHeading } from '@/components/LiveSection'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { CURATED_GAMES, getGameProfile, resolveHomepage } from '@/lib/narrative'

/**
 * 首页 = 三幕 + 幕间 + 高光 + 记忆（随机一晚 / 历史上的今天）+ 游戏预告 + 四个房间入口。
 * 第一屏只有人，没有数字（数字在第二屏「这一切加起来」）；
 * 一切计数来自 resolveHomepage 的构建期派生，文案不硬编码数字。
 * 「历史上的今天」以构建日期为准（静态站约束），同月同日、一年一条。
 */
export default async function HomePage() {
  // 首页是站内唯一渲染叙事内容（幕 / 高光）的页面，所以只有它需要烤入 narrative。
  // 其余页面由根 layout 烤入的站点文案与板块编排即可，详见 lib/baked-content.ts。
  const { narrative: bakedNarrative } = await fetchBakedContent()
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)
  const data = resolveHomepage(ds, timeline)

  // 随机记忆池：有封面 / 有游戏 / 有栏目 的条目才配进入（宁缺毋滥）。
  // 全时间线等距抽样（最多 400 条）——不偏向任何时期，构建期确定，无随机数。
  const meaningful = timeline.filter((e) => e.cover || e.games.length > 0 || e.seriesName)
  const step = Math.max(1, Math.ceil(meaningful.length / 400))
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
  const ids = [...ds.games.keys(), ...Object.keys(CURATED_GAMES)]
  const gamePreview: GameCardData[] = ids
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
  }))
  const homeSections: HomeSectionRailItem[] = [
    { id: 'home-top', label: '首页', meta: 'START', color: '#E6E4EF' },
    { id: 'home-highlights', label: '一些记得住的时刻', meta: 'HIGHLIGHTS', color: '#5BC8E8' },
    { id: 'home-memory', label: '回到过去，只需要一晚', meta: 'MEMORY', color: '#A78BFA' },
    ...(gamePreview.length > 0 ? [{ id: 'home-games', label: '陪得最久的几款', meta: 'GAMES', color: '#E0A244' }] : []),
    { id: 'home-rooms', label: '四个房间', meta: 'ROOMS', color: '#FF6B75' },
    { id: 'home-stats', label: '这一切加起来', meta: 'TOTALS', color: '#E5568A' },
  ]

  return (
    <LiveNarrativeSeed narrative={bakedNarrative}>
      <HomeActRail acts={homeActRail} sections={homeSections} />
      <main className="ui-page-in flex min-h-screen flex-col overflow-x-clip">
      <MobileQuickNav active="home" />
      <BackToTop />
      <TimelineProgress />

      <div className="flex flex-col lg:min-h-[100svh]">
        <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
          <SiteNav active="home" />
          <Link href="/archive/" className="ui-press hidden whitespace-nowrap rounded-sm text-meta tnum text-live lg:block">
            打开全部 {data.totals.entries.toLocaleString()} 条记录 →
          </Link>
        </header>

        {/* 第一屏：人物，不是数据。PC 端连同导航占满一整个视口，不提前露出 ACT I。 */}
        <HomeHero nowYear={data.now.year} historyYears={data.totals.years} />
      </div>

      {/* PC 三幕共用一个满屏 sticky 舞台；手机保留自然文档流，避免触屏滚动被锁定。 */}
      <div id="home-acts" className="scroll-mt-0">
        <HomeActStage acts={[actI, actII, actIII]} now={{ year: data.now.year, label: data.now.label, count: data.now.count }} />
        <HomeActSections acts={[actI, actII, actIII]} now={{ year: data.now.year, label: data.now.label, count: data.now.count }} />
      </div>

      {/* 高光：一些记得住的时刻（用户后续会给新的事件列表替换） */}
      <HighlightStrip beats={data.highlights} emphasisVars={data.emphasisVars} />

      {/* 记忆：随机一晚 + 历史上的今天 */}
      <LiveSectionGate sectionId="home-memory">
      <section id="home-memory" className="scroll-mt-4 border-t border-line bg-surface/15">
        <div className="home-content-container px-page py-12 sm:py-16">
          <LiveSectionHeading sectionId="home-memory" />
          <div className="memory-cards mt-6 grid items-start gap-5 lg:grid-cols-2">
            <RandomMemory pool={memoryPool} />
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
              <Link href="/games/" className="ui-press -my-2 rounded-sm py-2 text-meta text-live underline underline-offset-4">
                全部游戏 →
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
  )
}

/** 历史上的今天：同月同日、一年一条，构建期派生（静态站以构建日为「今天」）。 */
function TodayInHistory({ rows }: { rows: TodayHistoryRow[] }) {
  // 标题说清楚这一天最早能回到哪一年——比「N 年前」更有信息量，也随日期自己变。
  const earliest = rows.find((r) => r.item)?.year ?? null
  return (
    <div className="flex flex-col rounded-2xl border border-line/80 bg-surface/25 p-6 sm:p-8 lg:min-h-[var(--memory-card-h)]">
      <Eyebrow>Today in history</Eyebrow>
      {/* 卡片内标题：比节标题低一级，不和「回到过去，只需要一晚。」抢主次 */}
      <h3 className="mt-3 text-h3 font-semibold text-ink">
        {earliest ? <>这一天，最早能回到 {earliest} 年。</> : '这一天，档案里暂时没有记录。'}
      </h3>
      <TodayInHistoryList rows={rows} />
    </div>
  )
}

/** 四个房间的入口瓦片 */
