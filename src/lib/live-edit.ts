import type { LiveContent, LiveNarrative, LiveSiteCopy } from './live-content'

/**
 * 现场编辑：后台把真实前台嵌进一个 iframe，维护者在页面上点哪句就改哪句。
 *
 * 主包里只有这一小段握手。普通访客的页面不在 iframe 里，这里直接返回，
 * 什么都不加载；只有被可信的上层页面嵌入、并且对方先打了招呼，
 * 才去按需加载 `live-edit-session.ts`（标记、描边、点选都在那边）。
 *
 * **可信来源只有两个**：本站自己的 origin（生产环境后台与前台同域），
 * 以及本地联调时 `NEXT_PUBLIC_CONTENT_ORIGIN` 指向的内容服务。别的站点就算
 * 把这里嵌进去，也收不到 `ready`，发来的消息也会被丢掉。
 *
 * 编辑会话只改**这个窗口里显示的字**，不写任何东西——保存永远在后台完成。
 */

export const LIVE_EDIT_SOURCE = 'i6-live-edit'

/**
 * 一处可改文字的定位。
 *
 * - `copy` / `narrative`：站点文案与叙事文案，保存即生效；
 *   `path` 里 `@xxx` 表示「数组里 id 为 xxx 的那一项」，数字是数组下标。
 * - `catalog` / `entry`：档案数据（节目、游戏、条目标题），要走发布流程。
 */
export type LiveEditKey = { doc: 'copy' | 'narrative' | 'catalog' | 'entry'; path: (string | number)[] }

/** 后台送来的草稿（已按前台的解析规则过了一遍）。缺哪份就沿用当前线上值。 */
export type LiveEditDraft = { copy: LiveSiteCopy | null; narrative: LiveNarrative | null }

export type LiveEditSession = {
  /** 把当前内容换成「草稿 + 可点选标记」的版本。 */
  apply: (content: LiveContent, draft: LiveEditDraft | null) => LiveContent
  dispose: () => void
}

function trustedOrigins(): string[] {
  const origins = [window.location.origin]
  const content = process.env.NEXT_PUBLIC_CONTENT_ORIGIN
  if (content) {
    try {
      origins.push(new URL(content).origin)
    } catch {
      // 配置写错就只信任本站
    }
  }
  return origins
}

/**
 * 在根 Provider 里调用一次。返回清理函数。
 *
 * `onDraft` 在后台每次推来新草稿时调用；`onSession` 在会话建立后调用一次。
 */
export function listenForLiveEditHost(
  onSession: (session: LiveEditSession) => void,
  onDraft: (draft: LiveEditDraft) => void,
): () => void {
  if (window.parent === window) return () => {}
  const host = window.parent
  const origins = trustedOrigins()
  let session: LiveEditSession | null = null
  let starting = false
  let disposed = false

  const onMessage = (event: MessageEvent) => {
    if (event.source !== host || !origins.includes(event.origin)) return
    const data = event.data as { source?: unknown; type?: unknown } | null
    if (!data || data.source !== LIVE_EDIT_SOURCE || data.type !== 'hello' || starting) return
    starting = true
    const origin = event.origin
    void import('./live-edit-session').then(({ startLiveEditSession }) => {
      if (disposed) return
      session = startLiveEditSession(host, origin, onDraft)
      onSession(session)
    })
  }

  window.addEventListener('message', onMessage)
  // 对方不是可信来源时，postMessage 的 targetOrigin 对不上，浏览器直接丢弃，不会送达。
  for (const origin of origins) host.postMessage({ source: LIVE_EDIT_SOURCE, type: 'ready', path: window.location.pathname }, origin)

  return () => {
    disposed = true
    window.removeEventListener('message', onMessage)
    session?.dispose()
  }
}
