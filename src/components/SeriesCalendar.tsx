import { eraOf } from '@/lib/covers'
import { WEEKDAY_CN, type CalendarYear } from '@/lib/series-stats'

/** 一格 9px，格间距 3px。 */
const CELL = 9
const PITCH = 12

/**
 * 一档节目的跨年周历。
 *
 * 一列是一周，一行是星期几。固定在周日播的节目，会在"日"那一行连成一条几乎不断的亮线——
 * 《心灵砒霜》七年 243 期、219 期在星期天，这件事只有摊成格子才看得见，
 * 243 行的表格里它是隐形的。
 *
 * 用 SVG 而不是 div 网格：空格子有两千七百多个，逐个生成节点会让这一页凭空多出六百多 KB（实测 1,107 KB → 475 KB），
 * 而它们全是同一个灰方块——所以底色用一个 pattern 一次铺完，只有真正有一期的那 243 天
 * 才是独立的元素。
 *
 * 刻意不做的：不加悬浮弹层、不加图例、不做"活跃度分级"的深浅色阶。
 * 每个格子只有两种状态——那天有一期，或者没有。深浅色阶会让人去比较"哪年更活跃"，
 * 那是分析师的问题，不是这一页要回答的。
 */
export function SeriesCalendar({
  years,
  highlightWeekday,
}: {
  years: CalendarYear[]
  highlightWeekday?: number
}) {
  return (
    <div className="space-y-5">
      {years.map(({ year, weekCount, lit }) => {
        const width = weekCount * PITCH - (PITCH - CELL)
        const height = 7 * PITCH - (PITCH - CELL)
        const patternId = `cal-empty-${year}`

        return (
          <div key={year} className="flex items-start gap-3">
            <span className="w-9 shrink-0 pt-px font-mono text-[11px] text-faint tnum">{year}</span>

            <div className="flex shrink-0 flex-col" style={{ gap: PITCH - CELL }}>
              {WEEKDAY_CN.map((label, day) => (
                <span
                  key={day}
                  className={`font-mono text-[8px] ${day === highlightWeekday ? 'text-ink' : 'text-faint/50'}`}
                  style={{ height: CELL, lineHeight: `${CELL}px` }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="min-w-0 flex-1 overflow-x-auto pb-1">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                width={width}
                height={height}
                role="img"
                aria-label={`${year} 年，共 ${lit.length} 期`}
                className="block max-w-full"
              >
                <defs>
                  <pattern id={patternId} width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
                    <rect width={CELL} height={CELL} rx="1" className="fill-line/40" />
                  </pattern>
                </defs>
                <rect width={width} height={height} fill={`url(#${patternId})`} />

                {lit.map((cell) => (
                  <a key={cell.date} href={`/e/${cell.entry.id}/`}>
                    <title>{`${cell.date} ${cell.entry.title}`}</title>
                    <rect
                      x={cell.weekIndex * PITCH}
                      y={cell.weekday * PITCH}
                      width={CELL}
                      height={CELL}
                      rx="1"
                      fill={eraOf(cell.date).color}
                    />
                  </a>
                ))}
              </svg>
            </div>
          </div>
        )
      })}
    </div>
  )
}
