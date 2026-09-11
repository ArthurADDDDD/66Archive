import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buildSourceGroups, getDataset } from '@/lib/data'
import { visibleGameIds } from '@/lib/games'
import { PLATFORM_META } from '@/lib/platforms'
import { formatClock, formatDuration, gameColor } from '@/lib/ui'
import { actColorForDate } from '@/lib/narrative'
import { toSeconds, type Platform } from '@/lib/schema'
import { buildEntryRails } from '@/lib/relations'
import { pageMetadata, SITE_DESCRIPTION } from '@/lib/page-metadata'
import { InlineTagCalibration } from '@/components/InlineTagCalibration'
import { TrailRecorder } from '@/components/Trail'
import { SiteNav } from '@/components/SiteNav'
import { BackToTop, MobileQuickNav } from '@/components/ScrollAffordances'
import { RelatedRail } from '@/components/RelatedRail'
import { PresenceIndicator } from '@/components/PresenceIndicator'
import { Eyebrow, SiteFooter } from '@/components/primitives'
import { EntryWatch, type WatchSegment, type WatchSource } from '@/components/EntryWatch'
import { SiteText } from '@/components/SiteText'
import { LiveCopySeed } from '@/components/LiveCopySeed'
import { fetchBakedPageCopy } from '@/lib/baked-content'

/**
 * 一条记录的详情页。
 *
 * 结构 = 这是哪一场（Hero，纯文字）→ 在哪儿看 + 这场里在打什么（观看台）→ 前后两场 → 相关的路。
 * 封面不再是 Hero 里一张静态图——它挂在观看台的来源面板顶部，跟着选中的来源换，
 * 点它就是打开那个来源，而不是一张只能看的装饰图。
 * 三个端的差别只在观看台那一段：
 * - 手机：单列，先来源+封面后时间轴（先决定去哪儿看，再挑时间点）；封面和其余内容
 *   共用同一层 px-page 安全边距，不再出血到屏幕边缘。
 * - 平板（md+）/桌面（lg+）：来源面板（含封面）吸附在右侧，时间轴在左，
 *   20 段的长列表也不用滚回去换来源。
 *
 * 页面外壳与 /series/[id]、/games/[id] 对齐（site-container + px-page + SiteFooter），
 * 不再用写死的 max-w 把正文钉在 740px、让顶栏和内容差出 190px 的左边界。
 */

export const dynamicParams = false

/** 无游戏分段的备用配色：只为在色带上彼此分得开，与 gameColor 的语义无关。 */
const SEGMENT_FALLBACK = ['#5BC8E8', '#E5568A', '#E0A244', '#9B8AFB', '#72C7A5']

