// Renders public/icons/*.png from live-alert-icon.svg with a local Chromium (Playwright). Run from the repo root:
//   node scripts/icons/render-icons.mjs
// Needs Playwright and the "Inter Display" font installed locally; the PNGs are committed, so builds never run this.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM ?? import.meta.url)
const { chromium } = require('playwright')
const source = readFileSync('scripts/icons/live-alert-icon.svg', 'utf8')
const variants = [
  // purpose "any": rounded tile. "maskable": full bleed, artwork inside the 80% safe zone. Apple: full bleed (iOS rounds it).
  { file: 'icon-192.png', size: 192, rx: 112, scale: 1 }, { file: 'icon-512.png', size: 512, rx: 112, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, rx: 0, scale: 0.78 }, { file: 'apple-touch-icon.png', size: 180, rx: 0, scale: 0.92 },
]
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
for (const v of variants) {
  const page = await browser.newPage({ viewport: { width: v.size, height: v.size }, deviceScaleFactor: 1 })
  const svg = source.replaceAll('__RX__', String(v.rx)).replace('__SCALE__', String(v.scale)).replace('width="512" height="512"', `width="${v.size}" height="${v.size}"`)
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
  await page.screenshot({ path: `public/icons/${v.file}`, omitBackground: v.rx > 0, clip: { x: 0, y: 0, width: v.size, height: v.size } })
  await page.close()
}
await browser.close()
