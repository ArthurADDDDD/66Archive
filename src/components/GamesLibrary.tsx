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
 * 保留下来的能力：名称/别名搜索 · 六种排序 · 计数与提示行。
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

type SortKey = 'recent' | 'duration' | 'sessions' | 'first' | 'oldest' | 'newest'

const SORTS: { id: SortKey; label: string; hint: string }[] = [
  { id: 'recent', label: '最近玩过', hint: '往下滚就是往回走，滚到底是她很久没打开的那些' },
  { id: 'duration', label: '玩得最久', hint: '按已知时长排' },
  { id: 'sessions', label: '播得最多', hint: '按出场场次排' },
  { id: 'first', label: '第一次玩', hint: '按她第一次打开它的日子排，最早的在前' },
  { id: 'oldest', label: '从旧到新', hint: '按她第一次打开它的日子排，最早的在前' },
  { id: 'newest', label: '从新到旧', hint: '按她第一次打开它的日子排，最近的在前' },
]

export function GamesLibrary({ games }: { games: LibraryGame[] }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = games
    if (needle) {
      list = list.filter(
        (g) => g.name.toLowerCase().includes(needle) || g.aliases.some((a) => a.toLowerCase().includes(needle)),
      )
    }
    const sorted = [...list]
    if (sort === 'duration') sorted.sort((a, b) => b.totalMinutes - a.totalMinutes)
    else if (sort === 'sessions') sorted.sort((a, b) => b.sessions - a.sessions)
    else if (sort === 'first' || sort === 'oldest') {
      sorted.sort((a, b) => (a.firstDate ?? '').localeCompare(b.firstDate ?? ''))
    } else if (sort === 'newest') {
      sorted.sort((a, b) => (b.firstDate ?? '').localeCompare(a.firstDate ?? ''))
    }
    else sorted.sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''))
    return sorted
  }, [games, q, sort])

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
          inputClassName="w-full max-w-xs rounded-full border border-line bg-surface/70 px-4 py-2 text-control text-ink outline-none transition-colors placeholder:text-faint focus:border-live/60 sm:w-64"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              aria-pressed={sort === s.id}
              className={`ui-press rounded-full border px-3 py-2 text-meta transition-colors sm:py-1.5 ${
                sort === s.id ? 'border-live/60 bg-live/10 text-live' : 'border-line text-muted hover:border-muted hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-meta text-faint tnum">
          {filtered.length} / {games.length}
        </span>
      </div>

      <p className="mt-3 text-meta text-faint">{activeSort?.hint}</p>

      {filtered.length === 0 ? (
        <p className="mt-12 text-body text-muted">没有匹配「{q}」的游戏。</p>
      ) : (
        <ul
          key={`${sort}:${q.trim().toLowerCase()}`}
          className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
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
                className="absolute left-2 top-2 font-mono text-meta uppercase tracking-[0.16em] tnum"
                style={{ color: eraColor }}
              >
                {g.firstDate ? `${g.firstDate.slice(0, 4)}` : '待补录'}
              </span>
              <span className="relative max-w-full text-center text-base font-bold leading-tight text-ink/90">
                {g.name}
              </span>
            </div>
          )}

          {g.comebackDays > 0 && (
            <span className="absolute left-0 top-0 bg-base/85 px-1.5 py-1 text-meta leading-none text-video tnum">
              隔了 {g.comebackDays.toLocaleString()} 天又打开
            </span>
          )}
          <span className="absolute bottom-0 right-0 bg-base/85 px-1.5 py-1 text-meta leading-none text-muted tnum">
            {g.sessions} 场
          </span>
        </div>

        {/* 三行文字改成固定两行槽位：日期缺失时原本整行塌陷、lastDate 与 firstDate 相同时又少一段，
            同一行的瓦片文字块高度各不相同，读下来是参差的。缺什么就占什么，不塌陷。 */}
        <p className="mt-2.5 line-clamp-2 min-h-[2.6em] text-control leading-snug text-ink group-hover:text-live">
          {g.name}
        </p>
        <p className="mt-1 text-meta text-faint tnum">
          {g.firstDate ? (
            <span className="font-mono" style={{ color: eraColor }}>
              {g.firstDate}
            </span>
          ) : (
            <span>日期待补</span>
          )}
          {g.lastDate && g.lastDate !== g.firstDate && <span className="font-mono"> → {g.lastDate}</span>}
        </p>
        <p className="text-meta text-faint tnum" title={`${g.totalMinutes.toLocaleString()} 分钟 · ${g.knownDurationCount}/${g.sessions} 场有记录`}>
          {g.knownDurationCount === 0
            ? '时长未知'
            : `${g.totalMinutes >= 60 ? `${Math.round(g.totalMinutes / 60)} 小时` : `${g.totalMinutes} 分钟`}${g.knownDurationCount < g.sessions ? '*' : ''}`}
        </p>
      </Link>
    </li>
  )
}
