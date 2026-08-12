'use client'

import Link from 'next/link'
import type { ChronicleStory, StoryEvent, StoryYear, StoryYearKind } from '@/lib/chronicle-story'
import { actColorForDate } from '@/lib/narrative'
import { MediaFrame } from './primitives'

/**
 * 故事模式：纵向编辑时间线。
 * 每年只展示 Hero + 少量 Secondary；全部记录在档案模式。
 * 年份分三种视觉层级（kind）制造滚动节奏：
 *   A highlight：大年份 + 完整 Hero（封面 / 一句话 / Secondary）。
 *   B normal：紧凑 Hero 行，不占大版面。
 *   C sparse：资料很少或为空的年份，只有一句诚实的注脚。
 * 2011 年档案为空——如实展示为缺口，不假装。
 */
export function StoryTimeline({
  story,
  latestYear,
  onOpenArchive,
}: {
  story: ChronicleStory
  latestYear: number
  onOpenArchive: (year: number) => void
}) {
  return (
    <main className="ui-page-in mx-auto max-w-[1240px] px-4 pb-20 sm:px-6">
      <section className="ui-reveal py-8 sm:py-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-live">Chronicle · 编年史 · 故事模式</p>
        <h1 className="mt-4 max-w-2xl text-[30px] font-semibold leading-tight tracking-tight sm:text-[44px]">
          时间不是一条列表，是一路走过来的。
        </h1>
        <p className="mt-5 max-w-2xl text-[13px] leading-7 text-muted">
          故事模式只放那些值得停下看的晚上。共 {story.total.toLocaleString()} 条记录里的全部内容，在档案模式里可以逐条查到——包括这里没出现的每一次。
        </p>
      </section>

      <div className="relative">
        <div aria-hidden className="absolute bottom-0 left-5 top-0 w-px bg-line/60 lg:left-[150px]" />
        {story.years.map((year) => (
          <StoryYearBlock key={year.year} year={year} latestYear={latestYear} onOpenArchive={onOpenArchive} />
        ))}
      </div>

      <p className="mt-8 font-mono text-[10px] leading-5 text-faint/70">
        故事模式只展示代表性条目；如需逐条检索、筛选与来源核验，请切换到档案模式。
      </p>
    </main>
  )
}

const KIND_PRESENTATION: Record<
  StoryYearKind,
  {
    sectionPad: string
    yearSize: string
    yearMuted: string
    countSize: string
    rowPad: string
  }
> = {
  highlight: { sectionPad: 'py-12 sm:py-16', yearSize: 'text-[46px] sm:text-[58px]', yearMuted: 'text-ink', countSize: 'mt-3', rowPad: 'py-2.5' },
  normal: { sectionPad: 'py-7 sm:py-9', yearSize: 'text-[28px] sm:text-[34px]', yearMuted: 'text-ink/85', countSize: 'mt-1.5', rowPad: 'py-1.5' },
  sparse: { sectionPad: 'py-5 sm:py-6', yearSize: 'text-[22px] sm:text-[26px]', yearMuted: 'text-faint/70', countSize: 'mt-0.5', rowPad: 'py-1' },
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
  const accent = year.count ? actColorForDate(`${year.year}-06-01`) : '#5A5F73'
  const p = KIND_PRESENTATION[year.kind]

  return (
    <section
      className={`relative grid grid-cols-1 gap-4 border-b border-line/50 lg:grid-cols-[150px_1fr] lg:gap-12 ${p.sectionPad}`}
      aria-label={`${year.year} 年`}
    >
      <div className="relative pl-5 lg:pl-0">
        <span
          aria-hidden
          className="absolute left-[5px] top-1.5 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-base lg:left-auto lg:right-[-7px]"
          style={{ background: year.kind === 'sparse' ? 'transparent' : accent, borderColor: year.kind === 'sparse' ? accent : accent }}
        />
        <p className={`font-display font-bold leading-none tracking-[-0.05em] ${p.yearSize} ${p.yearMuted}`}>
          {year.year}
        </p>
        <div className={`font-mono text-[10px] leading-5 text-faint tnum ${p.countSize}`}>
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
            {year.hero && <HeroEvent event={year.hero} accent={accent} />}
            {year.secondary.length > 0 && (
              <SecondaryList events={year.secondary} accent={accent} className="mt-5" rowPad="py-2" />
            )}
            <OpenArchiveButton year={year} accent={accent} onOpenArchive={onOpenArchive} className="mt-6" />
          </>
        ) : (
          <>
            {year.hero && <HeroRow event={year.hero} accent={accent} />}
            {year.secondary.length > 0 && (
              <SecondaryList events={year.secondary} accent={accent} className="mt-3" rowPad="py-1.5" />
            )}
            <OpenArchiveButton year={year} accent={accent} onOpenArchive={onOpenArchive} className="mt-4" />
          </>
        )}

        {year.year === latestYear && (
          <p className="mt-3 font-mono text-[10px] text-faint/70">
            这一年还在继续——档案更新到哪里，这里就长到哪里。
          </p>
        )}
      </div>
    </section>
  )
}

