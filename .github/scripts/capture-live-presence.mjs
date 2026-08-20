import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const targets = [
  { name: 'home-desktop', url: 'https://i6i6.space/', viewport: { width: 1440, height: 1000 } },
  { name: 'home-mobile', url: 'https://i6i6.space/', viewport: { width: 390, height: 844 }, isMobile: true },
  { name: 'entry-desktop', url: 'https://i6i6.space/e/2026-08-09-live-02/', viewport: { width: 1440, height: 1000 } },
  { name: 'entry-mobile', url: 'https://i6i6.space/e/2026-08-09-live-02/', viewport: { width: 390, height: 844 }, isMobile: true },
]

await fs.mkdir('screenshots', { recursive: true })
const browser = await chromium.launch({ headless: true })

for (const target of targets) {
  const context = await browser.newContext({
    viewport: target.viewport,
    deviceScaleFactor: 1,
    isMobile: target.isMobile ?? false,
    hasTouch: target.isMobile ?? false,
  })
  const page = await context.newPage()
  await page.goto(target.url, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(5000)
  await page.screenshot({ path: `screenshots/${target.name}.png`, fullPage: false })
  await context.close()
}

await browser.close()
