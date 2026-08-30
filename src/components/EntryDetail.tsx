'use client'

import { useEffect, useState } from 'react'
import { InlineTagCalibration } from '@/components/InlineTagCalibration'
import type { TimelineEntry, TimelineSource } from '@/lib/data'
import { getBilibiliVideoMeta } from '@/lib/bilibili'
import { detectPlatform, PLATFORM_META, proxyImage, SOURCE_KIND_LABEL } from '@/lib/platforms'
import { formatDuration, gameColor } from '@/lib/ui'
import type { Platform } from '@/lib/schema'
import { analyticsSourceTarget } from '@/lib/site-analytics'

/**
 * 展开后那一整块「来源 / 分 P / 标签 / 校准」的内容，连同它的来源切换状态。
 *
 * 抽出来是因为现在有两种容器要用同一份内容：时间轴列表里就地展开的一行（EntryRow），
 * 以及封面网格里插在整行下方的详情面板（EntryGrid）。两边共用同一个组件，
 * 才不会出现「网格里点开的信息比列表里少一截」这种两套实现各长各的情况。
 */

/**
 * 选中来源 + 该来源的封面。
 * 数据里没存封面时，按 B 站公开接口现查一次（同 BV 全站共用一个请求，见 lib/bilibili）；
 * 明确标了 coverUnreliable 的来源不查——那种封面属于整支视频，套到这个来源上就是错的。
 */
export function useEntrySource(entry: TimelineEntry) {
  const defaultSourceIndex = Math.max(0, entry.sources.findIndex((source) => source.url === entry.primaryUrl))
  const [sourceIndex, setSourceIndex] = useState(defaultSourceIndex)
  const selectedSource = entry.sources[sourceIndex] ?? entry.sources[0]
  const selectedCover = proxyImage(selectedSource?.cover ?? selectedSource?.partDetails?.[0]?.cover ?? entry.cover ?? undefined, 640)
  const coverUnreliable = Boolean(selectedSource?.coverUnreliable)
  const [sourceFallbackCover, setSourceFallbackCover] = useState<{ url: string; cover: string | null } | null>(null)
  const selectedSourceUrl = selectedSource?.url

  useEffect(() => {
    if (selectedCover || !selectedSourceUrl || coverUnreliable) return
    let cancelled = false
    getBilibiliVideoMeta(selectedSourceUrl).then((meta) => {
      if (!cancelled) setSourceFallbackCover({ url: selectedSourceUrl, cover: meta?.cover ?? null })
    })
    return () => { cancelled = true }
  }, [selectedCover, selectedSourceUrl, coverUnreliable])

  const displayCover =
    selectedCover ??
    (coverUnreliable ? null : sourceFallbackCover?.url === selectedSourceUrl ? sourceFallbackCover.cover : null)

  return { sourceIndex, setSourceIndex, selectedSource, displayCover }
}

/**
 * 详情正文。外面的容器（圆角、边框、缩进、入场动画）由各自的调用方决定，
 * 这里只负责内容本身。
 */
