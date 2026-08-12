import Link from 'next/link'
import { actColor, type ResolvedBeat } from '@/lib/narrative'
import { Eyebrow } from './primitives'
import { Reveal } from './Reveal'

/**
 * 高光条：17 个「记得住的时刻」。
 * 数字是背景纹理不是指标（emphasis 大字淡色靠右）；
 * 每一条都有真实条目锚点，点击进详情或游戏页——这是跨链的起点。
 */
export function HighlightStrip({ beats }: { beats: ResolvedBeat[] }) {
  if (beats.length === 0) return null
  return (
    <section id="home-highlights" className="scroll-mt-4 border-t border-line py-12 sm:py-16">
      <div className="home-content-container px-page">
        <Reveal>
          <Eyebrow color="#5BC8E8">Highlights · 高光</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-h2 font-semibold">一些记得住的时刻。</h2>
          <p className="mt-3 max-w-xl text-body text-muted">
            档案里的每一条都能查到。这里只放那些大家会记住的——从第一支视频，到现在。
          </p>
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

/** 高光行：点击摘要后向下展开封面、描述与详情入口。 */
function Row({ beat }: { beat: ResolvedBeat }) {
  return (
    <details className="group border-b border-line/60 transition-colors open:bg-surface/20">
      <summary className="ui-press grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 marker:hidden sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:py-5 [&::-webkit-details-marker]:hidden">
        <span className="hidden font-mono text-meta text-faint tnum sm:block">{beat.date}</span>
        <span className="min-w-0">
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
        </span>
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line font-mono text-base text-faint transition-[transform,color,border-color] group-open:rotate-45 group-hover:border-muted group-hover:text-ink"
        >
          +
        </span>
      </summary>

      <div className="grid gap-5 pb-6 pl-0 sm:grid-cols-[120px_minmax(0,1fr)] sm:pb-8">
        <span aria-hidden className="hidden sm:block" />
        <div className={`grid max-w-4xl gap-5 ${beat.cover ? 'sm:grid-cols-[minmax(220px,360px)_minmax(0,1fr)]' : ''}`}>
          {beat.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={beat.cover}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="aspect-video w-full rounded-lg border border-line/70 object-cover object-center"
            />
          )}
          <div className="min-w-0 self-center">
            {beat.emphasis && (
              <p className="font-display text-h3 font-bold leading-tight" style={{ color: actColor(beat.act) }}>
                {beat.emphasis}
              </p>
            )}
            {beat.body && <p className={`${beat.emphasis ? 'mt-3' : ''} max-w-2xl text-body text-muted`}>{beat.body}</p>}
            {beat.href && (
              <Link
                href={beat.href}
                target={beat.external ? '_blank' : undefined}
                rel={beat.external ? 'noreferrer' : undefined}
                className="ui-press mt-5 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-meta text-live transition-colors hover:border-muted"
              >
                查看完整详情 <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </details>
  )
}
