'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import type { ResolvedBeat } from '@/lib/narrative'
import type { StorySection } from '@/lib/story-years'
import { applyLiveStoryYears } from '@/lib/live-content'
import { formatDuration } from '@/lib/ui'
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

/**
 * Chronicle 只展示最早的年月：精确到日和结束月份仍留在 Archive。
 * 例如 `2014.11 — 12` 只显示 `2014.11`，不让日期列混用多种精度。
 */
export function chronicleDate(value: string): string {
  let date = value.trim().replace(/^[~～]\s*/, '')

  date = date.replace(/^(\d{4})\.(\d{2})\.\d{2}$/, '$1.$2')
  date = date.replace(/^(\d{4})\.(\d{2})\s*[—–-].*$/, '$1.$2')

  return date
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
      id={`story-year-${section.year}`}
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
                <div id={`story-beat-${beat.id}`} key={beat.id} className={`scroll-mt-24 ${index > 0 ? 'border-t border-line/50 pt-7' : ''}`}>
                  <HeroEvent beat={beat} accent={accent} hideDate={chronicleDate(beat.date) === section.label} />
                </div>
              ))}
            </div>
            {section.secondary.length > 0 && <SecondaryList beats={section.secondary} accent={accent} className="mt-4" rowPad={p.rowPad} />}
            <OpenArchiveButton section={section} accent={accent} onOpenArchive={onOpenArchive} className="mt-5" />
          </>
        ) : (
          <>
            {section.hero && (
              <div id={`story-beat-${section.hero.id}`} className="scroll-mt-24">
                <HeroRow beat={section.hero} accent={accent} hideDate={chronicleDate(section.hero.date) === section.label} />
              </div>
            )}
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
  // null 表示用户尚未手动切换：实时后台值到达时仍可接管默认状态。
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const isOpen = manualOpen ?? beat.expanded !== false
  const displayDate = chronicleDate(beat.date)

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setManualOpen(true)}
        aria-expanded={false}
        className="group flex w-full items-start justify-between gap-4 rounded-card border border-line/70 bg-surface/25 px-4 py-3 text-left transition-colors hover:border-live/40 hover:bg-surface/50"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-meta uppercase tracking-[0.16em]" style={{ color: accent }}>
            {!hideDate && <span className="font-mono normal-case tracking-normal tnum">{displayDate}</span>}
            {beat.kicker && <span>· {beat.kicker}</span>}
          </span>
          <span className="mt-1 block text-body font-semibold text-ink">{beat.title}</span>
        </span>
        <span className="shrink-0 font-mono text-meta text-faint group-hover:text-live">展开 ↓</span>
      </button>
    )
  }

  const body = (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-meta uppercase tracking-[0.16em]" style={{ color: accent }}>
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        {!hideDate && <span className="font-mono normal-case tracking-normal tnum">{displayDate}</span>}
        {beat.kicker && <span>· {beat.kicker}</span>}
      </div>
      {beat.cover && (
        <div className="mt-4 chronicle-media-measure">
          <MediaFrame src={beat.cover} alt={beat.title} className="aspect-video w-full">
            <span className="absolute bottom-2 left-2 rounded-sm bg-base/70 px-1.5 py-0.5 font-mono text-meta text-ink/90 backdrop-blur-sm tnum">
              {displayDate}
            </span>
            {beat.durationMinutes && (
              <span className="absolute bottom-2 right-2 rounded-sm bg-base/70 px-1.5 py-0.5 font-mono text-meta text-ink/90 backdrop-blur-sm tnum">
                {formatDuration(beat.durationMinutes)}
              </span>
            )}
          </MediaFrame>
        </div>
      )}
      <div className="mt-4 min-w-0">
        <h3 className="text-h3 font-semibold text-ink transition-colors group-hover:text-white">{beat.title}</h3>
        {beat.body && <p className="mt-2 text-body text-muted">{beat.body}</p>}
        {beat.activity && <ActivityTimeline activity={beat.activity} accent={accent} />}
        {beat.emphasis && (
          <p className="mt-2 inline-block rounded-sm border border-line/70 px-2 py-1 text-meta tracking-[0.14em]" style={{ color: accent }}>
            {beat.emphasis}
          </p>
        )}
      </div>
    </>
  )

  const content = !beat.href ? <div>{body}</div> : (
    <Link href={beat.href} target={beat.external ? '_blank' : undefined} rel={beat.external ? 'noreferrer' : undefined} className="group block">
      {body}
    </Link>
  )

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setManualOpen(false)}
          aria-expanded
          className="font-mono text-meta text-faint transition-colors hover:text-live"
        >
          收起 ↑
        </button>
      </div>
      {content}
    </div>
  )
}

