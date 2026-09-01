'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { actColorForDate } from '@/lib/narrative'
import { trackSiteEvent } from '@/lib/site-analytics'
import { SearchField } from './SearchField'

/**
 * 游戏库封面墙（v2 设计）。
 *
 * 封面优先用她第一次播它那天的直播截图（face），不是商店页宣传图；如果数据角色补回
 * games.yaml 的 cover，getGameProfile 会把它作为没有截图时的后备。默认按「从新到旧」排，
 * 每页只渲染 60 个游戏，避免 700 多张卡片变成一条过长的页面。
 *
 * 保留下来的能力：名称/别名搜索 · 四种排序 · 分页 · 计数与提示行。
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

type SortKey = 'newest' | 'oldest' | 'duration' | 'sessions'

const SORTS: { id: SortKey; label: string; hint: string }[] = [
  { id: 'newest', label: '从新到旧', hint: '按最近一次游玩的日期排，最近在前' },
  { id: 'oldest', label: '从旧到新', hint: '按第一次游玩的日期排，最早在前' },
  { id: 'duration', label: '玩得最久', hint: '按已知时长排' },
  { id: 'sessions', label: '播得最多', hint: '按出场场次排' },
]

const PAGE_SIZE = 60

export function GamesLibrary({ games }: { games: LibraryGame[] }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [page, setPage] = useState(1)
  const reportedZero = useRef(false)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = games
    if (needle) {
      list = list.filter(
        (g) => g.name.toLowerCase().includes(needle) || g.aliases.some((a) => a.toLowerCase().includes(needle)),
      )
    }
    const sorted = [...list]
    const byName = (a: LibraryGame, b: LibraryGame) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    const byLastDate = (a: LibraryGame, b: LibraryGame) => (b.lastDate ?? '').localeCompare(a.lastDate ?? '')
    const byFirstDate = (a: LibraryGame, b: LibraryGame) => (a.firstDate ?? '').localeCompare(b.firstDate ?? '')

    if (sort === 'duration') sorted.sort((a, b) => b.totalMinutes - a.totalMinutes || byLastDate(a, b) || byName(a, b))
    else if (sort === 'sessions') sorted.sort((a, b) => b.sessions - a.sessions || byLastDate(a, b) || byName(a, b))
    else if (sort === 'oldest') sorted.sort((a, b) => byFirstDate(a, b) || byLastDate(a, b) || byName(a, b))
    else sorted.sort((a, b) => byLastDate(a, b) || byFirstDate(a, b) || byName(a, b))
    return sorted
  }, [games, q, sort])

  useEffect(() => {
    const isZeroSearch = q.trim().length > 0 && filtered.length === 0
    if (isZeroSearch && !reportedZero.current) trackSiteEvent('search.zero')
    reportedZero.current = isZeroSearch
  }, [filtered.length, q])

  const activeSort = SORTS.find((s) => s.id === sort)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const startIndex = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE
  const endIndex = Math.min(startIndex + PAGE_SIZE, filtered.length)
  const visible = filtered.slice(startIndex, endIndex)

  const scrollToLibrary = () => {
    const target = document.getElementById('games-library')
    if (!target) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  const changePage = (nextPage: number) => {
    const bounded = Math.max(1, Math.min(pageCount, nextPage))
    if (bounded === currentPage) return
    setPage(bounded)
    scrollToLibrary()
  }

  const changeSearch = (value: string) => {
    setQ(value)
    setPage(1)
  }

  const changeSort = (nextSort: SortKey) => {
    setSort(nextSort)
    setPage(1)
    scrollToLibrary()
  }

  return (
    <div id="games-library" className="scroll-mt-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SearchField
          value={q}
          onChange={changeSearch}
          placeholder="搜索游戏名或别名…"
          ariaLabel="搜索游戏"
          iconClassName="sm:max-w-xs"
          inputClassName="w-full max-w-xs rounded-full border border-line bg-surface/70 px-4 py-2 text-control text-ink outline-none transition-colors placeholder:text-faint focus:border-live/60 sm:w-64"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.id}
              data-analytics-event="filter.use"
              data-analytics-target="sort"
              onClick={() => changeSort(s.id)}
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
          {filtered.length} / {games.length} · 第 {currentPage} / {pageCount} 页
        </span>
      </div>

      <p className="mt-3 text-meta text-faint">{activeSort?.hint}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-meta text-faint tnum">
        <span>
          {filtered.length === 0 ? '没有结果' : `显示第 ${startIndex + 1}–${endIndex} 个游戏`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-12 text-body text-muted">没有匹配「{q}」的游戏。</p>
      ) : (
        <ul
          key={`${sort}:${q.trim().toLowerCase()}:${currentPage}`}
          className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {visible.map((g) => (
            <LibraryTile key={g.id} game={g} />
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <div className="mt-8 flex justify-center border-t border-line/60 pt-6">
          <Pagination page={currentPage} pageCount={pageCount} onChange={changePage} />
        </div>
      )}
    </div>
  )
}

function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
}) {
  if (pageCount <= 1) return null

  const pages = new Set([1, pageCount, page - 1, page, page + 1])
  const ordered = [...pages].filter((item) => item >= 1 && item <= pageCount).sort((a, b) => a - b)
  const items: (number | 'ellipsis')[] = []
  ordered.forEach((item, index) => {
    if (index > 0 && item - ordered[index - 1] > 1) items.push('ellipsis')
    items.push(item)
  })

  return (
    <nav aria-label="游戏分页" className="flex flex-wrap items-center justify-center gap-1.5">
      <PageButton page={page - 1} disabled={page === 1} onChange={onChange} label="上一页">‹</PageButton>
      {items.map((item, index) => item === 'ellipsis' ? (
        <span key={`ellipsis-${index}`} aria-hidden className="px-1 text-faint">…</span>
      ) : (
        <PageButton key={item} page={item} active={item === page} onChange={onChange} label={`第 ${item} 页`}>
          {item}
        </PageButton>
      ))}
      <PageButton page={page + 1} disabled={page === pageCount} onChange={onChange} label="下一页">›</PageButton>
    </nav>
  )
}

function PageButton({
  page,
  active = false,
  disabled = false,
  onChange,
  label,
  children,
}: {
  page: number
  active?: boolean
  disabled?: boolean
  onChange: (page: number) => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(page)}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`ui-press min-w-8 rounded-full border px-2.5 py-1.5 text-meta tnum transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? 'border-live/60 bg-live/10 text-live' : 'border-line text-muted hover:border-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function LibraryTile({ game: g }: { game: LibraryGame }) {
  // 封面来自首播那天，所以角标的时期色也跟着首播年份走；同页内仍保留这条年代线索。
  const eraColor = g.firstDate ? actColorForDate(g.firstDate) : '#5A5F73'

  return (
    <li>
      <Link
        href={`/games/${g.id}/`}
        data-analytics-event="content.open"
        data-analytics-target={`game:${g.id}`}
        className="ui-press group block"
      >
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
