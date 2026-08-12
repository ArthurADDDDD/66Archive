'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { GameStats } from '@/lib/game-stats-format'
import { formatGameDuration } from '@/lib/game-stats-format'
import { PLATFORM_META } from '@/lib/platforms'
import { gameColor } from '@/lib/ui'
import type { Platform } from '@/lib/schema'

type SortKey = 'sessions' | 'duration' | 'recent'

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'sessions', label: '出场次数' },
  { id: 'duration', label: '已知时长' },
  { id: 'recent', label: '最近出场' },
]

export function GamesGrid({ games }: { games: GameStats[] }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('sessions')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? games.filter(
          (g) => g.name.toLowerCase().includes(needle) || g.aliases.some((a) => a.toLowerCase().includes(needle)),
        )
      : games
    const sorted = [...list]
    if (sort === 'duration') sorted.sort((a, b) => b.knownDurationMin - a.knownDurationMin)
    else if (sort === 'recent') sorted.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
    else sorted.sort((a, b) => b.sessionCount - a.sessionCount)
    return sorted
  }, [games, q, sort])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索游戏名或别名…"
          className="w-full max-w-xs rounded-full border border-line bg-surface/70 px-4 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-live/60 sm:w-64"
        />
        <div className="flex items-center gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              aria-pressed={sort === s.id}
              className={`ui-press rounded-full border px-3 py-1.5 font-mono text-[10px] transition-colors ${
                sort === s.id ? 'border-live/60 bg-live/10 text-live' : 'border-line text-muted hover:border-muted hover:text-ink'
              }`}
            >
              按{s.label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[11px] text-faint tnum">{filtered.length} / {games.length}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-[13px] text-muted">没有匹配「{q}」的游戏。</p>
      ) : (
        <div className="ui-reveal mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  )
}

function GameCard({ game }: { game: GameStats }) {
  const color = gameColor(game.id)
  return (
    <Link
      href={`/games/${game.id}/`}
      className="ui-card ui-press group flex flex-col rounded-xl border border-line bg-surface/55 p-4 hover:border-muted"
    >
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-medium leading-snug text-ink group-hover:text-live">{game.name}</h3>
          {game.aliases.length > 0 && (
            <p className="mt-0.5 truncate text-[11px] text-faint">{game.aliases.join(' · ')}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-faint tnum">
        <span className="text-muted">{game.sessionCount} 场</span>
        <span className="text-line">·</span>
        <span>{formatGameDuration(game.knownDurationMin, game.knownDurationCount, game.sessionCount)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {game.platforms.map((p) => {
          const meta = PLATFORM_META[p as Platform]
          return (
            <span key={p} className="rounded-sm px-1.5 py-0.5 font-mono text-[9px]" style={{ color: meta?.color, background: `${meta?.color}18` }}>
              {meta?.name ?? p}
            </span>
          )
        })}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3 font-mono text-[10px] text-faint">
        <span>{game.firstDate} → {game.lastDate}</span>
        <span className="text-live opacity-0 transition-opacity group-hover:opacity-100">详情 →</span>
      </div>
    </Link>
  )
}
