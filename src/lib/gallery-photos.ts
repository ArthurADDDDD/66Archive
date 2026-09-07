/**
 * 画廊数据的类型与分桶规则。
 *
 * 这里只有纯逻辑，不碰文件系统——GalleryBoard 是客户端组件，一旦从这里牵出
 * node:fs，整个模块就会被打进客户端包，构建直接失败。读清单的部分在
 * gallery-photos-manifest.ts，只给服务端组件用。
 */

/**
 * 每张图有两档：thumb 给列表，src 给灯箱。列表一屏几十张，用大图等于把带宽
 * 全烧在 200px 高的格子上。
 *
 * year 为 null = 还没核实出年份，前台归到「年份待定」，不做推测。
 */
export type GalleryPhoto = {
  id: string
  src: string
  thumb: string
  width: number
  height: number
  year: string | null
  date: string | null
  time: string | null
  seq: string | null
  sourceRef: string | null
  title: string | null
  caption: string | null
  /** 面向读者的策展标签；素材批次、内部考证状态不放进这里。 */
  tags?: string[]
  source: string | null
  /** 后台隐藏开关：已收录但暂不展示（重复、待复核等），不是「删除」。 */
  hidden: boolean
}

/**
 * 一张照片在「最爱看」排行里显示成什么。
 *
 * 与画廊页的 photoAlt 同一口径：**没有确认过的标题就不编一个**，只说这是哪一天
 * 的画面。构建期的标题索引和运行时并进来的新照片都走这里，两边长歪就会出现
 * 「同一张图，排行里叫法和画廊里不一样」。
 */
export function galleryPhotoLabel(photo: Pick<GalleryPhoto, 'title' | 'caption' | 'date'>): string {
  if (photo.title) return photo.title
  if (photo.caption) return photo.caption
  return photo.date ? `${photo.date} 的画面` : '年份待定的画面'
}

/** 年份未定的那一组的桶键；前台单独成段，排在所有年份之后。 */
export const UNDATED = 'undated'
export const UNDATED_LABEL = '年份待定'

/** 分桶键：有年份就用年份，没有就进「待定」桶。 */
export function bucketOf(photo: GalleryPhoto) {
  return photo.year ?? UNDATED
}

/** 年份正序，「年份待定」永远垫底——它不是某一年，不该插在年份中间。 */
export function sortBucket(a: string, b: string) {
  if (a === UNDATED) return 1
  if (b === UNDATED) return -1
  return a.localeCompare(b)
}

/**
 * 缩略图的现代格式变体。
 *
 * 清单里只保存稳定的 JPEG 兜底路径；`.thumb-360` / `.thumb-720` 的 avif/webp
 * 文件名可以机械推导，不必污染人工维护的数据（生成见
 * `scripts/gallery-images-optimize.ts`）。
 *
 * 放在这个纯函数模块里，是因为画廊页和首页的画廊预告都要用：预告那八张图
 * 显示成 ~70px 的方块，此前直接引 `.thumb.jpg`，实测八张合计 340,257 B，
 * 而同一批 `.thumb-360.avif` 只要 54,532 B。同一份推导逻辑写两遍必然长歪。
 */
export function galleryThumbSources(thumb: string) {
  const stem = thumb.replace(/\.thumb\.jpg$/i, '')
  if (stem === thumb) return null
  return {
    avif: `${stem}.thumb-360.avif 360w, ${stem}.thumb-720.avif 720w`,
    webp: `${stem}.thumb-360.webp 360w, ${stem}.thumb-720.webp 720w`,
  }
}

/** 同一套推导，用于 CSS 背景（灯箱的模糊底）。 */
export function galleryThumbBackground(thumb: string) {
  const stem = thumb.replace(/\.thumb\.jpg$/i, '')
  if (stem === thumb) return `url("${thumb}")`
  return `image-set(url("${stem}.thumb-720.avif") type("image/avif"), url("${stem}.thumb-720.webp") type("image/webp"), url("${thumb}") type("image/jpeg"))`
}
