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
  return (doc.photos ?? []).filter((p) => p.width > 0 && p.height > 0)
}
