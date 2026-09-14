import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

type GalleryAsset = {
  id: string
  file: string
  alt: string
  caption: string
  date: string
  source: string
  dimensions: string
}

type GalleryGap = {
  years?: string
  item?: string
  reason: string
}

type GalleryReport = {
  gallery?: GalleryAsset[]
  gaps?: GalleryGap[]
}

export type GalleryItem = GalleryAsset & {
  year: string
  src: string
}

export { gallerySourceHref } from './gallery-href'

const ROOT = process.cwd()
const REPORT = path.join(ROOT, 'data/reports/gallery-assets.yaml')

// 三个素材实际是 PNG，只是采集时沿用了来源文件名的 .jpg 后缀。
const PUBLIC_NAME_OVERRIDES: Record<string, string> = {
  'anniv_06_3rd_2018_gala.jpg': 'anniv_06_3rd_2018_gala.png',
  'anniv_07_3rd_2018_blessing.jpg': 'anniv_07_3rd_2018_blessing.png',
  'anniv_09_duet_2018.jpg': 'anniv_09_duet_2018.png',
}

export function getGalleryCollection() {
  if (!fs.existsSync(REPORT)) return { items: [] as GalleryItem[], gaps: [] as GalleryGap[] }

  const report = yaml.load(fs.readFileSync(REPORT, 'utf8')) as GalleryReport
  const items = (report.gallery ?? []).map((item) => {
    const filename = path.basename(item.file)
    const publicFilename = PUBLIC_NAME_OVERRIDES[filename] ?? filename
    return {
      ...item,
      year: item.date.slice(0, 4),
      src: `/gallery/${publicFilename}`,
    }
  })

  return { items, gaps: report.gaps ?? [] }
}
