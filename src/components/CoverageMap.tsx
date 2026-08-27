'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Coverage } from '@/lib/coverage'
import { GAP_NOTES, noteForMonth, type GapNote } from '@/lib/gap-notes'
import { actColorForDate } from '@/lib/narrative'

/**
 * 联系页的「档案缺口」面板：一眼看出哪些月份还是空的，以及为什么空。
 *
 * 一格 = 一个月。亮 = 这个月已有记录（越亮越多），空 = 档案里这个月一条都没有。
 * 空格只说明「档案里没有」，不代表那个月没播；已经查清原因的空白（停播 / 视频时期 / 日期未定）
 * 用另一种描边区分，并在悬停读数里给出说明——事实与推测分开写，推测明确标注。
 * 尺寸全部用 clamp/fr，没有写死像素：宽屏上格子跟着版心一起长大。
 */

const MONTH_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

/** 四档密度：档位固定，读者能把颜色换算回数量级 */
function level(count: number, max: number): number {
  if (count <= 0) return 0
  const ratio = count / max
  if (ratio > 0.66) return 4
  if (ratio > 0.33) return 3
  if (ratio > 0.12) return 2
  return 1
}

const LEVEL_OPACITY = [0, 0.28, 0.5, 0.75, 1]

type Reading = { year: number; month: number; count: number; note?: GapNote }

