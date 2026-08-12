'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { actColorForDate } from '@/lib/narrative'

type YearRow = [number, { count: number; minutes: number; known: number }]

/**
 * 数据页的两个按年图表。
 * 移动端改成局部横向滚动（overflow-x-auto）：不会被祖先 overflow-hidden 裁掉，
 * 初始停在最右——最高年份与「最多」徽标直接可见，不用滑回去年。
 * 桌面保持原样（内容放得下，滚动容器退化为普通行）。
 */

/** 01 每一年留下的记录（柱状） */
export function YearBarChart({ rows, topYear }: { rows: YearRow[]; topYear: number }) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // 初始停到最右：让「最多」和最新年份直接可见（组件内部滚动，不撑破页面）
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  const max = Math.max(1, ...rows.map(([, r]) => r.count))

  return (
    <div>
      <div ref={scroller} className="overflow-x-auto [scrollbar-width:thin]">
        <div className="flex h-40 w-max min-w-full items-end gap-[3px] sm:h-48">
          {rows.map(([year, row]) => (
            <Link
              key={year}
              href={`/chronicle/?y=${year}`}
              className="group flex min-w-[30px] flex-1 flex-col items-center gap-1.5 sm:min-w-0"
              title={`${year} 年 · ${row.count.toLocaleString()} 条`}
            >
              <span className="relative flex w-full max-w-[26px] flex-1 items-end">
                <span
                  className="block w-full rounded-t-sm transition-[opacity,filter] group-hover:brightness-150"
                  style={{
                    height: `${Math.max(3, (row.count / max) * 100)}%`,
                    background: actColorForDate(`${year}-06-01`),
                  }}
                />
                {year === topYear && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[8px] font-semibold text-base tnum">
                    最多
                  </span>
                )}
              </span>
              <span className={`font-mono text-[8px] leading-3 text-faint/70 tnum ${year % 2 ? 'hidden sm:block' : ''}`}>
                {year}
              </span>
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-2 font-mono text-[9px] text-faint/60 sm:hidden">← 左右滑动看全部年份</p>
    </div>
  )
}

/** 04 每一年，一个点 */
export function EraDots({ rows }: { rows: YearRow[] }) {
  const max = Math.max(1, ...rows.map(([, r]) => r.count))
  return (
    <div className="overflow-x-auto [scrollbar-width:thin]">
      <div className="flex w-max min-w-full items-end gap-1.5">
        {rows.map(([year, row]) => {
          const d = Math.max(6, Math.min(26, 6 + (row.count / max) * 20))
          return (
            <Link
              key={year}
              href={`/chronicle/?y=${year}`}
              className="flex min-w-[24px] flex-col items-center gap-1.5"
              title={`${year} 年 · ${row.count.toLocaleString()} 条`}
            >
              <span
                className="rounded-full transition-transform hover:scale-110"
                style={{ width: d, height: d, background: actColorForDate(`${year}-06-01`) }}
              />
              <span className={`font-mono text-[8px] text-faint/60 tnum ${year % 2 ? 'hidden sm:block' : ''}`}>{year}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
