import assert from 'node:assert/strict'
import fs from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResponsiveCover } from '../src/components/ResponsiveCover'
import { entryCoverSources } from '../src/lib/entry-covers'
import { proxyImage, proxyImageSrcSet } from '../src/lib/platforms'

const widths = [320, 640]
const sizes = '(min-width: 1024px) 23vw, 45vw'
function render(src: string, responsive = true) {
  return renderToStaticMarkup(
    <ResponsiveCover src={src} widths={responsive ? widths : undefined} sizes={responsive ? sizes : undefined}
      alt="封面" loading="lazy" decoding="async" fetchPriority="high" className="cover" />,
  )
}

let originals = 0
for (const directory of ['public/images/covers', 'public/gallery']) {
  for (const name of fs.readdirSync(directory)) {
    if (!(directory.endsWith('covers') ? /\.jpg$/i : /^anniv_.+\.(jpg|png)$/i).test(name)) continue
    const src = `${directory.slice('public'.length)}/${name}`
    const sources = entryCoverSources(src)
    assert.ok(sources, src)
    const html = render(src)
    assert.ok(html.includes('<picture'), src)
    assert.ok(html.indexOf('image/avif') < html.indexOf('image/webp'))
    for (const sourceSet of Object.values(sources)) {
      for (const candidate of sourceSet.split(', ')) {
        const [url] = candidate.split(' ')
        assert.ok(fs.existsSync(`public${url}`), `Missing derivative: ${url}`)
      }
    }
    originals++
  }
}

const remote = proxyImage('https://i0.hdslb.com/bfs/archive/example.jpg', 640)!
assert.ok(!render(remote).includes('<picture'))
assert.ok(render(remote).includes(proxyImageSrcSet(remote, widths)!.replaceAll('&', '&amp;')))
for (const src of ['/images/unknown.jpg', 'https://example.com/photo.thumb.jpg', '/images/covers/not-a-cover.png']) {
  assert.ok(!render(src).includes('<picture'), src)
}
assert.ok(!render('/images/covers/example.jpg', false).includes('<picture'))
const gallery = render('/gallery/photos/example.thumb.jpg')
assert.ok(gallery.includes('example.thumb-360.avif'))
assert.ok(gallery.includes('example.thumb-720.webp'))
const versioned = render('/gallery/anniv_example.png?v=2')
assert.ok(versioned.includes('anniv_example.w360.avif?v=2'))
for (const attr of ['loading="lazy"', 'decoding="async"', 'fetchPriority="high"', 'alt="封面"', 'class="cover"']) {
  assert.ok(gallery.includes(attr), attr)
}
console.log(`Responsive cover checks passed; ${originals} local originals have all four derivatives.`)
