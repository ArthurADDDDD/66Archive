import type { Platform } from './schema'

export const PLATFORM_META: Record<
  Platform,
  { name: string; short: string; color: string; host: RegExp }
> = {
  youku: { name: '优酷', short: '优', color: '#3AA0FF', host: /youku\.com/ },
  bilibili: { name: '哔哩哔哩', short: 'B', color: '#FB7299', host: /bilibili\.com|b23\.tv/ },
  youtube: { name: 'YouTube', short: 'YT', color: '#FF3B30', host: /youtube\.com|youtu\.be/ },
  douyu: { name: '斗鱼', short: '斗', color: '#FF7E00', host: /douyu\.com/ },
  douyin: { name: '抖音', short: '抖', color: '#25F4EE', host: /douyin\.com/ },
}

export const SOURCE_KIND_LABEL: Record<string, string> = {
  original: '原始投稿',
  replay: '录播',
  clip: '切片',
  reupload: '转载',
}

/** 从粘贴的链接推断平台，供贡献表单使用 */
export function detectPlatform(url: string): Platform | null {
  for (const [key, meta] of Object.entries(PLATFORM_META)) {
    if (meta.host.test(url)) return key as Platform
  }
  return null
}

/**
 * 给外链加上时间戳，让分段可以直接跳到对应位置。
 * 各平台参数不同，未知平台原样返回。
 */
export function withTimestamp(url: string, seconds: number): string {
  const platform = detectPlatform(url)
  if (!platform || seconds <= 0) return url
  const u = new URL(url)
  if (platform === 'bilibili') u.searchParams.set('t', String(seconds))
  else if (platform === 'youtube') u.searchParams.set('t', `${seconds}s`)
  else return url
  return u.toString()
}

/**
 * 封面可选走部署方图片代理；未配置时退回公开的缩略图代理，
 * 以绕开图床对本地站点来源的防盗链。
 *
 * 两条不能退的性质：
 *
 * 1. **绝不放大。** 自有 Worker 用 Cloudflare Image Resizing 的 `fit: scale-down`，
 *    公开 fallback 用 weserv 的 `we`（without enlargement）。200 宽的 2010 年优酷封面
 *    请求 480 也只会回 200 宽，放进大格子里就是糊的——那是真的糊，见 src/lib/covers.ts。
 *    这条一旦被"顺手统一成 480"破坏，全站最诚实的一层时间感就没了。
 * 2. **三个来源都要走代理。** A 站录播稿有大量 1.5 MB 的 1800×1125 原图（2,040 条里占多数），
 *    直连会让任何一面封面墙变成几百兆的下载。之前只有 B 站走 fallback，是重构前
 *    页面上几乎不显示封面才没暴露出来的。
 */
const IMAGE_PROXY_HOST = /(^|\.)hdslb\.com$|(^|\.)acfun\.cn$|(^|\.)ykimg\.com$/
const FALLBACK_IMAGE_PROXY = 'https://images.weserv.nl/'
const DEFAULT_PROXY_WIDTH = 480
const MIN_PROXY_WIDTH = 40
const MAX_PROXY_WIDTH = 1280

function isLocalProxy(url: URL): boolean {
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
}

function proxyUrl(base: string, source: string, width: number, noEnlarge: boolean): string | null {
  try {
    const target = new URL(base)
    if (target.protocol !== 'https:' && !isLocalProxy(target)) return null
    target.searchParams.set('url', source)
    target.searchParams.set('w', String(width))
    // weserv：`we` = without enlargement。自有 Worker 的 scale-down 已经自带这个语义。
    if (noEnlarge) target.searchParams.set('we', '1')
    return target.toString()
  } catch {
    return null
  }
}

export function proxyImage(url: string | undefined, width = 480): string | null {
  if (!url) return null

  try {
    const source = new URL(url)
    if (source.protocol !== 'https:' || !IMAGE_PROXY_HOST.test(source.hostname)) return url

    const requestedWidth = Number.isFinite(width) ? Math.round(width) : DEFAULT_PROXY_WIDTH
    const safeWidth = Math.min(MAX_PROXY_WIDTH, Math.max(MIN_PROXY_WIDTH, requestedWidth))
    const configuredProxy = process.env.NEXT_PUBLIC_IMG_PROXY?.trim()
    if (configuredProxy) return proxyUrl(configuredProxy, source.toString(), safeWidth, false) ?? url

    return proxyUrl(FALLBACK_IMAGE_PROXY, source.toString(), safeWidth, true) ?? url
  } catch {
    return url
  }
}
