/**
 * 画廊点赞的前台客户端。与投票同一套约定：同源反代、`credentials: 'include'`
 * 带上签名 cookie、失败时抛出服务端给的中文文案。
 *
 * 复用 NEXT_PUBLIC_VOTE_API_BASE——这个变量从一开始就是「后台 API 的公共域名」，
 * 不是投票专属，correction-api.ts 已经这么用了；点赞的后台实现也确实和投票、
 * 纠错挂在同一个 Next 应用上，同一个域名。
 */

const API_BASE = (process.env.NEXT_PUBLIC_VOTE_API_BASE ?? '').replace(/\/$/, '')

export type GalleryLikesState = {
  /** 数量为 0 的照片不出现在这里，前端按缺省当 0 处理。 */
  counts: Record<string, number>
  /** 当前访客（按签名 cookie 识别）点赞过的照片 id。 */
  likedByViewer: string[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const body = (await response.json().catch(() => null)) as ({ message?: string } & T) | null
  if (!response.ok) throw new Error(body?.message ?? '点赞服务暂时不可用')
  if (!body) throw new Error('点赞服务返回了空响应')
  return body
}

export function fetchGalleryLikes(): Promise<GalleryLikesState> {
  return request('/api/likes/gallery')
}

/** 点赞/取消点赞二选一，由服务端按当前状态决定，调用方不用先知道现在是哪个状态。 */
export function toggleGalleryLike(photoId: string): Promise<{ liked: boolean; count: number }> {
  return request(`/api/likes/gallery/${encodeURIComponent(photoId)}`, { method: 'POST' })
}
