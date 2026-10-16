import { decodeArchivePayload, type ArchivePayload, type EncodedArchivePayload } from './archive-payload'

export type ArchiveBoot = { url: string; promise: Promise<unknown> }
export type ArchiveBootHolder = { __i6i6ArchiveBoot?: ArchiveBoot | Promise<unknown> }
// A stalled transfer must eventually release the loading screen and allow a retry.
export const ARCHIVE_TIMEOUT_MS = 60_000

export function archiveBootScript(dataUrl: string): string {
  const url = JSON.stringify(dataUrl).replace(/</g, '\\u003c')
  return `(function(){try{var c=new AbortController();var t=setTimeout(function(){c.abort()},${ARCHIVE_TIMEOUT_MS});window.__i6i6ArchiveBoot={url:${url},promise:fetch(${url},{signal:c.signal}).then(function(r){return r.ok?r.json():null}).catch(function(){return null}).finally(function(){clearTimeout(t)})}}catch(e){}})()`
}

function takeBoot(holder: ArchiveBootHolder | undefined, url: string): Promise<unknown> | null {
  const boot = holder?.__i6i6ArchiveBoot
  if (!boot || !holder) return null
  delete holder.__i6i6ArchiveBoot
  // Legacy boot promises have no identity. Never attach unknown bytes to a new URL.
  return 'url' in boot && boot.url === url ? boot.promise : null
}

function decode(value: unknown): ArchivePayload {
  if (!value || !Array.isArray((value as EncodedArchivePayload).entries)) {
    throw new Error('Invalid archive payload')
  }
  return decodeArchivePayload(value as EncodedArchivePayload)
}

/** One bounded cache entry; navigation shares work, failures remain retryable. */
export function createArchiveLoader({
  fetcher = fetch,
  holder,
  timeoutMs = ARCHIVE_TIMEOUT_MS,
}: { fetcher?: typeof fetch; holder?: ArchiveBootHolder; timeoutMs?: number } = {}) {
  let cached: { url: string; promise: Promise<ArchivePayload> } | null = null

  async function request(url: string): Promise<ArchivePayload> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`archive data returned ${response.status}`)
      return decode(await response.json())
    } finally {
      clearTimeout(timer)
    }
  }

  return function load(url: string): Promise<ArchivePayload> {
    if (cached?.url === url) return cached.promise
    const boot = takeBoot(holder, url)
    const promise = (async () => {
      if (boot) {
        try {
          return decode(await boot)
        } catch {
          // A failed/malformed prefetch is expendable; try the actual versioned URL.
        }
      }
      return request(url)
    })().catch((error) => {
      if (cached?.promise === promise) cached = null
      throw error
    })
    cached = { url, promise }
    return promise
  }
}
