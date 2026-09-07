/**
 * 「水友们最爱看」用的标题索引。
 *
 * 排行接口只回内容 ID 与次数——后台没有权威标题，也不该再复制一份档案元数据。
 * 标题只能由前台自己解析，而 /stats 是静态页，构建时并不知道将来谁会排进前十，
 * 所以这里把「ID → 标题」整份导出成一个独立的静态文件，由数据页在需要时才去取。
 *
 * 为什么不直接把这份映射塞进页面 props：全量映射有一百多 KB，塞进 HTML 等于
 * 每个打开数据页的人都为「十行排行」下载整本档案目录。做成单独文件后，它既
 * 可以被浏览器缓存，也不会拖慢首屏。
 *
 * 产物是派生数据，不进版本库（见 .gitignore）；`npm run dev` / `npm run build`
 * 会先跑一遍这个脚本。缺文件时数据页照常渲染，只是排行退回显示 ID。
 *
 * 用法：npx tsx scripts/popular-index-build.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { getDataset } from '../src/lib/data'
import { getGalleryPhotos } from '../src/lib/gallery-photos-manifest'
import { galleryPhotoLabel } from '../src/lib/gallery-photos'
import { buildSeriesList } from '../src/lib/series'
import { toTimelineEntries } from '../src/lib/data'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'public/data/popular-index.json')

type IndexEntry = { t: string; d?: string }

function main() {
  const ds = getDataset()
  const timeline = toTimelineEntries(ds)
  const items: Record<string, IndexEntry> = {}

  for (const entry of ds.entries) items[`entry:${entry.id}`] = { t: entry.title, d: entry.date }
  for (const [id, game] of ds.games) items[`game:${id}`] = { t: game.name }
  for (const series of buildSeriesList(ds, timeline)) items[`series:${series.id}`] = { t: series.name }
  // 画廊取的是**画廊页真正在渲染的那份清单**（gallery-photos.yaml），不是旧的
  // gallery-assets。两份数据的 ID 空间不一样，取错了这里会生成一堆永远匹配不上的键，
  // 排行里的照片则永远退回显示 ID。
  //
  // 标题沿用画廊自己的口径：没有确认过的标题不编一个，只说这是哪一天的画面。
  for (const photo of getGalleryPhotos()) {
    items[`gallery:${photo.id}`] = { t: galleryPhotoLabel(photo), ...(photo.date ? { d: photo.date } : {}) }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify({ version: 1, items })}\n`, 'utf8')
  console.log(`popular-index: ${Object.keys(items).length} 条 → ${path.relative(ROOT, OUT)}`)
}

main()
