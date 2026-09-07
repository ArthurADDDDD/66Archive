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
 * 2026-09-07 re-measurement — that earlier acfun decision compared the Worker
 * with the origin and never priced the origin's own payload. Measured directly:
 *
 * | upstream                          | direct    | weserv w=480 |
 * |-----------------------------------|-----------|--------------|
 * | tx-free-imgs.acfun.cn `.png`      | 1,939,387 |       20,306 |
 * | tx-free-imgs.acfun.cn `.png`      | 1,288,600 |       15,234 |
 * | tx-free-imgs.acfun.cn `.jpeg`     | 1,001,263 |       19,052 |
 * | tx-free-imgs.acfun.cn `.jpeg`     |   538,170 |       14,766 |
 * | sta-op.douyucdn.cn `.jpg`         |   135,797 |       13,558 |
 * | sta-op.douyucdn.cn `.jpg`         |    48,763 |       32,472 |
 *
 * These render into 211×119 CSS-pixel tiles. Serving a 1.9 MB PNG there is a
 * ~97% overdraw, and 74 acfun + 192 douyu references appear across the built
 * HTML. weserv costs a cold transformation (~1.4 s TTFB, then ~0.33 s warm —
 * the same profile hdslb already lives with in production), which is the right
 * trade against megabyte thumbnails on covers that are all lazy-loaded.
 *
 * Youku (`m.ykimg.com`) was first left direct on a two-URL sample, one of which
 * happened to be a 6,157-byte derivative that weserv made *bigger* (9,400 B).
 * That sample was not representative. Re-measured over 12 distinct covers taken
 * from the built `/series/` and `/e/*` pages:
 *
 * | route     | total over 12 |
 * |-----------|---------------|
 * | direct    |       225,231 |
 * | weserv480 |       151,124 |
 * | weserv240 |        62,812 |
 *
 * Every one of the 12 is smaller through weserv at w=480; not one regressed.
 * So Youku joins the others. The lesson worth keeping: two samples decided this
 * the wrong way, and the outlier was the small one.
 *
 * YouTube covers stay direct and are not Worker-allowlisted.
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
    route: 'weserv',
    fallback: 'weserv',
    workerAllowed: true,
  },
  {
    suffix: 'douyucdn.cn',
    referer: 'https://www.douyu.com/',
    route: 'weserv',
    fallback: 'weserv',
    workerAllowed: true,
  },
  {
    suffix: 'ykimg.com',
    referer: 'https://v.youku.com/',
    route: 'weserv',
    fallback: 'weserv',
    workerAllowed: true,
  },
] as const satisfies readonly ImageProxyPolicy[]

export function getImageProxyPolicy(hostname: string): ImageProxyPolicy | null {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return (
    IMAGE_PROXY_POLICY.find(({ suffix }) => host === suffix || host.endsWith(`.${suffix}`)) ?? null
  )
}
