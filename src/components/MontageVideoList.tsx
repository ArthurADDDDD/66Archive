'use client'

import Link from 'next/link'
import type { ResolvedBeat } from '@/lib/narrative'
import { Reveal } from './Reveal'

const PUBLIC_LIVE_HOURS_FLOOR = 10_000

/**
 * 首页 ACT II 的蒙太奇视频条。
 * 站内已确认时长 / 场次来自当前时间线；10,000+ 小时是公开采访与平台年度统计形成的保守累计下限。
 */
export function MontageVideoList({ beat, color, compact = false }: { beat: ResolvedBeat; color: string; compact?: boolean }) {
  const montage = beat.montage
  if (!montage) return null

  if (compact) {
    return (
      <div className="min-w-0 max-w-full overflow-x-auto" aria-label="蒙太奇视频列表">
          <div className="flex w-max min-w-full gap-3 pb-1">
          {montage.samples.map((sample) => (
            <Link key={sample.id} href={`/e/${sample.id}/`} className="group w-[168px] shrink-0 sm:w-[196px]">
              <div className="overflow-hidden rounded-lg border border-line/60 bg-surface/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.cover}
                  alt={sample.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="aspect-video w-full object-cover transition-opacity duration-300 group-hover:opacity-90"
                />
              </div>
              <span className="mt-1.5 block truncate text-meta text-faint tnum">
                {sample.date} · {sample.title}
              </span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-meta text-faint tnum">{beat.date}</span>
      </div>
      <h3 className="mt-3 text-h3 font-bold text-ink">{beat.title}</h3>
      {beat.body && <p className="measure-body mt-2 text-body text-muted">{beat.body}</p>}

      {beat.chips && beat.chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {beat.chips.map((chip) => (
            <span key={chip} className="rounded-full border border-line/70 px-3 py-1 text-meta text-muted">
              {chip}
            </span>
          ))}
        </div>
      )}

      {montage.samples.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <div className="flex gap-3 pb-1">
            {montage.samples.map((sample) => (
              <Link key={sample.id} href={`/e/${sample.id}/`} className="group w-[168px] shrink-0 sm:w-[196px]">
                <div className="overflow-hidden rounded-lg border border-line/60 bg-surface/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sample.cover}
                    alt={sample.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-video w-full object-cover transition-opacity duration-300 group-hover:opacity-90"
                  />
                </div>
                <span className="mt-1.5 block truncate text-meta text-faint tnum">
                  {sample.date} · {sample.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-2 text-body text-muted">
        <Reveal delay={0}>
          <span>
            <b className="tnum text-ink">{montage.stats.xinling}</b> 期心灵砒霜
          </span>
        </Reveal>
        <span className="text-faint/40">·</span>
        <Reveal delay={60}>
          <span>
            <b className="tnum text-ink">{PUBLIC_LIVE_HOURS_FLOOR.toLocaleString()}+</b> 小时公开累计下限
          </span>
        </Reveal>
        <span className="text-faint/40">·</span>
        <Reveal delay={120}>
          <span>
            <b className="tnum text-ink">{montage.stats.hoursLabel}</b> 小时档案已确认
          </span>
        </Reveal>
        <span className="text-faint/40">·</span>
        <Reveal delay={180}>
          <span>
            <b className="tnum text-ink">{montage.stats.liveSessions}</b> 场档案已收录
          </span>
        </Reveal>
        <span className="text-faint/40">·</span>
        <Reveal delay={240}>
          <span style={{ color }}>大周</span>
        </Reveal>
      </div>
    </div>
  )
}
