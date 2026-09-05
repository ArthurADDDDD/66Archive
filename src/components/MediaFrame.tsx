'use client'

import { useState } from 'react'

/** 视觉框：真实封面，缺失或加载失败（onError）时退化为字排版色块（绝不用假图）。 */
export function MediaFrame({
  src,
  alt = '',
  fallback,
  aspect = 'aspect-video',
  className = '',
  children,
}: {
  src?: string | null
  alt?: string
  fallback?: React.ReactNode
  aspect?: string
  className?: string
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