function ActivityTimeline({ activity, accent }: { activity: NonNullable<ResolvedBeat['activity']>; accent: string }) {
  const max = Math.max(...activity.points.map((point) => point.count), 1)

  return (
    <div className="mt-5 chronicle-media-measure rounded-xl border border-line/70 bg-surface/30 px-4 pb-3 pt-3.5 sm:px-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-meta font-medium text-ink/90">{activity.label}</p>
        <p className="text-[11px] text-faint">按当前档案收录期数</p>
      </div>
      <div className="mt-3 overflow-x-auto pb-1">
        <div
          className="relative grid min-w-[520px] items-end gap-2 pt-5"
          style={{ gridTemplateColumns: `repeat(${activity.points.length}, minmax(42px, 1fr))` }}
          role="img"
          aria-label={`${activity.label}：${activity.points.map((point) => `${point.year} 年 ${point.count} ${activity.unit}`).join('，')}`}
        >
          <span aria-hidden className="absolute inset-x-0 bottom-[25px] h-px bg-line" />
          {activity.points.map((point) => (
            <div key={point.year} className="relative z-10 flex flex-col items-center">
              <span className="font-mono text-[10px] text-faint tnum">{point.count}</span>
              <span
                aria-hidden
                className="mt-1 w-2 rounded-full opacity-85"
                style={{ height: `${12 + Math.round((point.count / max) * 42)}px`, background: accent }}
              />
              <span aria-hidden className="mt-1.5 h-2 w-2 rounded-full border-2 border-base" style={{ background: accent }} />
              <span className="mt-1 font-mono text-[10px] text-faint tnum">{point.year}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MemoryTag({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <span
      className="mt-1.5 inline-flex rounded-full border border-line/70 bg-surface/50 px-2.5 py-0.5 text-[11px] leading-5 tracking-[0.08em]"
      style={{ color: accent }}
    >
      {children}
    </span>
  )
}

/**
 * 没有来源链接的节点不是「档案卡」，而是一句补足时间线的阶段说明。
 * 只保留年月和说明正文，不显示标题、tag 或箭头，避免制造可以点击的暗示。
 */
function StageNote({ beat, className = '' }: { beat: ResolvedBeat; className?: string }) {
  const text = beat.body?.trim() || beat.title

  return (
    <div className={`grid chronicle-row-measure grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[108px_minmax(0,1fr)] ${className}`}>
      <span className="whitespace-nowrap font-mono text-meta text-faint tnum">{chronicleDate(beat.date)}</span>
      <p className="text-body leading-relaxed text-muted">{text}</p>
    </div>
  )
}

/**
 * Type B：紧凑主行。
 * 与 secondary 共用同一条左边线和列宽；无链接节点交给 StageNote 显示。
 */
function HeroRow({ beat, accent, hideDate = false }: { beat: ResolvedBeat; accent: string; hideDate?: boolean }) {
  if (!beat.href) {
    return <StageNote beat={beat} className="border-l border-line/50 py-2 pl-5" />
  }

  const displayDate = chronicleDate(beat.date)
  const body = (
    <div className="grid chronicle-row-measure grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 sm:grid-cols-[108px_minmax(0,1fr)_auto]">
      {!hideDate && <span className="col-start-1 row-start-1 whitespace-nowrap font-mono text-meta text-faint tnum">{displayDate}</span>}
      <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <span className="block text-body font-medium text-ink transition-colors group-hover:text-white">{beat.title}</span>
        {beat.kicker && <MemoryTag accent={accent}>{beat.kicker}</MemoryTag>}
      </div>
      <span aria-hidden className="col-start-2 row-start-1 shrink-0 font-mono text-meta transition-transform group-hover:translate-x-1 sm:col-start-3" style={{ color: accent }}>
        →
      </span>
    </div>
  )

  return (
    <Link
      href={beat.href}
      target={beat.external ? '_blank' : undefined}
      rel={beat.external ? 'noreferrer' : undefined}
      className="group block rounded border-l border-line/50 py-1.5 pl-5 transition-colors hover:bg-surface/50"
    >
      {body}
    </Link>
  )
}

/** Secondary 行：日期不折行；tag 收到标题下方，避免被推到宽屏最右侧。 */
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
        if (!beat.href) {
          return (
            <li id={`story-beat-${beat.id}`} key={beat.id} className="scroll-mt-24">
              <StageNote beat={beat} className={`px-1 ${rowPad}`} />
            </li>
          )
        }

        const displayDate = chronicleDate(beat.date)
        const inner = (
          <div className="grid chronicle-row-measure grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 sm:grid-cols-[108px_minmax(0,1fr)_auto]">
            <span className="col-start-1 row-start-1 whitespace-nowrap font-mono text-meta text-faint tnum">{displayDate}</span>
            <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
              <span className="block text-body text-muted group-hover:text-ink sm:truncate">{beat.title}</span>
              {beat.kicker && <MemoryTag accent={accent}>{beat.kicker}</MemoryTag>}
            </div>
            <span
              aria-hidden
              className="col-start-2 row-start-1 shrink-0 font-mono text-meta transition-transform group-hover:translate-x-1 sm:col-start-3"
              style={{ color: accent }}
            >
              →
            </span>
          </div>
        )
        return (
          <li id={`story-beat-${beat.id}`} key={beat.id} className="scroll-mt-24">
            <Link
              href={beat.href}
              target={beat.external ? '_blank' : undefined}
              rel={beat.external ? 'noreferrer' : undefined}
              className={`group block rounded px-1 transition-colors hover:bg-surface/50 ${rowPad}`}
            >
              {inner}
            </Link>
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