export function EntryDetailBody({ entry }: { entry: TimelineEntry }) {
  const platform = PLATFORM_META[entry.platform as Platform]
  const { sourceIndex, setSourceIndex, selectedSource, displayCover } = useEntrySource(entry)

  return (
    <div className="grid items-start sm:grid-cols-[minmax(220px,36%)_1fr]">
      <EntryCover cover={displayCover ?? undefined} title={selectedSource?.entryTitle ?? entry.title} destination={selectedSource?.url} />

      <div className="flex min-w-0 flex-col p-[clamp(1.25rem,1.65vw,2.75rem)]">
        {selectedSource ? (
          <a
            href={selectedSource.url}
            target="_blank"
            rel="noopener noreferrer"
            data-analytics-event="source.open"
            data-analytics-target={analyticsSourceTarget(detectPlatform(selectedSource.url))}
            className="block text-h3 font-medium leading-snug text-ink transition-colors hover:text-live"
          >
            {selectedSource.entryTitle} <span className="font-mono text-meta text-live">↗</span>
          </a>
        ) : (
          <h3 className="mt-2 text-h3 font-medium leading-snug text-ink">{entry.title}</h3>
        )}

        <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-meta text-faint tnum">
          <span style={{ color: platform?.color }}>{platform?.name ?? entry.platform}</span>
          <span>{entry.date}{entry.time ? ` ${entry.time}` : ''}</span>
          <span>{formatDuration(entry.duration_min)}</span>
        </div>

        {entry.bands.some((band) => band.game) && (
          <div className="mt-4">
            <SegmentBar entry={entry} />
          </div>
        )}

        {entry.sources.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {entry.sources.map((source, index) => {
                const sourcePlatform = detectPlatform(source.url)
                const sourceMeta = sourcePlatform ? PLATFORM_META[sourcePlatform] : undefined
                const active = index === sourceIndex
                return (
                  <button
                    key={source.url}
                    type="button"
                    onClick={() => setSourceIndex(index)}
                    aria-pressed={active}
                    title={`切换到${index === 0 ? '主链接' : `备选 ${index}`}`}
                    className={`ui-press group/source flex min-h-14 min-w-0 w-full items-center justify-between gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left text-control transition-colors ${active ? 'border-live/55 bg-live/10 text-ink shadow-[0_8px_24px_rgba(91,200,232,.06)]' : 'border-line bg-base/35 text-muted hover:border-muted hover:text-ink'}`}
                  >
                    <span className="min-w-0">
                      <span className="font-medium" style={{ color: sourceMeta?.color }}>{index === 0 ? '主链接' : `备选 ${index}`}</span>
                      <span className="ml-2 text-faint">{sourceMeta?.name ?? SOURCE_KIND_LABEL[source.kind] ?? source.kind}</span>
                      {source.accountName && <span className="ml-2 text-faint">{source.accountName}</span>}
                      {(source.parts ?? source.partDetails?.length) && <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 font-mono text-meta text-live">{source.parts ?? source.partDetails?.length}P</span>}
                      <span className="mt-0.5 block truncate text-meta text-faint">{source.entryTitle}</span>
                    </span>
                    <span className={`shrink-0 whitespace-nowrap font-mono text-meta ${active ? 'text-live' : 'text-faint'}`}>{active ? '当前来源 ✓' : '切换'}</span>
                  </button>
                )
              })}
            </div>

            <SelectedSourceParts source={selectedSource} />
          </div>
        )}

        {entry.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <span key={tag} className="rounded-sm border border-line px-1.5 py-0.5 text-meta text-muted">{tag}</span>
            ))}
          </div>
        )}

        <InlineTagCalibration entryId={entry.id} games={entry.games} />
      </div>
    </div>
  )
}

