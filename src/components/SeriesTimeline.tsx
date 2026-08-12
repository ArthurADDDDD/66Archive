import Link from 'next/link'
import type { SeriesStats } from '@/lib/series-stats'
import { gameColor } from '@/lib/ui'

/**
 * 系列甘特图：条的起止位置 = 系列实际的时间跨度，条内细线 = 每一期的真实日期。
 * 跟本站"竖条高度=时长"是同一套度量衡——密集连载的条会很"稠"，
 * 断续多年才更几期的系列条会很"稀"，一眼看出真实节奏而不是靠文字描述。
 */
export function SeriesTimeline({
  series,
  rangeStart,
  rangeEnd,
}: {
  series: SeriesStats[]
  rangeStart: string
  rangeEnd: string
}) {
  const startMs = new Date(rangeStart).getTime()
  const endMs = new Date(rangeEnd).getTime()
  const span = Math.max(1, endMs - startMs)
  const pct = (dateStr: string) => ((new Date(dateStr).getTime() - startMs) / span) * 100

  const years: number[] = []
  for (let y = new Date(rangeStart).getFullYear(); y <= new Date(rangeEnd).getFullYear(); y++) years.push(y)

  return (
    <div className="rounded-xl border border-line bg-surface/40 p-4 sm:p-6">
      <div className="relative mb-2 ml-[168px] hidden h-4 sm:block">
        {years.map((y) => (
          <span
            key={y}
            className="absolute -translate-x-1/2 font-mono text-[9px] text-faint"
            style={{ left: `${pct(`${y}-06-01`)}%` }}
          >
            {y}
          </span>
        ))}
      </div>

      <div className="space-y-0.5">
        {series.map((s) => {
          const color = gameColor(s.id)
          const left = pct(s.firstDate)
          const width = Math.max(0.6, pct(s.lastDate) - left)
          const localSpan = Math.max(1, new Date(s.lastDate).getTime() - new Date(s.firstDate).getTime())

          return (
            <Link
              key={s.id}
              href={`/series/${s.id}/`}
              className="ui-press group flex flex-col gap-1.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-raised/50 sm:flex-row sm:items-center sm:gap-4 sm:py-2"
            >
              <div className="shrink-0 sm:w-[152px]">
                <div className="truncate text-[13px] text-ink group-hover:text-today">{s.name}</div>
                <div className="font-mono text-[10px] text-faint tnum">{s.entryCount} 期</div>
              </div>

              {/* 桌面：按全站真实时间比例定位的甘特条 */}
              <div className="relative hidden h-3 flex-1 rounded-full bg-raised sm:block">
                <div
                  className="absolute inset-y-0 overflow-hidden rounded-full transition-[filter] group-hover:brightness-125"
                  style={{ left: `${left}%`, width: `${width}%`, background: `${color}55` }}
                >
                  {s.entries.map((e) => (
                    <span
                      key={e.id}
                      className="absolute top-0 h-full w-px"
                      style={{
                        left: `${((new Date(e.date).getTime() - new Date(s.firstDate).getTime()) / localSpan) * 100}%`,
                        background: color,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 移动端：局部归一化的迷你条，独占一行，不跟全局比例尺对齐 */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-raised sm:hidden">
                {s.entries.map((e) => (
                  <span
                    key={e.id}
                    className="absolute top-0 h-full w-px"
                    style={{
                      left: `${((new Date(e.date).getTime() - new Date(s.firstDate).getTime()) / localSpan) * 100}%`,
                      background: color,
                    }}
                  />
                ))}
              </div>

              <span className="hidden shrink-0 font-mono text-[10px] text-faint tnum md:inline">
                {s.firstDate} → {s.lastDate}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
