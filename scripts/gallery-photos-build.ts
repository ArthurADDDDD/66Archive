/**
 * 画廊素材的构建脚本：把原图压成两档 web 版本，并生成清单。
 *
 * 为什么要两档：画廊一屏就要铺几十张图。直接上原图的话，光是列表就要拉几十兆——
 * 服务器带宽和用户流量都白烧在「显示高度只有 200px 的缩略图」上。
 * 所以列表只加载 thumb（长边 900），点开灯箱才去取 full（长边 1800）。
 *
 * 原图不进仓库。仓库里放的是 web 派生版；母本请自行留档。
 *
 * 依赖 macOS 自带的 sips（不引入任何图像库依赖）。
 *
 * 用法：
 *   npx tsx scripts/gallery-photos-build.ts [原图目录]
 *   原图目录默认 ~/Downloads/tmp
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import yaml from 'js-yaml'
import { MANIFEST_HEADER } from './gallery-edit-core'

const ROOT = process.cwd()
const INCOMING = path.resolve(process.argv[2] ?? path.join(os.homedir(), 'Downloads/tmp'))
const OUT_DIR = path.join(ROOT, 'public/gallery/photos')
const LEGACY_DIR = path.join(ROOT, 'public/gallery')
const ASSETS_YAML = path.join(ROOT, 'data/reports/gallery-assets.yaml')
const MANIFEST = path.join(ROOT, 'data/reports/gallery-photos.yaml')

/**
 * 两档尺寸按「实际会被显示多大」定，不按「原图有多大」定：
 * - 列表里最疏的一档，格子高约 280px，2 倍屏需要约 560px —— thumb 长边 720 够用。
 * - 灯箱在 900px 高的视口上最多显示约 800px 高，2 倍屏需要约 1600px —— full 长边 1600 够用。
 * 再往上加的像素在屏幕上一个都看不出来，只会变成服务器白发出去的流量。
 */
const FULL_EDGE = 1600
const FULL_QUALITY = 80
const THUMB_EDGE = 720
const THUMB_QUALITY = 68

function sipsDimensions(file: string) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' })
  const w = /pixelWidth:\s*(\d+)/.exec(out)
  const h = /pixelHeight:\s*(\d+)/.exec(out)
  if (!w || !h) throw new Error(`读不出尺寸：${file}`)
  return { width: Number(w[1]), height: Number(h[1]) }
}

/** 压一档。只缩不放：原图比目标还小就原样转码，不会把小图硬拉大糊掉。 */
function encode(src: string, dest: string, maxEdge: number, quality: number, size: { width: number; height: number }) {
  const args = ['-s', 'format', 'jpeg', '--setProperty', 'formatOptions', String(quality)]
  if (Math.max(size.width, size.height) > maxEdge) args.push('-Z', String(maxEdge))
  execFileSync('sips', [...args, src, '--out', dest], { stdio: 'ignore' })
}

/** 已经生成过且比原图新就跳过——重跑一次不该把几十张图重新压一遍。 */
function upToDate(src: string, dest: string) {
  if (!fs.existsSync(dest)) return false
  return fs.statSync(dest).mtimeMs >= fs.statSync(src).mtimeMs
}

/**
 * 两套命名，日期都在文件名里（由采集者约定）：
 *
 * 1. YYYY-MM-DD_HHmm_<来源号>_<序号>.jpg
 * 2. <YYYYMMDDHHMMSS>_<图床 id>.jpg —— 同一条博文的多张图共用同一个时间戳
 *
 * 两套都解不出来时才留空（year: null），前台归到「年份待定」。
 * 按项目规矩，判不出来就留空，不拿推测填。
 */
function parseName(stem: string) {
  const dashed = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})_([0-9]+)_(\d+)$/.exec(stem)
  if (dashed) {
    return {
      date: `${dashed[1]}-${dashed[2]}-${dashed[3]}`,
      time: `${dashed[4]}:${dashed[5]}`,
      sourceRef: dashed[6],
      seq: dashed[7],
    }
  }
  const stamped = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\d{2}_(.+)$/.exec(stem)
  if (stamped) {
    return {
      date: `${stamped[1]}-${stamped[2]}-${stamped[3]}`,
      time: `${stamped[4]}:${stamped[5]}`,
      sourceRef: stamped[6],
      seq: null,
    }
  }
  return { date: null, time: null, sourceRef: null, seq: null }
}

type Verified = { alt: string; caption: string; date: string; source: string }

function loadVerified(): Map<string, Verified> {
  const map = new Map<string, Verified>()
  if (!fs.existsSync(ASSETS_YAML)) return map
  const doc = yaml.load(fs.readFileSync(ASSETS_YAML, 'utf8')) as {
    gallery?: { file: string; alt: string; caption: string; date: string; source: string }[]
  }
  for (const item of doc.gallery ?? []) {
    map.set(path.basename(item.file, path.extname(item.file)), {
      alt: item.alt,
      caption: item.caption,
      date: item.date,
      source: item.source,
    })
  }
  return map
}

type Photo = {
  id: string
  src: string
  thumb: string
  width: number
  height: number
  year: string | null
  date: string | null
  time: string | null
  seq: string | null
  sourceRef: string | null
  title: string | null
  caption: string | null
  source: string | null
  hidden: boolean
}

/** 后台可编辑的字段。已经存在的条目上这些字段永远保留原值，构建脚本从不覆盖。 */
const EDITABLE_FIELDS = ['title', 'caption', 'date', 'time', 'year', 'source', 'hidden'] as const

