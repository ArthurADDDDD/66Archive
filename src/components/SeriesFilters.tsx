'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type SeriesOrder = 'asc' | 'desc'

type SeriesFilterValue = {
  /** 选中的年份；null = 全部年份 */
  year: number | null
  setYear: (year: number | null) => void
  order: SeriesOrder
  setOrder: (order: SeriesOrder) => void
}

const SeriesFilterContext = createContext<SeriesFilterValue | null>(null)

/**
 * 节目详情页的「筛选 + 排序」共享状态。
 *
 * 年份按钮长在「活跃年份」区块里，期数列表在下面一整块——两者中间隔着服务端渲染的
 * 标题，所以用 context 而不是把它们塞进同一个组件，页面结构一个字都不用改。
 *
 * 状态**只放在内存里**：不写 URL、不写 localStorage。刷新即回到「全部年份 · 最早在前」，
 * 和站内其他筛选（录播室年月、游戏库搜索）现在的口径一致。
 */
export function SeriesFilterProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState<number | null>(null)
  const [order, setOrder] = useState<SeriesOrder>('asc')
  const value = useMemo(() => ({ year, setYear, order, setOrder }), [year, order])
  return <SeriesFilterContext.Provider value={value}>{children}</SeriesFilterContext.Provider>
}

export function useSeriesFilter(): SeriesFilterValue {
  const value = useContext(SeriesFilterContext)
  if (!value) throw new Error('useSeriesFilter 必须在 SeriesFilterProvider 内使用')
  return value
}

/**
 * 活跃年份按钮：点一下就地筛选下面的期数列表，不再跳去录播室。
 * 想看某一年的完整录播，页尾「同期录播」那一栏仍然通向 /archive/。
 */
export function SeriesYearChips({
  perYear,
  color,
  unit,
}: {
  perYear: { year: number; count: number }[]
  color: string
  unit: string
}) {
  const { year, setYear } = useSeriesFilter()

  const select = (next: number | null) => {
    setYear(next)
    // 按钮在页面上半部分，列表在下面——选完直接把视线送过去，不然看不出发生了什么。
    if (next === null) return
    const target = document.getElementById('series-episodes')
    if (!target) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => select(null)}
        aria-pressed={year === null}
        className={`ui-press rounded-full border px-3 py-1.5 text-meta transition-colors ${
          year === null ? 'text-ink' : 'border-line/80 bg-surface/50 text-muted hover:border-live/60 hover:text-ink'
        }`}
        style={year === null ? { borderColor: `${color}99`, background: `${color}1F`, color } : undefined}
      >
        全部年份
      </button>
      {perYear.map((p) => {
        const selected = year === p.year
        return (
          <button
            key={p.year}
            type="button"
            onClick={() => select(selected ? null : p.year)}
            aria-pressed={selected}
            className={`ui-press rounded-full border px-3 py-1.5 text-meta transition-colors tnum ${
              selected ? 'text-ink' : 'border-line/80 bg-surface/50 text-muted hover:border-live/60 hover:text-ink'
            }`}
            style={selected ? { borderColor: `${color}99`, background: `${color}1F`, color } : undefined}
          >
            {p.year} 年 · {p.count} {unit}
          </button>
        )
      })}
    </div>
  )
}
