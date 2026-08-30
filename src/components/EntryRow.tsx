'use client'

import type { TimelineEntry } from '@/lib/data'
import { EntryDetailBody } from './EntryDetail'
import { visibleGameIds } from '@/lib/games'
import { PLATFORM_META } from '@/lib/platforms'
import { barHeight, formatDuration, gameColor } from '@/lib/ui'
import type { Platform } from '@/lib/schema'

export { SegmentBar } from './EntryDetail'

/**
 * 时间轴上的一行。
 * 竖条用受限的线性高度表示时长，条内色带是当时在打的游戏。
 * 极长直播会封顶，准确时长始终以文字为准。
 */
export function EntryRow({
  entry,
  expanded,
  onToggle,
  showFullDate = false,
}: {
  entry: TimelineEntry
  expanded: boolean
  onToggle: () => void
  /** 跨年份浏览时保留完整日期；单一时期的列表可保持紧凑的月/日显示。 */
  showFullDate?: boolean
}) {
  const isLive = entry.type === 'live'
  const platform = PLATFORM_META[entry.platform as Platform]
  const h = barHeight(entry)
  const dead = entry.sourceCount > 0 && entry.deadCount === entry.sourceCount
  const compactGameIds = new Set(visibleGameIds(entry.games.map((game) => game.id)))
  const compactGames = entry.games.filter((game) => compactGameIds.has(game.id))
  const dateClass = showFullDate
    ? 'w-[clamp(4.75rem,7vw,7rem)]'
    : 'w-[clamp(2.75rem,4vw,4rem)] sm:w-[clamp(3.5rem,5vw,5rem)]'

  return (
    <article id={`entry-${entry.id}`} className={`group relative scroll-mt-24 rounded-lg transition-colors duration-300 ${expanded ? 'bg-surface/25 p-[clamp(0.75rem,1.25vw,1.75rem)]' : 'hover:bg-surface/10'}`}>
      <div className="py-[clamp(0.375rem,0.55vw,0.75rem)]">
        {/* 收起也是点这颗按钮，但那不是「点开」：展开状态下不挂上报属性，
            否则一次展开加一次收起会被记成两次打开。 */}
        <button
          {...(expanded ? {} : { 'data-analytics-event': 'content.open', 'data-analytics-target': `entry:${entry.id}` })}
          onClick={onToggle}
          className="ui-press flex w-full items-start gap-3 rounded-lg py-[clamp(0.5rem,0.7vw,0.875rem)] text-left sm:gap-4"
          aria-expanded={expanded}
          aria-controls={`entry-preview-${entry.id}`}
        >
        {/* 日期与开播时间 */}
        <div className={`${dateClass} shrink-0 pt-[3px] text-right font-mono text-meta leading-tight tnum`}>
          <div className="text-muted">{showFullDate ? entry.date : entry.date.slice(5).replace('-', '/')}</div>
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
          {/* 手机端两行不截断——13% 安全边距下 truncate 会把中文标题切得只剩几个字 */}
          <h3
            className={`min-w-0 text-body leading-snug transition-colors line-clamp-2 group-hover:text-white sm:line-clamp-none sm:truncate ${
              dead ? 'text-muted line-through decoration-faint' : 'text-ink'
            }`}
          >
            {entry.title}
          </h3>

          {/* 三组元信息与标题一起属于整条记录的触发区。 */}
          <div className="mt-1 space-y-1 text-meta text-faint tnum">
            {/* 三组元信息各占一行，避免不同标题长度触发 flex 换行后视觉错位。 */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span style={{ color: platform?.color }}>{platform?.name ?? entry.platform}</span>
              <span className="text-line">·</span>
              <span>{formatDuration(entry.duration_min)}</span>
            </div>

            {compactGames.length > 0 && (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-muted">
                {compactGames.slice(0, 2).map((game, index) => (
                  <span key={game.id} className={`flex min-w-0 items-center gap-1 ${index > 0 ? 'hidden sm:flex' : ''}`}>
                    {index > 0 && <span className="mr-0.5 text-line">/</span>}
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: gameColor(game.id) }} />
                    <span className="truncate">{game.name}</span>
                  </span>
                ))}
                {compactGames.length > 2 && <span className="hidden text-faint sm:inline">+{compactGames.length - 2}</span>}
              </div>
            )}

          </div>
        </div>

        <span className={`shrink-0 pt-0.5 font-mono text-meta text-faint transition-[transform,color] duration-300 ${expanded ? 'rotate-45 scale-110 text-live' : 'group-hover:text-muted'}`} aria-hidden>
          +
        </span>
        </button>

          {/* 点击条目后就地展开；跳转只发生在展开卡片内。 */}
          {expanded && (
            <div id={`entry-preview-${entry.id}`} className="ui-panel-in mt-[clamp(0.5rem,0.8vw,1rem)] overflow-hidden rounded-xl border border-line bg-surface/75 shadow-[0_18px_55px_rgba(0,0,0,0.18)] sm:ml-[clamp(4.5rem,8vw,7rem)] lg:ml-[clamp(6rem,9vw,8rem)]">
              <EntryDetailBody entry={entry} />
            </div>
          )}
      </div>
    </article>
  )
}
