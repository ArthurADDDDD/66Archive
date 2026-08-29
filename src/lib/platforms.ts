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
 * 封面可选走部署方图片代理；B 站封面在未配置时使用公开的缩略图代理，
 * 以绕开图床对本地站点来源的防盗链。其他来源继续直接使用原图。
 */
export function proxyImage(url: string | undefined, width = 480): string | null {
  if (!url) return null
  // 本站自带的封面（public/images/**）用站内绝对路径表示，任何图片代理都取不到它，
  // 必须原样返回；配置了 NEXT_PUBLIC_IMG_PROXY 时尤其容易把它代理成 404。
  if (url.startsWith('/')) return url
  // B 站元数据接口至今仍可能返回 http 图床地址；本站 Worker 只接受 https，
  // 这里统一升级，既能命中图片代理，也避免在 HTTPS 页面触发 mixed content。
  const normalized = url.replace(/^http:\/\/((?:[a-z0-9-]+\.)?hdslb\.com)\//i, 'https://$1/')
  const base = process.env.NEXT_PUBLIC_IMG_PROXY
  if (base) return `${base}?url=${encodeURIComponent(normalized)}&w=${width}`
  try {
    const host = new URL(normalized).hostname
    if (host === 'hdslb.com' || host.endsWith('.hdslb.com')) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(normalized)}&w=${width}`
    }
  } catch {
    return normalized
  }
  return normalized
}
