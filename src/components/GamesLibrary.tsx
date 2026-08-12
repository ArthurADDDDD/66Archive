'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { actColorForDate } from '@/lib/narrative'
import { SearchField } from './SearchField'

/**
 * 游戏库封面墙（v2 设计）。
 *
 * 封面 = 她第一次播它那天的直播截图（face），不是商店页宣传图——games.yaml 的 cover 字段
 * 几乎全空，这不是缺陷，是这个库该有的样子。默认按「最近玩过」排，往下滚，封面年代跟着
 * 首播年份一起往回退——滚到底就是 2016 年的 A 站录播截图，考古现场。
 *
 * 保留下来的能力：名称/别名搜索 · 四种排序 · 「只玩过一次」筛选 · 计数与提示行。
 */
export type LibraryGame = {
  id: string
  name: string
  aliases: string[]
  face: string | null
  sessions: number
  totalMinutes: number
  knownDurationCount: number
  firstDate: string | null
  lastDate: string | null
  comebackDays: number
}

type SortKey = 'recent' | 'duration' | 'sessions' | 'first'

const SORTS: { id: SortKey; label: string; hint: string }[] = [
  { id: 'recent', label: '最近玩过', hint: '往下滚就是往回走，滚到底是她很久没打开的那些' },
  { id: 'duration', label: '玩得最久', hint: '按已知时长排' },
  { id: 'sessions', label: '播得最多', hint: '按出场场次排' },
  { id: 'first', label: '第一次玩', hint: '按她第一次打开它的日子排，最早的在前' },
]

export function GamesLibrary({ games }: { games: LibraryGame[] }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [onceOnly, setOnceOnly] = useState(false)

  const onceCount = useMemo(() => games.filter((g) => g.sessions === 1).length, [games])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = games
    if (onceOnly) list = list.filter((g) => g.sessions === 1)
    if (needle) {
      list = list.filter(
        (g) => g.name.toLowerCase().includes(needle) || g.aliases.some((a) => a.toLowerCase().includes(needle)),
      )
    }
    const sorted = [...list]
    if (sort === 'duration') sorted.sort((a, b) => b.totalMinutes - a.totalMinutes)
    else if (sort === 'sessions') sorted.sort((a, b) => b.sessions - a.sessions)
    else if (sort === 'first') sorted.sort((a, b) => (a.firstDate ?? '').localeCompare(b.firstDate ?? ''))
    else sorted.sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''))
    return sorted
  }, [games, q, sort, onceOnly])

  const activeSort = SORTS.find((s) => s.id === sort)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="搜索游戏名或别名…"
          ariaLabel="搜索游戏"
          iconClassName="sm:max-w-xs"
          inputClassName="w-full max-w-xs rounded-full border border-line bg-surface/70 px-4 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-live/60 sm:w-64"
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
            <LibraryTile key={g.id} game={g} />
          ))}
        </ul>
      )}
    </div>
  )
}

function LibraryTile({ game: g }: { game: LibraryGame }) {
  // 封面来自首播那天，所以角标的时期色也跟着首播年份走——库越往下翻，颜色越往回退。
  const eraColor = g.firstDate ? actColorForDate(g.firstDate) : '#5A5F73'

  return (
    <li>
      <Link href={`/games/${g.id}/`} className="ui-press group block">
        <div className="relative aspect-video overflow-hidden bg-raised">
          {g.face ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={g.face}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            /* 无封面：字排版档案封面（不是随机渐变，绝不用假图）——时代色 + 真实信息 */
            <div
              className="relative flex h-full w-full flex-col items-center justify-center px-3"
              style={{ background: `linear-gradient(180deg, ${eraColor}1f, transparent 55%)` }}
            >
              <span
                aria-hidden
                className="absolute inset-0 opacity-[0.05]"
                style={{
                  backgroundImage: `radial-gradient(circle, ${eraColor} 1px, transparent 1px)`,
                  backgroundSize: '14px 14px',
                }}
              />
              <span
                className="absolute left-2 top-2 font-mono text-[8px] uppercase tracking-[0.18em]"
                style={{ color: eraColor }}
              >
                {g.firstDate ? `${g.firstDate.slice(0, 4)}` : '待补录'}
              </span>
              <span className="relative max-w-full text-center font-display text-[16px] font-bold leading-tight tracking-tight text-ink/90">
                {g.name}
              </span>
            </div>
          )}

          {g.comebackDays > 0 && (
            <span className="absolute left-0 top-0 bg-base/85 px-1.5 py-1 font-mono text-[9px] leading-none text-video tnum">
              隔了 {g.comebackDays.toLocaleString()} 天又打开
            </span>
          )}
          <span className="absolute bottom-0 right-0 bg-base/85 px-1.5 py-1 font-mono text-[9px] leading-none text-muted tnum">
            {g.sessions} 场
          </span>
        </div>

        <p className="mt-2.5 text-[13px] leading-snug text-ink group-hover:text-live">{g.name}</p>
        <p className="mt-1 font-mono text-[10px] text-faint tnum">
          {g.firstDate && <span style={{ color: eraColor }}>{g.firstDate}</span>}
          {g.lastDate && g.lastDate !== g.firstDate && <> → {g.lastDate}</>}
        </p>
        <p className="font-mono text-[10px] text-faint tnum" title={`${g.totalMinutes.toLocaleString()} 分钟 · ${g.knownDurationCount}/${g.sessions} 场有记录`}>
          {g.knownDurationCount === 0
            ? '时长未知'
            : `${g.totalMinutes >= 60 ? `${Math.round(g.totalMinutes / 60)} 小时` : `${g.totalMinutes} 分钟`}${g.knownDurationCount < g.sessions ? '*' : ''}`}
        </p>
      </Link>
    </li>
  )
}
