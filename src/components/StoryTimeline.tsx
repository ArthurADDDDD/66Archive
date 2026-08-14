'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ResolvedBeat } from '@/lib/narrative'
import type { StoryYear } from '@/lib/story-years'
import { applyLiveStoryYears } from '@/lib/live-content'
import { Eyebrow, MediaFrame } from './primitives'
import { useLiveContent } from './LiveContentProvider'

/**
 * 故事模式：纵向编辑时间线（回到「年份脊柱」那一版的样式）。
 *
 * 每年只展示 Hero + 少量 Secondary；全部记录在档案模式。
 * 年份分三种视觉层级（kind）制造滚动节奏：
 *   A highlight：大年份 + 完整 Hero（封面 / 一句话 / Secondary）。
 *   B normal：紧凑 Hero 行，不占大版面。
 *   C sparse：资料很少或为空的年份，只有一句诚实的注脚。
 * 2011 年档案为空——如实展示为缺口，不假装。
 *
 * 条目来自 STORY_ACTS 的策展列表（见 lib/story-years.ts），不是这里重新挑的。
 * 排版走全站的六档字阶与 13% 安全边距；日期与标题分成固定两行，
 * 标题永远从同一条左边线起，不因为前面有没有小标签而左右浮动。
 */
export function StoryTimeline({
  years: baselineYears,
  total,
  latestYear,
  onOpenArchive,
  modeControl,
}: {
  years: StoryYear[]
  total: number
  latestYear: number
  onOpenArchive: (year: number) => void
  modeControl?: ReactNode
}) {
  const { narrative } = useLiveContent()
  const years = applyLiveStoryYears(baselineYears, narrative?.storyActs)
  return (
    <main className="ui-page-in site-container px-page pb-20">
      {modeControl && <div className="ui-reveal pt-4 sm:hidden">{modeControl}</div>}
      <section className="ui-reveal pb-8 pt-4 sm:py-12">
        <Eyebrow color="#5BC8E8">Chronicle · 编年史 · 故事模式</Eyebrow>
        <h1 className="mt-4 max-w-2xl text-h1 font-semibold">时间不是一条列表，是一路走过来的。</h1>
        <p className="mt-5 max-w-2xl text-body text-muted">
          故事模式只放那些值得停下看的晚上。共 {total.toLocaleString()} 条记录里的全部内容，在档案模式里可以逐条查到——包括这里没出现的每一次。
        </p>
      </section>

      <div className="relative">
        {/* 脊柱：手机端贴左，桌面端落在年份栏右缘 */}
        <div aria-hidden className="absolute bottom-0 left-[5px] top-0 w-px bg-line/60 lg:left-[150px]" />
        {years.map((year) => (
          <StoryYearBlock key={year.year} year={year} latestYear={latestYear} onOpenArchive={onOpenArchive} />
        ))}
      </div>

      <p className="mt-8 text-meta text-faint">
        故事模式只展示代表性条目；如需逐条检索、筛选与来源核验，请切换到档案模式。
      </p>
    </main>
  )
}

const KIND_PRESENTATION: Record<
  StoryYear['kind'],
  { sectionPad: string; yearSize: string; yearTone: string; countGap: string; rowPad: string }
> = {
  highlight: { sectionPad: 'py-8 sm:py-12', yearSize: 'text-[38px] sm:text-[52px]', yearTone: 'text-ink', countGap: 'mt-2.5', rowPad: 'py-2' },
  normal: { sectionPad: 'py-6 sm:py-8', yearSize: 'text-[26px] sm:text-[32px]', yearTone: 'text-ink/85', countGap: 'mt-1.5', rowPad: 'py-1.5' },
  sparse: { sectionPad: 'py-4 sm:py-5', yearSize: 'text-[21px] sm:text-[24px]', yearTone: 'text-faint', countGap: 'mt-1', rowPad: 'py-1' },
}

