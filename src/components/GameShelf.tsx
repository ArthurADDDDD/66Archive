'use client'

import { useMemo, useState } from 'react'
import { GameCard } from './GameCard'

/** 收藏架瓦片需要的极简载荷（避免把全部场次塞进客户端） */
export type GameCardData = {
  id: string
  name: string
  cover: string | null
  sessions: number
  totalMinutes: number
  hoursLabel: string
  firstDate: string | null
  lastDate: string | null
  curated: boolean
}

const SORTS = [
  { id: 'longest', label: '最久' },
  { id: 'recent', label: '最近' },
  { id: 'first', label: '最早' },
  { id: 'most', label: '最多' },
  { id: 'az', label: 'A-Z' },
] as const

type SortId = (typeof SORTS)[number]['id']

/** 收藏架：搜索 + 排序 + 空游戏开关。默认「最久」——先记住那些陪得最久的。 */
export function GameShelf({ profiles }: { profiles: GameCardData[] }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortId>('longest')
  const [hideEmpty, setHideEmpty] = useState(false)

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = profiles.filter((p) => (hideEmpty ? p.sessions > 0 : true) && (!needle || p.name.toLowerCase().includes(needle)))
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'recent':
          return (b.lastDate ?? '').localeCompare(a.lastDate ?? '')
        case 'first':
          return (a.firstDate ?? '').localeCompare(b.firstDate ?? '')
        case 'most':
          return b.sessions - a.sessions
        case 'az':
          return a.name.localeCompare(b.name, 'zh')
        default:
          return b.totalMinutes - a.totalMinutes
      }
    })
    return list
  }, [profiles, q, sort, hideEmpty])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`搜索游戏 · ${profiles.length} 款`}
          aria-label="搜索游戏"
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-[12px] text-ink placeholder:text-faint transition-[border-color,box-shadow,background-color] duration-300 hover:bg-raised/70 focus:border-live focus:bg-raised/70 focus:shadow-[0_0_0_3px_rgba(91,200,232,0.1)] focus:outline-none sm:max-w-[300px] sm:py-2"
        />
        <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-line/80 bg-surface/50 p-1 font-mono text-[10px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-visible">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              aria-pressed={sort === s.id}
              className={`ui-press min-h-[34px] shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 transition-colors sm:min-h-0 sm:py-1 ${
                sort === s.id ? 'bg-ink text-base' : 'text-muted hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setHideEmpty(!hideEmpty)}
          aria-pressed={hideEmpty}
          className={`ui-press ml-auto min-h-[38px] rounded-full border px-3 py-2 font-mono text-[10px] transition-colors sm:min-h-0 sm:py-1.5 ${
            hideEmpty ? 'border-live/60 text-live' : 'border-line/80 bg-surface/50 text-muted hover:border-muted/60 hover:text-ink'
          }`}
        >
          {hideEmpty ? '已隐藏空游戏' : '显示空游戏'}
        </button>
      </div>
      <p className="mt-3 font-mono text-[10px] text-faint/80 tnum">{visible.length} 款游戏</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {visible.map((p) => (
          <GameCard key={p.id} profile={p} />
        ))}
      </div>
      {visible.length === 0 && <p className="mt-10 font-mono text-[11px] text-faint">没有找到匹配的游戏。</p>}
    </div>
  )
}
