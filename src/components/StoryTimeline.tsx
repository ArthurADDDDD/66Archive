'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ResolvedBeat } from '@/lib/narrative'
import type { StorySection } from '@/lib/story-years'
import { applyLiveStoryYears } from '@/lib/live-content'
import { inEra, type ChronicleEraId } from '@/lib/chronicle-eras'
import { formatDuration } from '@/lib/ui'
import { contentOpenProps } from '@/lib/analytics-target'
import { MediaFrame } from './MediaFrame'
import { Eyebrow } from './primitives'
import { useLiveContent } from './LiveContentProvider'
import { SiteText } from './SiteText'
import { ChronicleEraNext, ChronicleEraTabs } from './ChronicleEraTabs'

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
  era,
  onEraChange,
}: {
  sections: StorySection[]
  latestYear: number
  onOpenArchive: (year: number) => void
  /** 面包屑（含故事/档案切换）。缺省时退回静态眉标。 */
  eyebrow?: ReactNode
  /** 当前显示的时代（视频 / 斗鱼156277 / 抖音），见 lib/chronicle-eras.ts */
  era: ChronicleEraId
  onEraChange: (era: ChronicleEraId) => void
}) {
  const { narrative } = useLiveContent()
  const sections = applyLiveStoryYears(baselineSections, narrative?.storyActs, narrative?.deletedIds ?? [])
  const visible = inEra(sections, era)
  return (
    <main className="ui-page-in site-container px-page pb-20">
      <section className="ui-reveal pb-8 pt-4 sm:py-12">
        {eyebrow ?? <Eyebrow color="#5BC8E8"><SiteText id="chronicle-eyebrow" /></Eyebrow>}
        <h1 className="measure-hero mt-4 text-h1 font-semibold"><SiteText id="chronicle-title" /></h1>
        <p className="measure-body mt-5 text-body text-muted">
          <SiteText id="chronicle-lede" />
        </p>
      </section>

      <div id="chronicle-era-tabs" className="scroll-mt-24">
        <ChronicleEraTabs sections={sections} era={era} onChange={onEraChange} />
      </div>

      <div id="chronicle-era-panel" role="tabpanel" aria-labelledby={`chronicle-era-tab-${era}`} className="relative mt-2">
        {/* 脊柱：手机端贴左，桌面端落在年份栏右缘 */}
        <div aria-hidden className="absolute bottom-0 left-[5px] top-0 w-px bg-line/60 lg:left-[150px]" />
        {visible.map((section) => (
          <StorySectionBlock key={section.year} section={section} latestYear={latestYear} onOpenArchive={onOpenArchive} />
        ))}
      </div>

      <ChronicleEraNext sections={sections} era={era} onChange={onEraChange} />

      <p className="mt-8 text-meta text-faint">
        <SiteText
          id="chronicle-footer-hint"
          vars={{
            link: (
              <Link href="/archive/" prefetch={false} className="text-live underline underline-offset-4 hover:text-ink">
                <SiteText id="chronicle-footer-link" />
              </Link>
            ),
          }}
        />
      </p>
    </main>
  )
}

const KIND_PRESENTATION: Record<
  StorySection['kind'],
  { sectionPad: string; yearSize: string; yearTone: string; countGap: string; rowPad: string }
> = {
  highlight: { sectionPad: 'py-8 sm:py-12', yearSize: 'text-[38px] sm:text-[52px]', yearTone: 'text-ink', countGap: 'mt-2.5', rowPad: 'py-2.5' },
  normal: { sectionPad: 'py-6 sm:py-8', yearSize: 'text-[26px] sm:text-[32px]', yearTone: 'text-ink/85', countGap: 'mt-1.5', rowPad: 'py-2' },
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
              {/*
                这里原本还有一行「已录 N 小时」。年份脊柱有十七个年份，那一行就
                重复十七遍，而它说的是档案完成度（已经核对到多少时长），不是那一年
                发生了什么——读者拿它做不了任何事。条数留着：它确实能看出哪几年
                记录多、哪几年稀疏，是往下翻的线索。
              */}
              <p>{section.archiveCount.toLocaleString()} 条记录</p>
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
          <p className="mt-3 text-meta text-faint"><SiteText id="chronicle-still-going" /></p>
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
          <SiteText id="chronicle-year-empty" />
        </p>
      </div>
    )
  }
  return (
    <div className="border-l-2 border-line/50 py-1.5 pl-4">
      <p className="text-meta text-faint tnum">
        <SiteText id="chronicle-year-count" vars={{ count: section.archiveCount.toLocaleString() }} />
        <Link
          href={`/archive/?y=${section.year}`}
          prefetch={false}
          className="ml-2 inline-block underline underline-offset-4 transition-opacity hover:opacity-80"
          style={{ color: accent }}
        >
          <SiteText id="chronicle-year-archive" />
        </Link>
      </p>
    </div>
  )
}

