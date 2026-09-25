import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import type { GalleryPhoto } from './gallery-photos'
import { FEATURED_GALLERY_CATEGORY_BY_ID, FEATURED_GALLERY_IDS, FULL_GALLERY_IDS } from './gallery-selection'

/**
 * 读画廊清单。清单由 scripts/gallery-photos-build.ts 生成。
 * 只给服务端组件用——这里有 node:fs，客户端组件不能碰。
 */
const MANIFEST = path.join(process.cwd(), 'data/reports/gallery-photos.yaml')

function readManifest(): GalleryPhoto[] {
  if (!fs.existsSync(MANIFEST)) return []
  const doc = yaml.load(fs.readFileSync(MANIFEST, 'utf8')) as { photos?: GalleryPhoto[] }
  return (doc.photos ?? []).filter((p) => p.width > 0 && p.height > 0)
}

export function getGalleryPhotos(): GalleryPhoto[] {
  // hidden 在这里就过滤掉：不是每个读这份清单的调用方都会记得再判一次，
  // 漏判的后果是「后台点了隐藏，图还在首页」，比多写一次判断贵得多。
  return readManifest().filter((p) => !p.hidden)
}

/**
 * 给后台快照用（scripts/build-snapshot.ts）：**包括已隐藏的**，并标出是否在精选策展表里。
 *
 * 后台要能把隐藏的照片找回来、取消隐藏；要是快照也用 getGalleryPhotos，
 * 一张照片一旦隐藏落盘，就从后台彻底消失了。前台页面永远不要读这个。
 */
export function getGalleryPhotosForAdmin(): (GalleryPhoto & { featured: boolean })[] {
  const featured = new Set<string>(FEATURED_GALLERY_IDS)
  return readManifest().map((photo) => ({ ...photo, featured: featured.has(photo.id) }))
}

function selectPhotos(photos: GalleryPhoto[], ids: readonly string[]) {
  const byId = new Map(photos.map((photo) => [photo.id, photo]))
  // 后台把照片设为 hidden 后，getGalleryPhotos 已经把它滤掉；策展顺序表里即使还留着 id，
  // 发布页也应当安静地略过，而不是因为少一张图让整次构建失败。
  return ids.flatMap((id) => {
    const photo = byId.get(id)
    return photo ? [photo] : []
  })
}

/** 发布版的两种看法共用同一份照片元数据，只在这里按稳定 id 取不同顺序。 */
export function getGalleryCollections() {
  const photos = getGalleryPhotos()
  // 后台「移出精选」的照片只从纪念版里略过，全量照常收着。
  const featured = selectPhotos(photos, FEATURED_GALLERY_IDS).filter((photo) => !photo.unfeatured).map((photo) => {
    const category = FEATURED_GALLERY_CATEGORY_BY_ID[photo.id as keyof typeof FEATURED_GALLERY_CATEGORY_BY_ID]
    return category ? { ...photo, tags: [category] } : photo
  })
  return {
    featured,
    all: selectPhotos(photos, FULL_GALLERY_IDS),
  }
}
