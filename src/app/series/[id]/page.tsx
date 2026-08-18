import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { ActivityStrip } from '@/components/ActivityStrip'
import { RelatedRail } from '@/components/RelatedRail'
import { SeriesEpisodes } from '@/components/SeriesEpisodes'
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
  const color = s.era === 'video' ? '#E0A244' : '#5BC8E8'
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
      items: [{ label: `搜索「${s.name}」的全部记录`, href: `/chronicle/?q=${encodeURIComponent(s.name)}` }],
    },
    {
      title: '同期编年史',
      items: [
        { label: `${s.firstDate.slice(0, 4)} 年`, href: `/chronicle/?y=${s.firstDate.slice(0, 4)}` },
        { label: `${s.lastDate.slice(0, 4)} 年`, href: `/chronicle/?y=${s.lastDate.slice(0, 4)}` },
      ],
    },
  ]
  if (gameRails.length) rails.push({ title: '节目里的游戏', items: gameRails })

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
        <Link href="/series/" className="ui-press hidden rounded-sm text-meta text-live sm:block">
          ← 全部节目
        </Link>
      </header>

      {/* Hero */}
      <section className="site-container px-page pb-10 pt-12 sm:pb-14 sm:pt-16">
        <Eyebrow color={color} dot>
          {s.era === 'video' ? '视频解说时代' : '斗鱼直播时代'} · 栏目 / 系列
        </Eyebrow>
        <h1 className="measure-hero mt-4 text-h1 font-bold tracking-[-0.01em] text-ink">{s.name}</h1>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-meta text-muted tnum">
          <span className="text-body text-ink">{s.count} 期</span>
          <span>
            {s.firstDate.slice(0, 4)}.{s.firstDate.slice(5, 7)} — {s.lastDate.slice(0, 4)}.{s.lastDate.slice(5, 7)}
          </span>
          {longest?.duration_min && <span>最长一期 {formatDuration(longest.duration_min)}</span>}
        </div>
        <p className="measure-body mt-6 text-body text-muted">{s.description}</p>
      </section>

      {/* 代表性一句：第一期标题，原文照录 */}
      {s.firstTitle && (
        <section className="site-container px-page pb-10 sm:pb-14">
          <blockquote className="measure-body border-l-2 pl-5" style={{ borderColor: color }}>
            <p className="text-h3 font-medium leading-relaxed text-ink">第一期：「{s.firstTitle}」</p>
            <p className="mt-3 text-meta text-muted tnum">{s.firstDate}</p>
          </blockquote>
        </section>
      )}

      {/* 活跃年份：统一使用摘要条，不再绘制容易误读的迷你柱状图。 */}
      <section className="site-container px-page pb-10 sm:pb-14">
        <Eyebrow className="text-muted">活跃年份</Eyebrow>
        <div className="mt-4 w-full">
          <ActivityStrip perYear={s.perYear} color={color} />
          <div className="mt-6 flex flex-wrap gap-2">
            {s.perYear.map((p) => (
              <Link
                key={p.year}
                href={`/chronicle/?q=${encodeURIComponent(s.name)}&y=${p.year}`}
                className="ui-press rounded-full border border-line/80 bg-surface/50 px-3 py-1.5 text-meta text-muted transition-colors hover:border-live/60 hover:text-ink tnum"
              >
                {p.year} 年 · {p.count} 期
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 全部期数（档案列表，一条不省） */}
      <section className="site-container px-page pb-16 sm:pb-24">
        <div className="border-b border-line/60 pb-3">
          <Eyebrow className="text-muted">Episodes · 全部期数</Eyebrow>
          <h2 className="mt-2 text-h3 font-semibold text-ink">
            {s.name} · 档案里的 {s.count} 期
          </h2>
        </div>
        <div className="mt-3">
          <SeriesEpisodes entries={s.entries} color={color} count={s.count} />
        </div>
      </section>

      <RelatedRail rails={rails} />

      <SiteFooter />
    </main>
  )
}
