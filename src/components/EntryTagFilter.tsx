'use client'

import { useMemo, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { visibleGameIds } from '@/lib/games'
import { gameColor } from '@/lib/ui'

export type EntryTagSelection = { games: string[]; tags: string[] }
export const EMPTY_TAG_SELECTION: EntryTagSelection = { games: [], tags: [] }

/** 一次只在当前范围（某个月）里生效，所以出现的永远是「这个月真的存在」的游戏和标签。 */
export function applyTagSelection(entries: TimelineEntry[], selection: EntryTagSelection): TimelineEntry[] {
  if (!selection.games.length && !selection.tags.length) return entries
  return entries.filter((entry) => {
    // 同一组里是「或」——选了三个游戏就是这三个都要看；
    // 组与组之间是「且」——选了游戏又选了标签，就是这个游戏里带这个标签的那些。
    const gameOk = !selection.games.length || entry.games.some((game) => selection.games.includes(game.id))
    const tagOk = !selection.tags.length || entry.tags.some((tag) => selection.tags.includes(tag))
    return gameOk && tagOk
  })
}

export function hasTagSelection(selection: EntryTagSelection): boolean {
  return selection.games.length > 0 || selection.tags.length > 0
}

const COLLAPSED_LIMIT = 14

/**
 * 月内标签筛选条。
 *
 * 按正常的浏览顺序，点开一个月之后第一个想知道的是「这个月都在播什么」——
 * 所以先把这个月出现过的游戏与标签摊在条目上方，点一下就筛，再点一下取消，可以多选。
 * 这是**当前范围内**的筛选，换月份就清空；它不碰右上角那套跨年份的全局筛选。
 */
export function EntryTagFilter({
  entries,
  selection,
  onChange,
  color,
  matched,
  title = '这个月都在播什么',
}: {
  entries: TimelineEntry[]
  selection: EntryTagSelection
  onChange: (next: EntryTagSelection) => void
  color: string
  /** 应用筛选后剩下多少条，用来在有选中时给出即时反馈。 */
  matched: number
  /** 这批条目的范围说法；月份之外（例如搜索结果）用别的措辞。 */
  title?: string
}) {
  const [expanded, setExpanded] = useState(false)

  const games = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>()
    for (const entry of entries) {
      const visible = new Set(visibleGameIds(entry.games.map((game) => game.id)))
      for (const game of entry.games) {
        if (!visible.has(game.id)) continue
        const current = counts.get(game.id) ?? { id: game.id, name: game.name, count: 0 }
        current.count += 1
        counts.set(game.id, current)
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [entries])

  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries) {
      for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }, [entries])

  if (games.length === 0 && tags.length === 0) return null

  const total = games.length + tags.length
  const overflowing = total > COLLAPSED_LIMIT && !expanded
  const gameQuota = overflowing ? Math.min(games.length, COLLAPSED_LIMIT) : games.length
  const tagQuota = overflowing ? Math.max(0, COLLAPSED_LIMIT - gameQuota) : tags.length

  const toggle = (key: 'games' | 'tags', value: string) => {
    const current = selection[key]
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    onChange({ ...selection, [key]: next })
  }

  const active = hasTagSelection(selection)

  return (
    <section aria-label="按游戏和标签筛选当前条目" className="ui-reveal mt-6 rounded-xl border border-line bg-surface/40 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="text-meta uppercase tracking-[0.16em]" style={{ color }}>{title}</h3>
          <span className="text-meta text-faint">点一下只看它，再点一下取消，可以多选</span>
        </div>
        {active && (
          <div className="flex items-center gap-3 text-meta tnum">
            <span className="text-faint">
              命中 <span className="font-mono text-[0.9375rem] font-semibold text-ink">{matched}</span> 条
            </span>
            <button
              type="button"
              onClick={() => onChange(EMPTY_TAG_SELECTION)}
              className="ui-press text-live underline underline-offset-4"
            >
              清除
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {games.slice(0, gameQuota).map((game) => {
          const selected = selection.games.includes(game.id)
          return (
            <Chip
              key={`game-${game.id}`}
              selected={selected}
              color={color}
              onClick={() => toggle('games', game.id)}
              title={selected ? `取消筛选：${game.name}` : `只看 ${game.name}`}
            >
              <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: gameColor(game.id) }} />
              <span className="truncate">{game.name}</span>
              <span className="font-mono text-faint tnum">{game.count}</span>
            </Chip>
          )
        })}

        {tags.slice(0, tagQuota).map(({ tag, count }) => {
          const selected = selection.tags.includes(tag)
          return (
            <Chip
              key={`tag-${tag}`}
              selected={selected}
              color={color}
              onClick={() => toggle('tags', tag)}
              title={selected ? `取消筛选：${tag}` : `只看带「${tag}」的记录`}
            >
              <span aria-hidden className="font-mono text-faint">#</span>
              <span className="truncate">{tag}</span>
              <span className="font-mono text-faint tnum">{count}</span>
            </Chip>
          )
        })}

        {total > COLLAPSED_LIMIT && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="ui-press rounded-full px-3 py-1.5 text-meta text-live underline underline-offset-4"
          >
            {expanded ? '收起' : `还有 ${total - COLLAPSED_LIMIT} 个`}
          </button>
        )}
      </div>
    </section>
  )
}

function Chip({
  selected,
  color,
  onClick,
  title,
  children,
}: {
  selected: boolean
  color: string
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={title}
      className={`ui-press flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-meta transition-colors ${
        selected ? 'text-ink' : 'border-line/80 bg-base/40 text-muted hover:border-muted hover:text-ink'
      }`}
      style={selected ? { borderColor: `${color}99`, background: `${color}1F` } : undefined}
    >
      {children}
    </button>
  )
}
