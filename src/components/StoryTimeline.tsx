'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ResolvedBeat } from '@/lib/narrative'
import type { StorySection } from '@/lib/story-years'
import { applyLiveStoryYears } from '@/lib/live-content'
import { Eyebrow, MediaFrame } from './primitives'
import { useLiveContent } from './LiveContentProvider'

/**
 * 故事模式：纵向编辑时间线（年份脊柱）。
 *
 * 这里回答的是「我们知道她走过什么」，档案模式回答「我们保存了什么」。
 * 所以一段时间里可以只有故事、没有录像（2011 年就是这样），页面照常讲故事，
 * 不再把「站内没有录像」写成「这一年是空白」。
 *
 * 分三种视觉层级制造滚动节奏：
 *   highlight：一张或多张完整 featured memory（封面 / 一句话 / Secondary）。
 *   normal：紧凑 Hero 行。
 *   sparse：这一段没有可讲的节点，只留一句实话。
 *
 * 条目来自 STORY_ACTS 的策展列表（归位逻辑见 lib/story-years.ts），不是这里重新挑的。
 * 日期与标题分成固定两行，标题永远从同一条左边线起，不因为前面有没有小标签而左右浮动。
 */
export function StoryTimeline({
  sections: baselineSections,
  latestYear,
  onOpenArchive,
  eyebrow,
}: {
  sections: StorySection[]
  latestYear: number
  onOpenArchive: (year: number) => void
  /** 面包屑（含故事/档案切换）。缺省时退回静态眉标。 */
  eyebrow?: ReactNode
}) {
  const { narrative } = useLiveContent()
  const sections = applyLiveStoryYears(baselineSections, narrative?.storyActs, narrative?.deletedIds ?? [])
  return (
    <main className="ui-page-in site-container px-page pb-20">
      <section className="ui-reveal pb-8 pt-4 sm:py-12">
        {eyebrow ?? <Eyebrow color="#5BC8E8">Chronicle · 编年史</Eyebrow>}
        <h1 className="measure-hero mt-4 text-h1 font-semibold">时间不是一条列表，是一路走过来的。</h1>
        <p className="measure-body mt-5 text-body text-muted">
          这里把视频、直播和能确认的重要节点串在一起。想找具体某一天，再去录播室里翻。
        </p>
      </section>

      <div className="relative">
        {/* 脊柱：手机端贴左，桌面端落在年份栏右缘 */}
        <div aria-hidden className="absolute bottom-0 left-[5px] top-0 w-px bg-line/60 lg:left-[150px]" />
        {sections.map((section) => (
          <StorySectionBlock key={section.year} section={section} latestYear={latestYear} onOpenArchive={onOpenArchive} />
        ))}
      </div>

      <p className="mt-8 text-meta text-faint">
        想找具体日期、游戏或来源，可以去{' '}
        <Link href="/archive/" className="text-live underline underline-offset-4 hover:text-ink">
          录播室
        </Link>
        。
      </p>
    </main>
  )
}

const KIND_PRESENTATION: Record<
  StorySection['kind'],
  { sectionPad: string; yearSize: string; yearTone: string; countGap: string; rowPad: string }
> = {
  highlight: { sectionPad: 'py-8 sm:py-12', yearSize: 'text-[38px] sm:text-[52px]', yearTone: 'text-ink', countGap: 'mt-2.5', rowPad: 'py-2' },
  normal: { sectionPad: 'py-6 sm:py-8', yearSize: 'text-[26px] sm:text-[32px]', yearTone: 'text-ink/85', countGap: 'mt-1.5', rowPad: 'py-1.5' },
  sparse: { sectionPad: 'py-4 sm:py-5', yearSize: 'text-[21px] sm:text-[24px]', yearTone: 'text-faint', countGap: 'mt-1', rowPad: 'py-1' },
}

function StorySectionBlock({
  section,
  latestYear,
  onOpenArchive,
}: {
  section: StorySection
  latestYear: number
  onOpenArchive: (year: number) => void
}) {
  const p = KIND_PRESENTATION[section.kind]
  const accent = section.accent

  return (
    <section
      className={`relative grid grid-cols-1 gap-3 border-b border-line/50 lg:grid-cols-[150px_1fr] lg:gap-12 ${p.sectionPad}`}
      aria-label={`${section.label} 年`}
    >
      <div className="relative pl-5 lg:pl-0">
        <span
          aria-hidden
          className="absolute left-[5px] top-1.5 h-3 w-3 -translate-x-1/2 rounded-full border-2 lg:left-auto lg:right-[-7px]"
          style={{ background: section.kind === 'sparse' ? 'transparent' : accent, borderColor: accent }}
        />
        <p className={`font-mono font-bold leading-none tracking-[-0.04em] tnum ${section.year === section.endYear ? p.yearSize : 'text-[19px] sm:text-[22px]'} ${p.yearTone}`}>
          {section.label}
        </p>
        <div className={`text-meta text-faint tnum ${p.countGap}`}>
          {section.archiveCount > 0 ? (
            <>
              <p>{section.archiveCount.toLocaleString()} 条记录</p>
              {section.kind !== 'sparse' && section.durationCount > 0 && (
                <p>已录 {Math.round(section.durationMinutes / 60).toLocaleString()} 小时</p>
              )}
            </>
          ) : (
            /* 站内没有录像。有故事时这只是一句补充，不是「这段时间不知道发生了什么」。 */
            section.hasStory && <p className="text-faint/70">暂无站内录像</p>
          )}
        </div>
      </div>

      <div className="pl-5 lg:pl-8">
        {section.kind === 'sparse' ? (
          <SparseNote section={section} accent={accent} />
        ) : section.kind === 'highlight' ? (
          <>
            <div className="space-y-7">
              {section.featured.map((beat, index) => (
                <div key={beat.id} className={index > 0 ? 'border-t border-line/50 pt-7' : ''}>
                  <HeroEvent beat={beat} accent={accent} hideDate={beat.date === section.label} />
                </div>
              ))}
            </div>
            {section.secondary.length > 0 && <SecondaryList beats={section.secondary} accent={accent} className="mt-4" rowPad={p.rowPad} />}
            <OpenArchiveButton section={section} accent={accent} onOpenArchive={onOpenArchive} className="mt-5" />
          </>
        ) : (
          <>
            {section.hero && <HeroRow beat={section.hero} accent={accent} hideDate={section.hero.date === section.label} />}
            {section.secondary.length > 0 && <SecondaryList beats={section.secondary} accent={accent} className="mt-2.5" rowPad={p.rowPad} />}
            <OpenArchiveButton section={section} accent={accent} onOpenArchive={onOpenArchive} className="mt-3" />
          </>
        )}

        {section.endYear === latestYear && (
          <p className="mt-3 text-meta text-faint">这一年还在继续。</p>
        )}
      </div>
    </section>
  )
}

