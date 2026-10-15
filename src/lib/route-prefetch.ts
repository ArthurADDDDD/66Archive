/** 静态导出的查询串与锚点不改变路由载荷。 */
export function prefetchPath(href: string | null, currentPath: string): string | null {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return null
  const path = href.split(/[?#]/, 1)[0]
  const normalize = (value: string) => value.endsWith('/') ? value : `${value}/`
  if (!path || normalize(path) === normalize(currentPath)) return null
  return path
}

/** 一个页面只有一份去重表、悬停计时器和 12 条预算，包含页头与浮动导航。 */
export function createRoutePrefetch(prefetch: (path: string) => void) {
  const warmed = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: string | null = null

  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pending = null
  }
  const commit = (path: string) => {
    cancel()
    if (warmed.has(path) || warmed.size >= 12) return
    warmed.add(path)
    try {
      prefetch(path)
    } catch {
      warmed.delete(path)
    }
  }
  const queue = (path: string) => {
    if (pending === path) return
    cancel()
    if (warmed.has(path) || warmed.size >= 12) return
    pending = path
    timer = setTimeout(() => commit(path), 100)
  }
  return { queue, commit, cancel }
}
