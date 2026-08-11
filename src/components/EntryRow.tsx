'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
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
  const destination = selectedSource?.url ?? `/e/${entry.id}/`
  const cover = proxyImage(entry.cover ?? undefined, 640)
  const opensSource = Boolean(selectedSource)
  const compactGameIds = new Set(visibleGameIds(entry.games.map((game) => game.id)))

  return (
    <article className={`group relative rounded-lg transition-colors duration-300 ${expanded ? 'bg-surface/25' : 'hover:bg-surface/10'}`}>
      <div className="flex gap-3 py-1.5 sm:gap-4">
        {/* 日期与开播时间 */}
        <div className="w-11 shrink-0 pt-[3px] text-right font-mono text-[11px] leading-tight tnum sm:w-14">
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
            <h3
              className={`min-w-0 flex-1 truncate text-[15px] leading-snug transition-colors group-hover:text-white ${
                dead ? 'text-muted line-through decoration-faint' : 'text-ink'
              }`}
            >
              {entry.title}
            </h3>
            <span className={`shrink-0 font-mono text-[11px] text-faint transition-[transform,color] duration-300 ${expanded ? 'rotate-45 scale-110 text-live' : 'group-hover:text-muted'}`} aria-hidden>
              +
            </span>
          </button>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-faint tnum">
            <span style={{ color: platform?.color }}>{platform?.name ?? entry.platform}</span>
            <span className="text-line">·</span>
            <span>{formatDuration(entry.duration_min)}</span>
            {entry.games.filter((game) => compactGameIds.has(game.id)).slice(0, 2).map((g) => (
              <span key={g.id} className="flex items-center gap-1 text-muted">
                <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: gameColor(g.id) }} />
                {g.name}
              </span>
            ))}
            {entry.sourceCount > 1 && <span className="text-muted">1 主 + {entry.sourceCount - 1} 备选</span>}
            {entry.aliveCount > 0 && <span className="text-live/80">已核验</span>}
            {entry.aliveCount === 0 && entry.uncheckedCount > 0 && <span className="text-faint">来源未复查</span>}
            {entry.confidence === 'low' && (
              <span className="rounded-sm border border-line px-1 text-[10px] text-faint">待考证</span>
            )}
            {dead && <span className="text-today/80">全部链接已失效</span>}
          </div>

          {/* 点击条目后就地展开；跳转只发生在展开卡片内。 */}
          {expanded && (
            <div id={`entry-preview-${entry.id}`} className="ui-panel-in mt-4 overflow-hidden rounded-xl border border-line bg-surface/75 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
              <div className="grid sm:grid-cols-[minmax(220px,36%)_1fr]">
                <Link
                  href={destination}
                  target={opensSource ? '_blank' : undefined}
                  rel={opensSource ? 'noopener noreferrer' : undefined}
                  className="group/cover relative aspect-video overflow-hidden bg-raised sm:aspect-auto sm:min-h-[220px]"
                  aria-label={opensSource ? `打开原平台：${entry.title}` : `查看详情：${entry.title}`}
                >
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
                    <span className="flex h-full items-center justify-center font-mono text-[10px] text-faint">无封面</span>
                  )}
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-50 transition-opacity duration-300 group-hover/cover:opacity-80" />
                  <span className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 font-mono text-[9px] text-white backdrop-blur-sm">
                    {opensSource ? '打开原平台 ↗' : '查看详情 →'}
                  </span>
                </Link>

                <div className="flex min-w-0 flex-col p-4 sm:p-5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                    {opensSource ? '选择来源，再点击标题或封面打开原平台' : '当前没有外部来源'}
                  </p>
                  <Link
                    href={destination}
                    target={opensSource ? '_blank' : undefined}
                    rel={opensSource ? 'noopener noreferrer' : undefined}
                    className="mt-2 block text-[17px] font-medium leading-snug text-ink transition-colors hover:text-live"
                  >
                    {selectedSource?.entryTitle ?? entry.title} <span className="font-mono text-[11px] text-live">{opensSource ? '↗' : '→'}</span>
                  </Link>

                  <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 font-mono text-[10px] text-faint tnum">
                    <span style={{ color: platform?.color }}>{platform?.name ?? entry.platform}</span>
                    <span>{entry.date}{entry.time ? ` ${entry.time}` : ''}</span>
                    <span>{formatDuration(entry.duration_min)}</span>
                  </div>

                  <div className="mt-4">
                    <SegmentBar entry={entry} />
                  </div>

                  {entry.sources.length > 1 && (
                    <div className="mt-4 border-t border-line pt-4">
                      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">选择录像来源</p>
                      <div className="flex flex-wrap gap-2">
                        {entry.sources.map((source, index) => {
                          const sourcePlatform = detectPlatform(source.url)
                          const sourceMeta = sourcePlatform ? PLATFORM_META[sourcePlatform] : undefined
                          const active = index === sourceIndex
                          return (
                            <button
                              key={source.url}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setSourceIndex(index)}
                              title={source.entryTitle}
                              className={`ui-press rounded-md border px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors ${
                                active ? 'border-live bg-live/10 text-ink' : 'border-line bg-base/45 text-muted hover:border-muted hover:text-ink'
                              }`}
                            >
                              <span style={{ color: sourceMeta?.color }}>{index === 0 ? '主链接' : `备选 ${index}`}</span>
                              <span className="ml-1.5 text-faint">{sourceMeta?.name ?? SOURCE_KIND_LABEL[source.kind] ?? source.kind}</span>
                              {source.accountName && <span className="ml-1.5 text-faint">{source.accountName}</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {entry.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[9px] text-muted">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 font-mono text-[10px]">
                    <span className="text-faint">
                      {entry.sourceCount > 1 ? `1 个主链接 · ${entry.sourceCount - 1} 个备选` : `${entry.sourceCount} 个来源`}
                      {entry.mergedEntryCount > 0 && ` · 已折叠 ${entry.mergedEntryCount} 条同场记录`}
                      {entry.aliveCount > 0 && ` · ${entry.aliveCount} 个已核验`}
                      {entry.uncheckedCount > 0 && ` · ${entry.uncheckedCount} 个未复查`}
                      {entry.deadCount > 0 && ` · ${entry.deadCount} 个失效`}
                    </span>
                    <Link href={`/e/${entry.id}/`} className="text-live underline underline-offset-4">完整详情 →</Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

/** 分段条：这场的时间里，什么时候在打什么 */
export function SegmentBar({ entry }: { entry: TimelineEntry }) {
  if (!entry.bands.length) {
    return <p className="font-mono text-[11px] text-faint">尚未录入分段信息</p>
  }
  return (
    <div>
      <div className="group/segments flex h-2 w-full overflow-hidden rounded-full bg-raised">
        {entry.bands.map((b, i) => (
          <span
            key={i}
            className="transition-[filter,opacity] duration-300 group-hover/segments:brightness-125"
            style={{ width: `${(b.to - b.from) * 100}%`, background: gameColor(b.game), opacity: b.game ? 0.9 : 0.3 }}
            title={b.name}
          />
        ))}
      </div>
      <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted tnum">
        {entry.bands.map((b, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: gameColor(b.game) }} />
            <span className="truncate">{b.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