/** 这一段没有可讲的节点：有录像就给档案入口，什么都没有就说实话。 */
function SparseNote({ section, accent }: { section: StorySection; accent: string }) {
  if (section.archiveCount === 0) {
    return (
      <div className="border-l-2 border-line/50 py-1.5 pl-4">
        <p className="measure-body text-body text-muted">
          这一年暂时还没找到能确认的记录。
        </p>
      </div>
    )
  }
  return (
    <div className="border-l-2 border-line/50 py-1.5 pl-4">
      <p className="text-meta text-faint tnum">
        这一年留下了 {section.archiveCount.toLocaleString()} 条记录。
        <Link
          href={`/archive/?y=${section.year}`}
          className="ml-2 inline-block underline underline-offset-4 transition-opacity hover:opacity-80"
          style={{ color: accent }}
        >
          去录播室看看 →
        </Link>
      </p>
    </div>
  )
}

/** Type A：完整 Hero。没有真实封面就不放图，也不留同尺寸占位。 */
function HeroEvent({ beat, accent, hideDate = false }: { beat: ResolvedBeat; accent: string; hideDate?: boolean }) {
  const body = (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-meta uppercase tracking-[0.16em]" style={{ color: accent }}>
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        {!hideDate && <span className="font-mono normal-case tracking-normal tnum">{beat.date}</span>}
        {beat.kicker && <span>· {beat.kicker}</span>}
      </div>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <h3 className="text-h3 font-semibold text-ink transition-colors group-hover:text-white">{beat.title}</h3>
          {beat.body && <p className="measure-body mt-2 text-body text-muted">{beat.body}</p>}
          {beat.emphasis && (
            <p className="mt-2 inline-block rounded-sm border border-line/70 px-2 py-1 text-meta tracking-[0.14em]" style={{ color: accent }}>
              {beat.emphasis}
            </p>
          )}
        </div>
        {beat.cover && (
          <MediaFrame src={beat.cover} alt={beat.title} className="h-40 w-full shrink-0 sm:h-32 sm:w-56 lg:w-64">
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
function HeroRow({ beat, accent, hideDate = false }: { beat: ResolvedBeat; accent: string; hideDate?: boolean }) {
  const body = (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full sm:mt-0" style={{ background: accent }} />
      {!hideDate && <span className="order-1 font-mono text-meta text-faint tnum sm:order-none">{beat.date}</span>}
      <span className="order-3 w-full text-body font-medium text-ink transition-colors group-hover:text-white sm:order-none sm:w-auto sm:flex-1">
        {beat.title}
      </span>
      {/* 眉标跟在标题后面：标题长短不一，标签放前面会让每一行的标题起点参差。
          手机端窄，标题本来就独占一行，眉标回到日期那一行，不额外多占一行高度。 */}
      {beat.kicker && (
        <span className="order-1 shrink-0 text-meta sm:order-none" style={{ color: accent }}>
          {beat.kicker}
        </span>
      )}
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
            <span className="order-3 w-full min-w-0 text-body text-muted group-hover:text-ink sm:order-none sm:w-auto sm:flex-1 sm:truncate">
              {beat.title}
            </span>
            {beat.kicker && (
              <span className="order-1 shrink-0 text-meta sm:order-none" style={{ color: accent }}>
                {beat.kicker}
              </span>
            )}
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
  section,
  accent,
  onOpenArchive,
  className = '',
}: {
  section: StorySection
  accent: string
  onOpenArchive: (year: number) => void
  className?: string
}) {
  if (section.archiveCount === 0) return null
  return (
    <button
      onClick={() => onOpenArchive(section.year)}
      className={`ui-press group inline-flex items-center gap-2 rounded-sm text-meta text-muted tnum transition-colors hover:text-ink ${className}`}
    >
      看这一年的全部 {section.archiveCount.toLocaleString()} 条记录
      <span aria-hidden className="font-mono transition-transform group-hover:translate-x-1" style={{ color: accent }}>
        →
      </span>
    </button>
  )
}
