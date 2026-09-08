'use client'

import { useState } from 'react'
import { proxyImageSrcSet } from '@/lib/platforms'

/** 视觉框：真实封面，缺失或加载失败（onError）时退化为字排版色块（绝不用假图）。 */
export function MediaFrame({
  src,
  alt = '',
  fallback,
  aspect = 'aspect-video',
  className = '',
  widths,
  sizes,
  children,
}: {
  src?: string | null
  alt?: string
  fallback?: React.ReactNode
  aspect?: string
  className?: string
  /**
   * 可选的多档宽度。调用方知道这个框在各断点下有多宽，MediaFrame 自己不知道——
   * 它只负责画。给了就按 DPR 让浏览器挑，不给就沿用原来的单一 `src`。
   *
   * 为什么需要：`proxyImage(..., N)` 烤出来的是**一个**宽度，而同一个 URL 会被复用到
   * 尺寸差很多的位置。/series/ 的卡片就是这样——封面按详情页的 w=960 烤好，
   * 却显示在 254×142 的卡片里，实测 37,171 B 对 9,176 B。
   */
  widths?: readonly number[]
  sizes?: string
  children?: React.ReactNode
}) {
  // 同一个 MediaFrame（例如时间轴预览卡）会不断换 src。只记住真正失败的
  // 那个地址，避免一张坏图把之后所有正常封面也永久切到 fallback。
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && brokenSrc !== src

  return (
    <div className={`relative ${aspect} overflow-hidden rounded-xl border border-line/80 bg-raised ${className}`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          srcSet={(widths && proxyImageSrcSet(src, widths)) ?? undefined}
          sizes={widths && sizes ? sizes : undefined}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBrokenSrc(src ?? null)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-video/12 via-raised to-live/8 p-6">
          {fallback ?? <span className="text-meta tracking-widest text-faint">封面待补</span>}
        </div>
      )}
      {children}
    </div>
  )
}
