export const dynamic = 'force-static'

const WORKER = 'https://chronicle-66-img-proxy.chronicle66-a7m4.workers.dev'
const BILI = 'https://i0.hdslb.com/bfs/archive/7781f3640a2501f777d74ae803d6a8a9d17c9113.jpg'
const ACFUN = 'https://tx-free-imgs.acfun.cn/newUpload/4397992_e346220d9277412399cc8c04b8080ffc.jpeg?imageslim'
const YOUTUBE = 'https://i.ytimg.com/vi/P1uoFo-mmJw/hqdefault.jpg'
const DOUYU = 'https://sta-op.douyucdn.cn/vod-cover/2020/01/04/19e98ad38b584f0968f0bcb1784bae50.jpg'

type Measurement = {
  status: number | null
  ttfbMs: number | null
  totalMs: number | null
  bytes: number | null
  contentType: string | null
  cacheControl: string | null
  age: string | null
  cfCacheStatus: string | null
  cfRay: string | null
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
      cfRay: response.headers.get('cf-ray'),
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
      cfRay: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function cacheBuster(raw: string, id: string): string {
  const url = new URL(raw)
  url.searchParams.set('archive_proxy_audit', id)
  return url.toString()
}

function workerUrl(source: string): string {
  return `${WORKER}/?url=${encodeURIComponent(source)}&w=480`
}

function weservUrl(source: string): string {
  return `https://images.weserv.nl/?url=${encodeURIComponent(source)}&w=480`
}

async function coldWarm(url: string): Promise<{ cold: Measurement; warm: Measurement }> {
  return { cold: await measure(url), warm: await measure(url) }
}

export default async function LiveImageProxyAuditPage() {
  const root = await measure(WORKER)
  const rounds = []
  for (let i = 0; i < 3; i += 1) {
    const id = `20260901-${i}-${Date.now()}`
    const bili = cacheBuster(BILI, `bili-${id}`)
    const acfun = cacheBuster(ACFUN, `acfun-${id}`)
    rounds.push({
      id,
      bilibili: {
        direct: await coldWarm(bili),
        weserv: await coldWarm(weservUrl(bili)),
        worker: await coldWarm(workerUrl(bili)),
      },
      acfun: {
        direct: await coldWarm(acfun),
        worker: await coldWarm(workerUrl(acfun)),
      },
    })
  }

  const rejection = {
    youtube: await measure(workerUrl(YOUTUBE)),
    douyu: await measure(workerUrl(DOUYU)),
  }

  console.log(
    'LIVE_IMAGE_PROXY_AUDIT=' +
      JSON.stringify({ worker: WORKER, root, rounds, rejection }),
  )
  return null
}
