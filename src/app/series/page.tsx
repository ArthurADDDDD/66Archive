import { fetchBakedPageCopy } from '@/lib/baked-content'
import { LiveCopySeed } from '@/components/LiveCopySeed'
import { SiteText } from '@/components/SiteText'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/page-metadata'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { ActivityStrip } from '@/components/ActivityStrip'
import { MediaFrame } from '@/components/MediaFrame'
import { Eyebrow, SiteFooter } from '@/components/primitives'
import { LivePageHeader } from '@/components/LiveSection'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { proxyImage } from '@/lib/platforms'
import { buildSeriesList, type SeriesInfo } from '@/lib/series'
import { getBilibiliVideoMetaAtBuild } from '@/lib/bilibili'
import { BilibiliCoverFrame } from '@/components/BilibiliCoverFrame'
import { SeriesMontage, type SeriesMontageSample } from '@/components/SeriesMontage'
import { KeepDates } from '@/components/KeepDates'

/** 标题、简介、canonical 与社交卡片都由 `pageMetadata()` 一次给齐（见该文件注释）。 */
export const metadata: Metadata = pageMetadata({
  path: '/series/',
  title: '节目单',
  description: '心灵砒霜、一起 See、夜话……那些反复出现、也各有名字的节目。',
})

const SERIES_COLOR = { themed: '#5BC8E8', video: '#E0A244' } as const

/**
 * 节目单：按内容形态区分长期直播节目、主题栏目和视频系列。
 * 心灵砒霜（期数最多、横跨整个斗鱼时代）单独以大块深色展示；
 * 一起 See 不再单独突出，和夜话、户外直播等栏目一起放在「主题栏目」分组里。
 *
 * 节目封面在两处复用同一个 URL，但框差了一倍多。
 * `lib/series.ts` 按详情页的需要烤成 w=960，卡片网格却只有 254×142（1440 视口下
 * sm:grid-cols-2 → lg:grid-cols-4）。实测 14 张真实封面的中位数：
 * w=960 37,171 B · w=480 16,157 B · w=320 9,176 B。
 */
const CARD_COVER_WIDTHS = [320, 640] as const
const CARD_COVER_SIZES = '(min-width: 1024px) 254px, (min-width: 640px) 296px, 92vw'

export default async function SeriesPage() {
  // 根 layout 只烤 {site, nav}（见 baked-content.ts 的 fetchBakedNavShell）。
  // 这一页真的会渲染后台文案，所以在这里把它需要的那份补回来。
  const bakedCopy = await fetchBakedPageCopy(['series'], { texts: ['series-'] })

  const ds = getDataset()
  const timeline = toTimelineEntries(ds)
  const series = buildSeriesList(ds, timeline)
  const pishuang = series.find((s) => s.id === 'xinling-pishuang')
  const pishuangMontage = pishuang ? buildPishuangMontage(pishuang) : []
  const pishuangFirstBiliSource = pishuang?.entries[0]?.sources.find((source) => source.url.includes('bilibili.com/video/'))?.url
  const pishuangFirstBiliMeta = await getBilibiliVideoMetaAtBuild(pishuangFirstBiliSource)
  // B 站元数据那一支已经在 toVideoMeta 里过了 proxyImage；档案条目这一支是原始来源地址，
  // 不过一遍就会把 acfun / 斗鱼的原图整张下下来（实测单张可达 1.9 MB）。
  const pishuangFallbackCover =
    pishuangFirstBiliMeta?.cover ?? proxyImage(pishuang?.entries.find((entry) => entry.cover)?.cover ?? undefined, 640)
  const themed = series.filter((s) => s.category === 'themed')
  const videoSeries = series.filter((s) => s.category === 'video')

  return (
    <LiveCopySeed copy={bakedCopy}>
      <main className="ui-page-in min-h-screen overflow-x-clip">
        <MobileQuickNav active="series" />
        <BackToTop />
        <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
          <SiteNav active="series" />
          <Link
            href="/archive/"
            prefetch={false}
            className="ui-press hidden whitespace-nowrap rounded-sm text-meta text-live lg:block"
          >
            <SiteText id="series-archive-link" />
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
                  <SiteText id="series-pishuang-eyebrow" />
                </Eyebrow>
                <h2 className="mt-5 text-hero font-bold tracking-[-0.01em] text-ink"><SiteText id="series-pishuang-title" /></h2>
                <p className="measure-body mt-5 text-body text-muted"><KeepDates text={pishuang.description} /></p>
                {/* 这里原本还领着一个「294 期」。整页算上正文、按钮、描述、活跃年份条，
                    同一个数字出现过五次；留正文那句和按钮上那次就够了。 */}
                <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-meta text-muted tnum">
                  <span>{pishuang.firstDate.slice(0, 4)}.{pishuang.firstDate.slice(5, 7)} — {pishuang.lastDate.slice(0, 4)}.{pishuang.lastDate.slice(5, 7)}</span>
                  <span><SiteText id="series-pishuang-span" vars={{ years: Number(pishuang.lastDate.slice(0, 4)) - Number(pishuang.firstDate.slice(0, 4)) + 1 }} /></span>
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
                    <p className="text-h3 font-medium leading-relaxed text-ink/90"><SiteText id="series-pishuang-first" vars={{ title: pishuang.firstTitle }} /></p>
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
                  <SiteText id="series-pishuang-body" vars={{ count: pishuang.count }} />
                </p>
                <Link
                  href="/series/xinling-pishuang/"
                  prefetch={false}
                  data-analytics-event="content.open"
                  data-analytics-target="series:xinling-pishuang"
                  className="ui-press group inline-flex w-fit items-center gap-2 rounded-full border border-line/80 px-5 py-2.5 text-control text-ink transition-colors hover:border-live/60 hover:text-live"
                >
                  <SiteText id="series-pishuang-cta" vars={{ count: pishuang.count }} />
                  <span aria-hidden className="font-mono text-meta transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="site-container px-page py-12 sm:py-20">
          <SeriesGroup
            label={<SiteText id="series-group-themed-label" />}
            description={<SiteText id="series-group-themed-desc" />}
            color={SERIES_COLOR.themed}
            series={themed}
          />
          <div className="mt-14" />
          <SeriesGroup
            label={<SiteText id="series-group-video-label" />}
            description={<SiteText id="series-group-video-desc" />}
            color={SERIES_COLOR.video}
            series={videoSeries}
          />
        </section>

        <SiteFooter />
      </main>
    </LiveCopySeed>
  )
}

