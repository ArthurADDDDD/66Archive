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
 * 封面可选走部署方图片代理；B 站封面在未配置时使用公开的缩略图代理，
 * 以绕开图床对本地站点来源的防盗链。其他来源继续直接使用原图。
 */
export function proxyImage(url: string | undefined, width = 480): string | null {
  if (!url) return null
  const base = process.env.NEXT_PUBLIC_IMG_PROXY
  if (base) return `${base}?url=${encodeURIComponent(url)}&w=${width}`
  try {
    const host = new URL(url).hostname
    if (host === 'hdslb.com' || host.endsWith('.hdslb.com')) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${width}`
    }
  } catch {
    return url
  }
  return url
}
