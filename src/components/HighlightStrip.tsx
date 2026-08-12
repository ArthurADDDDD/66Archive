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
    <section className="border-t border-line py-12 sm:py-16">
      <div className="mx-auto max-w-[1240px] px-page">
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

/** 高光行：无 href 时退化为不可点击行（纯文案高光），避免构造空链接。 */
function Row({ beat }: { beat: ResolvedBeat }) {
  /**
   * 手机端：左缩略图 + 右侧「日期 · 标签 / 标题 / 引子」两段式，标题始终从同一条左边线起。
   * 原本 grid 塌成单列后，第三格（封面 + 大数字 + 箭头）会变成独立一行、左对齐的孤零零 →，
   * 而封面和数字都被 hidden sm:block 藏掉了——手机端等于白占一行高度。
   * 桌面端（sm+）回到原来的三栏 grid，逐像素不变。
   */
  const inner = (
    <div className="relative flex gap-3 sm:grid sm:grid-cols-[120px_minmax(0,1fr)_180px] sm:items-center sm:gap-x-6">
      {/* 日期：手机端并进标签行（见下），桌面端回到左栏 */}
      <span className="hidden font-mono text-meta text-faint tnum sm:block">{beat.date}</span>

      <span className="order-2 min-w-0 flex-1 sm:order-none">
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
        <span className="mt-1 block text-body text-muted">{beat.body}</span>
      </span>

      {/* 封面缩略 + 数字纹理：手机端挪到最左当缩略图，桌面端回到右栏 */}
      <span
        className={`order-1 shrink-0 items-center gap-3 sm:order-none sm:flex sm:justify-end ${
          beat.cover ? 'flex' : 'hidden'
        }`}
      >
        {beat.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={beat.cover}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-12 w-[68px] shrink-0 rounded border border-line/60 object-cover object-center opacity-80 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100 sm:h-14 sm:w-24"
          />
        )}
        <span
          aria-hidden
          className="hidden font-display text-[40px] font-bold leading-none tracking-tight sm:block"
          style={{ color: `${actColor(beat.act)}26` }}
        >
          {beat.emphasis}
        </span>
      </span>
    </div>
  )

  const base = 'group relative block border-b border-line/60 py-4 transition-colors hover:bg-surface/25 sm:py-5'

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
      <span aria-hidden className="absolute right-0 top-1/2 hidden -translate-y-1/2 font-mono text-meta text-faint/70 transition-all group-hover:translate-x-1 group-hover:text-live sm:block">
        →
      </span>
    </Link>
  )
}
