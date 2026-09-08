import fs from 'node:fs'
import path from 'node:path'
import { canonicalJson, publicOrigin, sha256, validateBakedInput, type BakedInput } from '../../src/lib/baked-input'

export async function capture(origin: string, request = fetch): Promise<BakedInput> {
  origin = publicOrigin(origin)
  async function read(): Promise<BakedInput> {
    const endpoints = ['narrative', 'site-copy', 'editorial']
    const [narrative, copy, editorial] = await Promise.all(endpoints.map(async endpoint => {
      const response = await request(`${origin}/api/content/${endpoint}`, {
        redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`Public content HTTP ${response.status}`)
      const raw = await response.text()
      if (Buffer.byteLength(raw) > 2_000_000) throw new Error('Public content response too large')
      return JSON.parse(raw)
    }))
    const input: BakedInput = { version: 1, origin, documents: { narrative, copy, editorial } }
    validateBakedInput(input)
    return input
  }
  // Revisions are independent; this detects observed changes, not a DB transaction.
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await read()
    const after = await read()
    if (canonicalJson(before) === canonicalJson(after)) return after
  }
  throw new Error('Public content changed during capture; refusing a mixed build')
}

if (process.argv[1]?.endsWith('capture-content.ts')) {
  capture(process.env.SITE_ORIGIN || '').then(input => {
    const filename = path.resolve(process.argv[2] || '.local/release/baked-content.json')
    fs.mkdirSync(path.dirname(filename), { recursive: true })
    const bytes = `${canonicalJson(input)}\n`
    fs.writeFileSync(filename, bytes)
    fs.writeFileSync(`${filename}.sha256`, `${sha256(bytes)}\n`)
    console.log(`Frozen public content SHA-256: ${sha256(bytes)}`)
  }).catch(error => { console.error(error.message); process.exitCode = 1 })
}
