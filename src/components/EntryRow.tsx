'use client'

import Link from 'next/link'
import type { TimelineEntry } from '@/lib/data'
import { PLATFORM_META } from '@/lib/platforms'
import { barHeight, formatDuration, gameColor } from '@/lib/ui'
import type { Platform } from '@/lib/schema'

/**
 * 时间轴上的一行。
 * 竖条的高度就是这场的真实时长——8 小时的直播是 1 小时的 8 倍高，
 * 条内色带是当时在打的游戏。滚过页面即是滚过他真正播出去的小时数。
 */
export function EntryRow({
  entry,
  expanded,
  onHover,
  onToggle,
}: {
  entry: TimelineEntry
  expanded: boolean
  onHover: (e: TimelineEntry | null, rect?: DOMRect) => void
  onToggle: () => void
}) {
  const isLive = entry.type === 'live'
  const platform = PLATFORM_META[entry.platform as Platform]
  const h = barHeight(entry)
  const dead = entry.sourceCount > 0 && entry.aliveCount === 0

  return (
    <article
      className="group relative"
      onMouseEnter={(ev) => onHover(entry, ev.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onHover(null)}
    >
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
            className="block w-full text-left"
            aria-expanded={expanded}
          >
            <h3
              className={`truncate text-[15px] leading-snug transition-colors group-hover:text-white ${
                dead ? 'text-muted line-through decoration-faint' : 'text-ink'
              }`}
            >
              {entry.title}
            </h3>
          </button>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-faint tnum">
            <span style={{ color: platform?.color }}>{platform?.name ?? entry.platform}</span>
            <span className="text-line">·</span>
            <span>{formatDuration(entry.duration_min)}</span>
            {entry.games.slice(0, 2).map((g) => (
              <span key={g.id} className="flex items-center gap-1 text-muted">
                <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: gameColor(g.id) }} />
                {g.name}
              </span>
            ))}
            {entry.sourceCount > 1 && <span className="text-muted">{entry.sourceCount} 源</span>}
            {entry.confidence === 'low' && (
              <span className="rounded-sm border border-line px-1 text-[10px] text-faint">待考证</span>
            )}
            {dead && <span className="text-today/80">链接已失效</span>}
          </div>

          {/* 触摸设备没有 hover：点击就地展开，不跳页 */}
          {expanded && (
            <div className="mt-2.5 rounded border border-line bg-surface/70 p-3 lg:hidden">
              <SegmentBar entry={entry} />
              <Link
                href={`/e/${entry.id}/`}
                className="mt-3 inline-block font-mono text-[11px] text-live underline underline-offset-4"
              >
                查看全部来源 →
              </Link>
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
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-raised">
        {entry.bands.map((b, i) => (
          <span
            key={i}
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
