'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CORRECTION_CONFIG_FALLBACK,
  fetchCorrectionConfig,
  submitCorrection,
  type CorrectionConfig,
} from '@/lib/correction-api'

/**
 * 资料纠错提交表单。
 *
 * 只做「提醒」：提交之后没有任何可查询的状态，也不会自动改动档案——
 * 所有内容都进后台的人工队列。所以这里刻意不做「我的提交记录」之类的东西，
 * 那会凭空多出一整套公开契约要维护。
 */

/** Cloudflare 注入的全局。只用到这三个方法，不引第三方封装。 */
type TurnstileApi = {
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

/**
 * 按需加载 Cloudflare 的脚本，整页只加载一次。
 *
 * 用一个挂在 window 上的 promise 去重，而不是「有没有 window.turnstile」——
 * 后者在脚本还在下载时是 false，连续调用会插入好几个 script 标签。
 */
function loadTurnstile(): Promise<void> {
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

type Status = 'idle' | 'submitting' | 'success'

export function CorrectionForm() {
  const [config, setConfig] = useState<CorrectionConfig | null>(null)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const widgetRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchCorrectionConfig().then((next) => {
      if (active) setConfig(next)
    })
    return () => {
      active = false
    }
  }, [])

  /**
   * **令牌是一次性的。** 用过一次（无论提交成功还是被服务端拒绝）就作废，
   * 不重置组件的话，用户再点提交会拿着同一个废令牌反复失败，而错误信息只会说
   * 「验证未通过」——看起来像是他自己的问题。所以每次提交结束都必须重置。
   */
  const resetWidget = useCallback(() => {
    setToken(null)
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
  }, [])

  useEffect(() => {
    if (!config?.enabled || !config.turnstileSiteKey) return
    const container = widgetRef.current
    if (!container) return

    let disposed = false
    void loadTurnstile()
      .then(() => {
        if (disposed || !window.turnstile || !container) return
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: config.turnstileSiteKey,
          callback: (value: string) => setToken(value),
          // 令牌过期（Cloudflare 默认 300 秒）后必须清掉本地那份，
          // 否则用户慢慢写完再提交，会拿一个已经失效的令牌去撞服务端。
          'expired-callback': () => setToken(null),
          'error-callback': () => setToken(null),
          theme: 'dark',
        })
      })
      .catch(() => setError('人机验证组件加载失败，请检查网络后刷新页面'))

    return () => {
      disposed = true
      const id = widgetIdRef.current
      if (id && window.turnstile) window.turnstile.remove(id)
      widgetIdRef.current = null
    }
  }, [config?.enabled, config?.turnstileSiteKey])

  const limits = config?.limits ?? CORRECTION_CONFIG_FALLBACK.limits
  const trimmedName = name.trim()
  const trimmedBody = body.trim()
  const canSubmit =
    status !== 'submitting' && Boolean(trimmedName) && Boolean(trimmedBody) && Boolean(token)

  const send = async () => {
    if (!canSubmit || !token) return
    setStatus('submitting')
    setError(null)
    try {
      await submitCorrection({ reporterName: trimmedName, body: trimmedBody, turnstileToken: token })
      setStatus('success')
      setName('')
      setBody('')
    } catch (submitError) {
      // **不清空输入。** 提交失败时把用户刚写的一段话抹掉是最让人恼火的事，
      // 而失败原因往往是限流或网络，稍后重试就好。
      setStatus('idle')
      setError(submitError instanceof Error ? submitError.message : '提交失败，请稍后再试')
    } finally {
      resetWidget()
    }
  }

  if (config === null) {
    return <p className="mt-4 text-control text-faint">正在载入…</p>
  }

  if (!config.enabled) {
    return (
      <p className="mt-4 text-body text-muted">
        提交功能暂未开放。你仍然可以从下面的项目仓库找到我。
      </p>
    )
  }

  if (status === 'success') {
    return (
      <div className="mt-4">
        <p role="status" className="text-body text-live">
          收到，谢谢。我会逐条看过再决定怎么改。
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="ui-press mt-4 min-h-10 rounded-full border border-line px-5 text-control text-muted hover:border-muted hover:text-ink"
        >
          再提交一条
        </button>
      </div>
    )
  }

  return (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <label className="block text-meta text-faint">
        怎么称呼你
        <input
          type="text"
          value={name}
          maxLength={limits.nameMax}
          onChange={(event) => setName(event.target.value)}
          placeholder="留个 ID 就行，方便我知道是谁发现的"
          className="mt-2 min-h-11 w-full rounded-lg border border-line bg-base/60 px-3 text-control text-ink outline-none placeholder:text-faint focus:border-live"
        />
      </label>

      <label className="mt-4 block text-meta text-faint">
        发现了什么问题
        <textarea
          value={body}
          maxLength={limits.bodyMax}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          placeholder="哪条记录、哪个字段不对、正确的应该是什么。有链接可以一起贴上来。"
          className="mt-2 w-full resize-y rounded-lg border border-line bg-base/60 px-3 py-2 text-control leading-relaxed text-ink outline-none placeholder:text-faint focus:border-live"
        />
        <span className="mt-1 block text-right tnum">
          {body.length} / {limits.bodyMax}
        </span>
      </label>

      {/* Cloudflare 把验证组件渲染进这个容器 */}
      <div ref={widgetRef} className="mt-4" />

      {error && (
        <p role="alert" className="mt-3 text-control text-video">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-faint">无需注册。提交的内容只作为人工核对的线索，不会自动改动档案。</p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="ui-press min-h-10 rounded-full bg-ink px-5 text-control font-semibold text-[#12141C] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {status === 'submitting' ? '提交中…' : '提交'}
        </button>
      </div>
    </form>
  )
}
