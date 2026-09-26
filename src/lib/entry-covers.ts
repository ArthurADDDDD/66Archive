/**
 * 条目页本地封面的现代格式变体。
 *
 * 与 `lib/gallery-photos.ts` 的 `galleryThumbSources` 同一个套路：文件名可以机械推导，
 * 不必把派生路径写进任何人工维护的数据里（生成见 `scripts/entry-covers-optimize.ts`）。
 *
 * 只认 `/images/covers/<id>.jpg` 这一种形状。别的封面要么是远程地址
 * （已经由 `proxyImage` 按显示宽度取图），要么是别处的本地图，都没有派生文件——
 * 返回 null，调用方照常只用原图。
 *
 * ⚠️ `<picture>` 的 `<source>` 加载失败**不会**回落到 `<img>`，所以这里返回非 null
 * 就等于承诺那四个文件在仓库里。新增本地封面后必须跑一次
 * `npm run covers:optimize` 并把派生文件一起提交。
 */
const LOCAL_COVER = /^\/images\/covers\/([^/]+)\.jpg$/i
/**
 * 大事件里的早期水友作品封面（`/gallery/anniv_*.jpg|png`）。原图最大 1.6 MB（PNG），
 * 却只显示成 112–224 px 的小封面，所以同样生成 w360 / w720 两档（同一个脚本）。
 * 地址上可能带 `?v=` 版本号：派生文件沿用同一个版本号，原图换了缓存也跟着换。
 */
const ANNIV_COVER = /^\/gallery\/(anniv_[^/?]+)\.(?:jpg|png)(\?[^#]*)?$/i

export function entryCoverSources(cover: string | null | undefined): { avif: string; webp: string } | null {
  if (!cover) return null
  const local = LOCAL_COVER.exec(cover)
  const anniv = local ? null : ANNIV_COVER.exec(cover)
  if (!local && !anniv) return null
  const stem = local ? `/images/covers/${local[1]}` : `/gallery/${anniv![1]}`
  const version = anniv?.[2] ?? ''
  return {
    avif: `${stem}.w360.avif${version} 360w, ${stem}.w720.avif${version} 720w`,
    webp: `${stem}.w360.webp${version} 360w, ${stem}.w720.webp${version} 720w`,
  }
}
