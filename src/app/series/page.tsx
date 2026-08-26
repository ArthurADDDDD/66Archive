import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { ActivityStrip } from '@/components/ActivityStrip'
import { Eyebrow, MediaFrame, SiteFooter } from '@/components/primitives'
import { LivePageHeader } from '@/components/LiveSection'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { buildSeriesList, type SeriesInfo } from '@/lib/series'
import { getBilibiliVideoMetaAtBuild } from '@/lib/bilibili'
import { BilibiliCoverFrame } from '@/components/BilibiliCoverFrame'
import { SeriesMontage, type SeriesMontageSample } from '@/components/SeriesMontage'

const SERIES_COLOR = { longRunning: '#A78BFA', themed: '#5BC8E8', video: '#E0A244' } as const

/**
 * 节目单：按内容形态区分长期直播节目、主题栏目和视频系列。
 * 心灵砒霜（期数最多、横跨整个斗鱼时代）单独以大块深色展示；
 * 一起 See 作为跨平台延续的长期节目重点展示。
 * 夜 / 邮件 / 电台 / 周日 / 长期陪伴的气质靠深色 + 字排 + 留白完成，不画收音机。
 */
export default async function SeriesPage() {
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)
  const series = buildSeriesList(ds, timeline)
  const pishuang = series.find((s) => s.id === 'xinling-pishuang')
  const pishuangMontage = pishuang ? await buildPishuangMontage(pishuang) : []
  const pishuangFirstBiliSource = pishuang?.entries[0]?.sources.find((source) => source.url.includes('bilibili.com/video/'))?.url
  const pishuangFirstBiliMeta = await getBilibiliVideoMetaAtBuild(pishuangFirstBiliSource)
  const pishuangFallbackCover = pishuangFirstBiliMeta?.cover ?? pishuang?.entries.find((entry) => entry.cover)?.cover
  const togetherSee = series.find((s) => s.id === 'together-see')
  const themed = series.filter((s) => s.category === 'themed')
  const videoSeries = series.filter((s) => s.category === 'video')

  return (
    <main className="ui-page-in min-h-screen overflow-x-clip">
      <MobileQuickNav active="series" />
      <BackToTop />
      <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
        <SiteNav active="series" />
        <Link
          href="/archive/"
          className="ui-press hidden whitespace-nowrap rounded-sm text-meta text-live lg:block"
        >
          在录播室搜索全部记录 →
        </Link>
      </header>

      <section className="site-container px-page pb-12 pt-10 sm:pb-16 sm:pt-14">
        <LivePageHeader pageId="series" eyebrowColor="#A78BFA" />
      </section>

      {pishuang && (
        <section className="border-y border-line/70 bg-[#0C0E15]">
          <div className="site-container grid items-start gap-10 px-page py-12 sm:py-20 lg:grid-cols-[1.15fr_.85fr] lg:gap-20">
            <div className="min-w-0">
              <Eyebrow color="#5BC8E8" dot>
                周日情感电台 · 斗鱼时期 · 心灵砒霜
              </Eyebrow>
              <h2 className="mt-5 text-hero font-bold tracking-[-0.01em] text-ink">心灵砒霜</h2>
              <p className="measure-body mt-5 text-body text-muted">{pishuang.description}</p>
              <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-meta text-muted tnum">
                <span className="text-body text-ink">{pishuang.count} 期</span>
                <span>{pishuang.firstDate.slice(0, 4)}.{pishuang.firstDate.slice(5, 7)} — {pishuang.lastDate.slice(0, 4)}.{pishuang.lastDate.slice(5, 7)}</span>
                <span>横跨 {Number(pishuang.lastDate.slice(0, 4)) - Number(pishuang.firstDate.slice(0, 4)) + 1} 年</span>
              </div>
              <div className="mt-8">
                <ActivityStrip perYear={pishuang.perYear} color="#5BC8E8" height={34} descriptive />
              </div>
              {pishuangMontage.length > 0 && (
                <div className="mt-8 border-t border-line/50 pt-6">
                  <SeriesMontage samples={pishuangMontage} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex flex-col gap-8 lg:pt-10">
              {pishuang.firstTitle && (
                <blockquote className="border-l-2 border-line/60 pl-5">
                  <p className="text-h3 font-medium leading-relaxed text-ink/90">第一期是「{pishuang.firstTitle}」。</p>
                  <p className="mt-3 text-meta text-muted tnum">{pishuang.firstDate}</p>
                </blockquote>
              )}
              <BilibiliCoverFrame
                sourceUrl={pishuangFirstBiliSource}
                fallbackSrc={pishuangFallbackCover}
                alt={pishuang.firstTitle ?? pishuang.name}
                className="w-full"
              />
              <p className="measure-body text-body text-muted">
                游戏暂停，邮件打开，一个星期日。后来，它陆续留下了 {pishuang.count} 期——有的很长，有的很短，很多个星期日，直播间都会等到这档节目。
              </p>
              <Link
                href="/series/xinling-pishuang/"
                className="ui-press group inline-flex w-fit items-center gap-2 rounded-full border border-line/80 px-5 py-2.5 text-control text-ink transition-colors hover:border-live/60 hover:text-live"
              >
                打开心灵砒霜的全部 {pishuang.count} 期
                <span aria-hidden className="font-mono text-meta transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="site-container px-page py-12 sm:py-20">
        {togetherSee && <TogetherSeeFeature series={togetherSee} />}
        <div className="mt-16" />
        <SeriesGroup
          label="主题栏目"
          description="围绕一个故事、玩法或共同主题，在一段时间里连续出现。"
          color={SERIES_COLOR.themed}
          series={themed}
        />
        <div className="mt-14" />
        <SeriesGroup
          label="视频系列"
          description="直播之前留下的连载解说与完整流程。"
          color={SERIES_COLOR.video}
          series={videoSeries}
        />
      </section>

      <SiteFooter />
    </main>
  )
}

async function buildPishuangMontage(series: SeriesInfo): Promise<SeriesMontageSample[]> {
  const seenBvid = new Set<string>()
  const samples: SeriesMontageSample[] = []
  for (const entry of series.entries) {
    const source = entry.sources.find((candidate) => candidate.url.includes('bilibili.com/video/'))
    const bvid = source?.url.match(/\/video\/(BV[\w-]+)/i)?.[1]
    if (!source || !bvid || seenBvid.has(bvid)) continue
    seenBvid.add(bvid)
    samples.push({ id: entry.id, date: entry.date, title: entry.title, sourceUrl: source.url, cover: entry.cover, views: null })
  }
  return Promise.all(samples.map(async (sample) => {
    const meta = await getBilibiliVideoMetaAtBuild(sample.sourceUrl)
    return { ...sample, cover: meta?.cover ?? sample.cover, views: meta?.views ?? null }
  }))
}

function TogetherSeeFeature({ series }: { series: SeriesInfo }) {
  const featureCover = [...series.entries]
    .reverse()
    .find((entry) => entry.cover && /一起看|发布会|直面会|颁奖|榜单/.test(entry.title))?.cover ?? series.cover

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-line/60 pb-3">
        <Eyebrow color={SERIES_COLOR.longRunning} dot>长期直播节目</Eyebrow>
        <span className="font-mono text-meta text-faint tnum">2018 — 至今</span>
      </div>
      <Link
        href={`/series/${series.id}/`}
        className="ui-press group mt-6 grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-line/80 bg-surface/35 transition-colors hover:border-[#A78BFA]/60 hover:bg-surface lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)]"
      >
        <div className="min-w-0 p-6 sm:p-8 lg:p-10">
          <Eyebrow color={SERIES_COLOR.longRunning}>Together See · 一起看</Eyebrow>
          <h2 className="mt-4 text-h2 font-semibold tracking-tight text-ink">一起 See</h2>
          <p className="measure-body mt-4 text-body text-muted">{series.description}</p>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-meta text-muted tnum">
            <span className="text-body text-ink">{series.count} 场</span>
            <span>{formatMonth(series.firstDate)} — {formatMonth(series.lastDate)}</span>
          </div>
          <div className="mt-6 max-w-2xl">
            <ActivityStrip perYear={series.perYear} color={SERIES_COLOR.longRunning} unit="场" descriptive />
          </div>
          <span className="mt-6 inline-flex items-center gap-2 text-control text-[#C4B5FD]">
            查看已确认的一起 See 记录
            <span aria-hidden className="font-mono text-meta transition-transform group-hover:translate-x-1">→</span>
          </span>
        </div>
        <div className="min-w-0 border-t border-line/60 p-5 sm:p-6 lg:border-l lg:border-t-0 lg:p-8">
          <MediaFrame
            src={featureCover}
            alt={series.name}
            fallback={<span className="text-h3 font-semibold text-ink/75">一起 See</span>}
            className="h-full min-h-48 w-full"
          />
        </div>
      </Link>
    </div>
  )
}

function SeriesGroup({
  label,
  description,
  color,
  series,
}: {
  label: string
  description: string
  color: string
  series: SeriesInfo[]
}) {
  const years = seriesYearRange(series)
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-line/60 pb-3">
        <Eyebrow color={color} dot>
          {label}
        </Eyebrow>
        <span className="font-mono text-meta text-faint tnum">{years}</span>
      </div>
      <p className="measure-body mt-4 text-body text-muted">{description}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {series.map((s) => (
          <Link
            key={s.id}
            href={`/series/${s.id}/`}
            className="ui-press group flex flex-col rounded-xl border border-line/80 bg-surface/40 p-5 transition-colors hover:border-muted/60 hover:bg-surface"
          >
            {s.cover ? (
              <MediaFrame src={s.cover} alt={s.name} aspect="aspect-video" className="w-full" />
            ) : (
              <div className="flex h-16 w-full items-center">
                <span className="text-h3 font-bold text-ink/85">{s.name}</span>
              </div>
            )}
            <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">{s.name}</h3>
            <p className="mt-1.5 text-meta text-faint tnum">
              <span className="font-mono text-[0.9375rem] font-semibold text-ink">{s.count}</span> 期 · {s.firstDate.slice(0, 4)}.{s.firstDate.slice(5, 7)} — {s.lastDate.slice(0, 4)}.{s.lastDate.slice(5, 7)}
            </p>
            <p className="mt-2.5 line-clamp-2 min-h-[2.8em] text-body text-muted">{s.description}</p>
            <div className="mt-4">
              <ActivityStrip perYear={s.perYear} color={color} height={26} descriptive />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function seriesYearRange(series: SeriesInfo[]): string {
  const years = series.flatMap((item) => [Number(item.firstDate.slice(0, 4)), Number(item.lastDate.slice(0, 4))])
  const valid = years.filter(Number.isFinite)
  if (valid.length === 0) return '暂无记录'
  const first = Math.min(...valid)
  const last = Math.max(...valid)
  return first === last ? String(first) : `${first} — ${last}`
}

function formatMonth(date: string): string {
  return date ? `${date.slice(0, 4)}.${date.slice(5, 7)}` : '待确认'
}
