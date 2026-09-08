/**
 * 为条目页的本地封面生成 AVIF / WebP 派生文件。
 *
 * 与 `scripts/gallery-images-optimize.ts` 同一套做法（同样的档位、同样的编码参数、
 * 同样按 mtime 跳过），只是换一批源图和一套命名。两处刻意没有合并成一个脚本：
 * 目录、命名规则和消费方都不同，凑在一起只会让两边都得读一遍才敢改。
 *
 * 为什么需要：`/e/*` 的封面是全站条目页的 LCP 元素，而 `lib/platforms.ts` 的
 * `proxyImage` 对 `/` 开头的地址直接原样返回、`proxyImageSrcSet` 返回 null——
 * 远程封面早就按显示宽度取图了，这 89 张本地封面却一直发原图。实测源图 88 张
 * 960px、1 张 1280px，中位 54,991 B，而它显示在 328 px（桌面侧栏）/ 92vw（手机）的框里。
 *
 * 实测 89 张合计：
 *
 *   原图 jpg   4,894,242 B
 *   w720 webp  2,161,522 B   avif 1,638,568 B
 *   w360 webp    894,262 B   avif   745,165 B
 *
 * 也就是 DPR 2 的手机每页省约 30.7 KB（webp）/ 36.6 KB（avif），DPR 1 桌面省约 45 KB。
 *
 * 派生文件和画廊那批一样**提交进仓库**：`<picture>` 的 `<source>` 一旦 404 是不会
 * 回落到 `<img>` 的，所以文件必须由仓库保证存在，不能指望构建时才现生成。
 * 脚本可以安全重复执行。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const COVERS_DIR = path.join(ROOT, 'public/images/covers')
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
  const files = (await fs.readdir(COVERS_DIR)).filter((name) => name.endsWith('.jpg')).sort()
  let built = 0
  let reused = 0

  for (const filename of files) {
    const source = path.join(COVERS_DIR, filename)
    const stem = filename.slice(0, -'.jpg'.length)

    for (const width of WIDTHS) {
      for (const format of FORMATS) {
        const destination = path.join(COVERS_DIR, `${stem}.w${width}.${format.extension}`)
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

  const generated = (await fs.readdir(COVERS_DIR)).filter((name) => /\.w(360|720)\.(avif|webp)$/.test(name))
  const bytes = (
    await Promise.all(generated.map(async (name) => (await fs.stat(path.join(COVERS_DIR, name))).size))
  ).reduce((sum, size) => sum + size, 0)

  console.log(`条目封面：${files.length} 张；新生成 ${built} 个，复用 ${reused} 个`)
  console.log(`现代格式派生文件：${generated.length} 个，共 ${(bytes / 1024 / 1024).toFixed(2)} MiB`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
