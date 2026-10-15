import React, { type ImgHTMLAttributes } from 'react'
import { entryCoverSources } from '@/lib/entry-covers'
import { galleryThumbSources } from '@/lib/gallery-photos'
import { proxyImageSrcSet } from '@/lib/platforms'

/** 共用封面出口：本地派生图优先，远程沿用代理宽度，未知来源保留原图。 */
export function ResponsiveCover({
  src,
  widths,
  sizes,
  alt,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string
  widths?: readonly number[]
}) {
  const local = widths && sizes
    ? entryCoverSources(src) ?? (/^\/gallery\/photos\/[^/?#]+\.thumb\.jpg$/i.test(src) ? galleryThumbSources(src) : null)
    : null
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- 静态导出使用已生成的本地图与现有远程代理。
    <img
      {...props}
      src={src}
      srcSet={widths ? proxyImageSrcSet(src, widths) ?? undefined : undefined}
      sizes={sizes}
      alt={alt}
    />
  )
  if (!local) return image
  return (
    <picture className="block h-full w-full">
      <source type="image/avif" srcSet={local.avif} sizes={sizes} />
      <source type="image/webp" srcSet={local.webp} sizes={sizes} />
      {image}
    </picture>
  )
}
