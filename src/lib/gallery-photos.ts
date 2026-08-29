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
  source: string | null
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