/** Type C：资料很少 / 为空的年份——一句诚实的注脚，不硬凑 Hero。 */
function SparseNote({ year, accent }: { year: StoryYear; accent: string }) {
  if (year.isEmpty) {
    return (
      <div className="border-l-2 border-line/50 py-2 pl-4">
        <p className="max-w-md text-[13px] leading-7 text-muted">
          档案里没有 {year.year} 年的记录。缺口被如实保留——它也是这段历史的一部分。
        </p>
      </div>
    )
  }
  // 有策展注脚的稀少年份（如 2012：停更前的最后一眼）
  return (
    <div className="border-l-2 border-line/50 py-2 pl-4">
      {year.hero?.line && <p className="max-w-md text-[13px] leading-7 text-muted">{year.hero.line}</p>}
      <p className="mt-1 font-mono text-[10px] text-faint tnum">
        这一年只留下 {year.count.toLocaleString()} 条记录
        <Link
          href={year.hero?.href ?? `/chronicle/?y=${year.year}`}
          className="ml-2 inline-block text-faint underline underline-offset-4 transition-colors hover:text-live"
          style={{ color: accent }}
        >
          查看 →
        </Link>
      </p>
    </div>
  )
}

/** Type A：完整 Hero（封面 optional——没有真实图就不放图，不留同尺寸占位）。 */
function HeroEvent({ event, accent }: { event: StoryEvent; accent: string }) {
  return (
    <Link href={event.href} className="group block">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: accent }}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        {event.date} · {event.kicker}
      </div>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h3 className="text-[20px] font-semibold leading-snug tracking-tight text-ink transition-colors group-hover:text-white sm:text-[26px]">
            {event.title}
          </h3>
          {event.line && <p className="mt-2 max-w-lg text-[13px] leading-7 text-muted">{event.line}</p>}
          {event.durationLabel && <p className="mt-2 font-mono text-[10px] text-faint tnum">时长 {event.durationLabel}</p>}
        </div>
        {event.cover && (
          <MediaFrame src={event.cover} alt={event.title} className="h-28 w-full shrink-0 sm:h-24 sm:w-44">
            <span className="absolute bottom-2 left-2 rounded-sm bg-base/70 px-1.5 py-0.5 font-mono text-[9px] text-ink/90 backdrop-blur-sm tnum">
              {event.date}
            </span>
          </MediaFrame>
        )}
      </div>
    </Link>
  )
}

/** Type B：紧凑 Hero 行——日期 + 眉标 + 标题，不占大版面。 */
function HeroRow({ event, accent }: { event: StoryEvent; accent: string }) {
  return (
    <Link
      href={event.href}
      className="group flex items-start gap-3 rounded px-1 py-1.5 transition-colors hover:bg-surface/50 sm:items-baseline"
    >
      <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full sm:mt-0" style={{ background: accent }} />
      <span className="font-mono text-[10px] text-faint tnum">{event.date}</span>
      <span className="min-w-0 flex-1 text-[14px] font-medium leading-6 text-ink transition-colors group-hover:text-white">
        <span className="font-mono text-[9px] font-normal text-faint/70">{event.kicker} · </span>
        {event.title}
      </span>
      <span
        className="shrink-0 font-mono text-[11px] text-faint/50 transition-transform group-hover:translate-x-1"
        style={{ color: accent }}
      >
        →
      </span>
    </Link>
  )
}

/** Secondary 行：长标题移动端换行（不再 truncate 撑破容器），桌面保持截断。 */
function SecondaryList({
  events,
  accent,
  className = '',
  rowPad,
}: {
  events: StoryEvent[]
  accent: string
  className?: string
  rowPad: string
}) {
  return (
    <ul className={`space-y-0.5 border-l border-line/50 pl-4 ${className}`}>
      {events.map((ev) => (
        <li key={ev.entryId}>
          <Link
            href={ev.href}
            className={`group flex items-start gap-3 rounded px-1 transition-colors hover:bg-surface/50 sm:items-baseline ${rowPad}`}
          >
            <span className="w-[72px] shrink-0 font-mono text-[10px] text-faint tnum">{ev.date}</span>
            <span className="min-w-0 flex-1 text-[13px] leading-6 text-muted group-hover:text-ink sm:truncate sm:leading-normal">
              <span className="font-mono text-[9px] text-faint/70">{ev.kicker} · </span>
              {ev.title}
            </span>
            <span
              className="shrink-0 font-mono text-[11px] text-faint/50 transition-transform group-hover:translate-x-1"
              style={{ color: accent }}
            >
              →
            </span>
          </Link>
        </li>
      ))}
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
  return (
    <button
      onClick={() => onOpenArchive(year.year)}
      className={`ui-press group inline-flex items-center gap-2 rounded-sm font-mono text-[11px] text-muted transition-colors hover:text-ink ${className}`}
    >
      ＋ 这一年还有 {year.count.toLocaleString()} 条记录 · 去档案模式
      <span className="font-mono text-[12px] text-faint/60 transition-transform group-hover:translate-x-1" style={{ color: accent }}>
        →
      </span>
    </button>
  )
}
