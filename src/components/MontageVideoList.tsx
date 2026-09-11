'use client'

import Link from 'next/link'
import type { ResolvedBeat } from '@/lib/narrative'
import { proxyImageSrcSet } from '@/lib/platforms'
import { Reveal } from './Reveal'

/**
 * 蒙太奇缩略图的框是写死的 `w-[168px] sm:w-[196px]`，实测 375→166、768→194 CSS px；
 * ≥1280（`xl`）时首页换成另一套排版，这一支整块 `display:none`，配合 `loading="lazy"`
 * 根本不会发请求——所以这几档只服务手机与平板。
 *
 * `lib/narrative.ts` 把这些封面烤成单一的 w=480：DPR 2 的手机只需要 336。
 * 实测这 14 张 w=480 合计 287,002 B，改挑 360 后 189,744 B（−34%）；
 * DPR 1 落到 180 只要 65,518 B。DPR 2 的平板仍然落在 480，画质不降。
 */
const THUMB_WIDTHS = [180, 360, 480] as const
const THUMB_SIZES = '(min-width: 640px) 196px, 168px'

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
            <Link prefetch={false}
              key={sample.id}
              href={`/e/${sample.id}/`}
              data-analytics-event="content.open"
              data-analytics-target={`entry:${sample.id}`}
              className="group w-[168px] shrink-0 sm:w-[196px]"
            >
              <div className="overflow-hidden rounded-lg border border-line/60 bg-surface/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.cover}
                  srcSet={proxyImageSrcSet(sample.cover, THUMB_WIDTHS) ?? undefined}
                  sizes={proxyImageSrcSet(sample.cover, THUMB_WIDTHS) ? THUMB_SIZES : undefined}
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
              <Link prefetch={false}
                key={sample.id}
                href={`/e/${sample.id}/`}
                data-analytics-event="content.open"
                data-analytics-target={`entry:${sample.id}`}
                className="group w-[168px] shrink-0 sm:w-[196px]"
              >
                <div className="overflow-hidden rounded-lg border border-line/60 bg-surface/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sample.cover}
                    srcSet={proxyImageSrcSet(sample.cover, THUMB_WIDTHS) ?? undefined}
                    sizes={proxyImageSrcSet(sample.cover, THUMB_WIDTHS) ? THUMB_SIZES : undefined}
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
        {/*
          这里原本还并排着三个数：「10,000+ 小时公开累计下限」「N 小时档案已确认」
          「N 场档案已收录」。它们正长在三幕故事中间——读者刚读完一段回忆，
          下一行就是一张产出结算表。而且「公开累计下限」「档案已确认」是校对口径，
          说的是档案完成度，不是她做过什么。留下的这一个是「多少期心灵砒霜」：
          那是她自己的节目，数它等于数她出现过多少个星期日。
        */}
        <span className="text-faint/40">·</span>
        <Reveal delay={60}>
          <span style={{ color }}>大周</span>
        </Reveal>
      </div>
    </div>
  )
}
