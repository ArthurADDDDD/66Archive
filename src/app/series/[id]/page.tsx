import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { ActivityStrip } from '@/components/ActivityStrip'
import { RelatedRail } from '@/components/RelatedRail'
import { SeriesEpisodes } from '@/components/SeriesEpisodes'
import { EntryFilterProvider, YearChips } from '@/components/EntryFilters'
import { Eyebrow, SiteFooter } from '@/components/primitives'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { buildSeries } from '@/lib/series'
import { formatDuration } from '@/lib/ui'

export const dynamicParams = false

export function generateStaticParams() {
  return [...getDataset().series.keys()].map((id) => ({ id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = getDataset().series.get(id)
  return { title: s ? `${s.name} · 节目单` : '节目 · 女流66编年史' }
}

/**
 * 节目详情：固定结构 = Hero → 代表性一句 → 活动纹理 → 年份 → 全部期数（档案列表）→ 相关。
 * 心灵砒霜的「夜 / 周日 / 长期陪伴」气质靠深色区块 + 字排 + 留白完成，不做任何拟物。
 */
export default async function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ds = getDataset()
  const def = ds.series.get(id)
  if (!def) notFound()

  const timeline = toTimelineEntries(ds)
  const s = buildSeries(ds, timeline, id, def.name, def.description ?? '')
  const isPishuang = id === 'xinling-pishuang'
  const isTogetherSee = id === 'together-see'
  const unit = id === 'together-see' ? '场' : '期'
  const color = s.category === 'video' ? '#E0A244' : s.category === 'themed' ? '#5BC8E8' : '#A78BFA'
  const dark = isPishuang

  // 相关：档案检索 + 同年编年史 + 相关游戏（视频时代 games 未登记，留空即跳过）
  const gameIdByName = new Map([...ds.games.values()].map((g) => [g.name, g.id]))
  const gameRails = [...new Set(s.games)].map((name) => {
    const gid = gameIdByName.get(name)
    return gid ? { label: name, href: `/games/${gid}/` } : null
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  const rails = [
    {
      title: '档案检索',
      items: [{ label: `搜索「${s.name}」的全部记录`, href: `/archive/?q=${encodeURIComponent(s.name)}` }],
    },
    {
      title: '同期录播',
      items: [
        { label: `${s.firstDate.slice(0, 4)} 年`, href: `/archive/?y=${s.firstDate.slice(0, 4)}` },
        { label: `${s.lastDate.slice(0, 4)} 年`, href: `/archive/?y=${s.lastDate.slice(0, 4)}` },
      ],
    },
  ]
  if (gameRails.length && !isTogetherSee) rails.push({ title: '节目里的游戏', items: gameRails })

  const longest = s.entries.reduce<(typeof s.entries)[number] | null>(
    (acc, e) => (e.duration_min && (acc === null || e.duration_min > (acc.duration_min ?? 0)) ? e : acc),
    null,
  )

  return (
    <main className={`ui-page-in min-h-screen overflow-x-clip ${dark ? 'bg-[#0C0E15]' : ''}`}>
      <MobileQuickNav active="series" />
      <BackToTop />
      <header className={`ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5 ${dark ? 'sticky top-0 border-b border-line/60 bg-[#0C0E15]/95 backdrop-blur' : ''}`}>
        <SiteNav active="series" />
        <Link href="/series/" className="ui-press hidden whitespace-nowrap rounded-sm text-meta text-live lg:block">
          ← 全部节目
        </Link>
      </header>

      {/* Hero */}
      <section className="site-container px-page pb-10 pt-12 sm:pb-14 sm:pt-16">
        <Eyebrow color={color} dot>
          {s.category === 'video' ? '视频系列' : s.category === 'themed' ? '主题栏目' : '长期直播节目'}
        </Eyebrow>
        <h1 className="measure-hero mt-4 text-h1 font-bold tracking-[-0.01em] text-ink">{s.name}</h1>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-meta text-muted tnum">
          <span className="text-body text-ink">{s.count} {unit}</span>
          <span>
            {s.firstDate.slice(0, 4)}.{s.firstDate.slice(5, 7)} — {s.lastDate.slice(0, 4)}.{s.lastDate.slice(5, 7)}
          </span>
          {!isTogetherSee && longest?.duration_min && <span>最长一{unit} {formatDuration(longest.duration_min)}</span>}
        </div>
        <p className="measure-body mt-6 text-body text-muted">{s.description}</p>
      </section>

      {/* 代表性一句：第一期标题，原文照录 */}
      {s.firstTitle && (
        <section className="site-container px-page pb-10 sm:pb-14">
          <blockquote className="measure-body border-l-2 pl-5" style={{ borderColor: color }}>
            <p className="text-h3 font-medium leading-relaxed text-ink">
              {isTogetherSee ? '目前最早确认的一场' : `第一${unit}`}：「{s.firstTitle}」
            </p>
            <p className="mt-3 text-meta text-muted tnum">{s.firstDate}</p>
          </blockquote>
        </section>
      )}

      {/* 年份筛选与正倒序共享一份内存状态，横跨下面两个区块 */}
      <EntryFilterProvider anchorId="series-episodes" defaultOrder="asc">
        {/* 活跃年份：统一使用摘要条，不再绘制容易误读的迷你柱状图。 */}
        <section className="site-container px-page pb-10 sm:pb-14">
          <Eyebrow className="text-muted">活跃年份</Eyebrow>
          <div className="mt-4 w-full">
            <ActivityStrip perYear={s.perYear} color={color} unit={unit} />
            <YearChips perYear={s.perYear} color={color} unit={unit} />
          </div>
        </section>

        {/* 全部期数（档案列表，一条不省） */}
        <section id="series-episodes" className="scroll-mt-6 site-container px-page pb-16 sm:pb-24">
          <div className="border-b border-line/60 pb-3">
            <Eyebrow className="text-muted">Episodes · 全部记录</Eyebrow>
            <h2 className="mt-2 text-h3 font-semibold text-ink">
              {s.name} · 档案里的 {s.count} {unit}
            </h2>
          </div>
          <div className="mt-3">
            {isTogetherSee && (
              <p className="mb-4 max-w-3xl text-meta leading-relaxed text-faint">
                这里按整场直播归档；一起 See 有时只是其中一个环节，所以条目仍保留当晚直播的原始标题。展开后可以查看已保存的分段信息。
              </p>
            )}
            <SeriesEpisodes entries={s.entries} color={color} count={s.count} unit={unit} />
          </div>
        </section>
      </EntryFilterProvider>

      <RelatedRail rails={rails} />

      <SiteFooter />
    </main>
  )
}
