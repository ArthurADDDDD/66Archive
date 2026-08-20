'use client'

import { useState } from 'react'
import Link from 'next/link'
import { actColor, type ResolvedBeat } from '@/lib/narrative'
import { applyLiveHighlights } from '@/lib/live-content'
import { Eyebrow } from './primitives'
import { Reveal } from './Reveal'
import { useCopyBlock, useLiveContent } from './LiveContentProvider'

/**
 * 三个补充梗先作为前端策展基线并入现有高光，再交给 live-content 做覆盖/删除。
 * 这样后台已有的默认展开、文案覆盖和 deletedIds 行为仍然有效。
 *
 * B 站两个链接使用官方支持的 p + t（秒）参数直接空降；
 * AcFun 没有找到可验证的公开跳秒参数，因此只保留原视频链接，把时间点明确写在卡片里，避免造一个“看起来能跳”的假链接。
 */
const EXTRA_HIGHLIGHTS: ResolvedBeat[] = [
  {
    id: 'dont-like-nvliu',
    act: 'act-ii',
    date: '2015',
    size: 'type',
    kicker: '砒霜名场面',
    title: '我就是不喜欢那个女流！',
    body: '「我就是不喜欢那个女流！」',
    href: 'https://www.bilibili.com/video/BV1bx411j7Gx?p=2&t=1907',
    external: true,
    cover: null,
    emphasis: 'P2 · 31:47',
  },
  {
    id: 'douyu-gandie',
    act: 'act-ii',
    date: '2021.09.21',
    size: 'type',
    kicker: '查房名场面',
    title: '斗鱼干爹',
    body: '「斗鱼干爹，定不负你。」',
    href: 'https://www.bilibili.com/video/BV1fk4y1k7uN?p=2&t=3122',
    external: true,
    cover: null,
    emphasis: 'P2 · 52:02',
  },
  {
    id: 'nature-gift',
    act: 'act-ii',
    date: '2022',
    size: 'type',
    kicker: '砒霜名场面',
    title: '感谢大自然的馈赠',
    body: '「感谢大自然的馈赠。」',
    href: 'https://m.acfun.cn/v/?ac=35552495',
    external: true,
    cover: null,
    emphasis: '01:22:48',
  },
]

/** 把补充梗插回对应的叙事位置；如果以后某个锚点被撤掉，兜底追加，避免整条高光消失。 */
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
 * 高光条：20 个「记得住的时刻」。
 * 数字是背景纹理不是指标（emphasis 大字淡色靠右）；
 * 每一条都指向真实播放/原平台 URL——展开后点击图片或标题直接跳转，不再进详情页。
 */
export function HighlightStrip({ beats: baseline, emphasisVars }: { beats: ResolvedBeat[]; emphasisVars: Record<string, string> }) {
  const { narrative } = useLiveContent()
  const copy = useCopyBlock('homeSections', 'home-highlights')
  const beats = applyLiveHighlights(withExtraHighlights(baseline), narrative?.highlights, emphasisVars, narrative?.deletedIds ?? [])
  if (beats.length === 0) return null
  return (
    <section id="home-highlights" className="scroll-mt-4 border-t border-line py-12 sm:py-16">
      <div className="home-content-container px-page">
        <Reveal>
          {copy.eyebrow && <Eyebrow color="#5BC8E8">{copy.eyebrow}</Eyebrow>}
          {copy.title && <h2 className="measure-hero mt-3 text-h2 font-semibold">{copy.title}</h2>}
          {copy.lede && <p className="measure-body mt-3 text-body text-muted">{copy.lede}</p>}
        </Reveal>

        <div className="mt-8">
          {beats.map((beat, i) => (
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
    <div className={`group border-b border-line/60 transition-colors ${isOpen ? 'bg-surface/20' : ''}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:py-5">
        <span className="hidden font-mono text-meta text-faint tnum sm:block">{beat.date}</span>

        <div className="min-w-0">
          <span
            className="flex flex-wrap items-baseline gap-x-2 text-meta uppercase tracking-[0.16em]"
            style={{ color: actColor(beat.act) }}
          >
            <span className="font-mono normal-case tracking-normal text-faint tnum sm:hidden">{beat.date}</span>
            {beat.kicker}
          </span>
          {isOpen && beat.href ? (
            <Link
              href={beat.href}
              target={beat.external ? '_blank' : undefined}
              rel={beat.external ? 'noreferrer' : undefined}
              className="mt-1 block text-h3 font-medium text-ink transition-colors group-hover:text-white hover:text-live"
            >
              {beat.title}
              {beat.external && <span className="ml-1 font-mono text-meta text-live">↗</span>}
            </Link>
          ) : (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={isOpen}
              aria-controls={`highlight-panel-${beat.id}`}
              className="ui-press mt-1 block cursor-pointer text-left text-h3 font-medium text-ink transition-colors group-hover:text-white"
            >
              {beat.title}
            </button>
          )}
        </div>

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
              {beat.emphasis && (
                <p className="font-display text-h3 font-bold leading-tight" style={{ color: actColor(beat.act) }}>
                  {beat.emphasis}
                </p>
              )}
              {beat.body && <p className={`${beat.emphasis ? 'mt-3' : ''} measure-body text-body text-muted`}>{beat.body}</p>}
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
