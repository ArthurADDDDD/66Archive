'use client'

import { useMemo } from 'react'
import type { TimelineEntry } from '@/lib/data'

type Props = {
  entries: TimelineEntry[]
  boundary: number | null
  compact?: boolean
  activeYear?: number | null
  onJump: (year: number) => void
}

/**
 * 十六年的密度梳。一年十二齿，一齿一个月。
 * 齿高 = 该月条目数，上段琥珀（视频）下段冰青（直播），没有的月份留空。
 * 它同时是三样东西：全站的开场陈述、唯一的年份导航、以及一眼可见的补录缺口图。
 */
export function EraStrip({ entries, boundary, compact, activeYear, onJump }: Props) {
  const years = useMemo(() => {
    const map = new Map<number, { video: number; live: number }[]>()
    for (const e of entries) {
      const y = Number(e.date.slice(0, 4))
      const mo = Number(e.date.slice(5, 7)) - 1
      if (!map.has(y)) map.set(y, Array.from({ length: 12 }, () => ({ video: 0, live: 0 })))
      map.get(y)![mo][e.type]++
    }
    const list = [...map.entries()].sort((a, b) => a[0] - b[0])
    const max = Math.max(1, ...list.flatMap(([, ms]) => ms.map((m) => m.video + m.live)))
    return list.map(([year, months]) => ({ year, months, max }))
  }, [entries])

  if (!years.length) return null
  const combHeight = compact ? 22 : 76

  return (
    <div className="flex items-end gap-2 sm:gap-3" role="group" aria-label="按年份跳转">
      {years.map(({ year, months, max }) => {
        const active = activeYear === year
        const isLiveEra = boundary !== null && year >= boundary
        const total = months.reduce((n, m) => n + m.video + m.live, 0)
        return (
          <button
            key={year}
            onClick={() => onJump(year)}
            aria-label={`跳转到 ${year} 年，共 ${total} 条`}
            title={`${year} 年 · ${total} 条`}
            className="group flex flex-1 flex-col gap-1.5 transition-opacity"
            style={{ opacity: active || activeYear == null ? 1 : 0.45 }}
          >
            <div className="flex items-end gap-px" style={{ height: combHeight }}>
              {months.map((m, i) => {
                const n = m.video + m.live
                return (
                  <span
                    key={i}
                    className="flex flex-1 flex-col justify-end overflow-hidden rounded-[1px]"
                    style={{ height: n ? Math.max(2, (n / max) * combHeight) : 2 }}
                  >
                    {n === 0 ? (
                      <span className="h-full w-full bg-line/60" />
                    ) : (
                      <>
                        <span className="w-full shrink-0 bg-video" style={{ height: `${(m.video / n) * 100}%` }} />
                        <span className="w-full shrink-0 bg-live" style={{ height: `${(m.live / n) * 100}%` }} />
                      </>
                    )}
                  </span>
                )
              })}
            </div>
            {!compact && (
              <span
                className={`border-t pt-1 font-mono text-[10px] tnum transition-colors ${
                  active
                    ? 'border-ink text-ink'
                    : `border-line ${isLiveEra ? 'text-live/50' : 'text-video/50'} group-hover:text-ink`
                }`}
              >
                {String(year).slice(2)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
