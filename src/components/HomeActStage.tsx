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
  /** 按下时刻，用来识别短而快的甩动。 */
  t: number
  touch: boolean
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
  // 手指拖动时书页要明显跟手；鼠标保持原来较克制的位移。
  const [dragFollow, setDragFollow] = useState(0.22)

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

  // 横向拖过之后吞掉紧跟的一次 click：没翻成页时，手指也可能正好停在卡内链接上。
  const suppressNextClick = () => {
    justDraggedRef.current = true
    window.setTimeout(() => { justDraggedRef.current = false }, 400)
  }

  // 鼠标和触屏都可以直接拖动书页；纵向触摸一旦被识别就完全交还页面滚动。
  // 页角按钮也能作为滑动起点——手机上两个页角占了卡片底边一半以上的宽度。
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('[data-page-control]')) return
    if (turnTimerRef.current) return
    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      axis: null,
      t: event.timeStamp,
      touch: event.pointerType !== 'mouse',
    }
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
        setDragFollow(start.touch ? 0.6 : 0.22)
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
    if (start.axis === 'x') suppressNextClick()
    const horizontal = start.axis === 'x' && Math.abs(dx) > Math.abs(dy) * 1.1
    const width = event.currentTarget.clientWidth
    // 触屏的翻页距离按卡宽的一成算；另外短促的甩动即使没拖够距离也算翻页。
    const threshold = start.touch
      ? Math.max(36, Math.min(64, width * 0.1))
      : Math.max(48, Math.min(92, width * 0.085))
    const flick = Math.abs(dx) >= 24 && event.timeStamp - start.t < 300
    const delta = dx < 0 ? 1 : -1
    const nextIndex = activeIndexRef.current + delta
    if (!horizontal || (Math.abs(dx) < threshold && !flick) || nextIndex < 0 || nextIndex >= steps.length) {
      setDragX(0)
      return
    }

    // 先让这一页沿手势方向滑出一小段，再挂入下一页的方向性入场动画。
    const slideOut = width * 0.18
    setDragX(delta > 0 ? -slideOut : slideOut)
    turnTimerRef.current = window.setTimeout(() => goTo(nextIndex), TURN_OUT_MS)
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
        className="absolute inset-0 opacity-70 transition-colors duration-700"
        style={{ background: `radial-gradient(circle at 68% 48%, ${act.color}16, transparent 36%)` }}
      />

      {/* 左右与导航、下面各节同一条页边距；顶部让开 lg 以下悬浮的菜单胶囊，底部留出与下一节的呼吸。
          xl 起左沿按版心反推（大屏上版心封顶居中），右沿贴近时间轴。 */}
      <div className="home-content-container home-act-frame relative flex h-auto flex-col px-page pb-[clamp(2.5rem,12vw,4rem)] pt-16 sm:h-full sm:pb-5 xl:max-w-none xl:pl-[var(--home-act-inset)] xl:pr-[var(--home-act-gutter)] xl:pb-[clamp(1.5rem,3vh,2.75rem)] xl:pt-[clamp(1.75rem,3.5vh,3.5rem)]">
        {/* 各尺寸同一个结构：幕名 / 标题 / 进度直接落在页面上，只随翻页自动换；那张卡才是一叠可翻的纸。
            xl 起左右并排（旧版版式），以下上下排列。 */}
        <div className="flex flex-col gap-4 sm:min-h-0 sm:flex-1 sm:gap-5 xl:grid xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)] xl:grid-rows-[minmax(0,1fr)] xl:items-center xl:gap-[clamp(3rem,6vw,8rem)]">
        {!outro && (
          <div className="min-w-0 flex-none">
            <div key={`act-${act.id}`} className="home-act-side-enter">
              <ActHeader act={act} intro={intro} stepPosition={stepPosition} stepCount={stepCount} actProgress={actProgress} />
            </div>
          </div>
        )}
        {/* 卡片尺寸：手机按 4:5；平板填满 100svh 里剩下的高度；xl 在右栏按 20:17、不超过可用高度。
            最后一页“接着往下看”是整个故事的收尾：不挂页眉，桌面端横跨两栏整张铺开，手机上高度随内容；
            仍是同一张书页，拖拽、左下页角、键盘都能翻回上一页。 */}
        <div
          className={`home-act-deck relative w-full select-none sm:min-h-0 sm:flex-1 sm:aspect-auto xl:max-h-full ${outro ? 'max-sm:[container-type:inline-size] xl:col-span-2 xl:h-full' : 'aspect-[4/5] xl:col-start-2 xl:aspect-[20/17]'} ${dragging ? 'is-dragging cursor-grabbing' : 'cursor-grab'}`}
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
              className={`home-act-deck__sheet absolute inset-0 rounded-[clamp(1.15rem,1.8vw,2rem)] border bg-[color:var(--home-act-card)] ${depth === 1 ? 'home-act-deck__sheet--next' : ''}`}
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

          {/* 这张卡本身就是事件卡：封面铺满上部、文字在下，不再卡中套卡。
              封面吃掉正文用剩的高度，文字永远完整显示，卡内不出现第二层纵向滚动去和翻页手势抢。 */}
          <div
            key={step.id}
            className="home-act-page-enter relative z-[4] h-full min-h-0 overflow-hidden rounded-[clamp(1.15rem,1.8vw,2rem)] border border-line/80 bg-[color:var(--home-act-card)] shadow-[0_2.5rem_8rem_rgba(0,0,0,0.34)]"
            style={{
              transform: dragX ? `translate3d(${dragX * dragFollow}px, 0, 0) rotateY(${dragX * -0.018}deg)` : undefined,
              transformOrigin: dragX < 0 ? 'left center' : 'right center',
              transition: dragging ? 'none' : dragX ? `transform ${TURN_OUT_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${TURN_OUT_MS}ms ease` : undefined,
              opacity: dragX && !dragging ? 0.72 : 1,
            }}
          >
            {outro && promo ? (
              <div className="flex h-full flex-col justify-center p-[clamp(1rem,4cqw,3.5rem)]">
                <HomeExplorePromo data={promo} variant="stage" />
              </div>
            ) : beat ? (
              <StageBeat beat={beat} color={act.color} />
            ) : closer ? (
              <StageCloser line={closer.line} />
            ) : (
              <div className={TEXT_PAGE_CLASS}>
                <div className="measure-hero space-y-3">
                  {(act.body.length > 0 ? act.body : [act.title]).map((line) => (
                    <p key={line} className="text-h2 font-semibold text-ink">{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => goTo(activeIndex - 1)}
            className="home-act-page-corner home-act-page-corner--prev absolute bottom-0 left-0 z-[8] disabled:pointer-events-none disabled:opacity-0"
            aria-label="翻到上一页"
          />
          <button
            type="button"
            disabled={activeIndex === steps.length - 1}
            onClick={() => goTo(activeIndex + 1)}
            className="home-act-page-corner home-act-page-corner--next absolute bottom-0 right-0 z-[8] disabled:pointer-events-none disabled:opacity-0"
            aria-label="翻到下一页"
          />
        </div>
        </div>

        <div data-page-control className="relative z-10 mt-2 flex shrink-0 items-center gap-3 sm:mt-3">
          {/* 页码条从 sm 起才出现，且压低存在感，悬停或键盘聚焦时才亮起；
              手机上靠滑动和页角翻页，只留右侧的页码数字。 */}
          <div className="hidden min-w-0 flex-1 opacity-40 transition-opacity duration-300 focus-within:opacity-100 hover:opacity-100 sm:block">
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
          <span className="ml-auto shrink-0 font-mono text-meta text-faint tnum" aria-live="polite">
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

/**
 * 幕名、年份、幕内进度：直接落在页面上，只跟着卡片的翻页自动更新。
 * xl 起在左栏、按旧版字号；以下在卡片上方，字号随屏宽收小。
 */
function ActHeader({
  act,
  intro,
  stepPosition,
  stepCount,
  actProgress,
}: {
  act: ResolvedAct['act']
  intro: boolean
  stepPosition: number
  stepCount: number
  actProgress: number
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-4">
        <span className="font-mono text-meta tracking-[0.2em]" style={{ color: act.color }}>{act.kicker}</span>
        <span className="h-px flex-1 bg-line/70" />
      </div>
      <p className="mt-3 font-mono text-meta text-faint tnum xl:mt-5">{act.years}</p>
      <h2 className="mt-2 text-[clamp(1.75rem,7.5vw,3.5rem)] font-black leading-[0.98] tracking-[-0.04em] text-ink xl:mt-3 xl:text-[clamp(2.75rem,4.6vw,6.5rem)] xl:leading-[0.95]">
        {act.title}
      </h2>
      {/* 这段幕简介在幕首页已经大字出现过；窄屏上每张事件页再重复一遍只会把卡片挤小，只在 xl 左栏保留。 */}
      {!intro && (
        <div className="measure-body mt-6 hidden space-y-2 xl:block">
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
  )
}

/** 纯文字页（幕首 / 幕尾）：和事件卡同一张卡，文字居中铺开，留白按卡片尺寸算。 */
const TEXT_PAGE_CLASS = 'home-act-text-card flex h-full flex-col justify-center px-[clamp(1.5rem,7cqw,5.5rem)] py-[clamp(1.5rem,8cqh,5rem)]'

/** 幕尾与幕首共用同一张纯文字页版式：一句收束，不额外加标签或尾标。 */
function StageCloser({ line }: { line: string }) {
  return (
    <div className={TEXT_PAGE_CLASS}>
      <h3 className="measure-hero text-h2 font-semibold text-ink">{line}</h3>
    </div>
  )
}

function StageBeat({ beat, color }: { beat: ResolvedBeat; color: string }) {
  const body = (
    <article className="home-act-stage-beat grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
      {/* 封面不锁 16:9：正文用剩的高度都给它，只保底卡高的两成；object-cover 让它缩放时只是裁切。 */}
      <div className="relative min-h-[20cqh] overflow-hidden">
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
          <div className="flex h-full items-center justify-center" style={{ background: `linear-gradient(145deg, ${color}22, transparent 64%)` }}>
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
      className="group block h-full"
    >
      {body}
    </Link>
  ) : <div className="group h-full">{body}</div>
}
