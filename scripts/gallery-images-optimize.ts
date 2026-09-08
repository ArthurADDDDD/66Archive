/**
 * 为画廊缩略图生成浏览器可按屏幕宽度选择的 AVIF / WebP 派生文件。
 *
 * JPEG 保留作兼容兜底；列表优先请求现代格式，灯箱仍只在用户点开时请求大图。
 * 该脚本不修改画廊清单或任何人工核验字段，可以安全重复执行。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const PHOTOS_DIR = path.join(ROOT, 'public/gallery/photos')
const WIDTHS = [360, 720] as const

type Format = {
  extension: 'avif' | 'webp'
  encode: (image: sharp.Sharp) => sharp.Sharp
}

const FORMATS: Format[] = [
  { extension: 'avif', encode: (image) => image.avif({ quality: 50, effort: 4 }) },
  { extension: 'webp', encode: (image) => image.webp({ quality: 74, effort: 4 }) },
]

async function upToDate(source: string, destination: string) {
  try {
    const [src, dest] = await Promise.all([fs.stat(source), fs.stat(destination)])
    return dest.mtimeMs >= src.mtimeMs
  } catch {
    return false
  }
}

async function main() {
  const files = (await fs.readdir(PHOTOS_DIR)).filter((name) => name.endsWith('.thumb.jpg')).sort()
  let built = 0
  let reused = 0

  for (const filename of files) {
    const source = path.join(PHOTOS_DIR, filename)
    const stem = filename.slice(0, -'.thumb.jpg'.length)

    for (const width of WIDTHS) {
      for (const format of FORMATS) {
        const destination = path.join(PHOTOS_DIR, `${stem}.thumb-${width}.${format.extension}`)
        if (await upToDate(source, destination)) {
          reused++
          continue
        }

        const image = sharp(source).rotate().resize({ width, withoutEnlargement: true })
        await format.encode(image).toFile(destination)
        built++
      }
    }
  }

  // 灯箱大图：不缩尺寸，只转 webp。理由与档位选择见 lib/gallery-photos.ts 的
  // `galleryFullSource`——这批原图本来就只有 1,048 px 中位宽，能省的是编码不是尺寸。
  const originals = (await fs.readdir(PHOTOS_DIR))
    .filter((name) => name.endsWith('.jpg') && !name.endsWith('.thumb.jpg'))
    .sort()
  let fullBuilt = 0
  let fullReused = 0
  for (const filename of originals) {
    const source = path.join(PHOTOS_DIR, filename)
    const destination = path.join(PHOTOS_DIR, `${filename.slice(0, -'.jpg'.length)}.full.webp`)
    if (await upToDate(source, destination)) {
      fullReused++
      continue
    }
    await sharp(source).rotate().webp({ quality: 80, effort: 4 }).toFile(destination)
    fullBuilt++
  }
  console.log(`灯箱大图：${originals.length} 张；新生成 ${fullBuilt} 个，复用 ${fullReused} 个`)

  const generated = (await fs.readdir(PHOTOS_DIR)).filter((name) => /\.thumb-(360|720)\.(avif|webp)$/.test(name))
  const bytes = (await Promise.all(generated.map(async (name) => (await fs.stat(path.join(PHOTOS_DIR, name))).size))).reduce(
    (sum, size) => sum + size,
    0,
  )

  console.log(`画廊缩略图：${files.length} 张；新生成 ${built} 个，复用 ${reused} 个`)
  console.log(`现代格式派生文件：${generated.length} 个，共 ${(bytes / 1024 / 1024).toFixed(2)} MiB`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
