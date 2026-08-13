/**
 * 六六编年史 · 封面图代理
 *
 * 只做两件事：
 * 1. 带上各平台自己认可的 Referer，绕开防盗链（浏览器直连时 no-referrer 在部分场景仍会被拦）。
 * 2. 交给 Cloudflare Image Resizing 按需缩放（未开通该功能的账号会静默跳过，退化为原图代理）。
 *
 * 不是通用代理：只放行数据里实际出现过的封面域名，避免被当成开放代理滥用。
 */

type OriginConfig = {
  host: RegExp
  referer: string
}

const ALLOWED_ORIGINS: OriginConfig[] = [
  { host: /(^|\.)hdslb\.com$/, referer: 'https://www.bilibili.com/' },
  { host: /(^|\.)acfun\.cn$/, referer: 'https://www.acfun.cn/' },
  { host: /(^|\.)ykimg\.com$/, referer: 'https://www.youku.com/' },
]

const MIN_WIDTH = 40
const MAX_WIDTH = 1280
const DEFAULT_WIDTH = 480

function resolveOrigin(url: URL): OriginConfig | null {
  return ALLOWED_ORIGINS.find((o) => o.host.test(url.hostname)) ?? null
}

function clampWidth(raw: string | null): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WIDTH
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(n)))
}

export default {
  async fetch(request: Request): Promise<Response> {
    const reqUrl = new URL(request.url)

    if (reqUrl.pathname === '/' && !reqUrl.searchParams.has('url')) {
      return new Response('chronicle-66 img-proxy: 用 ?url=<封面地址>&w=<宽度> 调用', { status: 200 })
    }

    const target = reqUrl.searchParams.get('url')
    if (!target) return new Response('missing url', { status: 400 })

    let originUrl: URL
    try {
      originUrl = new URL(target)
    } catch {
      return new Response('invalid url', { status: 400 })
    }
    if (originUrl.protocol !== 'https:') return new Response('only https origins allowed', { status: 400 })

    const origin = resolveOrigin(originUrl)
    if (!origin) return new Response('origin not allowlisted', { status: 403 })

    const width = clampWidth(reqUrl.searchParams.get('w'))

    const upstream = await fetch(originUrl.toString(), {
      headers: {
        Referer: origin.referer,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      cf: {
        image: { width, fit: 'scale-down' },
        cacheTtl: 60 * 60 * 24 * 7,
        cacheEverything: true,
      } as RequestInitCfProperties,
    })

    if (!upstream.ok) {
      return new Response('upstream error', { status: 502 })
    }

    const headers = new Headers(upstream.headers)
    headers.set('Cache-Control', 'public, max-age=604800, immutable')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.delete('Set-Cookie')

    return new Response(upstream.body, { status: 200, headers })
  },
}
