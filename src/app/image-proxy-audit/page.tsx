import { getDataset } from '@/lib/data'

export const dynamic = 'force-static'

function coverHost(value: string | undefined): string {
  if (!value) return '(missing)'
  if (value.startsWith('/')) return '(local)'
  try {
    return new URL(value).hostname
  } catch {
    return '(invalid)'
  }
}

type Measurement = {
  status: number | null
  ttfbMs: number | null
  totalMs: number | null
  bytes: number | null
  contentType: string | null
  cacheControl: string | null
  age: string | null
  cfCacheStatus: string | null
  error?: string
}

async function measure(url: string): Promise<Measurement> {
  const start = performance.now()
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0 Safari/537.36',
      },
    })
    const ttfbMs = performance.now() - start
    const body = await response.arrayBuffer()
    return {
      status: response.status,
      ttfbMs: Math.round(ttfbMs * 10) / 10,
      totalMs: Math.round((performance.now() - start) * 10) / 10,
      bytes: body.byteLength,
      contentType: response.headers.get('content-type'),
      cacheControl: response.headers.get('cache-control'),
      age: response.headers.get('age'),
      cfCacheStatus: response.headers.get('cf-cache-status'),
    }
  } catch (error) {
    return {
      status: null,
      ttfbMs: null,
      totalMs: null,
      bytes: null,
      contentType: null,
      cacheControl: null,
      age: null,
      cfCacheStatus: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function twice(url: string): Promise<Measurement[]> {
  return [await measure(url), await measure(url)]
}

export default async function ImageProxyAuditPage() {
  const { entries } = getDataset()
  const counts = new Map<string, { entry: number; source: number; total: number }>()

  const add = (host: string, kind: 'entry' | 'source') => {
    const current = counts.get(host) ?? { entry: 0, source: 0, total: 0 }
    current[kind] += 1
    current.total += 1
    counts.set(host, current)
  }

  for (const entry of entries) {
    if (entry.cover) add(coverHost(entry.cover), 'entry')
    for (const source of entry.sources) {
      if (source.cover) add(coverHost(source.cover), 'source')
    }
  }

  const hostResult = [...counts.entries()]
    .map(([host, value]) => ({ host, ...value }))
    .sort((a, b) => b.total - a.total || a.host.localeCompare(b.host))
  console.log('IMAGE_PROXY_HOST_AUDIT=' + JSON.stringify(hostResult))

  const samples = {
    bilibili: 'https://i0.hdslb.com/bfs/archive/7781f3640a2501f777d74ae803d6a8a9d17c9113.jpg',
    douyu: 'https://sta-op.douyucdn.cn/vod-cover/2020/01/04/19e98ad38b584f0968f0bcb1784bae50.jpg',
    youku: 'https://m.ykimg.com/054204085252CD966A0A4C5B5C751BA8',
    acfun: 'https://tx-free-imgs.acfun.cn/newUpload/4397992_e346220d9277412399cc8c04b8080ffc.jpeg?imageslim',
    youtube: 'https://i.ytimg.com/vi/P1uoFo-mmJw/hqdefault.jpg',
  } as const
  const weserv = `https://images.weserv.nl/?url=${encodeURIComponent(samples.bilibili)}&w=480`

  const networkResult: Record<string, Measurement[]> = {}
  for (const [name, url] of Object.entries(samples)) networkResult[`${name}:direct`] = await twice(url)
  networkResult['bilibili:weserv'] = await twice(weserv)
  console.log('IMAGE_PROXY_NETWORK_AUDIT=' + JSON.stringify(networkResult))

  return null
}
