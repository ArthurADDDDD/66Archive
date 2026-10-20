/**
 * Generate site identity icons from the same portrait as the browser favicon.
 * Do NOT overwrite public/icons/icon-192.png: that is the bell used by Web Push.
 *
 * The PNGs are deterministic build artifacts (ignored by git) and are generated
 * before Next dev/build, so Android/iOS never fall back to the notification bell.
 */
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const portrait = fileURLToPath(new URL('../../public/images/avatars/v1_2015.jpg', import.meta.url))
const output = fileURLToPath(new URL('../../public/icons/', import.meta.url))
const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url))
const crop = { fit: 'cover', position: sharp.strategy.attention }

await mkdir(output, { recursive: true })

for (const size of [192, 512]) {
  await sharp(portrait)
    .rotate()
    .resize(size, size, crop)
    .png()
    .toFile(`${output}/site-${size}.png`)
}

// Apple rounds its home-screen icons. Keep the full portrait in a square PNG.
await sharp(portrait)
  .rotate()
  .resize(180, 180, crop)
  .png()
  .toFile(`${output}/site-apple-touch-icon.png`)

// iOS 与不少客户端（含收藏夹、聊天软件抓预览）不读 <link>，直接探测站点根目录的固定路径，
// 此前这几个地址一直 404。内容与上面那份完全相同。
for (const name of ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png']) {
  await sharp(portrait).rotate().resize(180, 180, crop).png().toFile(`${publicRoot}/${name}`)
}

// /favicon.ico：ICO 容器里直接嵌 PNG（Vista 起所有浏览器都认），16 与 32 两档。
const icoSizes = [16, 32]
const icoImages = await Promise.all(icoSizes.map((size) => sharp(portrait).rotate().resize(size, size, crop).png().toBuffer()))
const icoHeader = Buffer.alloc(6 + 16 * icoImages.length)
icoHeader.writeUInt16LE(0, 0)
icoHeader.writeUInt16LE(1, 2)
icoHeader.writeUInt16LE(icoImages.length, 4)
let icoOffset = icoHeader.length
icoImages.forEach((image, index) => {
  const entry = 6 + 16 * index
  icoHeader.writeUInt8(icoSizes[index], entry)
  icoHeader.writeUInt8(icoSizes[index], entry + 1)
  icoHeader.writeUInt16LE(1, entry + 4)
  icoHeader.writeUInt16LE(32, entry + 6)
  icoHeader.writeUInt32LE(image.length, entry + 8)
  icoHeader.writeUInt32LE(icoOffset, entry + 12)
  icoOffset += image.length
})
await writeFile(`${publicRoot}/favicon.ico`, Buffer.concat([icoHeader, ...icoImages]))

// The Android maskable icon needs its important artwork inside the central
// 80% safe area. A circular crop keeps the portrait away from system masks.
const innerSize = 360
const inner = await sharp(portrait)
  .rotate()
  .resize(innerSize, innerSize, crop)
  .png()
  .toBuffer()
const mask = Buffer.from(`<svg width="${innerSize}" height="${innerSize}" xmlns="http://www.w3.org/2000/svg"><circle cx="${innerSize / 2}" cy="${innerSize / 2}" r="${innerSize / 2}" fill="#fff"/></svg>`)
const circularPortrait = await sharp(inner)
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#12141c' } })
  .composite([{ input: circularPortrait, left: 76, top: 76 }])
  .png()
  .toFile(`${output}/site-maskable-512.png`)
