import Link from 'next/link'
import { proxyImage, proxyImageSrcSet } from '@/lib/platforms'
import { AutoScrollText } from './AutoScrollText'

export type SeriesMontageSample = {
  id: string
  date: string
  title: string
  cover: string
}

/**
 * 瓦片实测宽度（CSS px）：375→166、768→166、1440→214，和 `clamp(10.5rem, 15vw, 15rem)`
 * 对得上——15vw 在 1120 以下不足 168、1600 以上超过 240，所以两端都被夹住。
 *
 * 原先所有 24 张一律 w=480。DPR 1 的桌面按 214 的框只需要 240：实测这 24 张
 * w=480 合计 698,632 B、w=240 只要 231,906 B（−67%）；DPR 2 的手机改挑 360 是
 * 445,068 B（−36%）。DPR 2 的桌面仍然落在 480，画质不降。
 */
const MONTAGE_WIDTHS = [240, 360, 480] as const
const MONTAGE_SIZES = '(min-width: 1600px) 240px, (min-width: 1120px) 15vw, 168px'

export function SeriesMontage({ samples }: { samples: SeriesMontageSample[] }) {
  if (samples.length === 0) return null

  return (
    <div className="overflow-x-auto" aria-label="心灵砒霜最近录像">
      <div className="flex gap-3 pb-1">
        {samples.map((sample) => {
          const cover = proxyImage(sample.cover, 480)
          // 直连来源（例如优酷）改不了尺寸，`proxyImageSrcSet` 返回 null，照常只用 src。
          const srcSet = proxyImageSrcSet(cover, MONTAGE_WIDTHS)
          return (
            <Link
              key={sample.id}
              href={`/e/${sample.id}/`}
              prefetch={false}
              className="group w-[clamp(10.5rem,15vw,15rem)] shrink-0"
            >
              <div className="relative aspect-video overflow-hidden rounded-lg border border-line/60 bg-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover ?? sample.cover}
                  srcSet={srcSet ?? undefined}
                  sizes={srcSet ? MONTAGE_SIZES : undefined}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                />
              </div>
              <AutoScrollText className="mt-1.5 text-meta text-faint tnum">{`${sample.date} · ${sample.title}`}</AutoScrollText>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
