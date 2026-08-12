import Link from 'next/link'
import type { ResolvedAct } from '@/lib/narrative'
import { formatDuration } from '@/lib/ui'
import { Reveal } from './Reveal'

/**
 * 三幕中的一幕。布局左右交替（index 奇数翻面）制造节奏；
 * 数字只来自派生 count；封面缺失时退化为字排版色块（绝不用假图）。
 */
export function ActSection({ act, index, now }: { act: ResolvedAct; index: number; now?: { year: string; label: string; count: number } }) {
  const a = act.act
  const flipped = index % 2 === 1

  return (
    <section id={a.id} className="relative border-t border-line py-14 sm:py-28">
      <span
        aria-hidden
        className="absolute left-4 top-0 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-base sm:left-6"
        style={{ background: a.color, boxShadow: `0 0 16px ${a.color}55` }}
      />
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <Reveal>
          <div className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${flipped ? 'lg:[direction:rtl]' : ''}`}>
            {/* 文字 */}
            <div className="lg:[direction:ltr]">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: a.color }}>
                  {a.kicker}
                </p>
                <p className="font-mono text-[11px] text-faint tnum">{a.years}</p>
              </div>
              <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[40px]">{a.title}</h2>
              <div className="mt-5 max-w-xl space-y-3">
                {a.body.map((line, i) => (
                  <p key={i} className="text-[14px] leading-7 text-muted">
                    {line}
                  </p>
                ))}
              </div>
              <p className="mt-5 font-mono text-[11px] text-faint tnum">
                {act.count.toLocaleString()} 条记录
                {act.heroEntry?.duration_min && (
                  <span className="ml-3 text-faint/70">{formatDuration(act.heroEntry.duration_min)} 起</span>
                )}
              </p>

              {act.beats.length > 0 && (
                <ul className="mt-7 space-y-1 border-l border-line/70 pl-4">
                  {act.beats.map((beat) => (
                    <li key={beat.id}>
                      <Link
                        href={beat.href}
                        className="group ui-press flex items-baseline gap-3 rounded-sm px-1 py-1.5 transition-colors hover:bg-surface/50"
                      >
                        <span className="w-[74px] shrink-0 font-mono text-[10px] text-faint tnum">{beat.date}</span>
                        <span className="min-w-0 truncate text-[13px] text-muted group-hover:text-ink">{beat.kicker} · {beat.title}</span>
                        <span className="ml-auto shrink-0 font-mono text-[11px] transition-transform group-hover:translate-x-0.5" style={{ color: a.color }}>
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {now && (
                <Link
                  href="/chronicle/"
                  className="group mt-8 inline-flex items-center gap-3 rounded-full border border-today/30 bg-today/5 py-2 pl-3 pr-5 transition-colors hover:border-today/60"
                >
                  <span aria-hidden className="ui-now-pulse h-2 w-2 rounded-full bg-today" />
                  <span className="font-mono text-[11px] tracking-[0.14em] text-today">{now.year}，{now.label}</span>
                  <span className="font-mono text-[10px] text-faint group-hover:text-today">· 已有 {now.count.toLocaleString()} 条 →</span>
                </Link>
              )}
            </div>

            {/* 视觉：真实封面，缺失时用字排色块 */}
            <div className="lg:[direction:ltr]">
              <div className="relative aspect-video overflow-hidden rounded-xl border border-line/80 bg-surface/40">
                {act.heroCover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={act.heroCover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${a.color}22, transparent 60%)` }}
                  >
                    <span className="font-mono text-[12px] tracking-widest" style={{ color: a.color }}>
                      {a.label} · 封面待补
                    </span>
                  </div>
                )}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-base/45 via-transparent to-transparent" />
                {act.heroEntry && (
                  <span className="absolute bottom-3 left-3 rounded-sm bg-base/70 px-2 py-1 font-mono text-[10px] text-ink/90 backdrop-blur-sm">
                    {act.heroEntry.date} · {act.heroEntry.title}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
