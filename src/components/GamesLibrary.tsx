'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { GameCard } from '@/lib/game-stats-format'
import { formatGameDuration } from '@/lib/game-stats-format'
import { eraOf } from '@/lib/covers'
import { proxyImage } from '@/lib/platforms'

type SortKey = 'recent' | 'duration' | 'sessions' | 'first'

const SORTS: { id: SortKey; label: string; hint: string }[] = [
  { id: 'recent', label: '最近玩过', hint: '往下滚就是往回走，滚到底是她很久没打开的那些' },
  { id: 'duration', label: '玩得最久', hint: '按已知时长排' },
  { id: 'sessions', label: '播得最多', hint: '按出场场次排' },
  { id: 'first', label: '第一次玩', hint: '按她第一次打开它的日子排，最早的在前' },
]

/**
 * 游戏库。
 *
 * 旧版是一张 492 行的条形图列表：信息密度很高，但翻它像看后台报表。
 * 这一版是**封面墙**，而且每张封面是她玩那天的直播截图，不是商店页的宣传图——
 * games.yaml 里 499 个游戏没有一个有 cover 字段，这不是缺陷，这就是这个库该有的样子。
 *
 * 保留下来的能力（不许在后续"优化"里丢掉）：
 * - 名称 + 别名搜索
 * - 四种排序，默认"最近玩过"（滚到底 = 考古现场）
 * - 「只玩过一次」的筛选，那 202 个是这个库里最容易被忘掉、也最可能让她"啊我还玩过这个"的一批
 */
export function GamesLibrary({ games }: { games: GameCard[] }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [onceOnly, setOnceOnly] = useState(false)

  const onceCount = useMemo(() => games.filter((g) => g.sessionCount === 1).length, [games])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = games
    if (onceOnly) list = list.filter((g) => g.sessionCount === 1)
    if (needle) {
      list = list.filter(
        (g) => g.name.toLowerCase().includes(needle) || g.aliases.some((a) => a.toLowerCase().includes(needle)),
      )
    }
    const sorted = [...list]
    if (sort === 'duration') sorted.sort((a, b) => b.knownDurationMin - a.knownDurationMin)
    else if (sort === 'sessions') sorted.sort((a, b) => b.sessionCount - a.sessionCount)
    else if (sort === 'first') sorted.sort((a, b) => a.firstDate.localeCompare(b.firstDate))
    else sorted.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
    return sorted
  }, [games, q, sort, onceOnly])

  const activeSort = SORTS.find((s) => s.id === sort)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索游戏名或别名…"
          aria-label="搜索游戏"
          className="w-full max-w-xs rounded-full border border-line bg-surface/70 px-4 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-live/60 sm:w-64"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              aria-pressed={sort === s.id}
              className={`ui-press rounded-full border px-3 py-1.5 font-mono text-[10px] transition-colors ${
                sort === s.id ? 'border-live/60 bg-live/10 text-live' : 'border-line text-muted hover:border-muted hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => setOnceOnly((v) => !v)}
            aria-pressed={onceOnly}
            className={`ui-press rounded-full border px-3 py-1.5 font-mono text-[10px] transition-colors ${
              onceOnly ? 'border-video/60 bg-video/10 text-video' : 'border-line text-muted hover:border-muted hover:text-ink'
            }`}
          >
            只玩过一次 · {onceCount}
          </button>
        </div>
        <span className="ml-auto font-mono text-[11px] text-faint tnum">
          {filtered.length} / {games.length}
        </span>
      </div>

      <p className="mt-3 text-[11px] text-faint">{activeSort?.hint}</p>

      {filtered.length === 0 ? (
        <p className="mt-12 text-[13px] text-muted">没有匹配「{q}」的游戏。</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((g) => (
            <GameTile key={g.id} game={g} />
          ))}
        </ul>
      )}
    </div>
  )
}

function GameTile({ game }: { game: GameCard }) {
  // 封面来自首播那天，所以角标的时期色也跟着首播年份走——库越往下翻，颜色越往回退。
  const era = game.firstDate ? eraOf(game.firstDate) : null
  const comebackDays = game.comebackDays

  return (
    <li>
      <Link href={`/games/${game.id}/`} className="ui-press group block">
        <div className="relative aspect-video overflow-hidden bg-raised">
          {game.face ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxyImage(game.face, 480) ?? ''}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full items-center justify-center font-mono text-[10px] text-faint">无封面</span>
          )}

          {/* 主机库把"上次游玩"直接贴在封面上。这里贴的是那句更狠的话。 */}
          {comebackDays > 0 && (
            <span className="absolute left-0 top-0 bg-base/85 px-1.5 py-1 font-mono text-[9px] leading-none text-video tnum">
              隔了 {comebackDays.toLocaleString()} 天又打开
            </span>
          )}
          <span className="absolute bottom-0 right-0 bg-base/85 px-1.5 py-1 font-mono text-[9px] leading-none text-muted tnum">
            {game.sessionCount} 场
          </span>
        </div>

        <p className="mt-2.5 text-[13px] leading-snug text-ink group-hover:text-live">{game.name}</p>
        <p className="mt-1 font-mono text-[10px] text-faint tnum">
          <span style={era ? { color: era.color } : undefined}>{game.firstDate}</span>
          {game.lastDate !== game.firstDate && <> → {game.lastDate}</>}
        </p>
        <p
          className="font-mono text-[10px] text-faint tnum"
          title={formatGameDuration(game.knownDurationMin, game.knownDurationCount, game.sessionCount)}
        >
          {Math.round(game.knownDurationMin / 60)} 小时
          {game.knownDurationCount < game.sessionCount && '*'}
        </p>
      </Link>
    </li>
  )
}