/** Type A：完整 Hero。没有真实封面就不放图，也不留同尺寸占位。 */
/**
 * 编年史正文里的封面：左边小图、右边文字。
 *
 * 以前是整幅 16:9 大图（桌面宽约 680 px），斗鱼那一段一半的页面高度都是封面，
 * 读起来像在翻相册。现在封面缩成缩略图：手机 7rem（112 px）、sm 11rem、lg 14rem
 * （224 px），文字放在右边，一张卡的高度大致由文字决定。
 * 显示宽度最多 224 px，DPR 2 下 360 / 540 两档就够了，不再下载 900 宽的图。
 */
const STORY_COVER_WIDTHS = [240, 360, 540] as const
const STORY_COVER_SIZES = '(min-width: 1024px) 224px, (min-width: 640px) 176px, 112px'

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
            {beat.important && <MilestoneBadge accent={accent} compact />}
          </span>
          <span className="mt-1 block text-body font-semibold text-ink">{beat.title}</span>
        </span>
        <span className="shrink-0 font-mono text-meta text-faint group-hover:text-live">展开 ↓</span>
      </button>
    )
  }

  const link = (children: ReactNode, extra: { className?: string; hidden?: boolean } = {}) =>
    beat.href ? (
      <Link
        href={beat.href}
        prefetch={false}
        target={beat.external ? '_blank' : undefined}
        rel={beat.external ? 'noreferrer' : undefined}
        {...contentOpenProps(beat.href)}
        className={extra.className}
        tabIndex={extra.hidden ? -1 : undefined}
        aria-hidden={extra.hidden || undefined}
      >
        {children}
      </Link>
    ) : (
      <span className={extra.className}>{children}</span>
    )

  return (
    <div className="group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-meta uppercase tracking-[0.16em]" style={{ color: accent }}>
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 self-center rounded-full" style={{ background: accent }} />
          {!hideDate && <span className="font-mono normal-case tracking-normal tnum">{displayDate}</span>}
          {beat.kicker && <span>· {beat.kicker}</span>}
          {beat.important && <MilestoneBadge accent={accent} compact />}
        </div>
        <button
          type="button"
          onClick={() => setManualOpen(false)}
          aria-expanded
          className="shrink-0 font-mono text-meta text-faint transition-colors hover:text-live"
        >
          收起 ↑
        </button>
      </div>

      {/*
        精选卡：小封面 + 文字。
        - 手机：封面和标题并排，正文在下面占满整行（7rem 小图旁边塞正文，一行只剩几个字）。
        - sm 起：左图右文。封面宽度用 rem，跟着字号走，4K 下不会变成一小块。
        - 正文宽度按所在栏的百分比（lg 起 85%）：1080p 和 4K 下换行位置成比例，不用固定字数。
        只有封面和标题是链接：正文在手机上可以「展开全文」，按钮不能套在链接里。
      */}
      <div
        className={`mt-3 ${beat.cover ? 'grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-5 lg:grid-cols-[14rem_minmax(0,1fr)]' : ''}`}
      >
        {beat.cover &&
          link(
            <MediaFrame
              src={beat.cover}
              alt={beat.title}
              className="aspect-video w-full rounded-sm"
              widths={STORY_COVER_WIDTHS}
              sizes={STORY_COVER_SIZES}
            >
              {beat.durationMinutes && (
                <span className="absolute bottom-1 right-1 rounded-sm bg-base/75 px-1 py-px font-mono text-[0.6875rem] text-ink/90 tnum">
                  {formatDuration(beat.durationMinutes)}
                </span>
              )}
            </MediaFrame>,
            { className: 'block sm:row-span-2', hidden: true },
          )}
        <h3 className="min-w-0 self-center lg:max-w-[85%] text-body font-semibold text-ink sm:self-start sm:text-h3">
          {link(beat.title, { className: 'transition-colors group-hover:text-white' })}
        </h3>
        {(beat.body || beat.emphasis || beat.activity) && (
          <div className={beat.cover ? 'col-span-2 min-w-0 sm:col-span-1 sm:col-start-2' : 'mt-1.5'}>
            {beat.body && <ClampText text={beat.body} />}
            {beat.emphasis && (
              <p className="mt-2 inline-block rounded-sm border border-line/70 px-2 py-1 text-meta tracking-[0.14em]" style={{ color: accent }}>
                {beat.emphasis}
              </p>
            )}
            {beat.activity && <ActivityTimeline activity={beat.activity} accent={accent} />}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 手机上正文超过 4 行先收起，给一个「展开全文」。桌面不截断。
 * 只在真的放不下时出现按钮（量 scrollHeight），短正文不会多一个没用的按钮。
 */
function ClampText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setOverflows(node.scrollHeight - node.clientHeight > 2)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [text])

  return (
    <>
      <p ref={ref} className={`text-body text-muted lg:max-w-[85%] ${open ? '' : 'max-sm:line-clamp-4'}`}>
        {text}
      </p>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-1 font-mono text-meta text-faint transition-colors hover:text-live sm:hidden"
          aria-expanded={open}
        >
          {open ? '收起 ↑' : '展开全文 ↓'}
        </button>
      )}
    </>
  )
}

