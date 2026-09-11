import { fetchBakedPageCopy } from '@/lib/baked-content'
import { LiveCopySeed } from '@/components/LiveCopySeed'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/page-metadata'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { SiteFooter } from '@/components/primitives'
import { LivePageHeader } from '@/components/LiveSection'
import { YearBarChart } from '@/components/YearCharts'
import { YearLane, YearAxis, EraFlow } from '@/components/YearLane'
import { CoverageGaps } from '@/components/CoverageMap'
import { PopularContent } from '@/components/PopularContent'
import { PresenceIndicator } from '@/components/PresenceIndicator'
import { SiteReach } from '@/components/SiteReach'
import { TrailSection } from '@/components/Trail'
import { popularIndexUrl } from '@/lib/popular-index-url'
import { LiveStatsSection as Section } from '@/components/LiveStatsSection'
import { buildCoverage } from '@/lib/coverage'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { getGameProfile } from '@/lib/narrative'
import { buildSeriesList } from '@/lib/series'
import { allGameIds } from '@/lib/narrative'

/** 标题、简介、canonical 与社交卡片都由 `pageMetadata()` 一次给齐（见该文件注释）。 */
export const metadata: Metadata = pageMetadata({
  path: '/stats/',
  title: '数据',
  description: '关于这份档案的一些观察：哪一年留下的最多，哪款游戏陪得最久。',
})

/**
 * 数据里的发现：每一节只回答一个问题。
 * 数据 → 观察 → 记忆：数字先行，观察一句话，最后都通向编年史 / 游戏 / 节目。
 * 图表只有纯 CSS 的条 / 点 / 时间线，不引入任何图表依赖。
 */
/** 「哪些节目坚持得最久」这一节数据意义不大，先隐藏不删——想恢复直接改回 true。 */
const SHOW_LONGEST_RUNNING_SERIES = false

/** 「哪些游戏隔了几年还会回来」同理：读者拿它做不了任何事，先隐藏不删。 */
const SHOW_RETURNING_GAMES = false