export function generateStaticParams() {
  return getDataset().entries.map((e) => ({ id: e.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const entry = getDataset().entries.find((e) => e.id === id)
  // 站名由根 layout 的 title template 补，这里只给这一场自己的名字。
  return pageMetadata({
    path: `/e/${id}/`,
    title: entry ? `${entry.date} ${entry.title}` : '记录',
    description: entry
      ? `${entry.date}${entry.time ? ` ${entry.time}` : ''} · ${formatDuration(entry.duration_min)} · 只索引，不搬运。`
      : SITE_DESCRIPTION,
  })
}

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ds = getDataset()
  const idx = ds.entries.findIndex((e) => e.id === id)
  if (idx === -1) notFound()

  const entry = ds.entries[idx]
  const platform = PLATFORM_META[entry.platform as Platform]
  const accent = actColorForDate(entry.date)
  const totalSec = (entry.duration_min ?? 0) * 60
  const newer = ds.entries[idx - 1]
  const older = ds.entries[idx + 1]

  const year = entry.date.slice(0, 4)
  const month = Number(entry.date.slice(5, 7))
  const backHref = `/archive/?y=${year}&m=${month}`

  // 同场的不同录像被数据审校标成一组；来源合并去重后一起展示，条目不重复出现。
  const sourceGroup = buildSourceGroups(ds.entries).get(entry.id) ?? [entry]
  const sources: WatchSource[] = sourceGroup
    .flatMap((item) =>
      item.sources.map((source) => ({
        url: source.url,
        cover: source.cover,
        kind: source.kind,
        status: source.status,
        parts: source.parts,
        partDetails: source.part_details,
        coverUnreliable: source.cover_unreliable,
        accountName: source.account ? ds.accounts.get(source.account)?.name : undefined,
        entryTitle: item.title,
      })),
    )
    .filter((source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index)

  // 整场都没标游戏时（分段其实是录像的分 P / 章节），灰色会把色带糊成一条——
  // 这时按序号发一组可区分的颜色，只为分得开，不代表任何游戏。
  const isGameTimeline = entry.segments.some((s) => s.game)
  const segments: WatchSegment[] = entry.segments.map((s, i) => {
    const from = toSeconds(s.at)
    const next = entry.segments[i + 1]
    const to = next ? toSeconds(next.at) : totalSec || from
    return {
      at: s.at,
      atSec: from,
      endSec: to,
      name: s.game ? (ds.games.get(s.game)?.name ?? s.game) : s.label,
      label: s.label,
      gameId: s.game ?? null,
      color: s.game ? gameColor(s.game) : isGameTimeline ? gameColor(null) : SEGMENT_FALLBACK[i % SEGMENT_FALLBACK.length],
      dim: isGameTimeline && !s.game,
      from: totalSec ? from / totalSec : i / entry.segments.length,
      to: totalSec ? Math.min(to / totalSec, 1) : (i + 1) / entry.segments.length,
    }
  })

  const games = visibleGameIds(entry.games).map((g) => ({ id: g, name: ds.games.get(g)?.name ?? g, known: ds.games.has(g) }))
  const seriesDef = entry.series ? ds.series.get(entry.series) : undefined
  const rails = buildEntryRails(entry, ds)

  // 两千多个条目页共用同一份：只带条目页自己的固定文字（`entry-`），几百字节。
  const bakedCopy = await fetchBakedPageCopy([], { texts: ['entry-'] })

  return (
    <LiveCopySeed copy={bakedCopy}>
    <main className="ui-page-in min-h-screen overflow-x-clip">
      <MobileQuickNav active="entry" />
      <BackToTop />
      {/* 记一笔足迹（纯本地，见 lib/trail.ts）。没有可见输出。 */}
      <TrailRecorder id={entry.id} title={entry.title} date={entry.date} />
      <header className="ui-slide-down relative z-20 site-header-container flex items-center justify-between px-page py-5">
        <SiteNav active="entry" />
        <Link href={backHref} prefetch={false} className="ui-press hidden whitespace-nowrap rounded-sm text-meta text-live lg:block">
          ← <SiteText id="entry-back" vars={{ year, month }} />
        </Link>
      </header>

      {/* 这是哪一场 */}
      <section className="site-container px-page pb-10 pt-6 sm:pb-14 sm:pt-10">
        <Link
          href={backHref}
          prefetch={false}
          className="ui-press -my-2 inline-block rounded-sm py-2 text-meta text-muted underline underline-offset-4 transition-colors hover:text-live tnum lg:hidden"
        >
          ← <SiteText id="entry-back" vars={{ year, month }} />
        </Link>

        <div className="mt-4 lg:mt-0">
          <div className="min-w-0">
            <Eyebrow color={accent} dot>
              {platform?.name ?? entry.platform} · {entry.type === 'live' ? '直播录像' : '视频'}
            </Eyebrow>
            <h1 className="measure-hero mt-4 text-h1 font-semibold text-ink">{entry.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-meta text-muted tnum">
              <span className="font-mono text-ink">{entry.date}</span>
              {entry.time && <span>{entry.time} 开播</span>}
              {entry.confidence !== 'high' && (
                <span className="rounded-sm border border-line px-1.5 py-0.5 text-faint">
                  {entry.confidence === 'low' ? '待考证' : '部分待核实'}
                </span>
              )}
              <PresenceIndicator pageKey={`entry:${entry.id}`} mode="page" />
            </div>

            {/*
              关键数字。「分段」为 0 时不画——大多数条目都没有录分段，
              于是首屏三格里有一格常年摆着一个大大的 0，看起来像缺了什么东西。
              没有分段是常态，不是缺陷，那就干脆不提。
            */}
            <dl className={`mt-6 grid max-w-md gap-4 border-y border-line/60 py-4 ${entry.segments.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <Fact
                value={formatClock(entry.duration_min)}
                label={entry.duration_min ? '时长 时:分:秒' : '时长未知'}
                accent={entry.duration_min ? accent : undefined}
              />
              {entry.segments.length > 0 && <Fact value={String(entry.segments.length)} label="分段" />}
              <Fact value={String(sources.length)} label="来源" />
            </dl>

            {(games.length > 0 || seriesDef || entry.tags.length > 0) && (
              <div className="mt-5 flex flex-wrap gap-2">
                {games.map((g) =>
                  g.known ? (
                    <Chip key={g.id} href={`/games/${g.id}/`} color={gameColor(g.id)}>
                      {g.name}
                    </Chip>
                  ) : (
                    <Chip key={g.id} color={gameColor(g.id)}>
                      {g.name}
                    </Chip>
                  ),
                )}
                {seriesDef && <Chip href={`/series/${seriesDef.id}/`}>{seriesDef.name}</Chip>}
                {entry.tags.map((tag) => (
                  <Chip key={tag} href={`/archive/?q=${encodeURIComponent(tag)}`}>
                    {tag}
                  </Chip>
                ))}
              </div>
            )}

            {entry.note && <p className="measure-note mt-5 text-meta leading-relaxed text-faint">{entry.note}</p>}
            {sourceGroup.length > 1 && (
              <p className="measure-note mt-2 text-meta leading-relaxed text-faint">
                <SiteText id="entry-same-session" vars={{ count: sourceGroup.length - 1 }} />
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 在哪儿看 + 这场里在打什么 */}
      <section className="border-y border-line bg-surface/20 py-12 sm:py-16">
        <div className="site-container px-page">
          <EntryWatch
            sources={sources}
            segments={segments}
            totalSec={totalSec}
            accent={accent}
            gameNames={games.map((g) => g.name)}
            entryCover={entry.cover ?? null}
            entryTitle={entry.title}
          />
          {/*
            校对入口以前只挂在录播室里展开的那一行（EntryDetailBody），
            条目页——也就是被分享出去、被搜索引擎收到、从游戏厅点进来的那一个入口——
            反而一个都没有。发现游戏标错的那一刻正好发生在这一页，却只能自己想到去
            「联系我们」，绝大多数人不会绕这一趟。

            位置放在观看台**下面**：组件文案是「打开上面的录像看一眼」，
            看过再判断才是这个功能想要的顺序。它不在挂载时请求任何接口，
            展开才拉任务与词库，所以两千多张静态页不会因此多出一次请求。
          */}
          <div className="mt-10">
            <InlineTagCalibration entryId={entry.id} games={games} tags={entry.tags} />
          </div>
        </div>
      </section>

      {/* 前后两场 */}
      <nav aria-label="相邻记录" className="site-container grid gap-3 px-page py-10 sm:grid-cols-2 sm:py-14">
        <NeighborLink entry={older} direction="prev" />
        <NeighborLink entry={newer} direction="next" />
      </nav>

      <RelatedRail rails={rails} />

      <SiteFooter />
    </main>
    </LiveCopySeed>
  )
}

function Fact({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div>
      <dt className={`font-mono text-h3 font-bold tnum ${accent ? '' : 'text-ink'}`} style={accent ? { color: accent } : undefined}>
        {value}
      </dt>
      <dd className="mt-1 text-meta uppercase tracking-[0.16em] text-faint">{label}</dd>
    </div>
  )
}

function Chip({ href, color, children }: { href?: string; color?: string; children: React.ReactNode }) {
  const inner = (
    <>
      {color && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: color }} />}
      {children}
      {href && (
        <span aria-hidden className="font-mono text-meta text-faint/70 transition-transform group-hover:translate-x-0.5">
          →
        </span>
      )}
    </>
  )
  const shell =
    'inline-flex min-h-[2.25rem] items-center gap-2 rounded-full border border-line bg-surface/50 px-3 py-1.5 text-meta text-muted'
  if (!href) return <span className={shell}>{inner}</span>
  return (
    <Link
      href={href}
      prefetch={false}
      className={`ui-press group ${shell} transition-colors hover:border-muted hover:text-ink`}
    >
      {inner}
    </Link>
  )
}

/** 前后两场：整块可点（原来只有一行会被 truncate 到 45% 的窄链接）。 */
function NeighborLink({
  entry,
  direction,
}: {
  entry: { id: string; date: string; title: string } | undefined
  direction: 'prev' | 'next'
}) {
  if (!entry) return <span aria-hidden className="hidden sm:block" />
  const isPrev = direction === 'prev'
  return (
    <Link
      href={`/e/${entry.id}/`}
      prefetch={false}
      className={`ui-press group flex min-h-[4rem] flex-col justify-center rounded-xl border border-line bg-surface/30 px-4 py-3 transition-colors hover:border-muted hover:bg-surface/60 ${
        isPrev ? '' : 'sm:items-end sm:text-right'
      }`}
    >
      <span className="text-meta text-faint">{isPrev ? '← 更早一场' : '更晚一场 →'}</span>
      <span className="mt-1 line-clamp-2 text-body text-muted transition-colors group-hover:text-ink">
        <span className="font-mono text-meta text-faint tnum">{entry.date}</span> {entry.title}
      </span>
    </Link>
  )
}
