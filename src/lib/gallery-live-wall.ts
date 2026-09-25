import fs from 'node:fs'
import path from 'node:path'
import { getDataset } from './data'

/**
 * 画廊「全直播合集」的构建期摘要。只给服务端组件用（有 node:fs）。
 *
 * 清单本体（几千格的日期与标题）不烤进页面，由 GalleryLiveWall 切到该标签时再去取；
 * 这里只算两样首屏就要的东西：标签上的场次数，和需要在图上盖掉的已隐藏条目。
 *
 * 隐藏名单从**全量** `getDataset()` 里取，而不是 `getPublicDataset()`：后者已经把它们滤掉了，
 * 恰恰拿不到要盖掉的那几格。
 */
const MANIFEST = path.join(process.cwd(), 'public/gallery/live-wall/index.json')

export function getLiveWallSummary(): { count: number; hiddenIds: string[] } | null {
  if (!fs.existsSync(MANIFEST)) return null
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { tiles?: [string, ...unknown[]][] }
  const tileIds = new Set((manifest.tiles ?? []).map((tile) => tile[0]))
  if (tileIds.size === 0) return null
  const hiddenIds = getDataset()
    .entries.filter((entry) => entry.hidden && tileIds.has(entry.id))
    .map((entry) => entry.id)
  return { count: tileIds.size - hiddenIds.length, hiddenIds }
}
