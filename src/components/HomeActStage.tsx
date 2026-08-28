'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ResolvedAct, ResolvedBeat } from '@/lib/narrative'
import { applyLiveActs } from '@/lib/live-content'
import { useLiveContent } from './LiveContentProvider'

type StageStep = {
  id: string
  actIndex: number
  beatIndex: number | null
  /** 幕尾收束：和事件卡一样占据桌面舞台的一步。 */
  closer?: boolean
}

const STEP_DISTANCE_SVH = 32
/** 自己驱动的翻页动画时长；结束时间可预测，不像 scroll-behavior:smooth 那样不可知。 */
const STEP_SCROLL_MS = 420
/** 动画落位后的短冷却，避免最后一帧的滚动事件立刻触发下一页。 */
const STEP_COOLDOWN_MS = 90
/** 两次滚轮事件间隔超过它就算新手势：新手势第一笔输入立刻翻一页。 */
const WHEEL_GESTURE_GAP_MS = 140
/** 同一手势里想再翻一页，需要继续滚出的额外距离（滤掉触控板惯性尾巴）。 */
const WHEEL_REPEAT_DELTA = 90
/** 判定舞台是否满屏时的容差，避免亚像素误差让接管时断时续。 */
const STAGE_EDGE_TOLERANCE = 4

/** 把不同 deltaMode 的滚轮事件折算成像素。 */
function wheelPixels(event: WheelEvent) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return Math.abs(event.deltaY) * 16
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return Math.abs(event.deltaY) * window.innerHeight
  return Math.abs(event.deltaY)
}

/**
 * PC 首页三幕共用一个 100svh 的 sticky 舞台。
 * 舞台内把一次明确的滚轮 / 触控板手势映射为一页；到达首尾后恢复原生滚动离开舞台。
 */
