/** Node-only frozen public inputs shared by every static-render worker. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEditorial, parseNarrative, parseSiteCopy, type LiveContent } from './live-content'

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`
}
export function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}
export function publicOrigin(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Expected a public HTTPS origin without credentials, path, query or fragment')
  }
  return url.origin
}
export type BakedInput = {
  version: 1
  origin: string
  documents: { narrative: unknown; copy: unknown; editorial: unknown }
}
export function validateBakedInput(input: BakedInput): LiveContent {
  if (input.version !== 1 || publicOrigin(input.origin) !== input.origin) throw new Error('Invalid baked input envelope')
  const { narrative, copy, editorial } = input.documents
  for (const document of [narrative, copy, editorial]) {
    const raw = document as Record<string, unknown> | null
    if (!raw || !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 1 ||
        typeof raw.updatedAt !== 'string' || !Number.isFinite(Date.parse(raw.updatedAt))) {
      throw new Error('Missing public content revision or timestamp')
    }
  }
  const result = { narrative: parseNarrative(narrative), copy: parseSiteCopy(copy), editorial: parseEditorial(editorial) }
  if (Object.values(result).some(value => value === null)) throw new Error('Invalid or incomplete public content')
  return result
}
export function readBakedInput(filename: string, expectedHash: string, origin: string): LiveContent {
  if (!/^[0-9a-f]{64}$/.test(expectedHash)) throw new Error('Frozen input SHA-256 is required')
  const raw = readFileSync(filename)
  if (sha256(raw) !== expectedHash) throw new Error('Frozen public content hash mismatch')
  const input = JSON.parse(raw.toString('utf8')) as BakedInput
  if (input.origin !== publicOrigin(origin)) throw new Error('Frozen public content origin mismatch')
  return validateBakedInput(input)
}