function StoryYearBlock({
  year,
  latestYear,
  onOpenArchive,
}: {
  year: StoryYear
  latestYear: number
  onOpenArchive: (year: number) => void
}) {
  const p = KIND_PRESENTATION[year.kind]
  const accent = year.accent

  return (
    <section
      className={`relative grid grid-cols-1 gap-3 border-b border-line/50 lg:grid-cols-[150px_1fr] lg:gap-12 ${p.sectionPad}`}
      aria-label={`${year.year} 年`}
    >
      <div className="relative pl-5 lg:pl-0">
        <span
          aria-hidden
          className="absolute left-[5px] top-1.5 h-3 w-3 -translate-x-1/2 rounded-full border-2 lg:left-auto lg:right-[-7px]"
          style={{ background: year.kind === 'sparse' ? 'transparent' : accent, borderColor: accent }}
        />
        <p className={`font-mono font-bold leading-none tracking-[-0.04em] tnum ${p.yearSize} ${p.yearTone}`}>
          {year.year}
        </p>
        <div className={`text-meta text-faint tnum ${p.countGap}`}>
          {year.isEmpty ? (
            <p>档案为空</p>
          ) : (
            <>
              <p>{year.count.toLocaleString()} 条记录</p>
              {year.kind !== 'sparse' && year.durationCount > 0 && (
                <p>已录 {Math.round(year.durationMinutes / 60).toLocaleString()} 小时</p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="pl-5 lg:pl-8">
        {year.kind === 'sparse' ? (
          <SparseNote year={year} accent={accent} />
        ) : year.kind === 'highlight' ? (
          <>
            {year.hero && <HeroEvent beat={year.hero} accent={accent} />}
            {year.secondary.length > 0 && <SecondaryList beats={year.secondary} accent={accent} className="mt-4" rowPad={p.rowPad} />}
            <OpenArchiveButton year={year} accent={accent} onOpenArchive={onOpenArchive} className="mt-5" />
          </>
        ) : (
          <>
            {year.hero && <HeroRow beat={year.hero} accent={accent} />}
            {year.secondary.length > 0 && <SecondaryList beats={year.secondary} accent={accent} className="mt-2.5" rowPad={p.rowPad} />}
            <OpenArchiveButton year={year} accent={accent} onOpenArchive={onOpenArchive} className="mt-3" />
          </>
        )}

        {year.year === latestYear && (
          <p className="mt-3 text-meta text-faint">这一年还在继续——档案更新到哪里，这里就长到哪里。</p>
        )}
      </div>
    </section>
  )
}

/** Type C：没有策展条目的年份——一句诚实的注脚，不硬凑 Hero。 */
function SparseNote({ year, accent }: { year: StoryYear; accent: string }) {
  if (year.isEmpty) {
    return (
      <div className="border-l-2 border-line/50 py-1.5 pl-4">
        <p className="max-w-md text-body text-muted">
          档案里没有 {year.year} 年的记录。缺口被如实保留——它也是这段历史的一部分。
        </p>
      </div>
    )
  }
  return (
    <div className="border-l-2 border-line/50 py-1.5 pl-4">
      <p className="text-meta text-faint tnum">
        这一年有 {year.count.toLocaleString()} 条记录，故事里没有单独停下来讲
        <Link
          href={`/chronicle/?y=${year.year}`}
          className="ml-2 inline-block underline underline-offset-4 transition-opacity hover:opacity-80"
          style={{ color: accent }}
        >
          去档案看 →
        </Link>
      </p>
    </div>
  )
}

/** Type A：完整 Hero。没有真实封面就不放图，也不留同尺寸占位。 */
function HeroEvent({ beat, accent }: { beat: ResolvedBeat; accent: string }) {
  const body = (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-meta uppercase tracking-[0.16em]" style={{ color: accent }}>
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        <span className="font-mono normal-case tracking-normal tnum">{beat.date}</span>
        {beat.kicker && <span>· {beat.kicker}</span>}
      </div>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <h3 className="text-h3 font-semibold text-ink transition-colors group-hover:text-white">{beat.title}</h3>
          {beat.body && <p className="mt-2 max-w-lg text-body text-muted">{beat.body}</p>}
          {beat.emphasis && (
            <p className="mt-2 inline-block rounded-sm border border-line/70 px-2 py-1 text-meta tracking-[0.14em]" style={{ color: accent }}>
              {beat.emphasis}
            </p>
          )}
        </div>
        {beat.cover && (
          <MediaFrame src={beat.cover} alt={beat.title} className="h-32 w-full shrink-0 sm:h-24 sm:w-44">
            <span className="absolute bottom-2 left-2 rounded-sm bg-base/70 px-1.5 py-0.5 font-mono text-meta text-ink/90 backdrop-blur-sm tnum">
              {beat.date}
            </span>
          </MediaFrame>
        )}
      </div>
    </>
  )

  if (!beat.href) return <div>{body}</div>
  return (
    <Link href={beat.href} target={beat.external ? '_blank' : undefined} rel={beat.external ? 'noreferrer' : undefined} className="group block">
      {body}
    </Link>
  )
}

/** Type B：紧凑 Hero 行——日期 + 眉标一行，标题另起一行，起点固定。 */
function HeroRow({ beat, accent }: { beat: ResolvedBeat; accent: string }) {
  const body = (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full sm:mt-0" style={{ background: accent }} />
      <span className="order-1 font-mono text-meta text-faint tnum sm:order-none">{beat.date}</span>
      {beat.kicker && (
        <span className="order-1 text-meta sm:order-none" style={{ color: accent }}>
          {beat.kicker}
        </span>
      )}
      <span className="order-3 w-full text-body font-medium text-ink transition-colors group-hover:text-white sm:order-none sm:w-auto sm:flex-1">
        {beat.title}
      </span>
      <span aria-hidden className="order-2 ml-auto shrink-0 font-mono text-meta transition-transform group-hover:translate-x-1 sm:order-none" style={{ color: accent }}>
        →
      </span>
    </div>
  )

  if (!beat.href) return <div className="px-1 py-1.5">{body}</div>
  return (
    <Link
      href={beat.href}
      target={beat.external ? '_blank' : undefined}
      rel={beat.external ? 'noreferrer' : undefined}
      className="group block rounded px-1 py-1.5 transition-colors hover:bg-surface/50"
    >
      {body}
    </Link>
  )
}

/** Secondary 行：手机端日期与标题分两行（标题起点固定），桌面端单行截断。 */
function SecondaryList({
  beats,
  accent,
  className = '',
  rowPad,
}: {
  beats: ResolvedBeat[]
  accent: string
  className?: string
  rowPad: string
}) {
  return (
    <ul className={`space-y-0.5 border-l border-line/50 pl-4 ${className}`}>
      {beats.map((beat) => {
        const inner = (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="order-1 shrink-0 font-mono text-meta text-faint tnum sm:order-none sm:w-[72px]">{beat.date}</span>
            {beat.kicker && (
              <span className="order-1 shrink-0 text-meta sm:order-none" style={{ color: accent }}>
                {beat.kicker}
              </span>
            )}
            <span className="order-3 w-full min-w-0 text-body text-muted group-hover:text-ink sm:order-none sm:w-auto sm:flex-1 sm:truncate">
              {beat.title}
            </span>
            <span
              aria-hidden
              className="order-2 ml-auto shrink-0 font-mono text-meta transition-transform group-hover:translate-x-1 sm:order-none sm:ml-0"
              style={{ color: accent }}
            >
              →
            </span>
          </div>
        )
        return (
          <li key={beat.id}>
            {beat.href ? (
              <Link
                href={beat.href}
                target={beat.external ? '_blank' : undefined}
                rel={beat.external ? 'noreferrer' : undefined}
                className={`group block rounded px-1 transition-colors hover:bg-surface/50 ${rowPad}`}
              >
                {inner}
              </Link>
            ) : (
              <div className={`px-1 ${rowPad}`}>{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function OpenArchiveButton({
  year,
  accent,
  onOpenArchive,
  className = '',
}: {
  year: StoryYear
  accent: string
  onOpenArchive: (year: number) => void
  className?: string
}) {
  if (year.isEmpty) return null
  return (
    <button
      onClick={() => onOpenArchive(year.year)}
      className={`ui-press group inline-flex items-center gap-2 rounded-sm text-meta text-muted tnum transition-colors hover:text-ink ${className}`}
    >
      ＋ 这一年还有 {year.count.toLocaleString()} 条记录 · 去档案模式
      <span aria-hidden className="font-mono transition-transform group-hover:translate-x-1" style={{ color: accent }}>
        →
      </span>
    </button>
  )
}