export function HomeActStage({
  acts: baselineActs,
  now,
}: {
  acts: ResolvedAct[]
  now: { year: string; label: string; count: number }
}) {
  const { narrative } = useLiveContent()
  const acts = applyLiveActs(baselineActs, narrative?.homeActs, true, narrative?.deletedIds ?? [])
  const rootRef = useRef<HTMLElement>(null)
  const steps = useMemo<StageStep[]>(
    () => acts.flatMap((act, actIndex) => [
      { id: act.act.id, actIndex, beatIndex: null },
      ...act.beats.map((beat, beatIndex) => ({
        id: `home-${act.act.id}-${beat.id}`,
        actIndex,
        beatIndex,
      })),
      ...(act.act.closer ? [{ id: `home-${act.act.id}-closer`, actIndex, beatIndex: null, closer: true }] : []),
    ]),
    [acts],
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const stickyRef = useRef<HTMLDivElement>(null)
  // 翻页动画自己跑 rAF：知道什么时候开始、什么时候结束，
  // 动画期间滚动位置由我们写入，不再反过来推导状态（否则中间步会被一路重挂载而闪屏）。
  const animRef = useRef<{ raf: number } | null>(null)
  // 冷却截止时间。只在发起翻页时写一次，不会被后续滚轮事件不断延长
  // ——旧实现每来一个惯性事件就把锁往后推 240ms，连续滚鼠标滚轮时锁永远不过期，
  //   于是「狂滚也不翻页，停手才翻一页」。
  const gateUntilRef = useRef(0)
  const wheelRef = useRef({ accum: 0, peak: 0, direction: 0, lastAt: 0, stepped: false })

  const setActive = useCallback((index: number) => {
    if (activeIndexRef.current === index) return
    activeIndexRef.current = index
    setActiveIndex(index)
  }, [])

  /** 舞台的滚动几何：sticky 可推进的总距离 / 每一步的距离。 */
  const readMetrics = useCallback(() => {
    const root = rootRef.current
    const sticky = stickyRef.current
    if (!root || !sticky) return null
    const travel = root.offsetHeight - sticky.offsetHeight
    const span = steps.length > 1 ? travel / (steps.length - 1) : 0
    return { top: root.getBoundingClientRect().top + window.scrollY, span }
  }, [steps.length])

  // 位置直接由滚动距离算出：每一步固定 STEP_DISTANCE_SVH，
  // 一次滚动跨过多少距离就前进多少步，不会漏也不会一次跳两层。
  // （旧实现用 IntersectionObserver 观察 6vh 宽的判定带，标记点常常整帧掠过
  //   判定带不被上报，于是卡一层、再跳两层。）
  useEffect(() => {
    const root = rootRef.current
    const sticky = stickyRef.current
    if (!root || !sticky) return

    let raf = 0
    let span = 0
    const measure = () => {
      const travel = root.offsetHeight - sticky.offsetHeight
      span = steps.length > 1 ? travel / (steps.length - 1) : 0
    }
    const sync = () => {
      if (span <= 0) return
      // 动画期间的滚动是我们自己写的，交给动画收尾时统一定位。
      if (animRef.current) return
      const offset = -root.getBoundingClientRect().top
      const index = Math.round(offset / span)
      setActive(Math.max(0, Math.min(steps.length - 1, index)))
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(sync)
    }
    const onResize = () => {
      measure()
      onScroll()
    }

    measure()
    sync()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [setActive, steps.length])

  const step = steps[activeIndex] ?? steps[0]
  const resolved = acts[step?.actIndex ?? 0]
  const beat = step?.beatIndex == null ? null : resolved?.beats[step.beatIndex] ?? null
  const closer = step?.closer ? resolved?.act.closer : undefined
  const intro = !beat && !closer
  const stepPosition = step?.closer ? resolved?.beats.length ?? 0 : step?.beatIndex ?? -1
  const stepCount = resolved ? resolved.beats.length + (resolved.act.closer ? 1 : 0) : 0
  const actProgress = resolved
    ? Math.max(0, Math.min(1, (stepPosition + 1) / (stepCount + 1)))
    : 0

  const stopAnimation = useCallback(() => {
    const anim = animRef.current
    if (!anim) return
    cancelAnimationFrame(anim.raf)
    animRef.current = null
  }, [])

  useEffect(() => stopAnimation, [stopAnimation])

  /**
   * 跳到第 index 步：滚到该步对应的精确位置。
   * 动画由自己的 rAF 驱动，落位时间确定，冷却窗口也就确定；
   * 状态在发起时立刻更新，滚动结束后再按真实位置对一次账，两边不会各说各话。
   */
  const jumpTo = useCallback((index: number) => {
    const metrics = readMetrics()
    if (!metrics || metrics.span <= 0) return
    const bounded = Math.max(0, Math.min(steps.length - 1, index))
    const to = Math.round(metrics.top + bounded * metrics.span)
    const from = window.scrollY
    setActive(bounded)
    stopAnimation()

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const distance = to - from
    // 全站 html 上有 scroll-behavior:smooth，逐帧写位置必须显式 instant，
    // 否则每一帧都会被浏览器再包一层平滑动画，自己的动画永远追不上目标。
    const setScroll = (y: number) => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior })

    if (reduceMotion || Math.abs(distance) < 2) {
      setScroll(to)
      gateUntilRef.current = performance.now() + STEP_COOLDOWN_MS
      return
    }

    const start = performance.now()
    gateUntilRef.current = start + STEP_SCROLL_MS + STEP_COOLDOWN_MS
    const tick = (frameAt: number) => {
      const progress = Math.min(1, (frameAt - start) / STEP_SCROLL_MS)
      const eased = 1 - (1 - progress) ** 3
      setScroll(Math.round(from + distance * eased))
      if (progress < 1) {
        animRef.current = { raf: requestAnimationFrame(tick) }
        return
      }
      animRef.current = null
      gateUntilRef.current = performance.now() + STEP_COOLDOWN_MS
    }
    animRef.current = { raf: requestAnimationFrame(tick) }
  }, [readMetrics, setActive, stopAnimation, steps.length])

  /** 舞台完整占据视口时才接管翻页；离开舞台后恢复普通页面行为。 */
  const isStageActive = useCallback(() => {
    const root = rootRef.current
    const sticky = stickyRef.current
    if (!root || !sticky) return false
    // xl 以下桌面舞台会被 CSS 隐藏，但组件和 window wheel 监听仍然挂载。
    // display:none 的 root / sticky 尺寸都是 0；若继续走边界判断，0 会被
    // 误认为完整覆盖视口，导致隐藏舞台吞掉移动版页面的全部滚轮输入。
    if (root.offsetHeight <= 0 || sticky.offsetHeight <= 0) return false
    const rect = root.getBoundingClientRect()
    return rect.top <= STAGE_EDGE_TOLERANCE && rect.bottom >= sticky.offsetHeight - STAGE_EDGE_TOLERANCE
  }, [])

  /**
   * 一个手势 = 一页。新手势的第一笔纵向输入立刻翻页；
   * 翻页动画期间的输入一律吞掉（不延长冷却），动画一结束就能接受下一次滚动。
   * 在捕获阶段监听，覆盖右侧轨道、底部按钮等固定浮层，不让手势漏掉。
   */
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const state = wheelRef.current
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) return
      if (!isStageActive()) {
        state.accum = 0
        state.peak = 0
        state.stepped = false
        state.lastAt = performance.now()
        return
      }

      const now = performance.now()
      const direction = event.deltaY > 0 ? 1 : -1
      const magnitude = wheelPixels(event)
      if (now - state.lastAt > WHEEL_GESTURE_GAP_MS || state.direction !== direction) {
        state.accum = 0
        state.peak = 0
        state.stepped = false
      }
      state.lastAt = now
      state.direction = direction
      state.accum += magnitude
      state.peak = Math.max(state.peak, magnitude)

      // 已经在首/尾还继续往外滚：交还给原生滚动，正常离开舞台。
      const current = activeIndexRef.current
      if ((direction < 0 && current === 0) || (direction > 0 && current === steps.length - 1)) {
        stopAnimation()
        return
      }

      event.preventDefault()
      if (now < gateUntilRef.current) return
      // 同一手势内要再翻一页，必须是「还在用力滚」而不是触控板的惯性尾巴：
      // 惯性的 delta 逐帧衰减，真滚轮的每一格幅度基本不变。
      if (state.stepped && (state.accum < WHEEL_REPEAT_DELTA || magnitude < state.peak * 0.6)) return

      state.accum = 0
      state.stepped = true
      jumpTo(current + direction)
    }

    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', onWheel, { capture: true })
  }, [isStageActive, jumpTo, stopAnimation, steps.length])

  /** 左右键不要求先聚焦舞台；只要桌面 ACT 正在视口中就能翻页。 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isStageActive() || event.altKey || event.ctrlKey || event.metaKey) return
      // 按住不放时按动画节奏连续翻；单次按键永远即时响应（可以连点快速翻多页）。
      if (event.repeat && performance.now() < gateUntilRef.current) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) return
      const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (!direction) return
      event.preventDefault()
      jumpTo(activeIndexRef.current + direction)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isStageActive, jumpTo])

  if (!resolved) return null
  const act = resolved.act

  return (
    <section
      ref={rootRef}
      aria-label="三幕故事"
      className="relative hidden border-t border-line xl:block"
      style={{ height: `calc(100svh + ${(steps.length - 1) * STEP_DISTANCE_SVH}svh)` }}
    >
      <div ref={stickyRef} className="sticky top-0 h-[100svh] overflow-hidden bg-base">
        <div
          aria-hidden
          className="absolute inset-0 opacity-70 transition-colors duration-700"
          style={{ background: `radial-gradient(circle at 68% 48%, ${act.color}16, transparent 36%)` }}
        />
        <div className="home-content-container relative grid h-full grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)] items-center gap-[clamp(3rem,6vw,8rem)] px-page py-[clamp(4.5rem,8vh,7rem)] pr-[clamp(8rem,10vw,12rem)]">
          <div key={`act-${act.id}`} className="home-act-stage-enter min-w-0">
            <div className="flex items-center gap-4">
              <span className="font-mono text-meta tracking-[0.2em]" style={{ color: act.color }}>{act.kicker}</span>
              <span className="h-px flex-1 bg-line/70" />
            </div>
            <p className="mt-5 font-mono text-meta text-faint tnum">{act.years}</p>
            <h2 className="mt-3 text-[clamp(2.75rem,4.6vw,6.5rem)] font-black leading-[0.95] tracking-[-0.04em] text-ink">
              {act.title}
            </h2>
            {!intro && (
              <div className="measure-body mt-6 space-y-2">
                {act.body.map((line) => <p key={line} className="text-body text-muted">{line}</p>)}
              </div>
            )}
            <div className="mt-9 flex items-center gap-4">
              <span className="font-mono text-meta text-faint tnum">
                {String(stepPosition + 2).padStart(2, '0')} / {String(stepCount + 1).padStart(2, '0')}
              </span>
              <span className="relative h-px flex-1 overflow-hidden bg-line/70">
                <span className="absolute inset-y-0 left-0 origin-left bg-current transition-transform duration-500" style={{ color: act.color, transform: `scaleX(${actProgress})` }} />
              </span>
            </div>
          </div>

          <div className="relative min-h-0 min-w-0">
            <div key={step?.id} className="home-act-stage-enter">
              {beat ? (
                <StageBeat beat={beat} color={act.color} />
              ) : closer ? (
                <StageCloser line={closer.line} />
              ) : (
                <div className="flex min-h-[48svh] flex-col justify-center border-y border-line/70 py-10">
                  <div className="measure-hero space-y-3">
                    {(act.body.length > 0 ? act.body : [act.title]).map((line) => (
                      <p key={line} className="text-h2 font-semibold text-ink">{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-[clamp(1.5rem,3vh,3rem)] left-1/2 flex -translate-x-1/2 items-center gap-3">
          <button type="button" onClick={() => jumpTo(activeIndex - 1)} disabled={activeIndex === 0} className="ui-press rounded-full border border-line bg-surface/70 px-4 py-2 text-meta text-muted disabled:opacity-25" aria-label="上一个节点">←</button>
          <span className="font-mono text-meta text-faint tnum">SCROLL · {activeIndex + 1}/{steps.length}</span>
          <button type="button" onClick={() => jumpTo(activeIndex + 1)} disabled={activeIndex === steps.length - 1} className="ui-press rounded-full border border-line bg-surface/70 px-4 py-2 text-meta text-muted disabled:opacity-25" aria-label="下一个节点">→</button>
        </div>

        {step?.actIndex === acts.length - 1 && (step.closer || (!resolved.act.closer && step.beatIndex === resolved.beats.length - 1)) && (
          <Link href="/archive/" className="ui-press absolute bottom-[clamp(1.5rem,3vh,3rem)] right-[clamp(8rem,10vw,12rem)] rounded-full border border-line bg-surface/70 px-5 py-2 text-meta text-ink">
            {now.year}，{now.label} · {now.count.toLocaleString()} 条 →
          </Link>
        )}
      </div>

      {/* 锚点只负责把原生滚动距离映射到舞台状态，不占视觉空间。 */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {steps.map((item, index) => (
          <span
            key={item.id}
            id={item.id}
            className="absolute left-0 h-px w-px scroll-mt-0"
            style={{ top: `${index * STEP_DISTANCE_SVH}svh` }}
          />
        ))}
      </div>
    </section>
  )
}