export default async function StatsPage() {
  // 根 layout 只烤 {site, nav}（见 baked-content.ts 的 fetchBakedNavShell）。
  // 这一页真的会渲染后台文案，所以在这里把它需要的那份补回来。
  const bakedCopy = await fetchBakedPageCopy([
    'stats',
    'stats-q-recorded',
    'stats-q-busiest-year',
    'stats-q-longest-games',
    'stats-q-returning-games',
    'stats-q-eras',
    'stats-q-longest-series',
    'stats-q-popular',
    'stats-q-trail',
    'stats-q-gaps',
  ])

  const ds = getDataset()
  const timeline = toTimelineEntries(ds)

  // —— 01 每一年 ——
  const byYear = new Map<number, { count: number; minutes: number; known: number }>()
  for (const e of timeline) {
    const y = Number(e.date.slice(0, 4))
    const row = byYear.get(y) ?? { count: 0, minutes: 0, known: 0 }
    row.count += 1
    if (e.duration_min) {
      row.minutes += e.duration_min
      row.known += 1
    }
    byYear.set(y, row)
  }
  const yearRows = [...byYear.entries()].sort((a, b) => a[0] - b[0])
  const observedYears = new Set(yearRows.map(([year]) => year))
  const firstArchiveYear = yearRows[0]?.[0] ?? new Date().getFullYear()
  const lastArchiveYear = yearRows[yearRows.length - 1]?.[0] ?? firstArchiveYear
  const emptyYears: number[] = []
  for (let year = firstArchiveYear; year <= lastArchiveYear; year++) {
    if (!observedYears.has(year)) emptyYears.push(year)
  }
  let topYear = yearRows[0]?.[0] ?? 0
  let topCount = 0
  for (const [y, r] of yearRows) if (r.count > topCount) {
    topCount = r.count
    topYear = y
  }

  // —— 02 / 03 游戏 ——
  const profiles = allGameIds(ds)
    .map((id) => getGameProfile(ds, timeline, id))
    .filter((p): p is NonNullable<typeof p> => p !== null)
  const longest = [...profiles]
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 8)
    .filter((p) => p.totalMinutes > 0)
  const maxMinutes = Math.max(1, ...longest.map((p) => p.totalMinutes))

  const revisited = profiles
    .filter((p) => p.entries.length > 0)
    .map((p) => {
      const years = [...new Set(p.entries.map((e) => e.date.slice(0, 4)))].sort()
      let gaps = 0
      for (let i = 1; i < years.length; i++) if (Number(years[i]) - Number(years[i - 1]) > 1) gaps += 1
      return { p, years, gaps }
    })
    .sort((a, b) => b.years.length - a.years.length || b.p.totalMinutes - a.p.totalMinutes)
    .slice(0, 6)

  // —— 04 时代 ——
  // 2015 是视频投稿与斗鱼直播重叠的过渡年，时代统计按条目类型/平台分，不再按年份硬切。
  /*
   * 时期按**日期**切，不按平台切。
   *
   * 原先是 video / douyu 直播 / douyin 直播 三个 filter，于是 14 条 B 站直播
   * （2015 年 3 条，2023-10 ~ 2024-03 共 11 条）谁都不属于，直接从这一节消失：
   * 三档相加 2,700 条，而档案一共 2,714 条，页面上另一节又说直播有 2,618 场，
   * 三个总数互相对不上，且没有任何一处会报错。
   *
   * 那 11 条恰恰是离开斗鱼、还没到抖音的那段过渡期——它本来就属于某个时期，
   * 只是不属于任何一个平台。按日期切之后每条记录必定落进且只落进一个时期，
   * 相加恒等于全部条目。
   *
   * 分界点从数据里取，不写死：第一场直播 / 第一场抖音直播。年份标签也由各档
   * 自己的内容算出来——标签写死就迟早和内容对不上。
   */
  const sortedDates = timeline.map((entry) => entry.date).sort()
  const firstLiveDate = timeline.filter((e) => e.type === 'live').map((e) => e.date).sort()[0] ?? sortedDates[0] ?? ''
  const firstDouyinDate = timeline.filter((e) => e.platform === 'douyin').map((e) => e.date).sort()[0] ?? ''

  const eraLabel = (rows: { date: string }[], openEnded = false) => {
    if (rows.length === 0) return ''
    const years = rows.map((row) => row.date.slice(0, 4)).sort()
    return `${years[0]} — ${openEnded ? '至今' : years[years.length - 1]}`
  }

  const douyuLastDate = timeline.filter((e) => e.platform === 'douyu').map((e) => e.date).sort().at(-1) ?? ''
  const interimCount = timeline.filter((e) => e.date > douyuLastDate && e.date < firstDouyinDate).length

  const eras = [
    {
      id: 'video',
      label: '视频时期',
      color: '#E0A244',
      from: 2010,
      entries: timeline.filter((e) => e.date < firstLiveDate),
    },
    {
      id: 'douyu',
      label: '斗鱼时期',
      color: '#5BC8E8',
      from: 2015,
      entries: timeline.filter((e) => e.date >= firstLiveDate && (firstDouyinDate === '' || e.date < firstDouyinDate)),
    },
    {
      id: 'douyin',
      label: '现在',
      color: '#FF6B75',
      from: 2024,
      entries: timeline.filter((e) => firstDouyinDate !== '' && e.date >= firstDouyinDate),
    },
  ].map((era) => ({ ...era, years: eraLabel(era.entries, era.id === 'douyin') })).map((era) => {
    const count = era.entries.length
    const minutes = era.entries.reduce((sum, entry) => sum + (entry.duration_min ?? 0), 0)
    const perYear = new Map<number, number>()
    for (const entry of era.entries) {
      const y = Number(entry.date.slice(0, 4))
      perYear.set(y, (perYear.get(y) ?? 0) + 1)
    }
    return { ...era, count, hours: Math.round(minutes / 60), perYear }
  })

  // 每一年一根柱子，柱子内部按时期分段——时代更替是这一节唯一要说清的事。
  const eraColumns = []
  for (let year = firstArchiveYear; year <= lastArchiveYear; year++) {
    eraColumns.push({
      year,
      segments: eras.map((era) => ({
        id: era.id,
        label: era.label,
        color: era.color,
        count: era.perYear.get(year) ?? 0,
      })),
    })
  }

  // —— 06 缺口 ——（全站唯一一份，联系页只留提交入口）
  const coverage = buildCoverage(timeline)

  // —— 05 节目 ——
  const series = buildSeriesList(ds, timeline)
    .map((s) => ({ ...s, span: s.count > 1 ? Number(s.lastDate.slice(0, 4)) - Number(s.firstDate.slice(0, 4)) + 1 : 1 }))
    .sort((a, b) => b.span - a.span || b.count - a.count)
  const longestSeries = series[0]
  const pishuangSeries = series.find((s) => s.id === 'xinling-pishuang')

  return (
    <LiveCopySeed copy={bakedCopy}>
      <main className="ui-page-in min-h-screen overflow-x-clip">
        <MobileQuickNav active="stats" />
        <BackToTop />
        <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
          <SiteNav active="stats" />
          <Link href="/archive/" prefetch={false} className="ui-press hidden whitespace-nowrap rounded-sm text-meta text-live lg:block">
            去录播室逐条查看 →
          </Link>
        </header>

        <section className="site-container-wide px-page pb-[clamp(3rem,7vh,7rem)] pt-[clamp(2.5rem,6vh,6rem)]">
          <LivePageHeader
            pageId="stats"
            eyebrowColor="#E5568A"
            wide
          />
          {/* 这一页说的是「我们」，那就先说此刻这里有谁、一共来过多少人。两者都拿不到就都不出现。 */}
          <PresenceIndicator pageKey="stats" mode="global" className="mt-6" />
          <SiteReach className="mt-2" />
        </section>

        {/*
          00 水友们最爱点开哪些记录？

          这一节原本排在第七位。但它是全页唯一一节**读者自己参与生成**的内容——
          先摆它，这一页才是「我们」而不是「她的产出报表」。
          数据在运行期从内容服务拉；拿不到就整节不出现。
        */}
        <PopularContent
          labelIndexUrl={popularIndexUrl()}
          questionId="stats-q-popular" fallback="水友们最爱点开哪些记录？"
          accent="#7BD88F"
          legend="站内点开一次算一次，从建站起一路累计到现在 · 同一个人反复点开会重复计入，所以这是「被点开的次数」，不是「多少人看过」"
        />

        {/* 01 你的足迹——纯本地，不上报 */}
        <Section questionId="stats-q-trail" fallback="你自己翻过哪些？" accent="#A78BFA">
          <TrailSection />
        </Section>

        {/*
          这里原本是「已收录直播有多少？」：已收录直播 N 场 / 已确认时长 N 小时 /
          公开口径累计 N+ 小时。整节删掉，原因有两条——

          一、它和下面的「时代如何变化」是同一批数据的两种切法，而且两套口径谁都
              不等于档案总数，页面自己和自己打架。
          二、这三个数说的是「她一共产出了多少」，既不可点也不通向任何地方，
              读者拿它做不了任何事。校对口径（已确认时长、公开下限）属于征集语境。
        */}

        {/* 01 哪一年留下的记录最多？ */}
        <Section questionId="stats-q-busiest-year" fallback="哪一年留下的记录最多？" accent="#E0A244">
          <YearBarChart rows={yearRows} topYear={topYear} />
          <Observation>
            最多的一年是 {topYear} 年，留下了 {topCount.toLocaleString()} 条记录。
            {emptyYears.length > 0
              ? ` ${emptyYears.join('、')} 年目前没有保存下来的站内录像。`
              : ' 档案覆盖到的每一年都至少留下了一条记录。'}
          </Observation>
        </Section>

        {/* 02 哪些游戏陪得最久？ */}
        <Section questionId="stats-q-longest-games" fallback="哪些游戏陪得最久？" accent="#E5568A">
          <div className="space-y-3">
            {longest.map((p, i) => (
              <Link prefetch={false} key={p.id} href={`/games/${p.id}/`} className="group block">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2 text-body text-muted group-hover:text-ink">
                    <span className="font-mono text-meta text-faint tnum">{String(i + 1).padStart(2, '0')}</span>
                    {p.name}
                  </span>
                  <span className="text-meta text-faint tnum">{p.hoursLabel}</span>
                </div>
                <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-raised">
                  <span
                    className="block h-full rounded-full transition-[width,filter] group-hover:brightness-150"
                    style={{ width: `${(p.totalMinutes / maxMinutes) * 100}%`, background: '#E5568A' }}
                  />
                </div>
              </Link>
            ))}
          </div>
          <Observation>
            陪伴最久的游戏是「{longest[0]?.name}」，已录 {longest[0]?.hoursLabel}。
          </Observation>
        </Section>

        {/* 03 哪些游戏反复回来？——隐藏中，见 SHOW_RETURNING_GAMES */}
        {SHOW_RETURNING_GAMES && (
          <Section
            questionId="stats-q-returning-games" fallback="哪些游戏，隔了几年还会回来？"
            accent="#5BC8E8"
            legend={`一格一年（${firstArchiveYear} — ${lastArchiveYear}）· 亮起来＝这一年打过，暗格＝这一年没碰过`}
          >
            <YearAxis from={firstArchiveYear} to={lastArchiveYear} className="mb-1.5" />
            <div className="divide-y divide-line/60 border-y border-line/60">
              {revisited.map(({ p, years, gaps }) => (
                <Link prefetch={false} key={p.id} href={`/games/${p.id}/`} className="group block py-3.5 transition-colors hover:bg-surface/30">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-body font-medium text-ink">{p.name}</span>
                    <span className="text-meta text-faint tnum">
                      <span className="font-mono text-control font-semibold text-ink">{years.length}</span> 个年份里打过
                      {gaps > 0 && <> · 中途断过 {gaps} 次</>}
                    </span>
                  </div>
                  <div className="mt-2">
                    <YearLane
                      from={firstArchiveYear}
                      to={lastArchiveYear}
                      perYear={p.entries.reduce<{ year: number; count: number }[]>((acc, entry) => {
                        const y = Number(entry.date.slice(0, 4))
                        const row = acc.find((item) => item.year === y)
                        if (row) row.count += 1
                        else acc.push({ year: y, count: 1 })
                        return acc
                      }, [])}
                      color="#5BC8E8"
                      unit="场"
                      compact
                      showAxis={false}
                    />
                  </div>
                </Link>
              ))}
            </div>
            <Observation>
              有些游戏隔了几年，还是会重新打开：「{revisited[0]?.p.name}」在 {revisited[0]?.years.length} 个不同年份里都出现过。
            </Observation>
          </Section>
        )}

        {/* 04 时代如何变化？ */}
        <Section questionId="stats-q-eras" fallback="时代如何变化？" accent="#FF6B75">
          <div className="grid gap-3 sm:grid-cols-3">
            {eras.map((era) => (
              <Link
                key={era.id}
                href={`/archive/?y=${era.from}`}
                prefetch={false}
                className="rounded-xl border border-line/80 bg-surface/40 p-5 transition-colors hover:border-muted/60"
              >
                <p className="flex items-center gap-2 text-meta uppercase tracking-[0.16em]" style={{ color: era.color }}>
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: era.color }} />
                  {era.label}
                </p>
                <p className="mt-3 font-mono text-h3 font-bold text-ink tnum">{era.count.toLocaleString()}</p>
                {/* 只说条数，不再并排一个「N 小时」：小时数与条数说的是同一件事的
                    两个侧面，而且更像在结算工时。年份跨度由内容算出，见上面 eraLabel。 */}
                <p className="mt-1 text-meta text-faint tnum">条记录 · {era.years}</p>
              </Link>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-line/80 bg-surface/40 p-[clamp(0.875rem,1.2vw,1.25rem)]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="text-body font-medium text-ink">一年一根柱子，颜色就是当时的主场</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {eras.map((era) => (
                  <span key={era.id} className="flex items-center gap-2 text-meta text-faint">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-[0.1875rem]" style={{ background: era.color }} />
                    {era.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-[clamp(0.875rem,1.4vw,1.25rem)]">
              <EraFlow rows={eraColumns} />
            </div>
          </div>
          <Observation>
            {/*
              原文说这段是「空档」。按平台分桶时看起来确实是空的，但那只是因为
              那几场不在斗鱼也不在抖音——档案里真实存在，只是落在了 B 站。
              这三个数都从数据里算，改不动也不会和内容对不上。
            */}
            视频时期靠录像，斗鱼时期靠直播。斗鱼最后一场停在 {douyuLastDate}，抖音第一场是 {firstDouyinDate}；
            {interimCount > 0
              ? `中间隔了大半年，但那段时间并不是空的——档案里还留着 ${interimCount} 场 B 站的夜话和话疗。`
              : '中间隔了大半年。'}
          </Observation>
        </Section>

        {/* 05 哪些节目坚持得最久？——隐藏中，见 SHOW_LONGEST_RUNNING_SERIES */}
        {SHOW_LONGEST_RUNNING_SERIES && (
        <Section
          questionId="stats-q-longest-series" fallback="哪些节目坚持得最久？"
          accent="#A78BFA"
          legend={`一格一年（${firstArchiveYear} — ${lastArchiveYear}）· 柱子越高，这一年更新得越多`}
        >
          <YearAxis from={firstArchiveYear} to={lastArchiveYear} className="mb-1.5" />
          <div className="divide-y divide-line/60 border-y border-line/60">
            {series.slice(0, 6).map((s) => (
              <Link prefetch={false} key={s.id} href={`/series/${s.id}/`} className="group block py-3.5 transition-colors hover:bg-surface/30">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-body font-medium text-ink">{s.name}</span>
                  <span className="text-meta text-faint tnum">
                    <span className="font-mono text-control font-semibold text-ink">{s.count}</span> 期 · 从 {s.firstDate.slice(0, 4)} 播到 {s.lastDate.slice(0, 4)}
                  </span>
                </div>
                <div className="mt-2">
                  <YearLane
                    from={firstArchiveYear}
                    to={lastArchiveYear}
                    perYear={s.perYear}
                    color="#A78BFA"
                    unit="期"
                    compact
                    showAxis={false}
                  />
                </div>
              </Link>
            ))}
          </div>
          <Observation>
            「{pishuangSeries?.name ?? longestSeries?.name ?? '心灵砒霜'}」横跨了 {pishuangSeries?.span ?? longestSeries?.span ?? 0} 年——固定出现在每周日，是档案里坚持最久的节目。
          </Observation>
        </Section>
        )}

        {/* 07 档案还有多少空白？ */}
        <Section
          questionId="stats-q-gaps" fallback="档案还有多少空白？"
          accent="#5BC8E8"
          legend="一格一个月 · 亮起来＝档案里有记录，空格＝还没有找到任何录像。空格不代表那个月没播。"
        >
          <CoverageGaps coverage={coverage} />
          <Observation>
            手上有对应时间的录播、切片或者原视频链接，可以从
            <Link prefetch={false} href="/contact/" className="text-live underline decoration-line underline-offset-4 hover:decoration-live">
              联系页
            </Link>
            告诉我，这张图就会少一块空白。
          </Observation>
        </Section>

        <SiteFooter />
      </main>
    </LiveCopySeed>
  )
}

function Observation({ children }: { children: React.ReactNode }) {
  return (
    <p className="measure-body mt-6 border-l-2 border-line pl-4 text-body text-muted">
      <span className="text-meta uppercase tracking-[0.16em] text-faint">观察 · </span>
      {children}
    </p>
  )
}
