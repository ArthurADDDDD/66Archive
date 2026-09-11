'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { flashLandedTarget, scrollToLandingTarget } from '@/lib/landing-flash'

export type MonthGroup = {
  key: string
  year: string
  month: number
  count: number
  firstEntryId: string
  firstEntryTitle: string
  cover: string | null
}

/** 右侧年月轨道从 md 起才出现（见 TimelineRail），这以下由手机端的年月索引接手。 */
export const RAIL_HIDDEN_QUERY = '(max-width: 767px)'

/**
 * 手机端的年月索引。
 *
 * 列表进入视野时，底部中间浮出一颗胶囊，写着「现在翻到哪一月」；点开是一张按年排的
 * 月份表（只列有记录的月份，带条数），点哪个月就跳到那个月的第一条——
 * 和录播室「先挑年、再挑月」是同一种找法。几百期的节目在手机上不用再一路往下滑。
 *
 * 位置避开左下角的音乐按钮与右下角的回到顶部。
 *
 * 单独一个文件、由 EntryTimeline 按需加载：电脑端有右侧轨道，永远不下载这一块。
 */
export function EntryMobileIndex({
  groups,
  lastEntryId,
  total,
  color,
  unit,
  onMissingTarget,
}: {
  groups: MonthGroup[]
  lastEntryId: string | null
  total: number
  color: string
  unit: string
  onMissingTarget?: (id: string) => void
}) {
  const [inView, setInView] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const phone = window.matchMedia(RAIL_HIDDEN_QUERY)
    let frame = 0
    const measure = () => {
      frame = 0
      if (!phone.matches || groups.length === 0) {
        setInView(false)
        return
      }
      const first = document.getElementById(`entry-${groups[0]!.firstEntryId}`)
      const last = lastEntryId ? document.getElementById(`entry-${lastEntryId}`) : null
      if (!first) {
        setInView(false)
        return
      }
      const height = window.innerHeight
      const listTop = first.getBoundingClientRect().top
      const listBottom = (last ?? first).getBoundingClientRect().bottom
      setInView(listTop < height * 0.85 && listBottom > height * 0.35)

      // 当前月份：最后一个「第一条已经滚过视口 35% 处」的月份
      const probe = height * 0.35
      let active: string | null = groups[0]!.key
      for (const group of groups) {
        const element = document.getElementById(`entry-${group.firstEntryId}`)
        if (!element) continue
        if (element.getBoundingClientRect().top <= probe) active = group.key
        else break
      }
      setCurrent(active)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }
    // 只在手机宽度下挂滚动监听：横屏、换到平板以后右侧轨道接手，这里不再每一帧量一遍。
    let listening = false
    const sync = () => {
      if (phone.matches && !listening) {
        window.addEventListener('scroll', schedule, { passive: true })
        window.addEventListener('resize', schedule)
        listening = true
      } else if (!phone.matches && listening) {
        window.removeEventListener('scroll', schedule)
        window.removeEventListener('resize', schedule)
        listening = false
      }
      schedule()
    }
    sync()
    phone.addEventListener('change', sync)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      phone.removeEventListener('change', sync)
    }
  }, [groups, lastEntryId])

  useEffect(() => {
    if (!open) return
    activeRef.current?.scrollIntoView({ block: 'center' })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const years = useMemo(() => {
    const list: { year: string; count: number; months: MonthGroup[] }[] = []
    for (const group of groups) {
      const last = list[list.length - 1]
      if (last && last.year === group.year) {
        last.count += group.count
        last.months.push(group)
      } else {
        list.push({ year: group.year, count: group.count, months: [group] })
      }
    }
    return list
  }, [groups])

  if (groups.length === 0) return null
  const active = groups.find((group) => group.key === current) ?? groups[0]!

  const jump = (group: MonthGroup) => {
    setOpen(false)
    const id = `entry-${group.firstEntryId}`
    // 分批渲染还没画到的月份，交给调用方先把那一批补出来，再由它负责对齐。
    if (!scrollToLandingTarget(id)) onMissingTarget?.(id)
    flashLandedTarget(id, color)
  }

  // 挂到 body：页面入场动画带 transform，fixed 放在正文里会被困在正文的坐标系里。
  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`按年月查找，当前 ${active.year} 年 ${active.month} 月`}
        className={`ui-press fixed bottom-5 left-1/2 z-40 flex h-11 max-w-[calc(100vw-8.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-line/80 bg-surface/90 px-4 text-meta text-ink shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur transition-[opacity,transform] duration-300 md:hidden ${
          inView && !open ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate font-mono tnum">
          {active.year}.{String(active.month).padStart(2, '0')}
        </span>
        <span className="shrink-0 text-faint">按年月找</span>
        <span aria-hidden className="shrink-0 text-faint">▴</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="按年月查找">
          <button type="button" aria-label="关闭" onClick={() => setOpen(false)} className="ui-backdrop-in absolute inset-0 bg-base/80 backdrop-blur-sm" />
          <div className="ui-sheet-in absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto overscroll-contain rounded-t-xl border-t border-line bg-surface px-5 pb-8 pt-4 shadow-[0_-20px_70px_rgba(0,0,0,0.3)]">
            <div className="sticky -top-4 z-10 -mx-5 mb-2 flex items-center justify-between border-b border-line bg-surface px-5 pb-3 pt-1">
              <div>
                <p className="text-sm font-medium text-ink">按年月找</p>
                <p className="mt-0.5 text-meta text-faint tnum">共 {total} {unit} · 点一个月份跳过去</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="ui-press rounded px-2 py-2 text-meta text-live hover:bg-live/10">
                完成
              </button>
            </div>
            <div className="space-y-5">
              {years.map((year) => (
                <section key={year.year}>
                  <h3 className="flex items-baseline justify-between">
                    <span className="font-display text-lg font-bold text-ink tnum">{year.year}</span>
                    <span className="text-meta text-faint tnum">{year.count} {unit}</span>
                  </h3>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {year.months.map((group) => {
                      const selected = group.key === active.key
                      return (
                        <button
                          key={group.key}
                          ref={selected ? activeRef : undefined}
                          type="button"
                          onClick={() => jump(group)}
                          aria-current={selected ? 'true' : undefined}
                          className={`ui-press flex min-h-12 flex-col items-center justify-center rounded-lg border px-1 py-1.5 tnum transition-colors ${
                            selected ? 'bg-raised/80 text-ink' : 'border-line bg-base/40 text-muted'
                          }`}
                          style={selected ? { borderColor: color } : undefined}
                        >
                          <span className="text-control" style={selected ? { color } : undefined}>{group.month} 月</span>
                          <span className="text-meta text-faint">{group.count} {unit}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
