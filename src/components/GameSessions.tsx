'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { TimelineEntry } from '@/lib/data'
import { decodeArchiveEntry, type EncodedEntry } from '@/lib/archive-payload'
import type { GameRecordings } from '@/lib/game-recordings'
import { RecordingClips, RECORDING_TEXTS } from './GameRecordingGroup'
import { EntryGrid } from './EntryGrid'
import { EntryDetailBody } from './EntryDetail'
import { EntryRow } from './EntryRow'
import { EntryMonthRail, EntryTimeline } from './EntryTimeline'
import { EntryViewToggle, useEntryView } from './EntryViewMode'
import { applyEntryFilter, ClearYearButton, OrderToggle, useEntryFilter } from './EntryFilters'
import { SiteText } from './SiteText'

const NONE: ReadonlySet<string> = new Set()

/**
 * 游戏详情页的相关场次：按游戏章节分 P 展示，完整档案入口保留整场上下文。
 * 电脑上默认全部打开；手机默认折叠，展开后只显示当前游戏的录像区间。
 *
 * 年份筛选来自上面那张「年份分布」条形图（点某一年就只看那一年），
 * 正倒序则是这里的切换键。右侧年月时间轴从 entries 现算，跟着一起变。
 */
export function GameSessions({
  entries: encodedEntries,
  game,
  recordings,
  color = '#E0A244',
}: {
  /**
   * 与 `/archive-data.json` 同一套无损编码（见 `lib/archive-payload.ts`）。
   * 753 个游戏页每一个都要把这份场次列表内联进 HTML，编码省下来的是这 753 份的
   * 共同开销，不是某一页的特例。
   */
  entries: EncodedEntry[]
  game: { id: string; name: string }
  recordings: Record<string, GameRecordings>
  color?: string
}) {
  const entries = useMemo(() => encodedEntries.map(decodeArchiveEntry), [encodedEntries])
  const allIds = useMemo<ReadonlySet<string>>(() => new Set(entries.map((entry) => entry.id)), [entries])
  const { year, order } = useEntryFilter()
  // getGameProfile 交出来的是降序（最近一场在前）
  const visible = useMemo(() => applyEntryFilter(entries, year, order, 'desc'), [entries, year, order])

  const { view, setView, compact } = useEntryView()
  // 封面视图恢复成一场一张卡；展开时才显示该游戏的片段。
  const [gridExpandedId, setGridExpandedId] = useState<string | null>(null)
  // null = 还没动过：电脑默认全开，手机默认全收（compact 挂载后才知道，所以不能写进初始值）。
  const [touched, setTouched] = useState<ReadonlySet<string> | null>(null)
  const expanded = touched ?? (compact ? NONE : allIds)
  const allExpanded = visible.length > 0 && visible.every((entry) => expanded.has(entry.id))
  const expandAll = () => setTouched(new Set([...expanded, ...visible.map((entry) => entry.id)]))
  const collapseAll = () => {
    const next = new Set(expanded)
    for (const entry of visible) next.delete(entry.id)
    setTouched(next)
  }

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setTouched(next)
  }

  // 不再把同一场直播拆成四张外观相同的主卡；只覆盖已定位的展开面板。
  // 对应录像缺失时只显示缺失状态，不再回退整场或其他游戏的来源。
  const clipDetails = useMemo(() => {
    const result: Record<string, ReactNode> = {}
    for (const entry of entries) {
      if (entry.gameFootageNotice) {
        result[entry.id] = <EntryDetailBody entry={entry} />
        continue
      }
      const session = recordings[entry.id]
      if (!session?.clips.length) continue
      result[entry.id] = <GameClipsPanel entry={entry} game={game} recordings={session} />
    }
    return result
  }, [entries, game, recordings])

  const row = (entry: TimelineEntry) => (
    <EntryRow entry={entry} expanded={expanded.has(entry.id)} showFullDate
      onToggle={() => toggle(entry.id)} detail={clipDetails[entry.id]} />
  )

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-meta uppercase tracking-[0.16em] text-faint"><SiteText id="game-sessions-eyebrow" /></p>
          <h2 className="mt-2 text-h3 font-semibold text-ink">
            <SiteText id="game-sessions-title" />
            {year !== null && (
              <span className="ml-2 text-control font-normal tnum" style={{ color }}>
                · {year} 年 · {visible.length} 场
                <span className="text-faint">（共 {entries.length} 场）</span>
              </span>
            )}
          </h2>
          {/* 口径说明（不给读者看）：游戏页只收当前游戏的分 P/片段；外站播放到片段终点不会自动停。 */}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ClearYearButton />
          <OrderToggle />
          <EntryViewToggle view={view} setView={setView} compact={compact} />
          {view === 'list' && <button
            type="button"
            onClick={allExpanded ? collapseAll : expandAll}
            aria-expanded={allExpanded}
            className={`ui-press rounded-full border px-4 py-2 text-meta transition-colors sm:px-3 sm:py-1.5 ${
              allExpanded
                ? 'border-line text-muted hover:border-muted hover:text-ink'
                : 'border-live/50 bg-live/5 text-live hover:border-live hover:bg-live/10'
            }`}
          >
            {allExpanded ? '全部折叠' : '全部展开'}
          </button>}
        </div>
      </div>

      {view === 'grid' ? (
        <div className="mt-6 w-full">
          {visible.length > 10 && (
            <EntryMonthRail key={`${year ?? 'all'}-${order}`} entries={visible} color={color} unit="场" />
          )}
          <EntryGrid entries={visible} expandedId={gridExpandedId}
            onToggle={(id) => setGridExpandedId(gridExpandedId === id ? null : id)}
            showFullDate detailOverrides={clipDetails} />
        </div>
      ) : visible.length > 10 ? (
        <div className="mt-6 w-full">
          <EntryTimeline key={`${year ?? 'all'}-${order}`} entries={visible} color={color} unit="场" renderEntry={row} />
        </div>
      ) : (
        <div className="mt-6 w-full divide-y divide-line/50 border-y border-line/60">
          {visible.map((entry) => (
            <div key={entry.id}>{row(entry)}</div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 一场一张主封面卡；这里仅提供这款游戏的定位入口，不冒充独立新录像。 */
function GameClipsPanel({ entry, game, recordings }: {
  entry: TimelineEntry
  game: { id: string; name: string }
  recordings: GameRecordings
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-control font-semibold text-ink">{game.name} · 已定位 {recordings.clips.length} 段</p>
          <p className="mt-1 text-meta text-muted">
            下面仅列出这款游戏对应的录像片段。整场上下文、其他内容及备选录像请查看完整档案。
          </p>
        </div>
        <Link prefetch={false} href={`/e/${entry.id}/`}
          className="ui-press shrink-0 rounded-full border border-line px-3 py-1.5 text-meta text-live hover:border-live/60">
          <SiteText id="game-rec-archive" />
        </Link>
      </div>
      {/* 片段以紧凑列表展示，不重复堆叠四张同名大封面。 */}
      <RecordingClips entry={entry} clips={recordings.clips} grid={false} texts={RECORDING_TEXTS.game} />
    </div>
  )
}
