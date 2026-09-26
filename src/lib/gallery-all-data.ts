import { createHash } from 'node:crypto'
import { getGalleryCollections } from './gallery-photos-manifest'

/**
 * 画廊「全量版」的静态数据载荷（构建期身份）。
 *
 * 全量版五六百张照片的元数据原先随 `/gallery/` 的 HTML 一起烤进去，约占页面数据的九成，
 * 可打开画廊第一眼看的是纪念版——这份数据在首屏完全用不上，却要在手机上先下完、再解析、
 * 再水合。拆成单独的 JSON 之后，HTML 只带纪念版，全量版在空闲时预取、或点到时才取。
 *
 * URL 带一个由**载荷字节**算出来的版本号，理由与 `archive-data-url.ts` 相同：
 * 这份 JSON 和 HTML 在边缘各自缓存，不带版本号的话发布之后新 HTML 可能配着旧数据。
 * 放在 `/gallery/` 下面，与全直播合集的清单（`/gallery/live-wall/index.json?v=…`）同一条
 * 静态文件路径，缓存行为一致。
 */
let cached: { body: string; url: string } | null = null

function build(): { body: string; url: string } {
  if (cached) return cached
  const body = JSON.stringify(getGalleryCollections().all)
  const version = createHash('sha256').update(body).digest('hex').slice(0, 12)
  cached = { body, url: `/gallery/all-photos.json?v=${version}` }
  return cached
}

export function galleryAllPhotosBody(): string {
  return build().body
}

export function galleryAllPhotosUrl(): string {
  return build().url
}
