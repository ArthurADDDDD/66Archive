import Link from 'next/link'
import type { TimelineEntry } from '@/lib/data'
import { Reveal } from './Reveal'

/**
 * 幕间：空白本身就是设计。
 * 不塞数据、不卡片化——只有两行字、一条数据事实（幕间唯一记录）。
 */
export function Interlude({ count, loneEntry }: { count: number; loneEntry: TimelineEntry | null }) {
  return (
    <section aria-label="幕间 · 2023.11 — 2024.08" className="relative border-t border-line/60 py-14 sm:py-40">
      <div aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-line/40 to-transparent" />
      <div className="relative mx-auto flex max-w-[420px] flex-col items-center px-4 text-center">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-faint/60">Interlude · 幕间</p>
          <p className="mt-10 font-mono text-[12px] text-faint/70 tnum">2023.11.29</p>
          <p className="mt-2 text-[16px] tracking-wide text-faint/80">see you around~</p>
        </Reveal>

        {/* 空白 */}
        <div className="my-8 flex items-center gap-3 font-mono text-[10px] text-faint/40 sm:my-14" aria-hidden>
          <span>·</span>
          <span>·</span>
          <span>·</span>
        </div>

        <Reveal>
          {loneEntry && (
            <Link
              href={`/e/${loneEntry.id}/`}
              className="group font-mono text-[10px] leading-6 text-faint/60 transition-colors hover:text-faint"
            >
              {count > 0 && <span className="text-faint/40 tnum">{count.toLocaleString()} 条记录</span>}
              <span className="mx-2 text-faint/30">·</span>
              <span className="tnum">{loneEntry.date}</span>
              <span className="mx-2 text-faint/30">·</span>
              {loneEntry.title}
              <span className="ml-1 inline-block opacity-0 transition-opacity group-hover:opacity-60">→</span>
            </Link>
          )}
        </Reveal>

        <div className="my-8 flex items-center gap-3 font-mono text-[10px] text-faint/40 sm:my-14" aria-hidden>
          <span>·</span>
          <span>·</span>
          <span>·</span>
        </div>

        <Reveal>
          <p className="font-mono text-[12px] text-faint/70 tnum">2024.08.18</p>
          <p className="mt-2 text-[16px] tracking-wide text-faint/80">又见面了。</p>
        </Reveal>
      </div>
    </section>
  )
}
