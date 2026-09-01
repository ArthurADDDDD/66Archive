import { getImageProxyPolicy } from '../../../src/lib/image-proxy-policy'

/**
 * 六六编年史 · 封面图代理
 *
 * 只做两件事：
 * 1. 带上各平台自己认可的 Referer，绕开防盗链。
 * 2. 交给 Cloudflare Image Resizing 按需缩放；转换或上游请求失败时返回 502，
 *    不会为了兜底而放宽 allowlist。
 *
 * 不是通用代理：Worker admission 与前端生产路由都来自
 * src/lib/image-proxy-policy.ts，但由不同字段控制。一个 host 可以被允许做显式
 * Worker 基准测试，而不代表前端会自动把生产流量切进 Worker。
 */

const MIN_WIDTH = 40
const MAX_WIDTH = 1280
const DEFAULT_WIDTH = 480

function clampWidth(raw: string | null): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WIDTH
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(n)))
}

function resolveWorkerPolicy(hostname: string) {
  const policy = getImageProxyPolicy(hostname)
  return policy?.workerAllowed ? policy : null
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function isRedirectStatus(status: number): boolean {
  return REDIRECT_STATUSES.has(status)
}

/**
 * 拉取封面并安全处理重定向。
 *
 * 不跟随未校验的跨域跳转：每次 3xx 都必须重新过共享 policy，且只允许 https。
 */
async function fetchAllowlisted(initialUrl: URL, width: number): Promise<Response> {
  let current = initialUrl
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0 Safari/537.36'

  for (let hop = 0; hop < 4; hop += 1) {
    const policy = resolveWorkerPolicy(current.hostname)
    if (!policy) return new Response('redirect target not allowlisted', { status: 403 })

    const response = await fetch(current.toString(), {
      redirect: 'manual',
      headers: {
        Referer: policy.referer,
        'User-Agent': userAgent,
      },
      cf: {
        image: { width, fit: 'scale-down' },
        cacheTtl: 60 * 60 * 24 * 7,
        cacheEverything: true,
      } as RequestInitCfProperties,
    })

    if (!isRedirectStatus(response.status)) return response
    if (hop === 3) return new Response('too many redirects', { status: 502 })

    const location = response.headers.get('location')
    if (!location) return new Response('redirect missing location', { status: 502 })

    let next: URL
    try {
      next = new URL(location, current)
    } catch {
      return new Response('invalid redirect location', { status: 502 })
    }
    if (next.protocol !== 'https:') return new Response('redirect target must be https', { status: 403 })
    if (!resolveWorkerPolicy(next.hostname)) {
      return new Response('redirect target not allowlisted', { status: 403 })
    }

    current = next
  }

  return new Response('too many redirects', { status: 502 })
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
    if (!resolveWorkerPolicy(originUrl.hostname)) return new Response('origin not allowlisted', { status: 403 })

    const width = clampWidth(reqUrl.searchParams.get('w'))
    const upstream = await fetchAllowlisted(originUrl, width)

    if (!upstream.ok) return new Response('upstream error', { status: 502 })

    const headers = new Headers(upstream.headers)
    headers.set('Cache-Control', 'public, max-age=604800, immutable')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.delete('Set-Cookie')

    return new Response(upstream.body, { status: 200, headers })
  },
}
