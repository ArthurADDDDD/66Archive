import fs from 'node:fs'
import path from 'node:path'

/**
 * 画廊改版的预览数据源。
 *
 * 清单由 scripts/gallery-preview-manifest.ts 生成，字段里只有从文件名和文件头能确定的东西：
 * 尺寸、日期、时间、序号。标题一律为 null——正式命名由人来写，这里不填占位。
 */
export type GalleryPhoto = {
  id: string
  src: string
  width: number
  height: number
  year: string
  date: string | null
  time: string | null
  seq: string | null
  sourceRef: string | null
  title: string | null
}

const MANIFEST = path.join(process.cwd(), 'data/_demo/gallery-preview.json')

export function getGalleryPhotos(): GalleryPhoto[] {
  if (!fs.existsSync(MANIFEST)) return []
  const raw = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { items?: GalleryPhoto[] }
  const items = raw.items ?? []
  // 时间正序：画廊按时间读下来才是「这些年」，倒序会把最早的一批压到最后。
  return items
    .filter((item) => item.width > 0 && item.height > 0)
    .sort((a, b) => `${a.date ?? a.year}${a.time ?? ''}${a.seq ?? ''}`.localeCompare(`${b.date ?? b.year}${b.time ?? ''}${b.seq ?? ''}`))
}

export function groupByYear(photos: GalleryPhoto[]) {
  const map = new Map<string, GalleryPhoto[]>()
  for (const photo of photos) {
    const bucket = map.get(photo.year)
    if (bucket) bucket.push(photo)
    else map.set(photo.year, [photo])
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, list]) => ({ year, photos: list }))
}
