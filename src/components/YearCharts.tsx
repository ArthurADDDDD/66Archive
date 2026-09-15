'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { actColorForDate } from '@/lib/narrative'

type YearRow = [number, { count: number; minutes: number; known: number }]

/**
 * 数据页的按年柱状图。
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
        <div className="flex h-[clamp(12rem,18vw,22rem)] w-max min-w-full items-end gap-[0.1875rem]">
          {rows.map(([year, row]) => (
            <Link
              key={year}
              href={`/archive/?y=${year}`}
              prefetch={false}
              className="group relative flex h-full min-w-[1.875rem] flex-1 flex-col items-center gap-1.5 sm:min-w-0"
              title={`${year} 年 · ${row.count.toLocaleString()} 条`}
            >
              {/* 悬浮时的精确读数。放在整根柱子（含下面「最多」那行）之上，
                  bottom-full 量的是这个 Link 自身的高度，所以永远贴着这一列的顶，
                  不会因为「最多」徽标而被自己挡住。 */}
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-meta text-ink opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {year} 年 · <span className="font-mono tnum">{row.count.toLocaleString()}</span> 条
              </span>
              {/* 固定高度的一行，不管这一年是不是「最多」都占着——柱子的可用高度
                  （下面的 flex-1）因此每一列都一样，徽标才不会贴到柱顶上去。 */}
              <span className="flex h-4 items-end justify-center">
                {year === topYear && (
                  <span className="whitespace-nowrap rounded-sm bg-ink px-1.5 py-0.5 text-meta font-semibold text-[#12141C] tnum">
                    最多
                  </span>
                )}
              </span>
              <span className="relative flex min-h-0 w-full max-w-[clamp(1.25rem,1.5vw,2rem)] flex-1 items-end">
                <span
                  className="block w-full rounded-t-sm transition-[opacity,filter] group-hover:brightness-150"
                  style={{
                    height: `${Math.max(3, (row.count / max) * 100)}%`,
                    background: actColorForDate(`${year}-06-01`),
                  }}
                />
              </span>
              {/* 手机上只显示偶数年的标签，但必须用 invisible 而不是 hidden：
                  display:none 会把这一格的标签和它上面的 gap 一起从布局里拿掉，
                  于是奇数年的柱子比偶数年多出十几像素的高度，柱底一根一根错开——
                  柱状图的底线错了，整张图就废了。visibility:hidden 只是不画，格子还在。 */}
              <span className={`font-mono text-meta leading-3 text-faint tnum ${year % 2 ? 'invisible sm:visible' : ''}`}>
                {year}
              </span>
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-2 text-meta text-faint sm:hidden">← 左右滑动看全部年份</p>
    </div>
  )
}
