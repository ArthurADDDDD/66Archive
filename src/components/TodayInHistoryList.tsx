'use client'

import { useState } from 'react'
import Link from 'next/link'

export type TodayHistoryItem = {
  id: string
  date: string
  title: string
  games: string[]
  /** 同一天在这一年里的其他记录数（这一年只列一条，剩下的只标个数） */
  extra: number
}

/** 每一年一行：那一年的这一天有没有留下东西。没有就留空，空本身也是记录的一部分。 */
export type TodayHistoryRow = {
  year: number
  yearsAgo: number
  item: TodayHistoryItem | null
}

/**
 * 历史上的今天：从最早的一年数到去年，一年一行。
 * 默认只露出最早的两条，其余（含空年份）折叠——首页不该被一张长清单占满。
 */
export function TodayInHistoryList({ rows }: { rows: TodayHistoryRow[] }) {
  const [expanded, setExpanded] = useState(false)
  const withRecord = rows.filter((r) => r.item)
  const preview = withRecord.slice(0, 2)
  const shown = expanded ? rows : preview

  if (withRecord.length === 0) return null

  return (
    <div className="mt-6 border-t border-line/60 pt-5">
      <p className="text-meta text-faint">
        {expanded ? '从最早的一年数到去年：' : '最早的两次是：'}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {shown.map((row) => (
          <li key={row.year} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="w-11 shrink-0 font-mono text-meta text-faint tnum">{row.year}</span>
            {row.item ? (
              <>
                <Link
                  href={`/e/${row.item.id}/`}
                  className="ui-press min-w-0 rounded-sm text-meta leading-relaxed text-ink/80 transition-colors hover:text-live"
                >
                  {row.item.title}
                </Link>
                {row.item.games.length > 0 && <GameTagLine games={row.item.games} />}
                {row.item.extra > 0 && (
                  <span className="text-meta text-faint tnum">+{row.item.extra}</span>
                )}
              </>
            ) : (
              <span className="text-meta text-faint/60">—</span>
            )}
          </li>
        ))}
      </ul>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="ui-press mt-3 rounded-sm text-meta text-live transition-colors hover:text-ink"
      >
        {expanded ? '收起 ↑' : `展开这一天的全部 ${rows.length} 年 ↓`}
      </button>
    </div>
  )
}

/** 条目上的游戏标签：只是标签，不抢标题的注意力 */
function GameTagLine({ games }: { games: string[] }) {
  const shown = games.slice(0, 3)
  const rest = games.length - shown.length
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      {shown.map((name) => (
        <span
          key={name}
          className="rounded-full border border-line/70 px-2 py-px text-[0.6875rem] leading-relaxed text-faint"
        >
          {name}
        </span>
      ))}
      {rest > 0 && <span className="text-[0.6875rem] text-faint tnum">+{rest}</span>}
    </span>
  )
}