function buildPishuangMontage(series: SeriesInfo): SeriesMontageSample[] {
  // 档案条目本身已有足够多的已核验封面。只取最近 24 条，既保留长档案的
  // 横向浏览感，也避免为了播放量排序在每次构建时逐条请求第三方元数据。
  const samples: SeriesMontageSample[] = []
  const recentFirst = [...series.entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  for (const entry of recentFirst) {
    if (!entry.cover) continue
    samples.push({ id: entry.id, date: entry.date, title: entry.title, cover: entry.cover })
    if (samples.length === 24) break
  }
  return samples
}

function SeriesGroup({
  label,
  description,
  color,
  series,
}: {
  label: React.ReactNode
  description: React.ReactNode
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
      <p className="measure-body mt-4 text-body text-muted">{typeof description === 'string' ? <KeepDates text={description} /> : description}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {series.map((s) => (
          <Link
            key={s.id}
            href={`/series/${s.id}/`}
            prefetch={false}
            data-analytics-event="content.open"
            data-analytics-target={`series:${s.id}`}
            className="ui-press group flex flex-col rounded-xl border border-line/80 bg-surface/40 p-5 transition-colors hover:border-muted/60 hover:bg-surface"
          >
            {s.cover ? (
              <MediaFrame
                src={s.cover}
                alt={s.name}
                aspect="aspect-video"
                className="w-full"
                widths={CARD_COVER_WIDTHS}
                sizes={CARD_COVER_SIZES}
              />
            ) : (
              <div className="flex h-16 w-full items-center">
                <span className="text-h3 font-bold text-ink/85">{s.name}</span>
              </div>
            )}
            <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">{s.name}</h3>
            {/*
              只有她自己起过名字的节目才报期数（见 SeriesInfo.countsEpisodes）。
              「夜话 / 聊天」「户外直播」「发布会」是档案自己分出来的桶，她从没编过号，
              给它们标上「137 期」既不准确，读起来也像在清点「这些不是在打游戏」。
              年份范围也不在这里写了——下面的活跃年份条已经有，写两遍是同一个数字。
            */}
            {s.countsEpisodes && (
              <p className="mt-1.5 text-meta text-faint tnum">
                <span className="font-mono text-[0.9375rem] font-semibold text-ink">{s.count}</span> 期
              </p>
            )}
            <p className="mt-2.5 line-clamp-2 min-h-[2.8em] text-body text-muted"><KeepDates text={s.description} /></p>
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

