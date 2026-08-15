import { proxyImage } from './platforms'

export type BilibiliVideoMeta = {
  cover: string
  views: number
}

const cache = new Map<string, Promise<BilibiliVideoMeta | null>>()

export function bilibiliBvid(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const match = new URL(url).pathname.match(/\/video\/(BV[\w-]+)/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * 仅在客户端的展示层按已有 B 站来源读取封面和播放量；不写回档案数据。
 * 相同 BV 号全站复用同一个请求，避免多 P 条目在展开时重复请求。
 */
export function getBilibiliVideoMeta(url: string | null | undefined): Promise<BilibiliVideoMeta | null> {
  const bvid = bilibiliBvid(url)
  if (!bvid) return Promise.resolve(null)
  const cached = cache.get(bvid)
  if (cached) return cached

  // B 站接口在部分浏览器网络环境不会给 fetch 放行 CORS；JSONP 是该公开接口
  // 原生支持的方式。节目页会在构建期预取，客户端只为其他按需展开的来源降级读取。
  const request = loadVideoMetaJsonp(bvid)
    .then((meta) => meta ?? fetchVideoMeta(bvid))
    .catch(() => fetchVideoMeta(bvid))
    .catch(() => null)

  cache.set(bvid, request)
  return request
}

/**
 * 静态构建阶段从当前数据集里的来源链接读取元数据。页面输出只携带本次构建
 * 实际存在的 BV 条目，删除或替换来源后下一次构建会自然更新排序与封面。
 */
export async function getBilibiliVideoMetaAtBuild(url: string | null | undefined): Promise<BilibiliVideoMeta | null> {
  const bvid = bilibiliBvid(url)
  if (!bvid) return null
  try {
    return await fetchVideoMeta(bvid)
  } catch {
    return null
  }
}

type BilibiliPayload = { code?: number; data?: { pic?: string; stat?: { view?: number } } }

async function fetchVideoMeta(bvid: string): Promise<BilibiliVideoMeta | null> {
  const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
    credentials: 'omit',
  })
  if (!response.ok) return null
  return toVideoMeta(await response.json() as BilibiliPayload)
}

function loadVideoMetaJsonp(bvid: string): Promise<BilibiliVideoMeta | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const callbackName = `__archiveBili_${bvid.replace(/[^a-z0-9]/gi, '')}_${Date.now()}`
    const script = document.createElement('script')
    const callbackTarget = window as unknown as Record<string, unknown>
    const finish = (payload?: BilibiliPayload) => {
      window.clearTimeout(timeout)
      script.remove()
      delete callbackTarget[callbackName]
      resolve(payload ? toVideoMeta(payload) : null)
    }
    const timeout = window.setTimeout(() => finish(), 8_000)
    callbackTarget[callbackName] = (payload: BilibiliPayload) => finish(payload)
    script.async = true
    script.onerror = () => finish()
    script.src = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}&jsonp=jsonp&callback=${callbackName}`
    document.head.append(script)
  })
}

function toVideoMeta(payload: BilibiliPayload): BilibiliVideoMeta | null {
  const cover = proxyImage(payload.data?.pic, 640)
  if (payload.code !== 0 || !cover) return null
  return { cover, views: Number(payload.data?.stat?.view ?? 0) }
}
