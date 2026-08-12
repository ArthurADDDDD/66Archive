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

/**
 * 轻量列表：一行一个游戏，靠时长横条给出相对量级，不用大卡片占屏幕。
 * 79+ 个游戏要能一眼扫过去，逐条展开的大卡片只会让人失去耐心往下翻。
 */
export function GamesList({ games }: { games: GameStats[] }) {
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

  const maxMin = Math.max(1, ...games.map((g) => g.knownDurationMin))
  const maxSessions = Math.max(1, ...games.map((g) => g.sessionCount))

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
        <ul className="ui-reveal mt-5 divide-y divide-line rounded-lg border border-line">
          {filtered.map((g) => {
            const barBasis = sort === 'sessions' ? g.sessionCount / maxSessions : g.knownDurationMin / maxMin
            return (
              <li key={g.id}>
                <Link
                  href={`/games/${g.id}/`}
                  className="ui-press group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface/70 sm:gap-4 sm:px-4"
                >
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: gameColor(g.id) }} />

                  <span className="w-28 shrink-0 truncate text-[13px] text-ink group-hover:text-live sm:w-44">
                    {g.name}
                  </span>

                  <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-raised sm:block">
                    <span
                      className="block h-full rounded-full transition-[width]"
                      style={{ width: `${Math.max(2, barBasis * 100)}%`, background: gameColor(g.id), opacity: 0.7 }}
                    />
                  </div>

                  <span className="hidden shrink-0 font-mono text-[10px] text-faint tnum sm:inline">
                    {g.platforms.map((p) => PLATFORM_META[p as Platform]?.short ?? p).join(' ')}
                  </span>

                  <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted tnum">{g.sessionCount} 场</span>

                  <span
                    title={formatGameDuration(g.knownDurationMin, g.knownDurationCount, g.sessionCount)}
                    className="hidden w-24 shrink-0 truncate text-right font-mono text-[10px] text-faint tnum md:inline"
                  >
                    {g.knownDurationCount < g.sessionCount
                      ? `~${Math.round(g.knownDurationMin / 60)} 小时*`
                      : `${Math.round(g.knownDurationMin / 60)} 小时`}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
