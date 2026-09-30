import fs from 'node:fs'
import path from 'node:path'
import { canonicalJson, publicOrigin, sha256, validateBakedInput, type BakedInput } from '../../src/lib/baked-input'

class TransientError extends Error {}

// CI runners sit on the other side of an intercontinental link; a stalled or cut
// connection is routine there and says nothing about the content, so retry it.
async function fetchDocument(origin: string, endpoint: string, request: typeof fetch, retryDelayMs: number) {
  const attempts = 4
  for (let attempt = 1; ; attempt++) {
    try {
      let response: Response, raw: string
      try {
        response = await request(`${origin}/api/content/${endpoint}`, {
          redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { accept: 'application/json' },
        })
        if (response.status >= 500 || response.status === 429) throw new TransientError(`Public content HTTP ${response.status}`)
        if (!response.ok) throw new Error(`Public content HTTP ${response.status}`)
        raw = await response.text()
      } catch (error) {
        if (error instanceof TransientError || !(error instanceof Error)) throw error
        if (error.message.startsWith('Public content HTTP')) throw error
        const cause = error.cause instanceof Error ? `: ${error.cause.message}` : ''
        throw new TransientError(`${endpoint} request failed (${error.message}${cause})`)
      }
      if (Buffer.byteLength(raw) > 2_000_000) throw new Error('Public content response too large')
      return JSON.parse(raw)
    } catch (error) {
      if (!(error instanceof TransientError) || attempt >= attempts) throw error
      console.warn(`${error.message}; retry ${attempt}/${attempts - 1}`)
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt))
    }
  }
}

export async function capture(origin: string, request = fetch, retryDelayMs = 3_000): Promise<BakedInput> {
  origin = publicOrigin(origin)
  async function read(): Promise<BakedInput> {
    const endpoints = ['narrative', 'site-copy', 'editorial']
    const [narrative, copy, editorial] = await Promise.all(endpoints.map(endpoint => fetchDocument(origin, endpoint, request, retryDelayMs)))
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