/**
 * 已有清单里的这批字段是「事实」——由人（后台管理画廊）核实、修正过。
 * 这个脚本只负责两件事：给新收的图建条目、给旧图刷新技术性字段（尺寸、路径）。
 * 它绝不能在重跑时把后台改过的标题、日期、隐藏状态冲掉，否则后台编辑和本地加图
 * 谁跑得晚就赢，等于没有一边是可信的。
 */
function loadExisting(): Map<string, Photo> {
  const map = new Map<string, Photo>()
  if (!fs.existsSync(MANIFEST)) return map
  const doc = yaml.load(fs.readFileSync(MANIFEST, 'utf8')) as { photos?: Photo[] }
  for (const photo of doc.photos ?? []) map.set(photo.id, photo)
  return map
}

function withPreservedFields(id: string, computed: Photo, existing: Map<string, Photo>): Photo {
  const prior = existing.get(id)
  if (!prior) return computed
  const merged = { ...computed }
  for (const field of EDITABLE_FIELDS) {
    // 字段本身缺失（比如给旧清单新加了一个字段）时保留新算出来的默认值，
    // 不要把 undefined 写回去——那会在下次 dump 时把这个键整个丢掉。
    if (field in prior) (merged as Record<string, unknown>)[field] = prior[field]
  }
  return merged
}

const verified = loadVerified()
const existing = loadExisting()
fs.mkdirSync(OUT_DIR, { recursive: true })

const photos: Photo[] = []
let reused = 0
let built = 0

/** 仓库里已经有的周年图：只补一张 thumb，大图沿用原路径，不再复制一份。 */
for (const filename of fs.existsSync(LEGACY_DIR) ? fs.readdirSync(LEGACY_DIR).sort() : []) {
  if (!/\.(jpe?g|png)$/i.test(filename)) continue
  const src = path.join(LEGACY_DIR, filename)
  const stem = filename.replace(/\.[^.]+$/, '')
  const size = sipsDimensions(src)
  const thumbDest = path.join(OUT_DIR, `${stem}.thumb.jpg`)
  if (upToDate(src, thumbDest)) reused++
  else {
    encode(src, thumbDest, THUMB_EDGE, THUMB_QUALITY, size)
    built++
  }
  const known = verified.get(stem)
  photos.push(
    withPreservedFields(
      stem,
      {
        id: stem,
        src: `/gallery/${filename}`,
        thumb: `/gallery/photos/${stem}.thumb.jpg`,
        width: size.width,
        height: size.height,
        year: known?.date.slice(0, 4) ?? null,
        date: known?.date ?? null,
        time: null,
        seq: null,
        sourceRef: null,
        title: known?.alt ?? null,
        caption: known?.caption ?? null,
        source: known?.source ?? null,
        hidden: false,
      },
      existing,
    ),
  )
}

/** 新收来的原图：压出 full + thumb 两档，原图不进仓库。 */
for (const filename of fs.existsSync(INCOMING) ? fs.readdirSync(INCOMING).sort() : []) {
  if (!/\.(jpe?g|png)$/i.test(filename)) continue
  const src = path.join(INCOMING, filename)
  const stem = filename.replace(/\.[^.]+$/, '')
  const size = sipsDimensions(src)
  const fullDest = path.join(OUT_DIR, `${stem}.jpg`)
  const thumbDest = path.join(OUT_DIR, `${stem}.thumb.jpg`)
  if (upToDate(src, fullDest) && upToDate(src, thumbDest)) reused++
  else {
    encode(src, fullDest, FULL_EDGE, FULL_QUALITY, size)
    encode(src, thumbDest, THUMB_EDGE, THUMB_QUALITY, size)
    built++
  }
  // 清单里记的是 full 的尺寸——布局按它的宽高比排，缩略图只是同比例的小一号
  const fullSize = sipsDimensions(fullDest)
  const parsed = parseName(stem)
  photos.push(
    withPreservedFields(
      stem,
      {
        id: stem,
        src: `/gallery/photos/${stem}.jpg`,
        thumb: `/gallery/photos/${stem}.thumb.jpg`,
        width: fullSize.width,
        height: fullSize.height,
        year: parsed.date?.slice(0, 4) ?? null,
        date: parsed.date,
        time: parsed.time,
        seq: parsed.seq,
        sourceRef: parsed.sourceRef,
        title: null,
        caption: null,
        source: null,
        hidden: false,
      },
      existing,
    ),
  )
}

photos.sort((a, b) => {
  // 年份不明的排在最后，其余按时间正序
  if ((a.year === null) !== (b.year === null)) return a.year === null ? 1 : -1
  return `${a.date ?? ''}${a.time ?? ''}${a.id}`.localeCompare(`${b.date ?? ''}${b.time ?? ''}${b.id}`)
})

const undated = photos.filter((p) => p.year === null)

fs.writeFileSync(MANIFEST, `${MANIFEST_HEADER}${yaml.dump({ photos }, { lineWidth: 120 })}`)

const bytes = (dir: string) =>
  fs.readdirSync(dir).reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0)

console.log(`原图目录：${INCOMING}`)
console.log(`共 ${photos.length} 张（新压 ${built}，复用 ${reused}）`)
console.log(`派生文件占用：${(bytes(OUT_DIR) / 1024 / 1024).toFixed(1)} MB → ${path.relative(ROOT, OUT_DIR)}`)
console.log(`年份待定：${undated.length} 张`)
for (const p of undated) console.log(`  · ${p.id}`)
console.log(`清单：${path.relative(ROOT, MANIFEST)}`)
