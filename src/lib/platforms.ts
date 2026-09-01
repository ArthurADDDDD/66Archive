import type { Platform } from './schema'
import { getImageProxyPolicy } from './image-proxy-policy'

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
 * 封面路由由共享 policy 明确决定，而不是由环境变量全局覆盖。
 *
 * - `/gallery/**`、`/images/**` 以及其它站内绝对路径永远原样返回。
 * - route=direct 永远直连，route=weserv 永远走 weserv。
 * - 只有 route=worker 的 host 才会读取 NEXT_PUBLIC_IMG_PROXY；变量缺失时再按
 *   policy fallback 处理。
 * - 因此误设 NEXT_PUBLIC_IMG_PROXY 也不会把未验证的远程图批量切进 Worker。
 */
export function proxyImage(url: string | undefined, width = 480): string | null {
  if (!url) return null
  if (url.startsWith('/')) return url

  // B 站元数据接口至今仍可能返回 http 图床地址；统一升级避免 mixed content。
  const normalized = url.replace(/^http:\/\/((?:[a-z0-9-]+\.)?hdslb\.com)\//i, 'https://$1/')

  let policy
  try {
    policy = getImageProxyPolicy(new URL(normalized).hostname)
  } catch {
    return normalized
  }
  if (!policy || policy.route === 'direct') return normalized

  if (policy.route === 'weserv') {
    return `https://images.weserv.nl/?url=${encodeURIComponent(normalized)}&w=${width}`
  }

  const base = process.env.NEXT_PUBLIC_IMG_PROXY?.replace(/\/+$/, '')
  if (base) return `${base}?url=${encodeURIComponent(normalized)}&w=${width}`

  if (policy.fallback === 'weserv') {
    return `https://images.weserv.nl/?url=${encodeURIComponent(normalized)}&w=${width}`
  }
  return normalized
}
