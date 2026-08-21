import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { HomeHero } from '@/components/HomeHero'
import { HomeActRail, type HomeActRailItem, type HomeSectionRailItem } from '@/components/HomeActRail'
import { TimelineProgress } from '@/components/TimelineProgress'
import { HomeActSections } from '@/components/HomeActSections'
import { HomeActStage } from '@/components/HomeActStage'
import { HighlightStrip } from '@/components/HighlightStrip'
import { HomeStats } from '@/components/HomeStats'
import { GameCard } from '@/components/GameCard'
import type { GameCardData } from '@/lib/games'
import { RandomMemory, type MemoryCandidate } from '@/components/RandomMemory'
import { Eyebrow, SiteFooter } from '@/components/primitives'
import { LiveRooms, LiveSectionGate, LiveSectionHeading } from '@/components/LiveSection'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { CURATED_GAMES, getGameProfile, resolveHomepage } from '@/lib/narrative'

/**
 * 首页 = 三幕 + 幕间 + 高光 + 记忆（随机一晚 / 今日今夕）+ 游戏预告 + 四个房间入口。
 * 第一屏只有人，没有数字（数字在第二屏「这一切加起来」）；
 * 一切计数来自 resolveHomepage 的构建期派生，文案不硬编码数字。
 * 「今日今夕」以构建日期为准（静态站约束），框架为「N 年前的这几天」。
 */
export default function HomePage() {
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

  // 今日今夕：构建日 ±3 天里离今天最近的记录
  const today = new Date()
  const todayMd = today.getMonth() * 100 + today.getDate()
  let todayMemory: { entry: (typeof timeline)[number]; yearsAgo: number; distance: number } | null = null
  for (const e of timeline) {
    const [y, m, d] = e.date.split('-').map(Number)
    if (!y || !m || !d) continue
    const dist = Math.min(Math.abs(m * 100 + d - todayMd), 366 - Math.abs(m * 100 + d - todayMd))
    if (dist > 3) continue
    const yearsAgo = today.getFullYear() - y
    if (!todayMemory || dist < todayMemory.distance || (dist === todayMemory.distance && y > Number(todayMemory.entry.date.slice(0, 4)))) {
      todayMemory = { entry: e, yearsAgo, distance: dist }
    }
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
    <>
      <HomeActRail acts={homeActRail} sections={homeSections} />
      <main className="ui-page-in flex min-h-screen flex-col overflow-x-clip">
      <MobileQuickNav active="home" />
      <BackToTop />
      <TimelineProgress />

      <div className="flex flex-col sm:min-h-[100svh]">
        <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
          <SiteNav active="home" />
          <Link href="/archive/" className="ui-press hidden rounded-sm text-meta tnum text-live sm:block">
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

      {/* 记忆：随机一晚 + 今日今夕 */}
      <LiveSectionGate sectionId="home-memory">
      <section id="home-memory" className="scroll-mt-4 border-t border-line bg-surface/15">
        <div className="home-content-container px-page py-12 sm:py-16">
          <LiveSectionHeading sectionId="home-memory" />
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <RandomMemory pool={memoryPool} />
            <TodayInHistory
              title={todayMemory?.entry.title ?? null}
              date={todayMemory?.entry.date ?? null}
              yearsAgo={todayMemory?.yearsAgo ?? null}
              href={todayMemory ? `/e/${todayMemory.entry.id}/` : null}
              yearHref={todayMemory ? `/archive/?y=${todayMemory.entry.date.slice(0, 4)}` : null}
            />
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
    </>
  )
}

/** 今日今夕：离今天（±3 天）最近的一条历史记录。构建期派生，静态站约束如实标注。 */
function TodayInHistory({
  title,
  date,
  yearsAgo,
  href,
  yearHref,
}: {
  title: string | null
  date: string | null
  yearsAgo: number | null
  href: string | null
  yearHref: string | null
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line/80 bg-surface/25 p-6 sm:p-8">
      <Eyebrow>Today in history</Eyebrow>
      {/* 卡片内标题：比节标题低一级，不和「回到过去，只需要一晚。」抢主次 */}
      <h3 className="mt-3 text-h3 font-semibold text-ink">
        {title ? (
          <>
            这些天的历史上，{yearsAgo === 0 ? '今年' : `${yearsAgo} 年前`}：
          </>
        ) : (
          '这几天，档案里暂时没有记录。'
        )}
      </h3>
      {title && href && (
        <Link href={href} className="ui-press group mt-5">
          <div className="rounded-xl border border-line/80 bg-surface/50 p-4 transition-colors hover:border-muted/70">
            <p className="font-mono text-meta text-faint tnum">{date}</p>
            <p className="mt-1.5 text-body font-medium leading-snug text-ink transition-colors group-hover:text-white">{title}</p>
            <p className="mt-2 text-meta text-live">打开这一天 →</p>
          </div>
        </Link>
      )}
      {yearHref && (
        <p className="mt-4 text-meta text-faint">
          <Link href={yearHref} className="-my-2 inline-block rounded-sm py-2 underline underline-offset-4 transition-colors hover:text-live">
            看那年全部记录 →
          </Link>
        </p>
      )}
    </div>
  )
}

/** 四个房间的入口瓦片 */
