'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EXTRA_HIGHLIGHTS } from '@/lib/highlight-extras'
import { actColor, MEME_CATEGORIES, type HomepageData, type MemeCategory, type ResolvedBeat } from '@/lib/narrative'
import { applyLiveHighlights } from '@/lib/live-content'
import { Eyebrow } from './primitives'
import { Reveal } from './Reveal'
import { useCopyBlock, useLiveContent } from './LiveContentProvider'
import { MemeMontage } from './MemeMontage'

/**
 * 把补充梗插回对应的叙事位置；如果以后某个锚点被撤掉，兜底追加，避免整条高光消失。
 * 补充条目的字段本身统一来自 highlight-extras.ts；后台快照导入也读同一份源。
 */
function withExtraHighlights(baseline: ResolvedBeat[]): ResolvedBeat[] {
  const insertAfter = new Map<string, ResolvedBeat[]>([
    ['xinling-pishuang', [EXTRA_HIGHLIGHTS[0]]],
    ['number-723', [EXTRA_HIGHLIGHTS[1]]],
    ['dalishi', [EXTRA_HIGHLIGHTS[2]]],
  ])
  const inserted = new Set<string>()
  const merged = baseline.flatMap((beat) => {
    const extras = insertAfter.get(beat.id) ?? []
    extras.forEach((extra) => inserted.add(extra.id))
    return [beat, ...extras]
  })
  return [...merged, ...EXTRA_HIGHLIGHTS.filter((extra) => !inserted.has(extra.id))]
}

/**
 * 首页「直播间梗」：仍复用原 Highlight 的卡片、展开与播放入口，
 * 只在外层增加固定四分类。没有 category 的旧 Highlight 保留在数据里，
 * 但不被重新塞进任何一个分类。
 */
