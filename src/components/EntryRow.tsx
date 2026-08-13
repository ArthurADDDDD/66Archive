'use client'

import { InlineTagCalibration } from '@/components/InlineTagCalibration'
import { useState } from 'react'
import type { TimelineEntry, TimelineSource } from '@/lib/data'
import { visibleGameIds } from '@/lib/games'
import { detectPlatform, PLATFORM_META, proxyImage, SOURCE_KIND_LABEL } from '@/lib/platforms'
import { barHeight, formatDuration, gameColor } from '@/lib/ui'
import type { Platform } from '@/lib/schema'

/**
 * 时间轴上的一行。
 * 竖条用受限的线性高度表示时长，条内色带是当时在打的游戏。
 * 极长直播会封顶，准确时长始终以文字为准。
 */
export function EntryRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: TimelineEntry
  expanded: boolean
  onToggle: () => void
}) {
  const isLive = entry.type === 'live'
  const platform = PLATFORM_META[entry.platform as Platform]
  const h = barHeight(entry)
  const dead = entry.sourceCount > 0 && entry.deadCount === entry.sourceCount
  const defaultSourceIndex = Math.max(0, entry.sources.findIndex((source) => source.url === entry.primaryUrl))
  const [sourceIndex, setSourceIndex] = useState(defaultSourceIndex)
  const selectedSource = entry.sources[sourceIndex] ?? entry.sources[0]
  const selectedCover = proxyImage(selectedSource?.cover ?? selectedSource?.partDetails?.[0]?.cover ?? entry.cover ?? undefined, 640)
  const compactGameIds = new Set(visibleGameIds(entry.games.map((game) => game.id)))
  const compactGames = entry.games.filter((game) => compactGameIds.has(game.id))

  return (
    <article className={`group relative rounded-lg transition-colors duration-300 ${expanded ? 'bg-surface/25' : 'hover:bg-surface/10'}`}>
      <div className="flex gap-3 py-1.5 sm:gap-4">
        {/* 日期与开播时间 */}
        <div className="w-11 shrink-0 pt-[3px] text-right font-mono text-meta leading-tight tnum sm:w-14">
          <div className="text-muted">{entry.date.slice(5).replace('-', '/')}</div>
          {entry.time && <div className="text-faint">{entry.time}</div>}
        </div>

        {/* 时长竖条 —— 本站的度量衡。时长未知时绝不能画得像"很短"，
            那是在编造数据没有的信息，所以未知时只给一个空心点。 */}
        <div className="flex w-3 shrink-0 justify-center pt-[5px]">
          {entry.duration_min ? (
            <div
              className="relative w-[7px] overflow-hidden rounded-full transition-[filter] group-hover:brightness-125"
              style={{
                height: h,
                background: isLive ? 'rgba(91,200,232,0.22)' : 'rgba(224,162,68,0.30)',
                opacity: dead ? 0.4 : 1,
              }}
            >
              {isLive && entry.bands.length > 0
                ? entry.bands.map((b, i) => (
                    <span
                      key={i}
                      className="absolute left-0 w-full"
                      style={{
                        top: `${b.from * 100}%`,
                        height: `${Math.max(0.02, b.to - b.from) * 100}%`,
                        background: gameColor(b.game),
                        opacity: b.game ? 0.9 : 0.35,
                      }}
                    />
                  ))
                : !isLive && <span className="absolute inset-0 bg-video/80" />}
            </div>
          ) : (
            <span
              className="mt-[3px] h-[7px] w-[7px] shrink-0 rounded-full border"
              style={{ borderColor: isLive ? 'rgba(91,200,232,0.45)' : 'rgba(224,162,68,0.5)' }}
              title="时长未知"
            />
          )}
        </div>

        {/* 内容 */}
        <div className="min-w-0 flex-1 pb-1">
          <button
            onClick={onToggle}
            className="ui-press flex w-full items-start gap-3 rounded-sm text-left"
            aria-expanded={expanded}
            aria-controls={`entry-preview-${entry.id}`}
          >
            {/* 手机端两行不截断——13% 安全边距下 truncate 会把中文标题切得只剩几个字 */}
            <h3
              className={`min-w-0 flex-1 text-body leading-snug transition-colors line-clamp-2 group-hover:text-white sm:line-clamp-none sm:truncate ${
                dead ? 'text-muted line-through decoration-faint' : 'text-ink'
              }`}
            >
              {entry.title}
            </h3>
            <span className={`shrink-0 font-mono text-meta text-faint transition-[transform,color] duration-300 ${expanded ? 'rotate-45 scale-110 text-live' : 'group-hover:text-muted'}`} aria-hidden>
              +
            </span>
          </button>

          {/* meta 行：手机端只留「平台 · 时长 · 首个游戏」。
              来源数 / 核验状态 / 待考证在手机上会把这一行撑成 2~3 行，且每条数量不同，
              整列行高参差——这些信息一条不少，都在下面展开的卡片里。 */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-faint tnum">
            <span style={{ color: platform?.color }}>{platform?.name ?? entry.platform}</span>
            <span className="text-line">·</span>
            <span>{formatDuration(entry.duration_min)}</span>
            {compactGames.length > 0 && (
              <>
                <span className="text-line">·</span>
                <span className="flex min-w-0 items-center gap-1.5 text-muted">
                  {compactGames.slice(0, 2).map((game, index) => (
                    <span key={game.id} className={`flex min-w-0 items-center gap-1 ${index > 0 ? 'hidden sm:flex' : ''}`}>
                      {index > 0 && <span className="mr-0.5 text-line">/</span>}
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: gameColor(game.id) }} />
                      <span className="truncate">{game.name}</span>
                    </span>
                  ))}
                  {compactGames.length > 2 && <span className="hidden text-faint sm:inline">+{compactGames.length - 2}</span>}
                </span>
              </>
            )}
            {entry.sourceCount > 0 && (
              <>
                <span className="text-line">·</span>
                <span className="text-muted">
                  共有{formatSourceCount(entry.sourceCount)}段录像来源
                  {dead ? <span className="text-today">（已失效）</span>
                    : entry.aliveCount === entry.sourceCount ? <span className="text-live">（已核验）</span>
                      : entry.aliveCount > 0 ? <span className="text-live">（部分核验）</span>
                        : entry.uncheckedCount > 0 ? <span className="text-faint">（未复查）</span> : null}
                </span>
              </>
            )}
            {entry.confidence === 'low' && (
              <span className="rounded-sm border border-line px-1 text-faint">待考证</span>
            )}
          </div>

          {/* 点击条目后就地展开；跳转只发生在展开卡片内。 */}
          {expanded && (
            <div id={`entry-preview-${entry.id}`} className="ui-panel-in mt-4 overflow-hidden rounded-xl border border-line bg-surface/75 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
              <div className="grid items-start sm:grid-cols-[minmax(220px,36%)_1fr]">
                <EntryCover cover={selectedCover ?? undefined} title={selectedSource?.entryTitle ?? entry.title} destination={selectedSource?.url} />

                <div className="flex min-w-0 flex-col p-4 sm:p-5">
                  {selectedSource ? (
                    <a href={selectedSource.url} target="_blank" rel="noopener noreferrer" className="block text-h3 font-medium leading-snug text-ink transition-colors hover:text-live">
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
                              className={`ui-press group/source flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-control transition-colors ${active ? 'border-live/55 bg-live/10 text-ink shadow-[0_8px_24px_rgba(91,200,232,.06)]' : 'border-line bg-base/35 text-muted hover:border-muted hover:text-ink'}`}
                            >
                              <span className="min-w-0">
                                <span className="font-medium" style={{ color: sourceMeta?.color }}>{index === 0 ? '主链接' : `备选 ${index}`}</span>
                                <span className="ml-2 text-faint">{sourceMeta?.name ?? SOURCE_KIND_LABEL[source.kind] ?? source.kind}</span>
                                {source.accountName && <span className="ml-2 text-faint">{source.accountName}</span>}
                                {(source.parts ?? source.partDetails?.length) && <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 font-mono text-meta text-live">{source.parts ?? source.partDetails?.length}P</span>}
                                <span className="mt-0.5 block truncate text-meta text-faint">{source.entryTitle}</span>
                              </span>
                              <span className={`shrink-0 font-mono text-meta ${active ? 'text-live' : 'text-faint'}`}>{active ? '当前来源 ✓' : '切换'}</span>
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
            </div>
          )}
        </div>
      </div>
    </article>
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
              <a href={sourcePartHref(source.url, part.page)} target="_blank" rel="noopener noreferrer" className="ui-press group/part flex min-h-12 items-center gap-2.5 rounded-lg border border-transparent bg-surface/35 p-1.5 transition-colors hover:border-live/35 hover:bg-live/8">
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

function formatPartDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatSourceCount(count: number): string {
  return ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'][count] ?? String(count)
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
          className="h-full w-full object-cover transition duration-500 group-hover/cover:scale-[1.025]"
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

  // 桌面端使用固定封面视窗：右侧校准区展开/收起时不会再把图片拉长。
  const className = 'group/cover relative aspect-video overflow-hidden bg-raised sm:h-[clamp(28rem,52vw,42rem)] sm:aspect-auto sm:self-start'
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
