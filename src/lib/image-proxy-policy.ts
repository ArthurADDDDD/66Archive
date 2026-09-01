export type ImageProxyFallback = 'direct' | 'weserv'
export type ImageProxyRoute = 'direct' | 'weserv' | 'worker'

export type ImageProxyPolicy = {
  /** Exact hostname or parent-domain suffix. `example.com` also matches `*.example.com`. */
  suffix: string
  /** Referer sent by the self-hosted Worker when fetching the upstream image. */
  referer: string
  /** Production frontend route selected after measurement. */
  route: ImageProxyRoute
  /** Fallback used only when route=worker but NEXT_PUBLIC_IMG_PROXY is absent. */
  fallback: ImageProxyFallback
  /** Whether the Worker may fetch this origin during explicit/manual requests. */
  workerAllowed: boolean
}

/**
 * Single source of truth for image-origin policy. Frontend routing and Worker
 * admission both read this file, but those are deliberately separate decisions:
 * an origin can be safe to benchmark through the Worker without being selected
 * as the production frontend route.
 *
 * 2026-09-01 deployed-Worker measurements:
 * - hdslb.com: weserv remained materially faster on both cold and warm requests,
 *   with essentially the same transfer size. Keep production on weserv.
 * - acfun.cn: Worker warm-cache performance and transfer size were excellent,
 *   but cold transformations were materially slower than direct origin. Keep
 *   production direct until a later benchmark justifies changing that tradeoff.
 *
 * YouTube, Douyu and Youku covers stay direct and are not Worker-allowlisted.
 */
export const IMAGE_PROXY_POLICY = [
  {
    suffix: 'hdslb.com',
    referer: 'https://www.bilibili.com/',
    route: 'weserv',
    fallback: 'weserv',
    workerAllowed: true,
  },
  {
    suffix: 'acfun.cn',
    referer: 'https://www.acfun.cn/',
    route: 'direct',
    fallback: 'direct',
    workerAllowed: true,
  },
] as const satisfies readonly ImageProxyPolicy[]

export function getImageProxyPolicy(hostname: string): ImageProxyPolicy | null {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return (
    IMAGE_PROXY_POLICY.find(({ suffix }) => host === suffix || host.endsWith(`.${suffix}`)) ?? null
  )
}