/** 幕尾与幕首共用同一张纯文字页版式：一句收束，不额外加标签或尾标。 */
function StageCloser({ line }: { line: string }) {
  return (
    <div className="flex min-h-[48svh] flex-col justify-center border-y border-line/70 py-10">
      <h3 className="measure-hero text-h2 font-semibold text-ink">{line}</h3>
    </div>
  )
}

function StageBeat({ beat, color }: { beat: ResolvedBeat; color: string }) {
  const body = (
    <article className="grid min-h-[54svh] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[clamp(1rem,1.5vw,1.75rem)] border border-line/80 bg-surface/35 shadow-[0_2rem_7rem_rgba(0,0,0,0.22)]">
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
          <div className="flex h-full min-h-[30svh] items-center justify-center" style={{ background: `linear-gradient(145deg, ${color}22, transparent 64%)` }}>
            <span className="font-display text-[clamp(4rem,9vw,11rem)] font-black leading-none opacity-20 tnum" style={{ color }}>{beat.emphasis ?? beat.date}</span>
          </div>
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-base via-base/15 to-transparent" />
      </div>
      <div className="relative p-[clamp(1.5rem,2.4vw,3rem)]">
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
    <Link href={beat.href} target={beat.external ? '_blank' : undefined} rel={beat.external ? 'noreferrer' : undefined} className="group block">
      {body}
    </Link>
  ) : <div className="group">{body}</div>
}