export function HighlightStrip({
  beats: baseline,
  emphasisVars,
  memeMontages,
}: {
  beats: ResolvedBeat[]
  emphasisVars: Record<string, string>
  memeMontages: HomepageData['memeMontages']
}) {
  const { narrative } = useLiveContent()
  const copy = useCopyBlock('homeSections', 'home-highlights')
  const beats = applyLiveHighlights(withExtraHighlights(baseline), narrative?.highlights, emphasisVars, narrative?.deletedIds ?? [])
  const [activeCategory, setActiveCategory] = useState<MemeCategory>(MEME_CATEGORIES[0].id)
  const active = MEME_CATEGORIES.find((category) => category.id === activeCategory) ?? MEME_CATEGORIES[0]
  const activeBeats = beats.filter((beat) => beat.category === active.id)
  if (!MEME_CATEGORIES.some((category) => beats.some((beat) => beat.category === category.id))) return null
  return (
    <section id="home-highlights" className="scroll-mt-4 border-t border-line py-12 sm:py-16">
      <div className="home-content-container px-page">
        <Reveal>
          {copy.eyebrow && <Eyebrow color="#5BC8E8">{copy.eyebrow}</Eyebrow>}
          {copy.title && <h2 className="measure-hero mt-3 text-h2 font-semibold">{copy.title}</h2>}
          {copy.lede && <p className="measure-body mt-3 text-body text-muted">{copy.lede}</p>}
        </Reveal>

        <div className="mt-8">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="直播间梗分类">
            {MEME_CATEGORIES.map((category) => {
              const selected = category.id === active.id
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveCategory(category.id)}
                  className={`ui-press rounded-full border px-3 py-2 text-meta transition-colors sm:px-4 ${selected ? 'border-live/55 bg-live/10 text-ink' : 'border-line text-muted hover:border-muted hover:text-ink'}`}
                >
                  {category.label}
                </button>
              )
            })}
          </div>
          <div className="mt-5 border-l border-line/70 pl-4 sm:pl-5" role="tabpanel" aria-label={active.label}>
            <p className="text-control font-medium text-ink">{active.label}</p>
            <p className="mt-1 measure-body text-meta leading-relaxed text-faint">{active.description}</p>
          </div>

          {active.id === 'xinling-pishuang' && (
            <MemeMontage
              title="那些星期日，心灵砒霜准时开场"
              description="从早期节目到后来留下的名场面，沿着档案里的真实录像往回看。"
              href="/series/xinling-pishuang/"
              linkLabel="查看心灵砒霜系列"
              samples={memeMontages.xinlingPishuang}
            />
          )}
          {active.id === 'game-meme' && (
            <MemeMontage
              title="《我的世界》里的大周记忆"
              description="大周从这里长出来。看看这个系列里保存下来的直播与视频。"
              href="/games/minecraft/"
              linkLabel="进入我的世界系列"
              samples={memeMontages.minecraft}
            />
          )}
        </div>

        <div className="mt-5">
          {activeBeats.map((beat, i) => (
            <Reveal key={beat.id} delay={i < 4 ? i * 40 : 0}>
              <Row beat={beat} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * 高光行：折叠时标题作为展开入口；展开后图片和标题直接指向原平台播放 URL，
 * 不再进入“查看完整详情”页。
 *
 * 折叠状态用本地 state 管，而不是直接把 `open` 绑给 `beat.expanded`——
 * live 内容在首屏后异步到达（useLiveContent 更新）会重渲染整条，
 * 直接绑定会把用户刚展开/折叠的行打回原样。
 *
 * `null` 哨兵表示「用户还没手动动过」：跟随 `beat.expanded`（live 到达前基线
 * 为折叠，到达后按后台「默认展开」配置自动展开）；用户点过一次后以用户为准，
 * 不再被 live 重渲染覆盖。
 */
function Row({ beat }: { beat: ResolvedBeat }) {
  const [open, setOpen] = useState<boolean | null>(null)
  const isOpen = open ?? beat.expanded ?? false
  const toggle = () => setOpen(!isOpen)

  return (
    <div className="group border-b border-line/60 transition-colors">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:py-5">
        <span className="hidden font-mono text-meta text-faint tnum sm:block">{beat.date}</span>

        {/* 标题整行始终只控制开合；播放入口只放在下方展开内容里。 */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-controls={`highlight-panel-${beat.id}`}
          className="ui-press min-w-0 rounded-lg py-1 text-left transition-colors group-hover:text-white"
        >
          <span
            className="flex flex-wrap items-baseline gap-x-2 text-meta uppercase tracking-[0.16em]"
            style={{ color: actColor(beat.act) }}
          >
            <span className="font-mono normal-case tracking-normal text-faint tnum sm:hidden">{beat.date}</span>
            {beat.kicker}
          </span>
          <span className="mt-1 block text-h3 font-medium text-ink transition-colors group-hover:text-white">
            {beat.title}
          </span>
        </button>

        {/* 右侧图标保留为独立开合触控目标。 */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-controls={`highlight-panel-${beat.id}`}
          aria-label={isOpen ? '收起' : '展开'}
          className="ui-press flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line font-mono text-base text-faint transition-[transform,color,border-color] hover:border-muted hover:text-ink"
        >
          <span aria-hidden className={`transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
        </button>
      </div>

      {isOpen && (
        <div id={`highlight-panel-${beat.id}`} className="grid gap-5 pb-6 pl-0 sm:grid-cols-[120px_minmax(0,1fr)] sm:pb-8">
          <span aria-hidden className="hidden sm:block" />
          <div className={`measure-hero grid gap-5 ${beat.cover ? 'sm:grid-cols-[minmax(220px,360px)_minmax(0,1fr)]' : ''}`}>
            {beat.cover && (
              beat.href ? (
                <Link
                  href={beat.href}
                  target={beat.external ? '_blank' : undefined}
                  rel={beat.external ? 'noreferrer' : undefined}
                  aria-label={`播放：${beat.title}`}
                  className="group/highlight-cover block aspect-video overflow-hidden rounded-lg border border-line/70"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={beat.cover}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover object-center transition duration-300 group-hover/highlight-cover:scale-[1.025]"
                  />
                </Link>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={beat.cover}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="aspect-video w-full rounded-lg border border-line/70 object-cover object-center"
                />
              )
            )}
            <div className="min-w-0 self-center">
              {beat.href ? (
                <Link
                  href={beat.href}
                  target={beat.external ? '_blank' : undefined}
                  rel={beat.external ? 'noreferrer' : undefined}
                  aria-label={`播放：${beat.title}`}
                  className="ui-press -m-2 block rounded-lg p-2 text-left transition-colors hover:text-live"
                >
                  {beat.emphasis && (
                    <p className="font-display text-h3 font-bold leading-tight" style={{ color: actColor(beat.act) }}>
                      {beat.emphasis}
                    </p>
                  )}
                  {beat.body && <p className={`${beat.emphasis ? 'mt-3' : ''} measure-body text-body text-muted`}>{beat.body}</p>}
                </Link>
              ) : (
                <>
                  {beat.emphasis && (
                    <p className="font-display text-h3 font-bold leading-tight" style={{ color: actColor(beat.act) }}>
                      {beat.emphasis}
                    </p>
                  )}
                  {beat.body && <p className={`${beat.emphasis ? 'mt-3' : ''} measure-body text-body text-muted`}>{beat.body}</p>}
                </>
              )}
              {beat.href && (
                <Link
                  href={beat.href}
                  target={beat.external ? '_blank' : undefined}
                  rel={beat.external ? 'noreferrer' : undefined}
                  className="ui-press mt-5 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-meta text-live transition-colors hover:border-muted"
                >
                  打开播放 <span aria-hidden>↗</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
