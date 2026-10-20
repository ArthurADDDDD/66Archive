import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const iconDir = 'public/icons'
const bell = `${iconDir}/icon-192.png`
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const bellBefore = digest(bell)

// Ensure generated artifacts exist for the build, including maskable + iOS.
execFileSync(process.execPath, ['scripts/icons/generate-site-icons.mjs'], { stdio: 'inherit' })
assert.equal(digest(bell), bellBefore, 'generating site artwork must not replace the push bell')

const expected = [
  ['site-192.png', 192],
  ['site-512.png', 512],
  ['site-maskable-512.png', 512],
  ['site-apple-touch-icon.png', 180],
]
for (const [name, size] of expected) {
  const metadata = await sharp(`${iconDir}/${name}`).metadata()
  assert.equal(metadata.format, 'png', `${name} must be PNG`)
  assert.equal(metadata.width, size, `${name} width`)
  assert.equal(metadata.height, size, `${name} height`)
  assert.notEqual(digest(`${iconDir}/${name}`), bellBefore, `${name} cannot be the push bell`)
}

for (const name of ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png']) {
  const metadata = await sharp(`public/${name}`).metadata()
  assert.equal(metadata.format, 'png', `${name} must be PNG`)
  assert.equal(metadata.width, 180, `${name} width`)
  assert.equal(digest(`public/${name}`), digest(`${iconDir}/site-apple-touch-icon.png`), `${name} must match the linked iOS icon`)
}
const ico = readFileSync('public/favicon.ico')
assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)], [0, 1, 2], 'favicon.ico header')
for (let index = 0; index < 2; index += 1) {
  const entry = 6 + 16 * index
  const image = ico.subarray(ico.readUInt32LE(entry + 12), ico.readUInt32LE(entry + 12) + ico.readUInt32LE(entry + 8))
  const metadata = await sharp(image).metadata()
  assert.equal(metadata.format, 'png', 'favicon.ico entries embed PNG')
  assert.equal(metadata.width, ico.readUInt8(entry), 'favicon.ico entry size matches its directory')
}

const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'))
assert.deepEqual(
  manifest.icons.map((item) => item.src),
  ['/icons/site-192.png', '/icons/site-512.png', '/icons/site-maskable-512.png'],
  'all Android/PWA variants must use site artwork, not the push notification bell',
)
assert.equal(manifest.icons[2].purpose, 'maskable')
const layout = readFileSync('src/app/layout.tsx', 'utf8')
const sw = readFileSync('public/sw.js', 'utf8')
assert.match(layout, /icon: '\/images\/avatars\/v1_2015\.jpg'/)
assert.match(layout, /apple: '\/icons\/site-apple-touch-icon\.png'/)
assert.match(sw, /icon: '\/icons\/icon-192\.png'/, 'notifications should keep the existing bell')
console.log('site icon checks passed: avatar PWA and iOS assets are separate from the unchanged push bell')
