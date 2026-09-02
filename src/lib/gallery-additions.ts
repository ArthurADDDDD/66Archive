import { fetchJson } from './live-content'
import type { GalleryPhoto } from './gallery-photos'

/**
 * 运行时并进来的画廊照片。
 *
 * 站点是静态导出，画廊清单在构建期烤进 HTML。新收进来的照片如果只能等下一次部署才
 * 出现，「整理完立刻看看排出来什么样」这件事就做不到——而画廊恰恰是最需要即时的一块。
 *
 * 内容服务在 `/api/content/gallery-additions` 暴露那些**还没并入公开仓**的照片，
 * 前台在浏览器里拉一次并入清单。已经并入的不会出现在这份响应里——静态清单已经有了，
 * 再并一次会让同一张图显示两遍。
 *
 * 与文案覆盖同一套硬规矩：**只读、失败就当作没有增量**。接口挂了、超时、结构不对，
 * 画廊照常显示构建期那一份，不空白也不报错。
 */

/** 字段形状与后台接口一一对应，前台不做映射——映射层是两边字段慢慢长歪的温床。 */
function parsePhoto(value: unknown): GalleryPhoto | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const text = (key: string): string | null => (typeof raw[key] === 'string' && raw[key] ? (raw[key] as string) : null)
  const id = text('id')
  const src = text('src')
  const thumb = text('thumb')
  const width = typeof raw.width === 'number' ? raw.width : 0
  const height = typeof raw.height === 'number' ? raw.height : 0
  // 尺寸缺失会让等高行排版算出 NaN，整段布局塌掉。宁可丢掉这一张。
  if (!id || !src || !thumb || width <= 0 || height <= 0) return null
  return {
    id,
    src,
    thumb,
    width,
    height,
    year: text('year'),
    date: text('date'),
    time: text('time'),
    seq: text('seq'),
    sourceRef: text('sourceRef'),
    title: text('title'),
    caption: text('caption'),
    source: text('source'),
    hidden: raw.hidden === true,
  }
}

export async function fetchGalleryAdditions(): Promise<GalleryPhoto[]> {
  const payload = await fetchJson('/api/content/gallery-additions')
  if (!payload || typeof payload !== 'object') return []
  const list = (payload as { photos?: unknown }).photos
  if (!Array.isArray(list)) return []
  return list.flatMap((item) => {
    const photo = parsePhoto(item)
    // hidden 在服务端已经滤过一遍；这里再判一次，是因为「后台点了隐藏但图还在页面上」
    // 的代价远高于多写一个条件
    return photo && !photo.hidden ? [photo] : []
  })
}

/**
 * 合并：增量在前，构建期清单在后。
 *
 * 新上传的排在最前面是有意的——刚整理完的那一批正是此刻要看的。
 * 按 id 去重，静态清单优先：万一某张照片已经并入公开仓、而接口那边的标记还没更新，
 * 也只会显示一次，且显示的是公开仓那份（它才是并入之后的真源）。
 */
export function mergeGalleryPhotos(baked: GalleryPhoto[], additions: GalleryPhoto[]): GalleryPhoto[] {
  const known = new Set(baked.map((photo) => photo.id))
  return [...additions.filter((photo) => !known.has(photo.id)), ...baked]
}
