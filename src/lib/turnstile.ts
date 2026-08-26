/**
 * Cloudflare Turnstile 的按需加载器，供所有走人机验证的公开表单共用
 * （资料纠错、梗投稿，以后任何新的公开写接口都该复用这个而不是抄一份）。
 *
 * 用一个挂在 window 上的 promise 去重，而不是「有没有 window.turnstile」——
 * 后者在脚本还在下载时是 false，同一页面挂两个表单会插入两个 script 标签。
 */
export type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
    __i6i6TurnstileLoading?: Promise<void>
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function loadTurnstile(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (window.__i6i6TurnstileLoading) return window.__i6i6TurnstileLoading

  window.__i6i6TurnstileLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('人机验证组件加载失败'))
    document.head.appendChild(script)
  })
  return window.__i6i6TurnstileLoading
}
