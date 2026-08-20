'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { PresenceIndicator } from './PresenceIndicator'
import { RotatingAvatar } from './RotatingAvatar'
import { useSiteCopy } from './LiveContentProvider'

export function HomeHero({ nowYear }: { nowYear: string }) {
  const copy = useSiteCopy()
  const rootRef = useRef<HTMLElement>(null)
  const frameRef = useRef<number | null>(null)
  const [pressed, setPressed] = useState(false)

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
  }, [])

  function updatePointer(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch' || !window.matchMedia('(pointer: fine)').matches) return
    const root = rootRef.current
    if (!root) return
    const rect = root.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1))
    const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1))
    // 聚光层横向铺满视口，因此使用视口坐标，避免在版心边缘出现硬裁切线。
    const px = event.clientX
    // 光层向 Hero 上下各延伸 24svh，坐标同步补偿，避免靠近导航时出现横向裁切边。
    const py = event.clientY - rect.top + window.innerHeight * 0.24

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      root.style.setProperty('--hero-x', x.toFixed(3))
      root.style.setProperty('--hero-y', y.toFixed(3))
      root.style.setProperty('--hero-px', `${px.toFixed(1)}px`)
      root.style.setProperty('--hero-py', `${py.toFixed(1)}px`)
    })
  }

  function resetPointer() {
    const root = rootRef.current
    if (!root) return
    root.style.setProperty('--hero-x', '0')
    root.style.setProperty('--hero-y', '0')
    root.style.setProperty('--hero-px', '50vw')
    root.style.setProperty('--hero-py', '50%')
    setPressed(false)
  }

  return (
    <section
      id="home-top"
      ref={rootRef}
      className="home-hero relative home-content-container flex min-h-[80svh] w-full scroll-mt-4 flex-col justify-center px-page pb-10 pt-12 sm:min-h-0 sm:flex-1 sm:pb-24 sm:pt-20"
      onPointerMove={updatePointer}
      onPointerLeave={resetPointer}
    >
      <div className="home-hero__spotlight pointer-events-none absolute -bottom-[24svh] -top-[24svh] left-1/2 hidden w-screen -translate-x-1/2 sm:block" />
      <div className="home-hero__glow home-hero__glow--right pointer-events-none absolute -right-24 -top-40 h-[280px] w-[280px] rounded-full bg-live/10 blur-[60px] sm:h-[520px] sm:w-[520px] sm:blur-[100px]" />
      <div className="home-hero__glow home-hero__glow--left pointer-events-none absolute -left-44 top-24 h-[240px] w-[240px] rounded-full bg-today/10 blur-[60px] sm:h-[460px] sm:w-[460px] sm:blur-[110px]" />

      <div className="relative grid w-full gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-12">
        <div className="ui-reveal">
          <div className="home-hero__copy">
          <div className="home-hero__status inline-flex items-center gap-2 rounded-full border border-live/30 bg-live/5 px-3 py-1.5 text-meta uppercase tracking-[0.16em] text-live tnum">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
            2010 — {nowYear}{copy.hero.status ? ` · ${copy.hero.status}` : ''}
          </div>
          {copy.hero.eyebrow && <p className="mt-7 text-meta uppercase tracking-[0.22em] text-faint">{copy.hero.eyebrow}</p>}
          <h1 className="mt-3 text-hero font-bold tracking-[-0.01em] text-ink">{copy.hero.title}</h1>
          <p className="measure-body mt-6 text-body text-muted">
            {copy.hero.body.map((line, index) => (
              <span key={index}>
                {line}
                {index < copy.hero.body.length - 1 && <br className="hidden sm:block" />}
              </span>
            ))}
          </p>
            <div className="mt-7 flex flex-wrap gap-3 sm:mt-9">
            <a
              href="#home-acts"
              className="ui-press group hidden items-center rounded-full bg-ink px-6 py-3 text-control font-medium text-base hover:shadow-[0_16px_50px_rgba(230,228,239,0.12)] sm:inline-flex"
            >
              {copy.hero.primaryAction} <span className="ml-2 inline-block transition-transform group-hover:translate-y-0.5">↓</span>
            </a>
            <Link href="/chronicle/" className="ui-press rounded-full border border-line bg-surface/60 px-6 py-3 text-control text-muted hover:border-muted hover:text-ink">
              {copy.hero.secondaryAction}
            </Link>
            </div>
            <PresenceIndicator pageKey="home" mode="global" className="mt-4" />
          </div>
        </div>

        <div className="ui-reveal ui-delay-1">
          <div
            className="home-hero__orbit relative mx-auto aspect-square w-full max-w-[300px] select-none sm:max-w-[440px]"
            data-pressed={pressed ? 'true' : 'false'}
            onPointerDown={(event) => {
              if (event.pointerType !== 'touch') setPressed(true)
            }}
            onPointerUp={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
          >
            <div className="home-hero__ring home-hero__ring--outer absolute inset-[8%] animate-[spin_35s_linear_infinite] rounded-full border border-dashed border-line" />
            <div className="home-hero__ring home-hero__ring--inner absolute inset-[22%] animate-[spin_24s_linear_infinite_reverse] rounded-full border border-live/20" />
            <div className="home-hero__core absolute inset-[34%] rounded-full bg-gradient-to-br from-live/25 via-raised to-today/20 shadow-[0_0_90px_rgba(91,200,232,0.16)]" />
            <div className="absolute inset-0 flex items-center justify-center text-center">
              <div className="home-hero__avatar relative h-[38%] w-[38%] overflow-hidden rounded-full border-4 border-base/80 shadow-[0_0_35px_rgba(91,200,232,0.24)] ring-1 ring-live/40">
                <RotatingAvatar />
              </div>
            </div>
            {[
              ['12%', '48%', '#E0A244'],
              ['78%', '18%', '#5BC8E8'],
              ['83%', '72%', '#FF6B75'],
              ['25%', '82%', '#A78BFA'],
            ].map(([left, top, color], index) => (
              <span
                key={index}
                className="home-hero__node absolute h-3 w-3 rounded-full shadow-[0_0_20px_currentColor]"
                style={{ left, top, color, background: color }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
