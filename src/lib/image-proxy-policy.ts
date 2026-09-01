export type ImageProxyFallback = 'direct' | 'weserv'

export type ImageProxyPolicy = {
  /** Exact hostname or parent-domain suffix. `example.com` also matches `*.example.com`. */
  suffix: string
  /** Referer sent by the self-hosted Worker when fetching the upstream image. */
  referer: string
  /** Behaviour while NEXT_PUBLIC_IMG_PROXY is intentionally unset. */
  fallback: ImageProxyFallback
}

/**
 * Single source of truth for image origins that are allowed to enter our
 * self-hosted proxy. Keep this deliberately narrow: a host belongs here only
 * when there is a concrete compatibility or performance reason to proxy it.
 *
 * Current evidence:
 * - hdslb.com: proxying materially reduces bytes/latency and avoids hotlink
 *   fragility. Until our Worker is validated, keep the existing weserv path.
 * - acfun.cn: direct images can be very large/slow, so it is a Worker candidate;
 *   keep today's direct behaviour until NEXT_PUBLIC_IMG_PROXY is enabled.
 *
 * YouTube, Douyu and Youku covers stay direct and therefore do not appear here.
 */
export const IMAGE_PROXY_POLICY = [
  { suffix: 'hdslb.com', referer: 'https://www.bilibili.com/', fallback: 'weserv' },
  { suffix: 'acfun.cn', referer: 'https://www.acfun.cn/', fallback: 'direct' },
] as const satisfies readonly ImageProxyPolicy[]

export function getImageProxyPolicy(hostname: string): ImageProxyPolicy | null {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return (
    IMAGE_PROXY_POLICY.find(({ suffix }) => host === suffix || host.endsWith(`.${suffix}`)) ?? null
  )
}
