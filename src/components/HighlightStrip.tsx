import Link from 'next/link'
import { actColor, type ResolvedBeat } from '@/lib/narrative'
import { Reveal } from './Reveal'

/**
 * 高光条：17 个「记得住的时刻」。
 * 数字是背景纹理不是指标（emphasis 大字淡色靠右）；
 * 每一条都有真实条目锚点，点击进详情或游戏页——这是跨链的起点。
 */
export function HighlightStrip({ beats }: { beats: ResolvedBeat[] }) {
  if (beats.length === 0) return null
  return (
    <section className="border-t border-line py-14 sm:py-28">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-live">Highlights · 高光</p>
          <h2 className="mt-3 max-w-2xl text-[30px] font-semibold leading-tight tracking-tight sm:text-[42px]">
            一些记得住的时刻。
          </h2>
          <p className="mt-3 max-w-xl text-[13px] leading-7 text-muted">
            档案里的每一条都能查到。这里只放那些大家会记住的——从第一支视频，到现在。
          </p>
        </Reveal>

        <div className="mt-12">
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

/** 高光行：无 href 时退化为不可点击行（纯文案高光），避免构造空链接。 */
function Row({ beat }: { beat: ResolvedBeat }) {
  const inner = (
    <div className="relative grid gap-x-6 gap-y-2 sm:grid-cols-[120px_minmax(0,1fr)_180px] sm:items-center">
      {/* 日期 */}
      <span className="font-mono text-[11px] text-faint tnum">{beat.date}</span>

      {/* 文案 */}
      <span className="min-w-0">
        <span className="block font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: actColor(beat.act) }}>
          {beat.kicker}
        </span>
        <span className="mt-1 block text-[18px] font-medium leading-snug text-ink transition-colors group-hover:text-white sm:text-[21px]">
          {beat.title}
        </span>
        <span className="mt-1 block text-[13px] leading-6 text-muted">{beat.body}</span>
      </span>

      {/* 数字纹理 + 封面缩略 */}
      <span className="flex items-center justify-start gap-3 sm:justify-end">
        {beat.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={beat.cover}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="hidden h-14 w-24 shrink-0 rounded border border-line/60 object-cover object-center opacity-80 transition duration-500 group-hover:opacity-100 group-hover:scale-[1.03] sm:block"
          />
        )}
        <span
          aria-hidden
          className="hidden font-display text-[40px] font-bold leading-none tracking-tight sm:block"
          style={{ color: `${actColor(beat.act)}26` }}
        >
          {beat.emphasis}
        </span>
        <span className="font-mono text-[13px] text-faint/70 transition-transform group-hover:translate-x-1 group-hover:text-faint sm:hidden">
          →
        </span>
      </span>
    </div>
  )

  const base = 'group relative block overflow-hidden border-b border-line/60 py-5 transition-colors hover:bg-surface/25 sm:py-7'

  if (!beat.href) {
    return <div className={base}>{inner}</div>
  }

  return (
    <Link
      href={beat.href}
      target={beat.external ? '_blank' : undefined}
      rel={beat.external ? 'noreferrer' : undefined}
      className={base}
    >
      {inner}
      <span className="absolute right-0 top-1/2 hidden -translate-y-1/2 font-mono text-[13px] text-faint/50 transition-all group-hover:translate-x-1 group-hover:text-live sm:block">
        →
      </span>
    </Link>
  )
}
