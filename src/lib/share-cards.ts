import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

/**
 * 读分享卡片文案与图片，两者都按页面 id 分开维护，都在 data/share-cards.yaml。
 * 由后台「分享卡片」页面维护——文案走暂存 → 推送 → CI 的目录编辑同一条路，
 * 图片由专门的落盘步骤写回 `image` 字段。只给服务端组件用——这里有 node:fs，
 * 客户端组件不能碰。
 *
 * 两个 getter 都不抛错、不返回 undefined：文件缺失、某个 id 没有条目、或者
 * 那个页面还没设过图，一律落到调用方传入的兜底值——page-metadata.ts 里那句
 * 手写的文案与那张全站共用的图，就是这份兜底。
 */

const CARDS_FILE = path.join(process.cwd(), 'data/share-cards.yaml')

type ShareCardRecord = { id: string; description: string; image?: string | null }

let cachedRecords: Map<string, ShareCardRecord> | null = null

function loadRecords(): Map<string, ShareCardRecord> {
  if (cachedRecords) return cachedRecords
  const map = new Map<string, ShareCardRecord>()
  if (fs.existsSync(CARDS_FILE)) {
    const list = yaml.load(fs.readFileSync(CARDS_FILE, 'utf8')) as ShareCardRecord[] | null
    for (const record of list ?? []) {
      if (record?.id) map.set(record.id, record)
    }
  }
  cachedRecords = map
  return map
}

export function getShareCardDescription(pageId: string, fallback: string): string {
  const description = loadRecords().get(pageId)?.description
  return description && description.trim() ? description : fallback
}

/** 这个页面自己的分享图；这一页还没单独设过图就落到 fallback（通常是全站默认图）。 */
export function getShareCardImage(pageId: string, fallback: string): string {
  const image = loadRecords().get(pageId)?.image
  return image && image.trim() ? image : fallback
}

/** 原始记录列表，给 build-snapshot.ts 用——后台「分享卡片」页面靠它显示当前值。 */
export function getShareCardRecords(): ShareCardRecord[] {
  return [...loadRecords().values()]
}
