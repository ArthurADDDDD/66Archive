import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

/**
 * 画廊照片编辑的共享核心，供公开仓 CLI 与私仓后台落盘 CI 复用。
 *
 * 与 archive-edit-core.ts（`data/entries/**`）的关键区别：entries 是人工维护、
 * 带注释的多文件格式，改一条要做逐行手术式替换才能不产生噪声 diff；
 * gallery-photos.yaml 从头到尾只有一个写者组（构建脚本 + 这里），
 * 从不手改，所以整份重新 dump 是安全的——不会丢注释（没有），
 * 也不会把无关条目的格式重写出一堆假 diff（同样的 dump 选项对同样的值
 * 产出同样的文本，没变的条目字节不变）。
 */

export const MANIFEST_HEADER = [
  '# 画廊清单 —— 由 scripts/gallery-photos-build.ts（新增照片）与后台「画廊管理」',
  '# （编辑已收录照片的元数据）共同维护。前者只在字段缺失时才写入默认值，',
  '# 不会覆盖已经确认过的标题/日期/图注/隐藏状态，因此这份文件永远不需要手改。',
  '# width / height 是 full 版的像素尺寸，布局按它的宽高比排等高行。',
  '# year / date 为 null 表示还没核实出拍摄年份，前台会归到「年份待定」，不做推测。',
  '',
].join('\n')

export const MANIFEST_RELATIVE_PATH = 'data/reports/gallery-photos.yaml'

type PhotoRecord = Record<string, unknown> & { id: string }

export type LocatedPhoto = {
  absolutePath: string
  relativePath: string
  photos: PhotoRecord[]
  photo: PhotoRecord
}

function manifestPath(root: string) {
  return path.join(root, MANIFEST_RELATIVE_PATH)
}

function readPhotos(file: string): PhotoRecord[] {
  if (!fs.existsSync(file)) return []
  const parsed = yaml.load(fs.readFileSync(file, 'utf8')) as { photos?: unknown } | null
  const values = Array.isArray(parsed?.photos) ? parsed.photos : []
  return values.filter((value): value is PhotoRecord => {
    return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string'
  })
}

/** 照片 id 与 scripts/gallery-photos-build.ts 生成的 stem 保持一致：文件名去掉扩展名。 */
export function isValidPhotoId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,299}$/.test(value)
}

export function findGalleryPhoto(root: string, photoId: string): LocatedPhoto {
  if (!isValidPhotoId(photoId)) throw new Error('photo id 格式无效')
  const absolutePath = manifestPath(root)
  const photos = readPhotos(absolutePath)
  const matches = photos.filter((photo) => photo.id === photoId)
  if (matches.length === 0) throw new Error(`找不到画廊照片：${photoId}`)
  if (matches.length > 1) throw new Error(`画廊照片 id 重复，拒绝编辑：${photoId}`)
  return { absolutePath, relativePath: MANIFEST_RELATIVE_PATH, photos, photo: matches[0] }
}

function photosById(photos: PhotoRecord[], label: string) {
  const result = new Map<string, PhotoRecord>()
  for (const photo of photos) {
    if (result.has(photo.id)) throw new Error(`${label} 中存在重复 photo id：${photo.id}`)
    result.set(photo.id, photo)
  }
  return result
}

/** 与 archive-edit-core.assertOnlyTargetEntryChanged 同一套判断，换成照片记录。 */
export function assertOnlyTargetPhotoChanged(beforeFile: string, afterFile: string, targetId: string) {
  const before = photosById(readPhotos(beforeFile), '修改前文件')
  const after = photosById(readPhotos(afterFile), '修改后文件')
  if (before.size !== after.size || [...before.keys()].some((id) => !after.has(id))) {
    throw new Error('不允许在安全编辑流程中新增、删除照片或改写 photo id')
  }
  const changed = [...before.keys()].filter((id) => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)))
  if (changed.length === 0) throw new Error('文件内容没有发生照片字段变化')
  if (changed.length !== 1 || changed[0] !== targetId) {
    throw new Error(`一次只能修改目标照片 ${targetId}；实际变化：${changed.join('、')}`)
  }
}

const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]+', 'g')

export function normalizeEvidence(value: string) {
  const normalized = value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) throw new Error('依据不能为空')
  if (normalized.length > 500) throw new Error('依据不能超过 500 个字符')
  return normalized
}

export function galleryCommitMessage(photoId: string, evidence: string, changeId: string) {
  return [
    `data(gallery): correct ${photoId}`,
    '',
    `Gallery-Photo: ${photoId}`,
    `Gallery-Change-ID: ${changeId}`,
    `Gallery-Evidence: ${normalizeEvidence(evidence)}`,
  ].join('\n')
}
