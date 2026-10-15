import type { LiveContent } from './live-content'

const EMPTY: LiveContent = { narrative: null, copy: null, editorial: null }

/** 每个 Provider 独享：跨路由复用进行中和成功的请求，失败不永久占位。 */
export function createLiveContentLoader(fetchContent: (paths: readonly string[]) => Promise<LiveContent>) {
  const requests = new Map<string, Promise<LiveContent>>()

  function load(path: string): Promise<LiveContent> {
    const existing = requests.get(path)
    if (existing) return existing
    const request = Promise.resolve()
      .then(() => fetchContent([path]))
      .catch(() => EMPTY)
      .then((content) => {
        if (!content.copy && !content.narrative && !content.editorial) requests.delete(path)
        return content
      })
    requests.set(path, request)
    return request
  }

  return function subscribe(paths: readonly string[], receive: (content: LiveContent) => void) {
    let active = true
    for (const path of new Set(paths)) {
      void load(path).then((content) => {
        // 切页或卸载只取消订阅，不作废网络结果；新页面仍能复用它。
        if (active && (content.copy || content.narrative || content.editorial)) receive(content)
      })
    }
    return () => { active = false }
  }
}
