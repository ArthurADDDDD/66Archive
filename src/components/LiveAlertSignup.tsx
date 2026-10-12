'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

const CONTENT_ORIGIN = (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, '')
const SUBSCRIPTION_PATH = '/api/live-alerts/subscriptions'

function Bell({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" />
  </svg>
}

export function LiveAlertSignup() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  function close() {
    setOpen(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  return <>
    <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
      className="ui-press inline-flex items-center gap-2 rounded-full border border-live/35 bg-live/5 px-5 py-3 text-control font-medium text-live transition-colors hover:border-live/70 hover:bg-live/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-live">
      <Bell className="h-4 w-4" />开播提醒
    </button>
    {open && createPortal(<SignupDialog onClose={close} />, document.body)}
  </>
}

function SignupDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const id = useId()
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [availability, setAvailability] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    dialog.current?.showModal()
    dialog.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    fetch(`${CONTENT_ORIGIN}${SUBSCRIPTION_PATH}`, { signal: controller.signal, cache: 'no-store', credentials: 'omit' })
      .then(async response => {
        if (!response.ok) throw new Error('unavailable')
        const result: unknown = await response.json()
        setAvailability(result && typeof result === 'object' && 'enabled' in result && result.enabled === true ? 'ready' : 'unavailable')
      }).catch(() => { if (!controller.signal.aborted || dialog.current?.open) setAvailability('unavailable') })
      .finally(() => clearTimeout(timeout))
    return () => {
      controller.abort(); clearTimeout(timeout); request.current?.abort()
      document.body.style.overflow = overflow
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || availability !== 'ready' || !consent) return
    busy.current = true; setSubmitting(true); setError('')
    const controller = new AbortController()
    request.current = controller
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(`${CONTENT_ORIGIN}${SUBSCRIPTION_PATH}`, {
        method: 'POST', signal: controller.signal, credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), consent: true }),
      })
      if (response.status === 429) { setError('操作有些频繁，请稍后再试。'); return }
      if (response.status === 400) { setError('请检查邮箱地址后再试。'); return }
      if (!response.ok) throw new Error('unavailable')
      const result: unknown = await response.json()
      if (!result || typeof result !== 'object' || !('status' in result) || result.status !== 'confirmation_required') throw new Error('invalid_response')
      setConfirmed(true)
    } catch {
      if (!dialog.current?.open) return
      setError('暂时无法确认提交结果。请先检查邮箱是否收到确认邮件，稍后再试。')
    } finally {
      clearTimeout(timeout); busy.current = false; setSubmitting(false)
    }
  }

  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    } }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.75rem] border border-line bg-base p-0 text-ink shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop:bg-black/65 backdrop:backdrop-blur-sm">
    <div className="relative p-6 sm:p-8">
      <button type="button" onClick={onClose} aria-label="关闭开播提醒" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-live">
        <span aria-hidden="true" className="text-h3">×</span>
      </button>
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-live/25 bg-live/10 text-live"><Bell className="h-6 w-6" /></div>
      <p className="text-meta text-live">下一次开播，不用碰运气。</p>
      <h2 id={`${id}-title`} className="mt-2 text-h2 font-semibold">{confirmed ? '还差一步，确认邮箱' : '开播了，给你写封信。'}</h2>
      <p id={`${id}-description`} className="mt-3 text-body leading-relaxed text-muted">
        {confirmed ? '请打开邮件里的确认链接，之后才会收到开播提醒。如果没有找到，也看看垃圾邮件箱。' : '留下邮箱，女流在抖音开播时，我们就给你发一封提醒。只提醒开播，随时可以退订。'}
      </p>
      {confirmed ? <button type="button" onClick={onClose} className="ui-press mt-6 min-h-11 w-full rounded-full bg-ink px-5 py-3 text-control font-medium text-base">知道了</button> :
        <form onSubmit={submit} className="mt-6">
          <label htmlFor={`${id}-email`} className="text-control font-medium">你的邮箱</label>
          <input autoFocus id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254}
            pattern="[^\s@]+@[^\s@]+\.[^\s@]+" placeholder="you@example.com" value={email}
            onChange={event => { setEmail(event.target.value); setError('') }} disabled={submitting}
            aria-describedby={`${id}-hint`} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface px-4 py-3 text-body text-ink placeholder:text-faint focus:border-live focus:outline-none focus:ring-2 focus:ring-live/20 disabled:opacity-60" />
          <p id={`${id}-hint`} className="mt-2 text-meta leading-relaxed text-faint">先发一封确认邮件，点击确认后才开始提醒。</p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 text-meta leading-relaxed text-muted">
            <input type="checkbox" required checked={consent} disabled={submitting} onChange={event => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-live" />
            <span>我愿意接收开播提醒，并已阅读<Link href="/privacy/" target="_blank" rel="noopener noreferrer" className="text-live underline underline-offset-4">隐私说明</Link>。邮箱不会公开展示。</span>
          </label>
          <div className="mt-4 text-meta leading-relaxed" aria-live="polite" aria-atomic="true">
            {availability === 'loading' && <p className="text-faint">正在确认订阅是否开放…</p>}
            {availability === 'unavailable' && <p className="rounded-xl border border-line bg-surface/60 p-3 text-muted">开播提醒正在准备中，暂时无法提交订阅。这里填写的邮箱不会保存。</p>}
            {error && <p role="alert" className="mt-2 text-today">{error}</p>}
          </div>
          <button type="submit" disabled={availability !== 'ready' || submitting || !consent}
            className="ui-press mt-5 min-h-12 w-full rounded-full bg-live px-5 py-3 text-control font-semibold text-base transition-opacity disabled:cursor-not-allowed disabled:opacity-40">
            {submitting ? '正在提交…' : availability === 'unavailable' ? '订阅即将开放' : '发送确认邮件'}
          </button>
          <p className="mt-3 text-center text-meta leading-relaxed text-faint">提醒来自本站观测，可能稍晚于实际开播。</p>
        </form>}
    </div>
  </dialog>
}
