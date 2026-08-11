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

/**
 * 素材报告里保存的是平台 + 稳定 ID，而不是把外链重复写进展示数据。
 * 只有能从稳定 ID 明确还原的平台才生成跳转，未知格式继续只显示文字。
 */
export function gallerySourceHref(source: string): string | null {
  const explicit = source.match(/https?:\/\/[^\s)]+/i)?.[0]
  if (explicit) return explicit.replace(/[。，、；;]+$/, '')

  const bvid = source.match(/\bBV[0-9A-Za-z]+\b/i)?.[0]
  if (bvid) return `https://www.bilibili.com/video/${bvid}`

  const youkuId = source.match(/\bX[A-Za-z0-9_-]+={0,2}/)?.[0]
  if (youkuId) return `https://v.youku.com/v_show/id_${youkuId}.html`

  return null
}

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
