'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type EntryOrder = 'asc' | 'desc'

type EntryFilterValue = {
  /** 选中的年份；null = 全部年份 */
  year: number | null
  setYear: (year: number | null) => void
  order: EntryOrder
  setOrder: (order: EntryOrder) => void
  /** 选中年份后把视线送到哪个区块（列表通常在按钮下面很远） */
  anchorId: string
}

const EntryFilterContext = createContext<EntryFilterValue | null>(null)

/**
 * 「按年份筛选 + 正倒序」的共享状态。节目详情页（/series/[id]/）和
 * 游戏详情页（/games/[id]/）用的是同一套：年份控件长在页面上半部分的统计区块里，
 * 条目列表在下面隔着标题，中间是服务端渲染的内容——所以用 context 串，
 * 而不是把两块塞进同一个组件，页面结构一个字都不用改。
 *
 * 状态**只放在内存里**：不写 URL、不写 localStorage。刷新即回到「全部年份 + 默认顺序」，
 * 和站内其他筛选（录播室年月、游戏库搜索）现在的口径一致。
 *
 * `defaultOrder` 跟着各页数据源本来的方向走：节目的 entries 是升序（第一期在前），
 * 游戏的 entries 是降序（最近一场在前）——默认顺序不该因为接了筛选就变。
 */
export function EntryFilterProvider({
  children,
  defaultOrder = 'asc',
  anchorId,
}: {
  children: ReactNode
  defaultOrder?: EntryOrder
  anchorId: string
}) {
  const [year, setYear] = useState<number | null>(null)
  const [order, setOrder] = useState<EntryOrder>(defaultOrder)
  const value = useMemo(() => ({ year, setYear, order, setOrder, anchorId }), [year, order, anchorId])
  return <EntryFilterContext.Provider value={value}>{children}</EntryFilterContext.Provider>
}

export function useEntryFilter(): EntryFilterValue {
  const value = useContext(EntryFilterContext)
  if (!value) throw new Error('useEntryFilter 必须在 EntryFilterProvider 内使用')
  return value
}

/** 选完年份把视线送到列表——不然按钮在上半屏、结果在下面，看不出发生了什么。 */
export function scrollToEntryList(anchorId: string) {
  const target = document.getElementById(anchorId)
  if (!target) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}

/** 应用当前筛选与排序。原数组来自构建期，别就地反转。 */
export function applyEntryFilter<T extends { date: string }>(
  entries: T[],
  year: number | null,
  order: EntryOrder,
  sourceOrder: EntryOrder,
): T[] {
  const filtered = year === null ? entries : entries.filter((entry) => Number(entry.date.slice(0, 4)) === year)
  return order === sourceOrder ? filtered : [...filtered].reverse()
}

/**
 * 正/倒序切换：一个键在两种顺序之间来回切，标签写的是当前状态。
 */
export function OrderToggle() {
  const { order, setOrder } = useEntryFilter()
  return (
    <button
      type="button"
      onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
      title={order === 'asc' ? '当前：最早在前' : '当前：最新在前'}
      className="ui-press flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-meta text-muted transition-colors hover:border-muted hover:text-ink sm:px-3 sm:py-1.5"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="stroke-current">
        <path d="M7 4v16M7 20l-3.5-4M7 20l3.5-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 7h7M14 12h5M14 17h3" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {order === 'asc' ? '最早在前' : '最新在前'}
    </button>
  )
}

/** 清除年份：只在筛着的时候出现 */
export function ClearYearButton() {
  const { year, setYear } = useEntryFilter()
  if (year === null) return null
  return (
    <button
      type="button"
      onClick={() => setYear(null)}
      className="ui-press rounded-full border border-line px-4 py-2 text-meta text-muted transition-colors hover:border-muted hover:text-ink sm:px-3 sm:py-1.5"
    >
      清除年份
    </button>
  )
}

/**
 * 节目页的活跃年份按钮：点一下就地筛选下面的期数列表，不再跳去录播室。
 * 想看某一年的完整录播，页尾「同期录播」那一栏仍然通向 /archive/。
 */
export function YearChips({
  perYear,
  color,
  unit,
}: {
  perYear: { year: number; count: number }[]
  color: string
  unit: string
}) {
  const { year, setYear, anchorId } = useEntryFilter()

  const select = (next: number | null) => {
    setYear(next)
    if (next !== null) scrollToEntryList(anchorId)
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

/**
 * 游戏页的「年份分布」：本来就是一行一年的条形图，直接把整行做成按钮，
 * 不额外再加一排胶囊——同一份信息不重复画两遍。
 */
export function YearBars({
  rows,
}: {
  rows: { year: number; count: number; pct: number; color: string }[]
}) {
  const { year, setYear, anchorId } = useEntryFilter()

  const select = (next: number | null) => {
    setYear(next)
    if (next !== null) scrollToEntryList(anchorId)
  }

  return (
    <div className="mt-3 space-y-1">
      {rows.map((row) => {
        const selected = year === row.year
        return (
          <button
            key={row.year}
            type="button"
            onClick={() => select(selected ? null : row.year)}
            aria-pressed={selected}
            title={selected ? `取消筛选 ${row.year} 年` : `只看 ${row.year} 年的场次`}
            className={`ui-press flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
              selected ? 'bg-raised' : 'hover:bg-raised/60'
            }`}
          >
            <span className={`w-10 shrink-0 font-mono text-meta tnum ${selected ? 'text-ink' : 'text-faint'}`}>
              {row.year}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
              <span
                className="block h-full rounded-full transition-opacity"
                style={{ width: `${row.pct}%`, background: row.color, opacity: year === null || selected ? 1 : 0.4 }}
              />
            </span>
            <span className={`w-10 shrink-0 text-right text-meta tnum ${selected ? 'text-ink' : 'text-faint'}`}>
              {row.count} 场
            </span>
          </button>
        )
      })}
    </div>
  )
}
