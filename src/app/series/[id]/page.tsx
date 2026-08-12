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
      <header className={`ui-slide-down relative z-20 mx-auto flex max-w-[1240px] items-center justify-between px-4 py-5 sm:px-6 ${dark ? 'sticky top-0 border-b border-line/60 bg-[#0C0E15]/95 backdrop-blur' : ''}`}>
        <SiteNav active="series" />
        <Link href="/series/" className="ui-press hidden rounded-sm text-meta text-live underline-offset-4 hover:underline sm:block">
          ← 全部节目
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1240px] px-page pb-10 pt-12 sm:pb-14 sm:pt-16">
        <Eyebrow color={color} dot>
          {s.era === 'video' ? '视频解说时代' : '斗鱼直播时代'} · 栏目 / 系列
        </Eyebrow>
        <h1 className="mt-4 max-w-3xl text-h1 font-bold tracking-[-0.01em] text-ink">{s.name}</h1>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-meta text-muted tnum">
          <span className="text-body text-ink">{s.count} 期</span>
          <span>档案确认 · 构建期派生</span>
          <span>
            {s.firstDate.slice(0, 4)}.{s.firstDate.slice(5, 7)} — {s.lastDate.slice(0, 4)}.{s.lastDate.slice(5, 7)}
          </span>
          {longest?.duration_min && <span>最长一期 {formatDuration(longest.duration_min)}</span>}
        </div>
        <p className="mt-6 max-w-2xl text-body text-muted">{s.description}</p>
      </section>

      {/* 代表性一句：第一期标题，原文照录 */}
      {s.firstTitle && (
        <section className="mx-auto max-w-[1240px] px-page pb-10 sm:pb-14">
          <blockquote className="max-w-2xl border-l-2 pl-5" style={{ borderColor: color }}>
            <p className="text-h3 font-medium leading-relaxed text-ink">第一期：「{s.firstTitle}」</p>
            <p className="mt-3 text-meta text-muted tnum">第一期标题，原文照录 · {s.firstDate}</p>
          </blockquote>
        </section>
      )}

      {/* 活动纹理 */}
      <section className="mx-auto max-w-[1240px] px-page pb-12 sm:pb-16">
        <Eyebrow className="text-muted">按年活动</Eyebrow>
        {/* 桌面：横向刻度条 + 年份 chip（保持原样） */}
        <div className="mt-4 hidden sm:block">
          <ActivityStrip perYear={s.perYear} color={color} height={36} />
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
        {/* 移动端：year / bar / count 纵向排列，不压成不可读的极细刻度 */}
        <div className="mt-3 sm:hidden">
          {(() => {
            const max = Math.max(1, ...s.perYear.map((p) => p.count))
            return (
              <ul className="space-y-0.5">
                {s.perYear.map((p) => (
                  <li key={p.year}>
                    <Link
                      href={`/chronicle/?q=${encodeURIComponent(s.name)}&y=${p.year}`}
                      className="ui-press flex min-h-[40px] items-center gap-3 rounded px-1 py-1.5 transition-colors hover:bg-surface/40"
                    >
                      <span className="w-10 shrink-0 font-mono text-meta text-ink tnum">{p.year}</span>
                      <span className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, (p.count / max) * 100)}%`, background: color }} />
                      </span>
                      <span className="shrink-0 text-meta text-muted tnum">{p.count} 期</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          })()}
        </div>
      </section>

      {/* 全部期数（档案列表，一条不省） */}
      <section className="mx-auto max-w-[1240px] px-page pb-16 sm:pb-24">
        <div className="border-b border-line/60 pb-3">
          <Eyebrow className="text-muted">Episodes · 全部期数</Eyebrow>
          <h2 className="mt-2 text-h3 font-semibold text-ink">
            {s.name} · 档案里的 {s.count} 期
          </h2>
        </div>
        <div className="mt-3">
          <SeriesEpisodes entries={s.entries} color={color} count={s.count} />
        </div>
        <p className="mt-4 text-meta text-muted">
          ⓘ 期数由标题 / 栏目 tag 精确匹配派生；series.yaml 中的外部统计口径可能略宽，以档案确认为准。
        </p>
      </section>

      <RelatedRail rails={rails} />

      <SiteFooter />
    </main>
  )
}
