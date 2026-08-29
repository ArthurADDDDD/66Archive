/**
 * 画廊改版的本地预览清单生成器。
 *
 * 扫描 public/_preview/gallery（gitignored 的本地素材）与 public/gallery（仓库已有的周年图），
 * 读出每张图的真实像素尺寸，写成 data/_demo/gallery-preview.json。
 *
 * 布局要按真实宽高比排版（横竖混排不裁切），所以尺寸必须在构建期就知道——
 * 靠浏览器加载后再测会导致整页跳动。这里不引入图像库，直接读文件头：
 * JPEG 扫 SOF 段，PNG 读 IHDR。
 *
 * 用法：npx tsx scripts/gallery-preview-manifest.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'data/_demo/gallery-preview.json')

const SOURCES = [
  { dir: 'public/_preview/gallery', base: '/_preview/gallery' },
  { dir: 'public/gallery', base: '/gallery' },
]

function pngSize(buf: Buffer) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function jpegSize(buf: Buffer) {
  if (buf.readUInt16BE(0) !== 0xffd8) return null
  let offset = 2
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buf[offset + 1]
    // SOF0..SOF15，跳过 DHT(c4) / JPG(c8) / DAC(cc) 这三个不是帧头的
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) }
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    offset += 2 + buf.readUInt16BE(offset + 2)
  }
  return null
}

function readSize(file: string) {
  const buf = fs.readFileSync(file)
  return pngSize(buf) ?? jpegSize(buf)
}

/** 素材命名约定：YYYY-MM-DD_HHmm_<来源号>_<序号>.jpg；不符合的退回文件名本身。 */
function parseName(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, '')
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})_([0-9]+)_(\d+)$/.exec(stem)
  if (!m) return { date: null as string | null, time: null as string | null, seq: null as string | null, sourceRef: null as string | null }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}`, sourceRef: m[6], seq: m[7] }
}

/** 仓库已有的周年图没有日期前缀，但文件名里带年份。 */
function yearFromLegacyName(stem: string) {
  const m = /(20\d{2})/.exec(stem)
  return m ? m[1] : null
}

const items: unknown[] = []

for (const source of SOURCES) {
  const dir = path.join(ROOT, source.dir)
  if (!fs.existsSync(dir)) continue
  for (const filename of fs.readdirSync(dir).sort()) {
    if (!/\.(jpe?g|png)$/i.test(filename)) continue
    const size = readSize(path.join(dir, filename))
    if (!size) {
      console.warn(`跳过（读不出尺寸）：${source.dir}/${filename}`)
      continue
    }
    const stem = filename.replace(/\.[^.]+$/, '')
    const parsed = parseName(filename)
    const year = parsed.date?.slice(0, 4) ?? yearFromLegacyName(stem)
    if (!year) {
      console.warn(`跳过（判不出年份）：${source.dir}/${filename}`)
      continue
    }
    items.push({
      id: stem,
      src: `${source.base}/${filename}`,
      width: size.width,
      height: size.height,
      year,
      date: parsed.date,
      time: parsed.time,
      seq: parsed.seq,
      sourceRef: parsed.sourceRef,
      // 标题留空：真正的命名由人来写，占位文案会被误当成已确认信息。
      title: null,
    })
  }
}

items.sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)))

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify({ generatedFrom: SOURCES.map((s) => s.dir), items }, null, 2)}\n`)
console.log(`写入 ${items.length} 条 → ${path.relative(ROOT, OUT)}`)
