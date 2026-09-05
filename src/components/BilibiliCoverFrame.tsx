'use client'

import { useEffect, useState } from 'react'
import { getBilibiliVideoMeta } from '@/lib/bilibili'
import { MediaFrame } from './MediaFrame'

/** 已有 B 站来源的封面优先即时读取；本地已有的同栏目封面仅作为加载中的视觉兜底。 */
export function BilibiliCoverFrame({
  sourceUrl,
  fallbackSrc,
  alt,
  className,
}: {
  sourceUrl?: string | null
  fallbackSrc?: string | null
  alt: string
  className?: string
}) {
  const [remoteCover, setRemoteCover] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getBilibiliVideoMeta(sourceUrl).then((meta) => {
      if (!cancelled && meta?.cover) setRemoteCover(meta.cover)
    })
    return () => { cancelled = true }
  }, [sourceUrl])

  return (
    <MediaFrame
      src={remoteCover ?? fallbackSrc}
      alt={alt}
      className={className}
      fallback={<span className="text-meta tracking-widest text-faint">正在读取 B 站封面</span>}
    />
  )
}
