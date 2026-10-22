import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getPublicDataset, toTimelineEntries } from '../src/lib/data'
import { sourceStartHref } from '../src/lib/source-links'
import { EntryDetailBody } from '../src/components/EntryDetail'
import { EntryWatch } from '../src/components/EntryWatch'

// The CLI JSX transform uses React globals; Next supplies the automatic runtime.
Object.assign(globalThis, { React })

const entries = toTimelineEntries(getPublicDataset())
const collection = 'https://www.bilibili.com/video/BV12hBKY8ELa'
const entry = entries.find(entry => entry.sources.some(source => source.url === collection && source.partDetails?.[0]?.page === 7))!
assert.ok(entry, 'real multi-day collection has a session starting at P7')
const source = entry.sources.find(source => source.url === collection)!
const original = JSON.stringify(source)
const href = sourceStartHref(source)
assert.equal(new URL(href).searchParams.get('p'), '7')
assert.equal(JSON.stringify(source), original, 'source and chapter identity stay unchanged')
const html = renderToStaticMarkup(<EntryDetailBody entry={{ ...entry, sources: [source], primaryUrl: source.url, chapters: undefined }} />)
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'))
assert.ok(hrefs.filter(value => value === href).length >= 3, 'cover, title and first part all open P7')
assert.ok(!hrefs.includes(collection), 'entry cover/title must not fall back to collection P1')
assert.ok(hrefs.some(value => value.includes('p=8')), 'other declared parts remain available')
const watchHtml = renderToStaticMarkup(<EntryWatch sources={[source]} segments={[]} totalSec={0} accent="#65bcd3" gameNames={entry.games.map(game => game.name)} entryCover={entry.cover} entryTitle={entry.title} entryDate={entry.date} />)
const watchHrefs = [...watchHtml.matchAll(/href="([^\"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'))
assert.ok(watchHrefs.filter(value => value === href).length >= 3, 'archive watch cover, main CTA and first part all open P7')
assert.ok(!watchHrefs.includes(collection), 'archive watch surface must not reopen collection P1')

assert.equal(sourceStartHref({ ...source, url: `${collection}?p=8&t=12` }), `${collection}?p=8&t=12`, 'explicit location wins')
assert.equal(sourceStartHref({ ...source, url: `${collection}?t=12` }), `${collection}?t=12`, 'explicit time is preserved')
assert.equal(sourceStartHref({ ...source, partDetails: undefined }), collection, 'unknown parts are never inferred')
let checked = 0
for (const entry of entries) for (const source of entry.sources) {
  const before = JSON.stringify(source)
  const href = sourceStartHref(source)
  assert.equal(JSON.stringify(source), before)
  const first = source.partDetails?.[0]
  if (href !== source.url) {
    assert.ok(first && first.page > 1)
    const url = new URL(href)
    if (url.hostname.endsWith('bilibili.com')) assert.equal(Number(url.searchParams.get('p')), first.page)
    else assert.ok(url.pathname.endsWith(`_${first.page}`))
  }
  checked++
}
console.log(`OK collection entry cover/title open the declared first part; ${checked} source identities retained`)
