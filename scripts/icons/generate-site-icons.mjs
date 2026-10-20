/**
 * Generate site identity icons from the same portrait as the browser favicon.
 * Do NOT overwrite public/icons/icon-192.png: that is the bell used by Web Push.
 *
 * The PNGs are deterministic build artifacts (ignored by git) and are generated
 * before Next dev/build, so Android/iOS never fall back to the notification bell.
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const portrait = fileURLToPath(new URL('../../public/images/avatars/v1_2015.jpg', import.meta.url))
const output = fileURLToPath(new URL('../../public/icons/', import.meta.url))
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