function ActivityTimeline({ activity, accent }: { activity: NonNullable<ResolvedBeat['activity']>; accent: string }) {
  const max = Math.max(...activity.points.map((point) => point.count), 1)

  // 尺寸全部用 rem / em：跟着字号缩放，高分屏上不会是一排 10px 的小字。
  return (
    <div className="mt-4 rounded-xl lg:max-w-[85%] border border-line/70 bg-surface/30 px-3 pb-3 pt-3 sm:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-meta font-medium text-ink/90">{activity.label}</p>
        <p className="text-[0.6875rem] text-faint"><SiteText id="chronicle-activity-note" /></p>
      </div>
      <div
        className="relative mt-3 grid items-end gap-1 pt-4"
        style={{ gridTemplateColumns: `repeat(${activity.points.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${activity.label}：${activity.points.map((point) => `${point.year} 年 ${point.count} ${activity.unit}`).join('，')}`}
      >
        <span aria-hidden className="absolute inset-x-0 bottom-[1.55rem] h-px bg-line" />
        {activity.points.map((point) => (
          <div key={point.year} className="relative z-10 flex min-w-0 flex-col items-center">
            <span className="font-mono text-[0.625rem] text-faint tnum">{point.count}</span>
            <span
              aria-hidden
              className="mt-1 w-[0.4rem] rounded-full opacity-85"
              style={{ height: `${0.75 + (point.count / max) * 2.6}rem`, background: accent }}
            />
            <span aria-hidden className="mt-1.5 h-2 w-2 rounded-full border-2 border-base" style={{ background: accent }} />
            {/* 手机上一行放 9 个完整年份太挤，只写后两位 */}
            <span className="mt-1 font-mono text-[0.625rem] text-faint tnum">
              <span className="max-sm:hidden">{point.year}</span>
              <span className="sm:hidden">’{String(point.year).slice(2)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 关键节点不用奖杯、金色或大面积高光；一枚菱形和细描边足以形成“已确认里程碑”的层级。
 * 展开、折叠、紧凑行与右侧导轨都沿用这一语义，避免只有打开卡片后才看得出来。
 */
function MilestoneBadge({ accent, compact = false }: { accent: string; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium normal-case ${compact ? 'px-2 py-0.5 text-[10px] tracking-[0.12em]' : 'px-2.5 py-0.5 text-[11px] tracking-[0.1em]'}`}
      style={{
        color: accent,
        borderColor: `color-mix(in srgb, ${accent} 38%, transparent)`,
        background: `color-mix(in srgb, ${accent} 8%, transparent)`,
      }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-current opacity-90" />
      <SiteText id="chronicle-milestone" />
    </span>
  )
}

/**
 * 非精选条目：没有封面的「小卡」。
 *
 * 以前是一行灰色标题 + 一枚小标签，行尾的 → 在宽屏上被推到最右边，
 * 一年十几行排下来只看得清精选卡，其余像目录。现在每条都是一个完整的小节点：
 * - 左侧竖线上一颗时代色圆点，和精选卡的圆点是同一套语言；
 * - 第一行「日期 · 栏目」用时代色，和精选卡的 meta 行一致；
 * - 标题用正文主色加粗，→ 紧跟在标题后面，不再飘到屏幕另一头；
 * - 下面一两行正文（摘要），让人不用点进去也知道这件事讲什么。
 * 文字宽度与精选卡一样按所在栏的百分比（lg 起 85%）。
 * 没有链接的节点（年度数据、阶段说明）同样排版，只是没有箭头、不可点。
 */
function CompactEvent({ beat, accent, hideDate = false }: { beat: ResolvedBeat; accent: string; hideDate?: boolean }) {
  const displayDate = chronicleDate(beat.date)
  const title = beat.title?.trim()
  const body = beat.body?.trim()
  // 阶段说明常常只有正文：拿正文当标题，不重复显示两遍。
  const heading = title || body || ''
  const summary = body && body !== heading ? body : ''
  const showMeta = !hideDate || beat.kicker || beat.important

  return (
    <>
      <span
        aria-hidden
        className="absolute left-[calc(-1rem-0.5px)] top-[0.95rem] h-2 w-2 -translate-x-1/2 rounded-full border-2 border-base"
        style={{ background: accent }}
      />
      {showMeta && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta tracking-[0.12em]" style={{ color: accent }}>
          {!hideDate && <span className="font-mono tracking-normal tnum">{displayDate}</span>}
          {beat.kicker && <span>{!hideDate && '· '}{beat.kicker}</span>}
          {beat.important && <MilestoneBadge accent={accent} compact />}
        </span>
      )}
      <span className={`block lg:max-w-[85%] text-body font-semibold text-ink sm:text-[1.0625rem] ${showMeta ? 'mt-1' : ''}`}>
        {heading}
        {beat.href && (
          <>
            {/*
              U+2060（词连接符）让 → 和标题最后一个字一起换行，箭头不会单独掉到下一行。
              标题文字必须原样整段输出：现场编辑靠文字末尾的隐形标记认出这是哪条文案，拆开就认不出了。
            */}
            {'\u2060'}
            <span
              aria-hidden
              className="ml-1.5 inline-block font-mono text-meta font-normal transition-transform group-hover:translate-x-1"
              style={{ color: accent }}
            >
              →
            </span>
          </>
        )}
      </span>
      {summary && <span className="mt-1 block text-meta leading-relaxed text-muted line-clamp-2 sm:text-body lg:max-w-[85%]">{summary}</span>}
    </>
  )
}

function CompactEventLink({ beat, className, children }: { beat: ResolvedBeat; className: string; children: ReactNode }) {
  if (!beat.href) return <div className={className}>{children}</div>
  return (
    <Link
      href={beat.href}
      prefetch={false}
      target={beat.external ? '_blank' : undefined}
      rel={beat.external ? 'noreferrer' : undefined}
      {...contentOpenProps(beat.href)}
      className={`group ${className} transition-colors hover:bg-surface/50`}
    >
      {children}
    </Link>
  )
}

/** Type B：没有精选卡的年份，第一条用同样的小卡，挂在同一条竖线上。 */
function HeroRow({ beat, accent, hideDate = false }: { beat: ResolvedBeat; accent: string; hideDate?: boolean }) {
  return (
    <div className="border-l border-line/60 pl-4">
      <CompactEventLink beat={beat} className="relative block rounded-lg px-2 py-2.5">
        <CompactEvent beat={beat} accent={accent} hideDate={hideDate} />
      </CompactEventLink>
    </div>
  )
}

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
    <ul className={`space-y-1 border-l border-line/60 pl-4 ${className}`}>
      {beats.map((beat) => (
        <li id={`story-beat-${beat.id}`} key={beat.id} className="scroll-mt-24">
          <CompactEventLink beat={beat} className={`relative block rounded-lg px-2 ${rowPad}`}>
            <CompactEvent beat={beat} accent={accent} />
          </CompactEventLink>
        </li>
      ))}
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
      <SiteText id="chronicle-open-archive" vars={{ count: section.archiveCount.toLocaleString() }} />
      <span aria-hidden className="font-mono transition-transform group-hover:translate-x-1" style={{ color: accent }}>
        →
      </span>
    </button>
  )
}