export function CoverageGaps({
  coverage,
  defaultExpanded = false,
}: {
  coverage: Coverage
  /** 数据页默认摊开（那一页本来就是来看数据的）；联系页保持折叠。 */
  defaultExpanded?: boolean
}) {
  const {
    years,
    cells,
    maxMonthCount,
    blankMonths,
    monthsInRange,
    totalEntries,
    missingDuration,
    durationCoverage,
    deadOnly,
    noSource,
    yearRows,
  } = coverage

  const [reading, setReading] = useState<Reading | null>(null)
  const [expanded, setExpanded] = useState(defaultExpanded)

  const byKey = new Map(cells.map((cell) => [`${cell.year}-${cell.month}`, cell]))
  const filledMonths = monthsInRange - blankMonths
  const monthCoverage = monthsInRange ? Math.round((filledMonths / monthsInRange) * 100) : 0
  const explainedBlanks = cells.filter(
    (cell) => !cell.outOfRange && cell.count === 0 && noteForMonth(cell.year, cell.month),
  ).length
  const worstYears = [...yearRows]
    .filter((row) => row.blankMonths > 0)
    .sort((a, b) => b.blankMonths - a.blankMonths || a.year - b.year)
    .slice(0, 6)

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface/55">
      {/* 概览数字：先给结论，收起状态下这是唯一显示的内容 */}
      <div className="relative grid gap-px bg-line/60 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="已收录记录" value={totalEntries.toLocaleString()} unit="条" />
        <Tile label="有记录的月份" value={`${monthCoverage}%`} unit={`${filledMonths} / ${monthsInRange} 个月`} />
        <Tile label="空白月份" value={blankMonths.toLocaleString()} unit="个月一条记录都没有" accent="#5BC8E8" />
        <Tile
          label="已经查清原因"
          value={explainedBlanks.toLocaleString()}
          unit={`个空白月有说明 · 其余 ${Math.max(0, blankMonths - explainedBlanks)} 个还没有`}
          accent="#E0A244"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="ui-press absolute right-3 top-3 rounded-full border border-line/80 bg-base/70 px-3 py-1 text-meta text-muted backdrop-blur hover:border-muted hover:text-ink"
        >
          {expanded ? '收起 ↑' : '展开看每个月 ↓'}
        </button>
      </div>

      {expanded && (
      <div className="border-t border-line/70 p-[clamp(0.875rem,1.4vw,1.5rem)]">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h3 className="text-h3 font-medium text-ink">
              {years[0]} — {years[years.length - 1]}，每个格子是一个月
            </h3>
            <p className="mt-1 text-meta text-faint">亮起来＝档案里有记录；空格＝还没有找到任何录像</p>
          </div>
          <Readout reading={reading} />
        </div>

        <div
          className="mt-[clamp(0.875rem,1.2vw,1.25rem)] grid gap-[clamp(0.125rem,0.35vw,0.4rem)]"
          onMouseLeave={() => setReading(null)}
          style={{ gridTemplateColumns: `auto repeat(${years.length}, minmax(0, 1fr))` }}
        >
          {MONTH_LABELS.map((label, index) => {
            const month = index + 1
            return (
              <MonthRow key={month} label={label} month={month}>
                {years.map((year) => {
                  const cell = byKey.get(`${year}-${month}`)
                  const count = cell?.count ?? 0
                  const out = cell?.outOfRange ?? false
                  const lv = level(count, maxMonthCount)
                  const note = noteForMonth(year, month)
                  const explained = count === 0 && !out && note
                  return (
                    <button
                      type="button"
                      key={`${year}-${month}`}
                      tabIndex={out ? -1 : 0}
                      aria-hidden={out}
                      onMouseEnter={() => !out && setReading({ year, month, count, note })}
                      onFocus={() => !out && setReading({ year, month, count, note })}
                      title={
                        out
                          ? undefined
                          : count > 0
                            ? `${year} 年 ${month} 月 · ${count} 条记录`
                            : `${year} 年 ${month} 月 · 档案里没有记录`
                      }
                      className={`block h-[clamp(0.55rem,0.95vw,1rem)] w-full rounded-[0.1875rem] transition-[transform,box-shadow] hover:z-10 hover:scale-[1.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live ${
                        out
                          ? 'pointer-events-none opacity-0'
                          : lv > 0
                            ? ''
                            : explained
                              ? note.kind === 'known'
                                ? 'bg-raised/40 ring-1 ring-inset ring-line/60'
                                : 'bg-raised/50 ring-1 ring-inset ring-[#E0A244]/45'
                              : 'bg-raised/70 ring-1 ring-inset ring-line/70'
                      }`}
                      style={
                        out || lv === 0
                          ? undefined
                          : { background: actColorForDate(`${year}-${String(month).padStart(2, '0')}-15`), opacity: LEVEL_OPACITY[lv] }
                      }
                    />
                  )
                })}
              </MonthRow>
            )
          })}

          {/* 年份轴 */}
          <span aria-hidden />
          {years.map((year) => (
            // 手机上年份标签会挤成一团，隔一年隐去一个（用透明度，不能用 hidden——网格列不能塌）
            <span
              key={`axis-${year}`}
              className={`pt-1.5 text-center font-mono text-meta text-faint tnum ${year % 2 ? 'opacity-0 sm:opacity-100' : ''}`}
            >
              {String(year).slice(2)}
            </span>
          ))}
        </div>

        <div className="mt-[clamp(0.875rem,1.2vw,1.25rem)] flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line/60 pt-4">
          <span className="flex items-center gap-2 text-meta text-faint">
            少
            {[1, 2, 3, 4].map((lv) => (
              <span key={lv} className="h-3 w-3 rounded-[0.1875rem]" style={{ background: '#5BC8E8', opacity: LEVEL_OPACITY[lv] }} />
            ))}
            多 · 颜色跟随所处时期（视频 / 斗鱼 / 抖音）
          </span>
          <span className="flex items-center gap-2 text-meta text-faint">
            <span className="h-3 w-3 rounded-[0.1875rem] bg-raised/70 ring-1 ring-inset ring-line/70" />
            空白，还没查清
          </span>
          <span className="flex items-center gap-2 text-meta text-faint">
            <span className="h-3 w-3 rounded-[0.1875rem] bg-raised/50 ring-1 ring-inset ring-[#E0A244]/45" />
            空白，已知原因 / 正在找
          </span>
        </div>

        <p className="mt-4 text-meta text-faint">
          另外：{missingDuration.toLocaleString()} 条记录还缺可核对时长（{durationCoverage}% 已有）、
          {deadOnly.toLocaleString()} 条来源已全部失效、{noSource.toLocaleString()} 条还没有任何来源链接。
        </p>
      </div>
      )}

      {/* 空白的已知原因 + 空得最多的年份——收起状态下不渲染 */}
      {expanded && (
      <div className="grid gap-px border-t border-line/70 bg-line/60 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="bg-surface/55 p-[clamp(0.875rem,1.4vw,1.5rem)]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-meta uppercase tracking-[0.16em] text-faint">这些空白是怎么回事</p>
            <p className="text-meta text-faint">事实与推测分开写</p>
          </div>
          <ul className="mt-4 grid gap-2.5 xl:grid-cols-2">
            {GAP_NOTES.map((note) => (
              <li key={note.id} className="rounded-xl border border-line/70 bg-base/25 p-[clamp(0.75rem,1vw,1rem)]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-control text-ink">{note.label}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-meta"
                    style={
                      note.kind === 'gap'
                        ? { background: 'rgba(224,162,68,0.14)', color: '#E0A244' }
                        : { background: 'rgba(139,143,163,0.14)', color: '#8B8FA3' }
                    }
                  >
                    {note.kind === 'gap' ? '还在找' : '已知原因'}
                  </span>
                </div>
                <p className="measure-body mt-1.5 text-meta text-muted">{note.known}</p>
                {note.guess && (
                  <p className="measure-body mt-1.5 text-meta text-faint">
                    <span className="uppercase tracking-[0.16em]">推测 · </span>
                    {note.guess}
                  </p>
                )}
                {note.wanted && (
                  <p className="measure-body mt-1.5 text-meta text-faint">最有用的证据：{note.wanted}</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-surface/55 p-[clamp(0.875rem,1.4vw,1.5rem)]">
          <p className="text-meta uppercase tracking-[0.16em] text-faint">空得最多的年份</p>
          <ul className="mt-5 space-y-3">
            {worstYears.map((row) => (
              <li key={row.year}>
                <Link href={`/archive/?y=${row.year}`} className="ui-press group block">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-control text-ink tnum">{row.year}</span>
                    <span className="text-meta text-faint tnum">{row.blankMonths} / 12 个月空白</span>
                  </div>
                  <div className="mt-1.5 flex gap-[0.1875rem]">
                    {MONTH_LABELS.map((_, index) => {
                      const cell = byKey.get(`${row.year}-${index + 1}`)
                      const has = (cell?.count ?? 0) > 0
                      const out = cell?.outOfRange ?? false
                      return (
                        <span
                          key={index}
                          title={`${row.year} 年 ${index + 1} 月 · ${has ? `${cell?.count} 条` : '没有记录'}`}
                          className={`h-2 flex-1 rounded-[0.125rem] ${out ? 'opacity-0' : has ? '' : 'bg-raised/70 ring-1 ring-inset ring-line/70'}`}
                          style={out || !has ? undefined : { background: actColorForDate(`${row.year}-06-15`) }}
                        />
                      )
                    })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line/70 pt-4 text-meta text-faint">
            点年份可以直接打开那一年的录播室，看看现在都收了什么。
          </p>
        </div>
      </div>
      )}
    </div>
  )
}

/**
 * 悬停读数：鼠标停在哪个月，这里就显示那个月的数字与原因。
 * 高度和宽度都锁死——内容从「提示语」切到「两行读数」时，下面的热力图不能跟着跳。
 */
function Readout({ reading }: { reading: Reading | null }) {
  return (
    <div className="h-[3.5rem] w-full min-w-0 overflow-hidden rounded-lg border border-line/60 bg-base/25 px-3 py-2 sm:w-[26rem]">
      {!reading ? (
        <p className="flex h-full items-center text-meta text-faint">把鼠标移到格子上（手机点一下），看这个月收了多少</p>
      ) : (
        <>
          <p className="font-mono text-control text-ink tnum">
            {reading.year} 年 {reading.month} 月 ·{' '}
            {reading.count > 0 ? (
              <span className="text-live">{reading.count.toLocaleString()} 条记录</span>
            ) : (
              <span className="text-faint">档案里没有记录</span>
            )}
          </p>
          {reading.note && (
            <p className="measure-note mt-0.5 line-clamp-1 text-meta text-faint">
              {reading.note.label} · {reading.note.kind === 'gap' ? '还在找' : '已知原因'} — {reading.note.known}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function MonthRow({ label, month, children }: { label: string; month: number; children: React.ReactNode }) {
  return (
    <>
      <span className={`pr-1.5 text-right font-mono text-meta leading-[1] text-faint tnum sm:pr-2 ${month % 3 === 1 ? '' : 'opacity-0'}`}>
        {label}<span className="hidden sm:inline"> 月</span>
      </span>
      {children}
    </>
  )
}

function Tile({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: string }) {
  return (
    <div className="bg-surface/55 p-[clamp(0.875rem,1.2vw,1.25rem)]">
      <p className="flex items-center gap-2 text-meta uppercase tracking-[0.16em] text-faint">
        {accent && <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
        {label}
      </p>
      <p className="mt-2 font-mono text-h3 font-bold leading-none text-ink tnum">{value}</p>
      <p className="mt-1.5 text-meta text-faint tnum">{unit}</p>
    </div>
  )
}
