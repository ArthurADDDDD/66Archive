import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import type { GalleryPhoto } from './gallery-photos'

/**
 * 读画廊清单。清单由 scripts/gallery-photos-build.ts 生成。
 * 只给服务端组件用——这里有 node:fs，客户端组件不能碰。
 */
const MANIFEST = path.join(process.cwd(), 'data/reports/gallery-photos.yaml')

export function getGalleryPhotos(): GalleryPhoto[] {
  if (!fs.existsSync(MANIFEST)) return []
  const doc = yaml.load(fs.readFileSync(MANIFEST, 'utf8')) as { photos?: GalleryPhoto[] }
  // hidden 在这里就过滤掉：不是每个读这份清单的调用方都会记得再判一次，
  // 漏判的后果是「后台点了隐藏，图还在首页」，比多写一次判断贵得多。
  return (doc.photos ?? []).filter((p) => p.width > 0 && p.height > 0 && !p.hidden)
}
