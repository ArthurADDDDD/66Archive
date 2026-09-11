'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CORRECTION_CONFIG_FALLBACK,
  fetchCorrectionConfig,
  submitCorrection,
  type CorrectionConfig,
} from '@/lib/correction-api'
import { loadTurnstile, type TurnstileApi } from '@/lib/turnstile'
import { MAX_PHOTOS, preparePhotos, submitWithPhotos, type PreparedPhoto } from '@/lib/photo-submit'

/**
 * 访客提交表单，资料纠错和梗投稿共用同一个组件。
 *
 * 两者的后端契约完全一致（昵称 + 正文 + Turnstile 令牌 → 进人工队列，
 * 不自动改动任何数据），差的只是文案和落在哪个后台队列——那部分交给
 * `kind` 和几个文案 prop，逻辑本身不该抄两份。
 *
 * 只做「提醒」：提交之后没有任何可查询的状态，也不会自动生效——
 * 所有内容都进后台的人工队列。所以这里刻意不做「我的提交记录」之类的东西，
 * 那会凭空多出一整套公开契约要维护。
 */

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

type Status = 'idle' | 'submitting' | 'success'

export function SubmissionForm({
  kind,
  allowPhotos = false,
  initialBody = '',
  nameLabel,
  namePlaceholder,
  bodyLabel,
  bodyPlaceholder,
  successMessage,
  disabledMessage,
  submitLabel,
  againLabel,
  className,
}: {
  kind: 'correction' | 'meme'
  /**
   * 允许附图。只有联系页「我存着老图」那一种来意会打开它——纠错和梗投稿不需要图，
   * 多一个文件选择框只会让表单看起来更重。
   */
  allowPhotos?: boolean
  /**
   * 正文的初始内容。联系页按「补一场 / 纠错 / 老图」三种来意各给一份填空模板——
   * 面对一个空白 textarea，多数人写不出后台能直接用的信息。
   * 组件按 `initialBody` 重挂载（调用方给 key），所以这里只做初始值即可。
   */
  initialBody?: string
  nameLabel: string
  namePlaceholder: string
  bodyLabel: string
  bodyPlaceholder: string
  successMessage: string
  disabledMessage: string
  submitLabel: string
  againLabel: string
  className?: string
}) {
  const [config, setConfig] = useState<CorrectionConfig | null>(null)
  // 拿配置这一步失败，跟服务端明确说「没开」是两码事——见 fetchCorrectionConfig 的注释。
  // configAttempt 只用来让下面的 useEffect 在点「重试」时重新跑一遍，值本身不重要。
  const [configFailed, setConfigFailed] = useState(false)
  const [configAttempt, setConfigAttempt] = useState(0)
  const [name, setName] = useState('')
  const [body, setBody] = useState(initialBody)
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PreparedPhoto[]>([])
  const [preparing, setPreparing] = useState(false)
  /** 成功回执里要说「收到 N 张图」，而 photos 在成功时已经清空了。 */
  const [sentPhotoCount, setSentPhotoCount] = useState(0)

  const widgetRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    fetchCorrectionConfig()
      .then((next) => {
        if (!active) return
        setConfig(next)
        setConfigFailed(false)
      })
      .catch(() => {
        if (active) setConfigFailed(true)
      })
    return () => {
      active = false
    }
  }, [configAttempt])

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
    status !== 'submitting' && !preparing && Boolean(trimmedName) && Boolean(trimmedBody) && Boolean(token)

  const send = async () => {
    if (!canSubmit || !token) return
    setStatus('submitting')
    setError(null)
    try {
      setSentPhotoCount(photos.length)
      if (photos.length > 0) {
        // 带图走 multipart 的那条路：文字和图片在同一个请求里，一个令牌一次提交。
        await submitWithPhotos({
          reporterName: trimmedName,
          body: trimmedBody,
          turnstileToken: token,
          photos: photos.map((item) => item.file),
        })
      } else {
        await submitCorrection({ reporterName: trimmedName, body: trimmedBody, kind, turnstileToken: token })
      }
      setStatus('success')
      setName('')
      setBody(initialBody)
      setPhotos([])
    } catch (submitError) {
      // **不清空输入。** 提交失败时把用户刚写的一段话抹掉是最让人恼火的事，
      // 而失败原因往往是限流或网络，稍后重试就好。
      setStatus('idle')
      setError(submitError instanceof Error ? submitError.message : '提交失败，请稍后再试')
    } finally {
      resetWidget()
    }
  }

  if (configFailed) {
    return (
      <div className={className}>
        <p className="text-control text-muted">这次没能问到人机验证配置，多半是网络抖了一下。</p>
        <button
          type="button"
          onClick={() => setConfigAttempt((value) => value + 1)}
          className="ui-press mt-2 rounded-full border border-line px-4 py-1.5 text-control text-muted hover:border-muted hover:text-ink"
        >
          重试
        </button>
      </div>
    )
  }

  if (config === null) {
    return <p className={`text-control text-faint ${className ?? ''}`}>正在载入…</p>
  }

  if (!config.enabled) {
    return <p className={`text-body text-muted ${className ?? ''}`}>{disabledMessage}</p>
  }

  if (status === 'success') {
    return (
      <SubmissionReceipt
        className={className}
        message={successMessage}
        photoCount={sentPhotoCount}
        againLabel={againLabel}
        onAgain={() => {
          setSentPhotoCount(0)
          setStatus('idle')
        }}
      />
    )
  }

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <label className="block text-meta text-faint">
        {nameLabel}
        <input
          type="text"
          value={name}
          maxLength={limits.nameMax}
          onChange={(event) => setName(event.target.value)}
          placeholder={namePlaceholder}
          className="mt-2 min-h-11 w-full rounded-lg border border-line bg-base/60 px-3 text-control text-ink outline-none placeholder:text-faint focus:border-live"
        />
      </label>

      <label className="mt-4 block text-meta text-faint">
        {bodyLabel}
        <textarea
          value={body}
          maxLength={limits.bodyMax}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          placeholder={bodyPlaceholder}
          className="mt-2 w-full resize-y rounded-lg border border-line bg-base/60 px-3 py-2 text-control leading-relaxed text-ink outline-none placeholder:text-faint focus:border-live"
        />
        <span className="mt-1 block text-right tnum">
          {body.length} / {limits.bodyMax}
        </span>
      </label>

      {allowPhotos && (
        <div className="mt-4">
          <p className="text-meta text-faint">
            有图的话可以一起传（最多 {MAX_PHOTOS} 张）
          </p>
          <label className="ui-press mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line bg-base/60 px-4 text-control text-muted hover:border-live/45 hover:text-ink">
            选择图片
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={async (event) => {
                const chosen = [...(event.target.files ?? [])]
                // 同一个文件再选一次时 value 不变、onChange 不触发；清空才能重选。
                event.target.value = ''
                if (chosen.length === 0) return
                setPreparing(true)
                setError(null)
                try {
                  const { prepared, rejected } = await preparePhotos(chosen)
                  setPhotos((current) => [...current, ...prepared].slice(0, MAX_PHOTOS))
                  if (rejected.length > 0) setError(`这些没能加进来：${rejected.join('、')}`)
                } finally {
                  setPreparing(false)
                }
              }}
            />
          </label>
          {preparing && <p className="mt-2 text-meta text-faint">正在压缩…</p>}

          {photos.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {photos.map((photo, index) => (
                <li key={`${photo.file.name}-${index}`} className="flex items-center gap-3 text-meta text-muted">
                  <span className="min-w-0 flex-1 truncate">{photo.file.name}</span>
                  <span className="shrink-0 text-faint tnum">
                    {(photo.file.size / 1024).toFixed(0)} KB
                    {photo.originalBytes > photo.file.size && (
                      <>（已压缩，原 {(photo.originalBytes / 1024 / 1024).toFixed(1)}MB）</>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                    className="ui-press shrink-0 rounded-sm px-1 text-faint hover:text-ink"
                    aria-label={`移除 ${photo.file.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/*
            这句是站长定的说法：重点放在「我会认真看」，而不是「你要担责」。
            它同时也是事实——图片落在后台的收件箱里，审核通过之前在公网上没有地址。
          */}
          <p className="measure-body mt-3 text-meta leading-relaxed text-faint">
            你传上来的图我会一张张看过再决定收不收，<strong className="font-medium text-muted">上传不等于会出现在画廊里</strong>。
            图片会先压小一点再上传，省你的流量。
          </p>
        </div>
      )}

      {/* Cloudflare 把验证组件渲染进这个容器 */}
      <div ref={widgetRef} className="mt-4" />

      {error && (
        <p role="alert" className="mt-3 text-control text-video">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-faint">无需注册。提交的内容只作为人工核对的线索，不会自动生效。</p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="ui-press min-h-10 rounded-full bg-ink px-5 text-control font-semibold text-[#12141C] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {status === 'submitting'
            ? photos.length > 0
              ? `正在上传 ${photos.length} 张图…`
              : '提交中…'
            : submitLabel}
        </button>
      </div>
    </form>
  )
}

/**
 * 提交成功的回执。
 *
 * 从前这里只是一行青色小字。问题不在字本身，在**它出现的时候整个表单消失了**：
 * 姓名、正文、图片列表、人机验证、提交行加起来好几百像素，一下塌掉，
 * 于是原本盯着提交按钮的人，视口里剩下的是下面本来在屏幕外的内容——
 * 那句「收到」跑到视口上方，看不见。用户只知道「我点了，好像没反应」。
 *
 * 所以两件事一起做：做成一张有边框的回执（看得出是一个结果，不是一句注脚），
 * 并在挂载时把它滚进视野。带图时还要说清楚收到了几张、接下来会发生什么——
 * 传图的人最想确认的就是这个。
 */
function SubmissionReceipt({
  className,
  message,
  photoCount,
  againLabel,
  onAgain,
}: {
  className?: string
  message: string
  photoCount: number
  againLabel: string
  onAgain: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // 表单塌掉之后视口往往已经不在这块了，主动滚回来。
    // 这里没有 setState，不受 react-hooks/set-state-in-effect 限制。
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={`ui-panel-in rounded-xl border border-live/45 bg-live/8 p-5 ${className ?? ''}`}
    >
      <p className="text-h3 font-medium text-ink">收到了 ✓</p>
      <p className="measure-body mt-2 text-body text-muted">{message}</p>
      {photoCount > 0 && (
        <p className="measure-body mt-2 text-body text-muted">
          图片也收到了，一共 <span className="font-mono text-control font-semibold text-ink tnum">{photoCount}</span> 张。
          它们现在只存在后台的待审队列里，我看过之后才会决定要不要放进画廊。
        </p>
      )}
      <button
        type="button"
        onClick={onAgain}
        className="ui-press mt-4 min-h-10 rounded-full border border-line px-5 text-control text-muted hover:border-muted hover:text-ink"
      >
        {againLabel}
      </button>
    </div>
  )
}
