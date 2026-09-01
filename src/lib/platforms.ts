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
 * 封面只在共享 policy 明确允许时进入图片代理。
 *
 * - `/gallery/**`、`/images/**` 以及其它站内绝对路径永远原样返回。
 * - 设置 NEXT_PUBLIC_IMG_PROXY 只替换 policy 内 host 的取图路径，不会把所有远端图
 *   都送进 Worker。
 * - 未设置时，各 host 按 policy 的 fallback 行为处理；其余远端 host 永远直连。
 */
export function proxyImage(url: string | undefined, width = 480): string | null {
  if (!url) return null
  if (url.startsWith('/')) return url

  // B 站元数据接口至今仍可能返回 http 图床地址；本站 Worker 只接受 https，
  // 这里统一升级，既能命中图片代理，也避免在 HTTPS 页面触发 mixed content。
  const normalized = url.replace(/^http:\/\/((?:[a-z0-9-]+\.)?hdslb\.com)\//i, 'https://$1/')

  let policy
  try {
    policy = getImageProxyPolicy(new URL(normalized).hostname)
  } catch {
    return normalized
  }
  if (!policy) return normalized

  const base = process.env.NEXT_PUBLIC_IMG_PROXY?.replace(/\/+$/, '')
  if (base) return `${base}?url=${encodeURIComponent(normalized)}&w=${width}`

  if (policy.fallback === 'weserv') {
    return `https://images.weserv.nl/?url=${encodeURIComponent(normalized)}&w=${width}`
  }
  return normalized
}
