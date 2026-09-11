'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { ResolvedAct, ResolvedBeat } from '@/lib/narrative'
import { applyLiveActs } from '@/lib/live-content'
import { contentOpenProps } from '@/lib/analytics-target'
import {
  HOME_ACT_CHANGE_EVENT,
  HOME_ACT_SELECT_EVENT,
  type HomeActChangeDetail,
  type HomeActSelectDetail,
} from '@/lib/home-act-pagination'
import { useLiveContent } from './LiveContentProvider'
import { HomeExplorePromo, type ExplorePromoData } from './HomeExplorePromo'

type StageStep = {
  id: string
  actIndex: number
  beatIndex: number | null
  /** 幕尾收束：和事件卡一样占据书中的一页。 */
  closer?: boolean
  /** 全篇最后一页：不属于任何一幕，负责把编年史 / 画廊两条路交出去。 */
  outro?: boolean
}

type SwipeStart = {
  x: number
  y: number
  id: number
  axis: 'x' | 'y' | null
}

const TURN_OUT_MS = 170

/**
 * 首页三幕共用一张 100svh 的翻页卡。
 * 页面滚轮始终保持浏览器原生行为；卡内页码由横向拖拽、键盘、页条或桌面时间轴切换。
 */
export function HomeActStage({
  acts: baselineActs,
  now,
  promo,
}: {
  acts: ResolvedAct[]
  now: { year: string; label: string; count: number }
  promo?: ExplorePromoData
}) {
  const { narrative } = useLiveContent()
  const acts = useMemo(
    () => applyLiveActs(baselineActs, narrative?.homeActs, true, narrative?.deletedIds ?? []),
    [baselineActs, narrative],
  )
  const steps = useMemo<StageStep[]>(
    () => [
      ...acts.flatMap((act, actIndex) => [
        { id: act.act.id, actIndex, beatIndex: null },
        ...act.beats.map((beat, beatIndex) => ({
          id: `home-${act.act.id}-${beat.id}`,
          actIndex,
          beatIndex,
        })),
        ...(act.act.closer ? [{ id: `home-${act.act.id}-closer`, actIndex, beatIndex: null, closer: true }] : []),
      ]),
      ...(promo ? [{ id: 'home-acts-outro', actIndex: acts.length - 1, beatIndex: null, outro: true }] : []),
    ],
    [acts, promo],
  )
  const rootRef = useRef<HTMLElement>(null)
  const activeIndexRef = useRef(0)
  const visibleRef = useRef(false)
  const swipeStartRef = useRef<SwipeStart | null>(null)
  const turnTimerRef = useRef(0)
  const justDraggedRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const publishChange = useCallback((id: string, active = visibleRef.current) => {
    window.dispatchEvent(new CustomEvent<HomeActChangeDetail>(HOME_ACT_CHANGE_EVENT, {
      detail: { id, active },
    }))
  }, [])

  const goTo = useCallback((index: number, updateHash = true) => {
    if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current)
    turnTimerRef.current = 0
    setDragging(false)
    setDragX(0)
    const bounded = Math.max(0, Math.min(steps.length - 1, index))
    const previous = activeIndexRef.current
    const next = steps[bounded]
    if (!next) return
    if (bounded !== previous) {
      setDirection(bounded > previous ? 1 : -1)
      activeIndexRef.current = bounded
      setActiveIndex(bounded)
    }
    if (updateHash && window.location.hash !== `#${next.id}`) {
      window.history.replaceState(null, '', `#${next.id}`)
    }
    publishChange(next.id)
  }, [publishChange, steps])

  useEffect(() => () => {
    if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current)
  }, [])

  // 深链与右侧时间轴都能直接指定某一页；时间轴还会把整张卡带回视口。
  useEffect(() => {
    const syncHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (id === 'home-acts' || id === 'home-act-stage') {
        goTo(0, false)
        return
      }
      const index = steps.findIndex((item) => item.id === id)
      if (index >= 0) goTo(index, false)
    }
    syncHash()

    const onSelect = (event: Event) => {
      const id = (event as CustomEvent<HomeActSelectDetail>).detail?.id
      const index = steps.findIndex((item) => item.id === id)
      if (index < 0) return
      goTo(index)
      rootRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    }
    window.addEventListener('hashchange', syncHash)
    window.addEventListener(HOME_ACT_SELECT_EVENT, onSelect)
    return () => {
      window.removeEventListener('hashchange', syncHash)
      window.removeEventListener(HOME_ACT_SELECT_EVENT, onSelect)
    }
  }, [goTo, steps])

  // 卡片占据阅读焦点时，右侧时间轴的游标由当前页控制；离开后交还给正文滚动。
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting
      publishChange(steps[activeIndexRef.current]?.id ?? steps[0]?.id ?? '', entry.isIntersecting)
    }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 })
    observer.observe(root)
    return () => observer.disconnect()
  }, [publishChange, steps])

  useEffect(() => {
    activeIndexRef.current = Math.min(activeIndexRef.current, Math.max(0, steps.length - 1))
    setActiveIndex(activeIndexRef.current)
  }, [steps.length])

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const target = event.target
    if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) return
    const delta = event.key === 'ArrowRight' || event.key === 'PageDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'PageUp'
        ? -1
        : 0
    if (!delta) return
    event.preventDefault()
    goTo(activeIndexRef.current + delta)
  }

  // 鼠标和触屏都可以直接拖动书页；纵向触摸一旦被识别就完全交还页面滚动。
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('[data-page-control]')) return
    if (turnTimerRef.current) return
    swipeStartRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId, axis: null }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const start = swipeStartRef.current
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!start.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 7) {
      start.axis = Math.abs(dx) > Math.abs(dy) * 1.1 ? 'x' : 'y'
      if (start.axis === 'x') {
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
      }
    }
    if (start.axis !== 'x') return
    event.preventDefault()
    const atEdge = (dx > 0 && activeIndexRef.current === 0) ||
      (dx < 0 && activeIndexRef.current === steps.length - 1)
    // 拖动幅度按书页本身的宽度算，4K 屏上的大卡和手机上的小卡手感一致。
    const maxDrag = event.currentTarget.clientWidth * 0.3
    const offset = atEdge ? dx * 0.16 : dx
    setDragX(Math.max(-maxDrag, Math.min(maxDrag, offset)))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = swipeStartRef.current
    swipeStartRef.current = null
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
    const horizontal = start.axis === 'x' && Math.abs(dx) > Math.abs(dy) * 1.1
    const threshold = Math.max(48, Math.min(92, event.currentTarget.clientWidth * 0.085))
    const delta = dx < 0 ? 1 : -1
    const nextIndex = activeIndexRef.current + delta
    if (!horizontal || Math.abs(dx) < threshold || nextIndex < 0 || nextIndex >= steps.length) {
      setDragX(0)
      return
    }

    // 先让这一页沿手势方向滑出一小段，再挂入下一页的方向性入场动画。
    justDraggedRef.current = true
    const slideOut = event.currentTarget.clientWidth * 0.18
    setDragX(delta > 0 ? -slideOut : slideOut)
    turnTimerRef.current = window.setTimeout(() => {
      goTo(nextIndex)
      window.requestAnimationFrame(() => { justDraggedRef.current = false })
    }, TURN_OUT_MS)
  }
  const cancelPointer = () => {
    swipeStartRef.current = null
    setDragging(false)
    setDragX(0)
  }
  const onClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (!justDraggedRef.current) return
    event.preventDefault()
    event.stopPropagation()
  }

  const step = steps[activeIndex] ?? steps[0]
  const resolved = acts[step?.actIndex ?? 0]
  if (!resolved || !step) return null
  const beat = step.beatIndex == null ? null : resolved.beats[step.beatIndex] ?? null
  const closer = step.closer ? resolved.act.closer : undefined
  const outro = Boolean(step.outro)
  const intro = !beat && !closer && !outro
  const act = resolved.act
  const stepPosition = step.closer ? resolved.beats.length : step.beatIndex ?? -1
  const stepCount = resolved.beats.length + (resolved.act.closer ? 1 : 0)
  const actProgress = Math.max(0, Math.min(1, (stepPosition + 1) / (stepCount + 1)))
  const remaining = steps.length - activeIndex - 1
  const pageStyle = { '--act-color': act.color, '--page-direction': direction } as CSSProperties

  return (
    <section
      ref={rootRef}
      id="home-act-stage"
      aria-label="三幕故事，可翻页"
      aria-roledescription="翻页故事"
      onKeyDown={onKeyDown}
      className="home-act-stage relative block h-auto scroll-mt-0 overflow-hidden bg-base sm:h-[100svh]"
      style={pageStyle}
    >
      {/* 所有时间轴目标落在同一张卡的开头；具体显示哪一页由上面的事件契约处理。 */}
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden">
        {steps.map((item) => <span key={item.id} id={item.id} className="block h-px w-px" />)}
      </div>

      <div
        aria-hidden
        className="absolute inset-0 opacity-75 transition-colors duration-700"
        style={{ background: `radial-gradient(circle at 72% 44%, ${act.color}1f, transparent 38%)` }}
      />

      <div className="home-content-container home-act-frame relative flex h-auto flex-col xl:justify-center px-3 pb-3 pt-16 sm:h-full sm:px-page sm:pb-5 sm:pt-6 xl:pb-[clamp(1.5rem,3vh,2.75rem)] xl:pt-[clamp(1.75rem,3.5vh,3.5rem)] xl:pr-[clamp(8rem,10vw,12rem)]">
        <div
          className={`home-act-deck relative h-[clamp(28rem,145vw,40rem)] flex-none select-none sm:h-auto sm:min-h-0 sm:flex-1 ${dragging ? 'is-dragging cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={cancelPointer}
          onClickCapture={onClickCapture}
          onDragStart={(event) => event.preventDefault()}
        >
          {[3, 2, 1].map((depth) => (
            <span
              key={depth}
              aria-hidden
              className={`home-act-deck__sheet absolute inset-0 rounded-[clamp(1.15rem,1.8vw,2rem)] border bg-surface ${depth === 1 ? 'home-act-deck__sheet--next' : ''}`}
              style={{
                opacity: remaining >= depth ? 0.7 - depth * 0.12 : 0,
                transform: `translate3d(calc(${depth * 0.7}rem + ${dragX * -0.025}px), ${depth * 0.42}rem, 0) rotate(${depth * 0.24}deg)`,
              }}
            />
          ))}

          {remaining > 0 && (
            <button
              type="button"
              data-page-control
              onClick={() => goTo(activeIndex + 1)}
              className="home-act-stack-next absolute left-full z-[5] hidden sm:block"
              aria-label={`点击右下方区域翻到第 ${activeIndex + 2} 页`}
            />
          )}

          <div
            key={step.id}
            className="home-act-page-enter relative z-[4] grid h-full min-h-0 grid-cols-1 content-start gap-4 overflow-y-auto rounded-[clamp(1.15rem,1.8vw,2rem)] border border-line/90 bg-surface/95 px-[clamp(1rem,4vw,5rem)] py-4 shadow-[0_2.5rem_8rem_rgba(0,0,0,0.34)] sm:gap-5 sm:py-[clamp(1rem,3.5vh,3.5rem)] xl:grid-cols-[minmax(18rem,0.76fr)_minmax(0,1.24fr)] xl:content-normal xl:items-center xl:gap-[clamp(2.5rem,5vw,7rem)] xl:overflow-hidden"
            style={{
              transform: dragX ? `translate3d(${dragX * 0.22}px, 0, 0) rotateY(${dragX * -0.018}deg)` : undefined,
              transformOrigin: dragX < 0 ? 'left center' : 'right center',
              transition: dragging ? 'none' : dragX ? `transform ${TURN_OUT_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${TURN_OUT_MS}ms ease` : undefined,
              opacity: dragX && !dragging ? 0.72 : 1,
            }}
          >
            {outro && promo ? (
              <div className="col-span-1 max-h-none overflow-visible pr-1 xl:col-span-2 xl:max-h-full xl:overflow-y-auto">
                <HomeExplorePromo data={promo} variant="stage" />
              </div>
            ) : (
              <>
                <div className="min-w-0 border-b border-line/60 pb-4 xl:border-b-0 xl:pb-0">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-meta tracking-[0.2em]" style={{ color: act.color }}>{act.kicker}</span>
                    <span className="h-px flex-1 bg-line/70" />
                  </div>
                  <p className="mt-3 font-mono text-meta text-faint tnum xl:mt-5">{act.years}</p>
                  <h2 className="mt-2 text-[clamp(1.75rem,8vw,5.75rem)] font-black leading-[0.98] tracking-[-0.04em] text-ink xl:mt-3 xl:text-[clamp(2.5rem,4.2vw,5.75rem)] xl:leading-[0.95]">
                    {act.title}
                  </h2>
                  {!intro && (
                    <div className="measure-body mt-3 space-y-2 xl:mt-6">
                      {act.body.map((line) => <p key={line} className="text-body text-muted">{line}</p>)}
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-4 xl:mt-9">
                    <span className="font-mono text-meta text-faint tnum">
                      {String(stepPosition + 2).padStart(2, '0')} / {String(stepCount + 1).padStart(2, '0')}
                    </span>
                    <span className="relative h-px flex-1 overflow-hidden bg-line/70">
                      <span className="absolute inset-y-0 left-0 origin-left bg-current transition-transform duration-500" style={{ color: act.color, transform: `scaleX(${actProgress})` }} />
                    </span>
                  </div>
                </div>

                <div className="min-h-0 min-w-0 max-h-none overflow-visible pr-1 xl:max-h-full xl:overflow-y-auto">
                  {beat ? (
                    <StageBeat beat={beat} color={act.color} />
                  ) : closer ? (
                    <StageCloser line={closer.line} />
                  ) : (
                    <div className="flex min-h-[min(34svh,18rem)] flex-col justify-center border-y border-line/70 py-6 xl:min-h-[52cqh] xl:py-10">
                      <div className="measure-hero space-y-3">
                        {(act.body.length > 0 ? act.body : [act.title]).map((line) => (
                          <p key={line} className="text-h2 font-semibold text-ink">{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            data-page-control
            disabled={activeIndex === 0}
            onClick={() => goTo(activeIndex - 1)}
            className="home-act-page-corner home-act-page-corner--prev absolute bottom-0 left-0 z-[8] disabled:pointer-events-none disabled:opacity-0"
            aria-label="翻到上一页"
          />
          <button
            type="button"
            data-page-control
            disabled={activeIndex === steps.length - 1}
            onClick={() => goTo(activeIndex + 1)}
            className="home-act-page-corner home-act-page-corner--next absolute bottom-0 right-0 z-[8] disabled:pointer-events-none disabled:opacity-0"
            aria-label="翻到下一页"
          />
        </div>

        <div data-page-control className="relative z-10 mt-2 flex shrink-0 items-center gap-3 sm:mt-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-0.5 sm:gap-1" aria-label={`第 ${activeIndex + 1} 页，共 ${steps.length} 页`}>
              {steps.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(index)}
                  className="group flex h-[clamp(1.5rem,1.3cqw,2.25rem)] min-w-0 flex-1 items-center"
                  aria-label={`第 ${index + 1} 页`}
                  aria-current={index === activeIndex ? 'step' : undefined}
                >
                  <span
                    className="block h-px w-full origin-left transition-[height,opacity,transform] duration-300 group-hover:h-0.5"
                    style={{
                      background: index <= activeIndex ? act.color : '#2C3140',
                      opacity: index === activeIndex ? 1 : index < activeIndex ? 0.55 : 0.9,
                      transform: index === activeIndex ? 'scaleY(2)' : undefined,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
          <span className="shrink-0 font-mono text-meta text-faint tnum" aria-live="polite">
            {String(activeIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
          </span>

          {(promo
            ? outro
            : step.actIndex === acts.length - 1 && (step.closer || (!resolved.act.closer && step.beatIndex === resolved.beats.length - 1))) && (
            <Link href="/archive/" prefetch={false} className="ui-press ml-1 shrink-0 rounded-full border border-line bg-surface/80 px-3 py-2 text-meta text-ink sm:px-5">
              {now.year}，{now.label} · {now.count.toLocaleString()} 条 →
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

/** 幕尾与幕首共用同一张纯文字页版式：一句收束，不额外加标签或尾标。 */
function StageCloser({ line }: { line: string }) {
  return (
    <div className="flex min-h-[min(34svh,18rem)] flex-col justify-center border-y border-line/70 py-6 xl:min-h-[52cqh] xl:py-10">
      <h3 className="measure-hero text-h2 font-semibold text-ink">{line}</h3>
    </div>
  )
}

function StageBeat({ beat, color }: { beat: ResolvedBeat; color: string }) {
  const body = (
    <article className="home-act-stage-beat grid min-h-[min(42svh,24rem)] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[clamp(1rem,1.5vw,1.75rem)] border border-line/80 bg-base/35 shadow-[0_2rem_7rem_rgba(0,0,0,0.22)] xl:min-h-[56cqh]">
      <div className={`relative min-h-0 overflow-hidden ${beat.coverAspect === 'video' ? 'aspect-video shrink-0' : ''}`}>
        {beat.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={beat.cover} alt="" className="h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-[1.025] group-hover:opacity-100" referrerPolicy="no-referrer" />
        ) : beat.montage?.samples.length ? (
          <div className="grid h-full grid-cols-3 gap-px bg-line/50">
            {beat.montage.samples.slice(0, 6).map((sample) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={sample.id} src={sample.cover} alt="" className="h-full min-h-0 w-full object-cover opacity-75" referrerPolicy="no-referrer" />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[min(24svh,15rem)] items-center justify-center xl:min-h-[31cqh]" style={{ background: `linear-gradient(145deg, ${color}22, transparent 64%)` }}>
            <span className="font-display text-[clamp(4rem,9vw,11rem)] font-black leading-none opacity-20 tnum" style={{ color }}>{beat.emphasis ?? beat.date}</span>
          </div>
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-base via-base/15 to-transparent" />
      </div>
      <div className="home-act-stage-beat__copy relative p-[clamp(1.25rem,2vw,2.5rem)]">
        <div className="flex flex-wrap items-center gap-3 font-mono text-meta tnum">
          <span style={{ color }}>{beat.date}</span>
          {beat.kicker && <span className="rounded-full border border-current/30 px-2 py-0.5" style={{ color }}>{beat.kicker}</span>}
        </div>
        <h3 className="mt-3 text-h2 font-bold text-ink">{beat.title}</h3>
        {beat.body && <p className="measure-body mt-3 text-body text-muted">{beat.body}</p>}
        {beat.emphasis && <p className="mt-4 font-mono text-control tracking-[0.12em]" style={{ color }}>{beat.emphasis}</p>}
      </div>
    </article>
  )

  return beat.href ? (
    <Link
      href={beat.href}
      prefetch={false}
      target={beat.external ? '_blank' : undefined}
      rel={beat.external ? 'noreferrer' : undefined}
      {...contentOpenProps(beat.href)}
      className="group block"
    >
      {body}
    </Link>
  ) : <div className="group">{body}</div>
}