function SelectedSourceParts({ source }: { source: TimelineSource | undefined }) {
  if (!source) return null
  if (!source.partDetails?.length) {
    return source.parts && source.parts > 1 ? (
      <p className="mt-3 rounded-lg border border-line bg-base/30 px-3 py-2 text-meta leading-relaxed text-faint">
        当前来源共 {source.parts}P，具体标题和跳转页尚未核实。
      </p>
    ) : null
  }

  return (
    <section className="ui-content-swap mt-3 rounded-xl border border-line bg-base/30 p-2.5" aria-label="当前来源的分 P">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1 pb-2">
        <div>
          <p className="text-meta uppercase tracking-[0.16em] text-live">当前来源的分 P</p>
          <p className="mt-1 text-meta leading-relaxed text-faint">随上方来源切换；点击任意一段直接打开对应页面。</p>
        </div>
        <span className="font-mono text-meta text-faint tnum">{source.partDetails.length}P</span>
      </div>
      <ol className="grid gap-1.5 lg:grid-cols-2">
        {source.partDetails.map((part) => {
          const partCover = proxyImage(part.cover, 180)
          return (
            <li key={part.page}>
              <a
                href={sourcePartHref(source.url, part.page)}
                target="_blank"
                rel="noopener noreferrer"
                data-analytics-event="source.open"
                data-analytics-target={analyticsSourceTarget(detectPlatform(source.url))}
                className="ui-press group/part flex min-h-12 items-center gap-2.5 rounded-lg border border-transparent bg-surface/35 p-1.5 transition-colors hover:border-live/35 hover:bg-live/8"
              >
                <span className="relative h-10 w-[4.5rem] shrink-0 overflow-hidden rounded-md bg-raised">
                  {partCover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={partCover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform group-hover/part:scale-105" />
                  ) : <span className="flex h-full items-center justify-center font-mono text-meta text-faint">P{part.page}</span>}
                  <span className="absolute left-1 top-1 rounded bg-black/65 px-1 font-mono text-[10px] font-semibold text-white">P{part.page}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-meta leading-snug text-muted group-hover/part:text-ink">{part.title}</span>
                  {part.duration_sec && <span className="mt-0.5 block font-mono text-[10px] text-faint tnum">{formatPartDuration(part.duration_sec)}</span>}
                </span>
                <span className="shrink-0 font-mono text-live">↗</span>
              </a>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function sourcePartHref(sourceUrl: string, page: number): string {
  try {
    const url = new URL(sourceUrl)
    url.searchParams.set('p', String(page))
    return url.toString()
  } catch {
    return sourceUrl
  }
}

export function formatPartDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

function EntryCover({
  cover,
  title,
  destination,
}: {
  cover: string | undefined
  title: string
  destination?: string
}) {
  const content = (
    <>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain transition duration-500 group-hover/cover:scale-[1.025]"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-meta text-faint">无封面</span>
      )}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-50 transition-opacity duration-300 group-hover/cover:opacity-80" />
      {destination && (
        <span className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-meta text-white backdrop-blur-sm">
          打开主来源 ↗
        </span>
      )}
    </>
  )

  // 桌面端只保留横向封面视窗；右侧分 P、标签和校准区决定卡片高度，封面在其中垂直居中。
  // 不再用固定高视窗，否则横向视频封面会被拉进纵向容器并裁掉主体。
  const className = 'group/cover relative aspect-video overflow-hidden bg-raised sm:self-center'
  if (!destination) return <div className={className}>{content}</div>
  return (
    <a href={destination} target="_blank" rel="noopener noreferrer" className={className} aria-label={`打开原平台：${title}`}>
      {content}
    </a>
  )
}

/** 分段条：这场的时间里，什么时候在打什么 */
export function SegmentBar({ entry }: { entry: TimelineEntry }) {
  if (!entry.bands.length) {
    return <p className="text-meta text-faint">尚未录入分段信息</p>
  }
  const isContentTimeline = entry.bands.some((band) => band.game)
  const fallbackColors = ['#5BC8E8', '#E5568A', '#E0A244', '#9B8AFB', '#72C7A5']
  const colorFor = (game: string | null, index: number) => game ? gameColor(game) : fallbackColors[index % fallbackColors.length]
  return (
    <div>
      <div className="group/segments flex h-2 w-full overflow-hidden rounded-full bg-raised">
        {entry.bands.map((b, i) => (
          <span
            key={i}
            className="transition-[filter,opacity] duration-300 group-hover/segments:brightness-125"
            style={{ width: `${(b.to - b.from) * 100}%`, background: colorFor(b.game, i), opacity: 0.9 }}
            title={b.name}
          />
        ))}
      </div>
      <ul className="mt-2 space-y-1 text-meta text-muted tnum">
        {entry.bands.map((b, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: colorFor(b.game, i) }} />
            {!isContentTimeline && <span className="rounded border border-line px-1 font-mono text-[10px] text-live">P{i + 1}</span>}
            <span className="min-w-0 flex-1 truncate">{b.name}</span>
            {entry.duration_min && <span className="shrink-0 font-mono text-[10px] text-faint">{formatPartDuration(Math.round(entry.duration_min * 60 * b.from))}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
