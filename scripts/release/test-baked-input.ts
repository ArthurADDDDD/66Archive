import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { canonicalJson, readBakedInput, sha256, type BakedInput } from '../../src/lib/baked-input'
import { capture } from './capture-content'

const meta = { revision: 1, updatedAt: '2026-01-01T00:00:00Z' }
const input: BakedInput = { version: 1, origin: 'https://example.com', documents: {
  narrative: { ...meta, narrative: { highlights: [{ id: 'test', title: 'A' }] } },
  copy: { ...meta, copy: { site: { title: 'Site' }, hero: { title: 'Hero' } } },
  editorial: { ...meta, sections: [] },
} }
async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'baked-input-'))
  try {
    const file = path.join(tmp, 'input.json')
    const raw = canonicalJson(input) + '\n'
    fs.writeFileSync(file, raw)
    const hash = sha256(raw)
    assert.equal(readBakedInput(file, hash, input.origin).copy?.site.title, 'Site')
    assert.deepEqual(readBakedInput(file, hash, input.origin), readBakedInput(file, hash, input.origin))
    assert.throws(() => readBakedInput(file, hash, 'https://elsewhere.example'), /origin mismatch/)
    assert.throws(() => readBakedInput(file, '', input.origin), /required/)
    fs.writeFileSync(file, raw.replace('Hero', 'Changed'))
    assert.throws(() => readBakedInput(file, hash, input.origin), /hash mismatch/)
    assert.equal(canonicalJson({ z: 1, a: { b: 2, a: 1 } }), canonicalJson({ a: { a: 1, b: 2 }, z: 1 }))
    assert.notEqual(sha256(canonicalJson({ list: [1, 2] })), sha256(canonicalJson({ list: [2, 1] })))
    let calls = 0
    const request = (async (url: string) => {
      calls++
      const key = url.endsWith('site-copy') ? 'copy' : url.split('/').at(-1) as 'narrative' | 'editorial'
      return new Response(JSON.stringify(input.documents[key]), { status: 200 })
    }) as typeof fetch
    assert.deepEqual(await capture(input.origin, request), input)
    assert.equal(calls, 6)
    await assert.rejects(capture(input.origin, (async () => new Response('{}', { status: 503 })) as typeof fetch), /HTTP 503/)
    await assert.rejects(capture(input.origin, (async () => new Response('{}')) as typeof fetch), /revision/)
    let counter = 0
    await assert.rejects(capture(input.origin, (async (url: string) => {
      const response = await request(url)
      const payload = await response.json()
      payload.revision = ++counter
      return new Response(JSON.stringify(payload))
    }) as typeof fetch), /changed during capture/)
    console.log('Frozen input: stable capture, corruption, origin, schema, HTTP and concurrent-change tests passed')
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
