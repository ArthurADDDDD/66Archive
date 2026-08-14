'use client'

import Link from 'next/link'
import type { ResolvedAct, ResolvedBeat } from '@/lib/narrative'
import { applyLiveAct } from '@/lib/live-content'
import { Reveal } from './Reveal'
import { useLiveAct } from './LiveContentProvider'

/**
 * 三幕中的一幕。幕头只给文字（kicker/年份/标题/问题/正文）；showCount 时才显示「N 条记录」
 * （故事模式展示档案计数，首页精简幕不展示）。
 * 时间线以卡片流呈现——hero 配图大卡（真实封面）、type 字排大卡（无图，大字排版）、
 * small 小卡（文字+URL）、montage 蒙太奇（真实封面条 + 派生数字，首页 ACT II 专用）。
 * 幕尾可接 closer 字排收束（如「娃睡了来突袭。」TO BE CONTINUED）。
 * 封面缺失时 hero 退化为字排色块（绝不用假图）；数字只来自构建期派生。
 */
export function ActSection({
  act: baselineAct,
  now,
  showCount = true,
  homeScreen = false,
  sectionId,
  beatAnchorPrefix,
  scope = 'homeActs',
}: {
  act: ResolvedAct
  now?: { year: string; label: string; count: number }
  showCount?: boolean
  homeScreen?: boolean
  sectionId?: string
  beatAnchorPrefix?: string
  /** 读哪一份幕配置：首页三幕与故事模式在后台是分开维护的两份。 */
  scope?: 'homeActs' | 'storyActs'
}) {
  const live = useLiveAct(scope, baselineAct.act.id)
  const act = applyLiveAct(baselineAct, live, scope === 'homeActs')
  const a = act.act

  return (
    <section id={sectionId ?? a.id} className={`relative scroll-mt-4 border-t border-line py-12 sm:py-16 ${homeScreen ? 'xl:flex xl:min-h-[100svh] xl:items-center xl:py-20' : ''}`}>
      <span
        aria-hidden
        className="absolute left-[13%] top-0 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-base sm:left-6"
        style={{ background: a.color, boxShadow: `0 0 16px ${a.color}55` }}
      />
      <div className={`home-content-container px-page ${homeScreen ? 'xl:pr-28 2xl:pr-36' : ''}`}>
        <Reveal>
          <header className="max-w-2xl">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-meta uppercase tracking-[0.16em]" style={{ color: a.color }}>
                {a.kicker}
              </p>
              <p className="font-mono text-meta text-faint tnum">{a.years}</p>
            </div>
            <h2 className="mt-3 text-h2 font-bold text-ink">{a.title}</h2>
            <div className="mt-4 max-w-xl space-y-2.5">
              {a.body.map((line, i) => (
                <p key={i} className="text-body text-muted">
                  {line}
                </p>
              ))}
            </div>
            {showCount && <p className="mt-4 text-meta text-faint tnum">{act.count.toLocaleString()} 条记录</p>}
          </header>
        </Reveal>

        <div className="mt-8 sm:mt-10">
          {act.beats.map((beat) => (
            <BeatRow key={beat.id} beat={beat} color={a.color} anchorId={beatAnchorPrefix ? `${beatAnchorPrefix}${beat.id}` : homeScreen ? `home-${a.id}-${beat.id}` : undefined} />
          ))}
        </div>

        {a.closer && (
          <Reveal>
            <p className="mt-10 text-h2 font-black text-ink">{a.closer.line}</p>
            {a.closer.tail && (
              <p className="mt-3 font-mono text-meta tracking-[0.3em]" style={{ color: a.color }}>
                {a.closer.tail}
              </p>
            )}
          </Reveal>
        )}

        {now && (
          <Reveal>
            <Link
              href="/chronicle/"
              className="group mt-8 inline-flex items-center gap-3 rounded-full border border-today/30 bg-today/5 py-2 pl-3 pr-5 transition-colors hover:border-today/60"
            >
              <span aria-hidden className="ui-now-pulse h-2 w-2 shrink-0 rounded-full bg-today" />
              <span className="text-meta tracking-[0.14em] text-today tnum">{now.year}，{now.label}</span>
              <span className="text-meta text-faint tnum group-hover:text-today">· 已有 {now.count.toLocaleString()} 条 →</span>
            </Link>
          </Reveal>
        )}
      </div>
    </section>
  )
}

