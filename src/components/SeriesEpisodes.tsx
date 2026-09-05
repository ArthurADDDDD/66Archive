'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { EntryGrid } from './EntryGrid'
import { EntryRow } from './EntryRow'
import { EntryTimeline } from './EntryTimeline'
import { EntryViewToggle, useEntryView } from './EntryViewMode'
import { applyEntryFilter, ClearYearButton, OrderToggle, useEntryFilter } from './EntryFilters'

const EPISODES_BATCH_SIZE = 60

/**
 * 节目全部期数。
 * 全部记录首批呈现 60 条，用户滚到列表底部后可继续追加；点击某一期后在当前页面展开来源、分段和标签信息，
 * 不再把查找动作变成 /e/ 的完整详情页跳转。系列跨年份，所以这里显示完整日期。
 *
 * 年份筛选与正倒序都作用在同一份 entries 上——右侧那条年月时间轴是从 entries
 * 现算的（EntryTimeline 内部 groupByMonth），所以刻度、游标、悬停标签会跟着一起变，
 * 不需要额外通知它。
 */
export function SeriesEpisodes({
  entries,
  color,
  count,
  unit = '期',
}: {
  entries: TimelineEntry[]
  color: string
  count: number
  unit?: string
}) {
  const { year, order } = useEntryFilter()
  const { view, setView, compact } = useEntryView()
  // 网格一次只展开一条：整行插入的详情面板很高，同时开两块就没法对照了。
  const [gridExpandedId, setGridExpandedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // buildSeries 交出来的是升序（第一期在前）
  const visible = useMemo(() => applyEntryFilter(entries, year, order, 'asc'), [entries, year, order])
  const batchKey = `${year ?? 'all'}-${order}`
  const [batch, setBatch] = useState({ key: batchKey, count: EPISODES_BATCH_SIZE })
  const pendingTargetRef = useRef<{ id: string; key: string } | null>(null)
  // 条件式同步是 React 推荐的「根据本次 render 输入调整状态」模式：筛选或
  // 换序时本次就回到首批 60 条，不会先闪出旧条件下已经加载的长列表。
  if (batch.key !== batchKey) setBatch({ key: batchKey, count: EPISODES_BATCH_SIZE })
  const loadedCount = Math.min(
    batch.key === batchKey ? batch.count : EPISODES_BATCH_SIZE,
    visible.length,
  )
  const loadedEntries = visible.slice(0, loadedCount)
  const remainingCount = visible.length - loadedCount

  /**
   * 旧链接可能直接指向 #entry-<id>，完整年月轴也可能跳到尚未渲染的月份。
   * 只把包含目标的批次补出来，然后在 React 提交 DOM 后恢复原来的锚点定位能力。
   */
  const revealTarget = useCallback((targetId: string) => {
    if (!targetId.startsWith('entry-')) return
    const entryId = targetId.slice('entry-'.length)
    const targetIndex = visible.findIndex((entry) => entry.id === entryId)
    if (targetIndex < 0) return
    const mountedTarget = document.getElementById(targetId)
    if (mountedTarget) {
      mountedTarget.scrollIntoView({ block: 'start' })
      return
    }
    pendingTargetRef.current = { id: targetId, key: batchKey }
    const requiredCount = Math.min(
      Math.ceil((targetIndex + 1) / EPISODES_BATCH_SIZE) * EPISODES_BATCH_SIZE,
      visible.length,
    )
    setBatch((current) => {
      const currentCount = current.key === batchKey ? current.count : EPISODES_BATCH_SIZE
      return requiredCount > currentCount ? { key: batchKey, count: requiredCount } : current
    })
  }, [batchKey, visible])

  // hashchange 监听器只挂一次，避免排序/筛选改变时把地址栏里旧的 hash
  // 当成一次新导航，再把已经重置为 60 条的结果暗中补回很长。
  const revealTargetRef = useRef(revealTarget)
  useEffect(() => {
    revealTargetRef.current = revealTarget
  }, [revealTarget])

  useEffect(() => {
    const revealHashTarget = () => {
      let targetId = window.location.hash.slice(1)
      try {
        targetId = decodeURIComponent(targetId)
      } catch {
        // 非法转义片段不是本站生成的链接；保留原值尝试匹配即可。
      }
      if (targetId) revealTargetRef.current(targetId)
    }
    revealHashTarget()
    window.addEventListener('hashchange', revealHashTarget)
    return () => window.removeEventListener('hashchange', revealHashTarget)
  }, [])

  // 等批次真正提交后定位；字体落地可能让近 300 行累计增高数千像素，
  // 所以在字体完成和正文高度变化时重新校准，不能只假定“两帧以后布局就稳定”。
  useEffect(() => {
    const request = pendingTargetRef.current
    if (!request) return
    if (request.key !== batchKey) {
      pendingTargetRef.current = null
      return
    }
    const targetId = request.id
    let stopped = false
    let frame = 0
    let timeout = 0
    let fontsReady = document.fonts.status === 'loaded'
    let observer: ResizeObserver | null = null

    const cleanup = () => {
      if (stopped) return
      stopped = true
      if (frame) window.cancelAnimationFrame(frame)
      if (timeout) window.clearTimeout(timeout)
      observer?.disconnect()
    }
    const complete = () => {
      const pending = pendingTargetRef.current
      if (pending?.id === targetId && pending.key === batchKey) pendingTargetRef.current = null
      cleanup()
    }
    const align = () => {
      frame = 0
      if (stopped) return
      const target = document.getElementById(targetId)
      if (!target) return
      target.scrollIntoView({ block: 'start' })
      const top = target.getBoundingClientRect().top
      if (fontsReady && top >= 0 && top < 160) complete()
    }
    const scheduleAlign = () => {
      if (stopped || frame) return
      frame = window.requestAnimationFrame(align)
    }

    observer = new ResizeObserver(scheduleAlign)
    observer.observe(document.body)
    scheduleAlign()
    void document.fonts.ready.then(() => {
      fontsReady = true
      scheduleAlign()
    })
    // 字体接口或 ResizeObserver 异常时也给出最终落点，不无限持有观察器。
    timeout = window.setTimeout(() => {
      fontsReady = true
      align()
      complete()
    }, 3000)

    // Strict Mode 会在开发态立刻执行一次 cleanup 再重挂 effect；这里只释放
    // 浏览器资源，不能把尚未完成的目标请求也当成已完成清掉。
    return cleanup
  }, [batchKey, loadedCount, view])

  const allExpanded = visible.length > 0 && visible.every((entry) => expanded.has(entry.id))
  const expandAll = () => {
    // “全部展开”是用户明确触发的重操作，保留原先对完整筛选结果生效的能力。
    setBatch({ key: batchKey, count: visible.length })
    setExpanded((current) => new Set([...current, ...visible.map((entry) => entry.id)]))
  }
  const collapseAll = () =>
    setExpanded((current) => {
      const next = new Set(current)
      for (const entry of visible) next.delete(entry.id)
      return next
    })

  const loadMore = () =>
    setBatch({ key: batchKey, count: Math.min(loadedCount + EPISODES_BATCH_SIZE, visible.length) })

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const row = (entry: TimelineEntry) => (
    <EntryRow entry={entry} expanded={expanded.has(entry.id)} showFullDate onToggle={() => toggle(entry.id)} />
  )

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-meta text-faint">
          {unit === '场' ? '点击记录' : '点击期数'}展开原平台来源、分段和标签信息
          {year === null ? (
            <span className="ml-2 tnum">· {count} {unit}</span>
          ) : (
            <span className="ml-2 tnum" style={{ color }}>
              · {year} 年 · {visible.length} {unit}
              <span className="text-faint">（共 {count} {unit}）</span>
            </span>
          )}
          {visible.length > EPISODES_BATCH_SIZE && (
            <span className="ml-2 tnum">· 已显示 {loadedCount} / {visible.length}</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ClearYearButton />
          <OrderToggle />
          <EntryViewToggle view={view} setView={setView} compact={compact} />
          {view === 'list' && (
            <button
              type="button"
              onClick={allExpanded ? collapseAll : expandAll}
              aria-expanded={allExpanded}
              className={`ui-press rounded-full border px-4 py-2 text-meta transition-colors sm:px-3 sm:py-1.5 ${
                allExpanded
                  ? 'border-line text-muted hover:border-muted hover:text-ink'
                  : 'bg-surface/30 hover:bg-surface'
              }`}
              style={!allExpanded ? { borderColor: `${color}80`, color } : undefined}
            >
              {allExpanded ? '全部折叠' : '全部展开'}
            </button>
          )}
        </div>
      </div>

      {view === 'grid' ? (
        <div id="series-episode-list" className="mt-4 w-full">
          <EntryGrid
            entries={loadedEntries}
            expandedId={gridExpandedId}
            onToggle={(id) => setGridExpandedId(gridExpandedId === id ? null : id)}
            showFullDate
          />
        </div>
      ) : loadedEntries.length > 10 ? (
        <div id="series-episode-list" className="mt-4 w-full">
          {/* key 只在筛选或换序时重置时间轴；追加记录不能重建用户已经浏览过的条目。 */}
          <EntryTimeline
            key={batchKey}
            entries={loadedEntries}
            indexEntries={visible}
            color={color}
            renderEntry={row}
            onMissingTarget={revealTarget}
          />
        </div>
      ) : (
        <div id="series-episode-list" className="mt-4 w-full divide-y divide-line/50 border-y border-line/60">
          {loadedEntries.map((entry) => (
            <div key={entry.id}>{row(entry)}</div>
          ))}
        </div>
      )}

      {remainingCount > 0 ? (
        <div className="mt-7 flex flex-col items-center gap-2 border-t border-line/60 pt-6">
          <p className="text-meta text-faint tnum" role="status" aria-live="polite" aria-atomic="true">
            已显示 {loadedCount} / 共 {visible.length} {unit}
          </p>
          <button
            type="button"
            onClick={loadMore}
            aria-controls="series-episode-list"
            className="ui-press min-h-11 w-full max-w-xs rounded-full border border-live/60 bg-live/10 px-6 py-2.5 text-sm text-live transition-colors hover:border-live hover:bg-live/15"
          >
            加载更多
            <span className="ml-2 text-meta opacity-75">
              再显示 {Math.min(EPISODES_BATCH_SIZE, remainingCount)} {unit}
            </span>
          </button>
        </div>
      ) : visible.length > EPISODES_BATCH_SIZE ? (
        <p
          className="mt-7 border-t border-line/60 pt-6 text-center text-meta text-faint tnum"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          已加载全部 {visible.length} {unit}
        </p>
      ) : null}
    </div>
  )
}
