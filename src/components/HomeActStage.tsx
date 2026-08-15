'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ResolvedAct, ResolvedBeat } from '@/lib/narrative'
import { applyLiveActs } from '@/lib/live-content'
import { useLiveContent } from './LiveContentProvider'

type StageStep = {
  id: string
  actIndex: number
  beatIndex: number | null
}

const STEP_DISTANCE_SVH = 46

/**
 * PC 首页三幕共用一个 100svh 的 sticky 舞台。
 * 文档滚动仍是原生滚动，只把纵向距离映射成幕与事件的切换，不劫持滚轮。
 */
export function HomeActStage({
  acts: baselineActs,
  now,
}: {
  acts: ResolvedAct[]
  now: { year: string; label: string; count: number }
}) {
  const { narrative } = useLiveContent()
  const acts = applyLiveActs(baselineActs, narrative?.homeActs, true)
  const rootRef = useRef<HTMLElement>(null)
  const steps = useMemo<StageStep[]>(
    () => acts.flatMap((act, actIndex) => [
      { id: act.act.id, actIndex, beatIndex: null },
      ...act.beats.map((beat, beatIndex) => ({
        id: `home-${act.act.id}-${beat.id}`,
        actIndex,
        beatIndex,
      })),
    ]),
    [acts],
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)

  useEffect(() => {
    const setActive = (index: number) => {
      if (activeIndexRef.current === index) return
      activeIndexRef.current = index
      setActiveIndex(index)
    }
    const initialActive = () => {
      const focusY = window.innerHeight * 0.46
      let current = 0
      for (let index = 0; index < steps.length; index += 1) {
        const marker = document.getElementById(steps[index].id)
        if (!marker) continue
        if (marker.getBoundingClientRect().top <= focusY) current = index
        else break
      }
      setActive(current)
    }
    const indexById = new Map(steps.map((step, index) => [step.id, index]))
    const observer = new IntersectionObserver((observations) => {
      for (const observation of observations) {
        if (!observation.isIntersecting) continue
        const index = indexById.get(observation.target.id)
        if (index !== undefined) setActive(index)
      }
    }, { rootMargin: '-45% 0px -49% 0px', threshold: 0 })
    for (const step of steps) {
      const marker = document.getElementById(step.id)
      if (marker) observer.observe(marker)
    }
    initialActive()
    return () => {
      observer.disconnect()
    }
  }, [steps])

  const step = steps[activeIndex] ?? steps[0]
  const resolved = acts[step?.actIndex ?? 0]
  const beat = step?.beatIndex == null ? null : resolved?.beats[step.beatIndex] ?? null
  const actProgress = resolved
    ? Math.max(0, Math.min(1, ((step?.beatIndex ?? -1) + 1) / (resolved.beats.length + 1)))
    : 0

  function jumpBy(delta: number) {
    const target = steps[Math.max(0, Math.min(steps.length - 1, activeIndex + delta))]
    if (!target) return
    document.getElementById(target.id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  if (!resolved) return null
  const act = resolved.act

  return (
    <section
      ref={rootRef}
      aria-label="三幕故事"
      className="relative hidden border-t border-line xl:block"
      style={{ height: `calc(100svh + ${(steps.length - 1) * STEP_DISTANCE_SVH}svh)` }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-base">
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
            <div className="mt-6 max-w-xl space-y-2">
              {act.body.map((line) => <p key={line} className="text-body text-muted">{line}</p>)}
            </div>
            <div className="mt-9 flex items-center gap-4">
              <span className="font-mono text-meta text-faint tnum">
                {String((step?.beatIndex ?? -1) + 2).padStart(2, '0')} / {String(resolved.beats.length + 1).padStart(2, '0')}
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
              ) : (
                <div className="flex min-h-[48svh] flex-col justify-center border-y border-line/70 py-10">
                  <p className="font-mono text-meta uppercase tracking-[0.2em]" style={{ color: act.color }}>Scroll to explore</p>
                  <p className="mt-5 max-w-2xl text-h2 font-semibold text-ink">这一幕，从 {resolved.beats[0]?.date ?? act.years} 开始。</p>
                  <p className="mt-4 max-w-xl text-body text-muted">继续滚动查看这一阶段的年份与大事件，或使用右侧时间轴快速抵达。</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-[clamp(1.5rem,3vh,3rem)] left-1/2 flex -translate-x-1/2 items-center gap-3">
          <button type="button" onClick={() => jumpBy(-1)} disabled={activeIndex === 0} className="ui-press rounded-full border border-line bg-surface/70 px-4 py-2 text-meta text-muted disabled:opacity-25" aria-label="上一个节点">←</button>
          <span className="font-mono text-meta text-faint tnum">SCROLL · {activeIndex + 1}/{steps.length}</span>
          <button type="button" onClick={() => jumpBy(1)} disabled={activeIndex === steps.length - 1} className="ui-press rounded-full border border-line bg-surface/70 px-4 py-2 text-meta text-muted disabled:opacity-25" aria-label="下一个节点">→</button>
        </div>

        {step?.actIndex === acts.length - 1 && step.beatIndex === resolved.beats.length - 1 && (
          <Link href="/chronicle/" className="ui-press absolute bottom-[clamp(1.5rem,3vh,3rem)] right-[clamp(8rem,10vw,12rem)] rounded-full border border-line bg-surface/70 px-5 py-2 text-meta text-ink">
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

function StageBeat({ beat, color }: { beat: ResolvedBeat; color: string }) {
  const body = (
    <article className="grid min-h-[54svh] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[clamp(1rem,1.5vw,1.75rem)] border border-line/80 bg-surface/35 shadow-[0_2rem_7rem_rgba(0,0,0,0.22)]">
      <div className="relative min-h-0 overflow-hidden">
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
        {beat.body && <p className="mt-3 max-w-3xl text-body text-muted">{beat.body}</p>}
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