/** 一行词条：卡片主体（可点击）+ 词条下方脚注（不可点击，弱化）。 */
function BeatRow({ beat, color, anchorId }: { beat: ResolvedBeat; color: string; anchorId?: string }) {
  const card = beat.href ? (
    <Link
      href={beat.href}
      target={beat.external ? '_blank' : undefined}
      rel={beat.external ? 'noreferrer' : undefined}
      className="group block"
    >
      <BeatBody beat={beat} color={color} />
    </Link>
  ) : (
    <div>
      <BeatBody beat={beat} color={color} />
    </div>
  )

  return (
    <article id={anchorId} data-home-act-event={anchorId ? '' : undefined} className="scroll-mt-6 border-t border-line/50 py-6 sm:py-7">
      {card}
      {beat.gameWorld && <GameWorldFootnote footnote={beat.gameWorld} />}
    </article>
  )
}

function BeatBody({ beat, color }: { beat: ResolvedBeat; color: string }) {
  if (beat.size === 'hero') return <HeroCard beat={beat} color={color} />
  if (beat.size === 'type') return <TypeCard beat={beat} color={color} />
  if (beat.size === 'montage') return <MontageBlock beat={beat} color={color} />
  return <SmallRow beat={beat} color={color} />
}

/** 配图大卡：真实封面 + 标题/引子 */
function HeroCard({ beat, color }: { beat: ResolvedBeat; color: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-meta text-faint tnum">{beat.date}</span>
        {beat.kicker && (
          <span className="text-meta uppercase tracking-[0.16em]" style={{ color }}>
            {beat.kicker}
          </span>
        )}
      </div>
      {/* 封面限宽：容器满宽 1240px 时 16:9 会长到 697px 高，一屏装不下一张图，
          往下滚就变成「一屏一张图」的长路。限到 680px（≈382px 高）后节奏才回来。 */}
      <div className="relative mt-4 aspect-video max-w-[680px] overflow-hidden rounded-xl border border-line/80 bg-surface/40">
        {beat.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={beat.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${color}22, transparent 60%)` }}
          >
            <span className="font-mono text-meta tracking-widest" style={{ color }}>
              封面待补
            </span>
          </div>
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-base/45 via-transparent to-transparent" />
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-sm bg-base/70 px-2 py-1 text-meta text-ink/90 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          打开 →
        </span>
      </div>
      <h3 className="mt-4 text-h3 font-bold text-ink transition-colors group-hover:text-white">{beat.title}</h3>
      {beat.body && <p className="mt-2 max-w-2xl text-body text-muted">{beat.body}</p>}
      {beat.emphasis && <EmphasisTag text={beat.emphasis} color={color} />}
    </div>
  )
}

/** 字排大卡：无图，大字排版（大周MC / 三本书 / 石狮子 / 科目二 / see you around / 回冒险岛） */
function TypeCard({ beat, color }: { beat: ResolvedBeat; color: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-meta text-faint tnum">{beat.date}</span>
        {beat.kicker && (
          <span className="text-meta uppercase tracking-[0.16em]" style={{ color }}>
            {beat.kicker}
          </span>
        )}
      </div>
      {/* 字排大卡靠字重与留白拉重量，不靠比 hero 卡更大的字号——
          否则手机端会出现「卡片标题比幕标题还大」的档位穿插。 */}
      <h3 className="mt-3 text-h3 font-black leading-[1.05] text-ink transition-colors group-hover:text-white">
        {beat.title}
      </h3>
      {beat.body && <p className="mt-2 max-w-2xl text-body text-muted">{beat.body}</p>}
      {beat.emphasis && <EmphasisTag text={beat.emphasis} color={color} />}
      {beat.tail && <p className="mt-5 font-mono text-meta tracking-[0.3em] text-faint">{beat.tail}</p>}
    </div>
  )
}

/** 蒙太奇（首页 ACT II）：日期 · 标题 · 引子 → 分类 chips → 真实封面横条 → 派生统计闪现 */
function MontageBlock({ beat, color }: { beat: ResolvedBeat; color: string }) {
  const m = beat.montage
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-meta text-faint tnum">{beat.date}</span>
      </div>
      <h3 className="mt-3 text-h3 font-bold text-ink">{beat.title}</h3>
      {beat.body && <p className="mt-2 max-w-2xl text-body text-muted">{beat.body}</p>}

      {beat.chips && beat.chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {beat.chips.map((chip) => (
            <span key={chip} className="rounded-full border border-line/70 px-3 py-1 text-meta text-muted">
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* 横滑封面条：手机端出血到屏幕边缘，首尾用 bleed-inset 补回安全距离 */}
      {m && m.samples.length > 0 && (
        <div className="bleed-page mt-5 overflow-x-auto sm:mx-0">
          <div className="bleed-inset flex gap-3 pb-1">
            {m.samples.map((s) => (
              <Link key={s.id} href={`/e/${s.id}/`} className="group w-[168px] shrink-0 sm:w-[196px]">
                <div className="overflow-hidden rounded-lg border border-line/60 bg-surface/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.cover}
                    alt={s.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-video w-full object-cover transition-opacity duration-300 group-hover:opacity-90"
                  />
                </div>
                <span className="mt-1.5 block truncate text-meta text-faint tnum">
                  {s.date} · {s.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {m && (
        <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-2 text-body text-muted">
          <Reveal delay={0}>
            <span>
              <b className="tnum text-ink">{m.stats.xinling}</b> 期心灵砒霜
            </span>
          </Reveal>
          <span className="text-faint/40">·</span>
          <Reveal delay={60}>
            <span>
              <b className="tnum text-ink">{m.stats.hoursLabel}</b> 小时
            </span>
          </Reveal>
          <span className="text-faint/40">·</span>
          <Reveal delay={120}>
            <span>
              <b className="tnum text-ink">{m.stats.liveSessions}</b> 场直播
            </span>
          </Reveal>
          <span className="text-faint/40">·</span>
          <Reveal delay={180}>
            <span style={{ color }}>大周</span>
          </Reveal>
        </div>
      )}
    </div>
  )
}

/** 小卡：日期 · 标签 · 标题 · 引子 → URL
 *
 * 手机端拆成固定两段：第一行是「日期 · 标签 · →」的 meta 行，第二行起是标题与引子。
 * 原本四者同处一个 flex-wrap，标题的起始位置取决于前面有没有 kicker——
 * 有标签的从 x≈140 起、没标签的从 x=76 起，标题换行后又回到 x=0，整列参差不齐。
 * 桌面端（sm+）order 归零，回到原来的单行排布。
 */
function SmallRow({ beat, color }: { beat: ResolvedBeat; color: string }) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5">
      <span className="shrink-0 font-mono text-meta text-faint tnum">{beat.date}</span>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-body font-medium text-ink transition-colors group-hover:text-white">{beat.title}</span>
          {beat.body && <span className="min-w-0 text-body text-muted">· {beat.body}</span>}
        </div>
        {beat.kicker && (
          <span className="mt-1 block text-meta" style={{ color }}>
            {beat.kicker}
          </span>
        )}
      </div>
      {beat.href && (
        <span aria-hidden className="shrink-0 text-meta transition-transform group-hover:translate-x-0.5" style={{ color }}>
          →
        </span>
      )}
    </div>
  )
}

/** 隐线 / 冷知识脚注：词条下方一行弱化小字，GAME WORLD 标签，不可点击。 */
function GameWorldFootnote({ footnote }: { footnote: NonNullable<ResolvedBeat['gameWorld']> }) {
  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-meta text-faint">
      <span className="font-mono uppercase tracking-[0.2em]">GAME WORLD</span>
      {footnote.rel && <span className="font-mono tnum">{footnote.rel}</span>}
      {footnote.date && <span className="font-mono tnum">{footnote.date}</span>}
      <span>· {footnote.text}</span>
    </p>
  )
}

function EmphasisTag({ text, color }: { text: string; color: string }) {
  return (
    <p className="mt-4 inline-block rounded-sm border border-line/70 px-2 py-1 text-meta tracking-[0.14em]" style={{ color }}>
      {text}
    </p>
  )
}
