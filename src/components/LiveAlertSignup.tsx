'use client'

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { LiveAlertPushSection } from './LiveAlertPushSection'
import { readAvailability, type PushAvailability } from '@/lib/live-push'

const CONTENT_ORIGIN = (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, '')
const SUBSCRIPTION_PATH = '/api/live-alerts/subscriptions'
type Tab = 'email' | 'push'

function Bell({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" />
  </svg>
}

export function LiveAlertSignup() {
  const [open, setOpen] = useState(false)
  const [testCode, setTestCode] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  // 后台生成的一次性测试链接（#push-test=XXXX）：读出后立刻从地址栏移除，并打开弹窗。
  useEffect(() => {
    const code = /(?:^#|&)push-test=([A-Za-z0-9]{10})(?:&|$)/.exec(location.hash)?.[1]
    if (!code) return
    history.replaceState(null, '', location.pathname + location.search)
    const timer = setTimeout(() => { setTestCode(code.toUpperCase()); setOpen(true) })
    return () => clearTimeout(timer)
  }, [])
  function close() {
    setOpen(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  return <>
    <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
      className="ui-press inline-flex items-center gap-2 rounded-full border border-live/35 bg-live/5 px-5 py-3 text-control font-medium text-live transition-colors hover:border-live/70 hover:bg-live/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-live">
      <Bell className="h-4 w-4" />开播提醒
    </button>
    {open && createPortal(<SignupDialog onClose={close} testCode={testCode} onTestCode={setTestCode} />, document.body)}
  </>
}

function SignupDialog({ onClose, testCode, onTestCode }: { onClose: () => void; testCode: string; onTestCode: (code: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const emailTab = useRef<HTMLButtonElement>(null)
  const pushTab = useRef<HTMLButtonElement>(null)
  const initialPush = useRef(!!testCode)
  const id = useId()
  const [tab, setTab] = useState<Tab>(() => testCode ? 'push' : 'email')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [availability, setAvailability] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [mailSent, setMailSent] = useState(false)
  const [error, setError] = useState('')
  const [push, setPush] = useState<PushAvailability>({ enabled: false })
  const [pushLoading, setPushLoading] = useState(true)
  const [pushOn, setPushOn] = useState(false)
  // 弹窗只在点击后于浏览器端渲染，可以直接读取显示模式。
  const [standalone] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

  useEffect(() => {
    dialog.current?.showModal()
    if (!initialPush.current) dialog.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    // 浏览器通知与邮件订阅相互独立：接口不可用时只是不显示这一块，邮件部分照常。
    readAvailability(controller.signal).then(setPush).catch(() => setPush({ enabled: false })).finally(() => {
      if (!controller.signal.aborted || dialog.current?.open) setPushLoading(false)
    })
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

  // 持测试码打开时，等推送接口返回、Tab 真正出现后再把焦点放到「浏览器通知」。
  useEffect(() => {
    if (!initialPush.current || !push.enabled || tab !== 'push') return
    const frame = requestAnimationFrame(() => pushTab.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [push.enabled, tab])

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
      setMailSent(true)
    } catch {
      if (!dialog.current?.open) return
      setError('暂时无法确认提交结果。请先检查邮箱是否收到确认邮件，稍后再试。')
    } finally {
      clearTimeout(timeout); busy.current = false; setSubmitting(false)
    }
  }

  // 测试阶段只对持有测试码的设备显示浏览器通知（主屏幕 Web App 里可以手动输入测试码）。
  const pushReady = push.enabled && (push.mode === 'public' || !!testCode || standalone) ? push : null
  const showTabs = !!pushReady || pushLoading
  const activeTab: Tab = pushReady ? tab : 'email'
  const emailStatus = mailSent ? '需确认' : ''
  const pushStatus = pushOn ? '已开启' : ''

  function chooseTab(next: Tab) {
    if (next === 'push' && !pushReady) return
    setTab(next)
  }
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next: Tab = event.key === 'Home' ? 'email' : event.key === 'End' ? 'push' : activeTab === 'email' ? 'push' : 'email'
    if (next === 'push' && !pushReady) return
    setTab(next)
    requestAnimationFrame(() => (next === 'email' ? emailTab : pushTab).current?.focus())
  }

  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    } }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.75rem] border border-line bg-base p-0 text-ink shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop:bg-black/65 backdrop:backdrop-blur-sm">
    <div className="relative p-5 sm:p-7">
      <button type="button" onClick={onClose} aria-label="关闭开播提醒" className="absolute right-2.5 top-2.5 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-live">
        <span aria-hidden="true" className="text-h3">×</span>
      </button>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-live/25 bg-live/10 text-live"><Bell className="h-5 w-5" /></div>
      <p className="text-meta text-live">下一次开播，不用碰运气。</p>
      <h2 id={`${id}-title`} className="mt-1.5 text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">开播提醒</h2>
      <p id={`${id}-description`} className="mt-2 text-body leading-relaxed text-muted">
        {showTabs ? '选择适合你的提醒方式，两种方式都可以开启。' : '留下邮箱，女流在抖音开播时，我们就给你发一封提醒。只提醒开播，随时可以退订。'}
      </p>

      {showTabs && <div role="tablist" aria-label="开播提醒方式" onKeyDown={onTabKeyDown}
        className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border border-line/80 bg-surface/60 p-1">
        <button ref={emailTab} id={`${id}-email-tab`} type="button" role="tab" aria-selected={activeTab === 'email'} aria-controls={`${id}-email-panel`}
          tabIndex={activeTab === 'email' ? 0 : -1} onClick={() => chooseTab('email')}
          className={`ui-press flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-control font-medium transition-colors ${activeTab === 'email' ? 'bg-live/10 text-ink shadow-[inset_0_0_0_1px_rgba(91,200,232,0.42)]' : 'text-muted hover:bg-raised/60 hover:text-ink'}`}>
          <span className="truncate">邮件提醒</span>
          {emailStatus && <span className="shrink-0 text-[0.6875rem] font-normal leading-none text-live">{emailStatus}</span>}
        </button>
        <button ref={pushTab} id={`${id}-push-tab`} type="button" role="tab" aria-selected={activeTab === 'push'} aria-controls={pushReady ? `${id}-push-panel` : undefined}
          tabIndex={activeTab === 'push' ? 0 : -1} onClick={() => chooseTab('push')} disabled={!pushReady}
          className={`ui-press flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-control font-medium transition-colors disabled:cursor-wait ${activeTab === 'push' ? 'bg-live/10 text-ink shadow-[inset_0_0_0_1px_rgba(91,200,232,0.42)]' : 'text-muted hover:bg-raised/60 hover:text-ink'}`}>
          <span className="truncate">浏览器通知</span>
          {pushStatus && <span className="shrink-0 text-[0.6875rem] font-normal leading-none text-live">{pushStatus}</span>}
        </button>
      </div>}

      <div role={showTabs ? 'tabpanel' : undefined} id={`${id}-email-panel`} aria-labelledby={showTabs ? `${id}-email-tab` : undefined}
        hidden={activeTab !== 'email'} className="mt-5">
        {mailSent ? <div role="status" aria-live="polite">
          <div className="inline-flex items-center rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-meta font-semibold text-amber-200">尚未完成订阅</div>
          <h3 className="mt-3 text-h3 font-semibold text-ink">申请已提交，别忘了去邮箱确认！</h3>
          <p className="mt-3 text-control leading-relaxed text-muted">
            已收到 <span className="break-all font-medium text-ink">{email.trim()}</span> 的申请。确认邮件可能稍晚到达，<strong className="text-ink">仅提交邮箱还不能收到开播提醒。</strong>
          </p>
          <ol className="mt-4 space-y-3 rounded-2xl border border-live/30 bg-live/5 p-4 text-control leading-relaxed">
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-live/20 font-semibold text-live">1</span><span>打开邮箱，找到「女流66开播提醒」的确认邮件。</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-live/20 font-semibold text-live">2</span><span>点击邮件里的链接，<strong className="text-ink">再到网页点击「确认订阅」</strong>。</span></li>
          </ol>
          <p className="mt-3 text-meta leading-relaxed text-muted">完成网页确认后才会生效。链接有效期为 24 小时；找不到邮件请检查垃圾邮件箱。</p>
          <button type="button" onClick={onClose} className="ui-press mt-5 min-h-12 w-full rounded-full bg-live px-5 py-3 text-control font-semibold text-base">我去邮箱完成确认</button>
          {pushReady && <button type="button" onClick={() => chooseTab('push')} className="ui-press mt-2 min-h-11 w-full rounded-full border border-line px-5 text-control text-muted hover:border-live/50 hover:text-ink">改用浏览器通知</button>}
        </div> : <form onSubmit={submit}>
          <div className="rounded-xl border border-live/35 bg-live/5 p-3.5 text-control leading-relaxed">
            <p className="font-semibold text-ink">订阅需要邮件确认，填写邮箱还不算成功</p>
            <p className="mt-1.5 text-muted">提交后，请打开收到的邮件，进入确认页面并点击「确认订阅」，提醒才会开启。</p>
          </div>
          <label htmlFor={`${id}-email`} className="mt-4 block text-control font-medium">你的邮箱</label>
          <input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254}
            pattern="[^\s@]+@[^\s@]+\.[^\s@]+" placeholder="you@example.com" value={email}
            onChange={event => { setEmail(event.target.value); setError('') }} disabled={submitting}
            aria-describedby={`${id}-hint`} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface px-4 py-3 text-body text-ink placeholder:text-faint focus:border-live focus:outline-none focus:ring-2 focus:ring-live/20 disabled:opacity-60" />
          <p id={`${id}-hint`} className="mt-2 text-meta leading-relaxed text-faint">将申请发送至该邮箱，之后还需要在邮件打开的网页上确认。</p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-meta leading-relaxed text-muted">
            <input type="checkbox" required checked={consent} disabled={submitting} onChange={event => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-live" />
            <span>我自愿订阅女流档案馆的开播邮件提醒，同意在检测到女流开播时接收通知，可随时退订。</span>
          </label>
          <p className="mt-2 pl-7 text-meta leading-relaxed text-faint">女流档案馆是粉丝独立维护的非官方服务，邮箱不会公开展示。邮箱如何使用、保存与退订，见<Link href="/privacy/" target="_blank" rel="noopener noreferrer" className="text-live underline underline-offset-4">隐私说明</Link>。</p>
          <div className="mt-3 text-meta leading-relaxed" aria-live="polite" aria-atomic="true">
            {availability === 'loading' && <p className="text-faint">正在确认订阅是否开放…</p>}
            {availability === 'unavailable' && <p className="rounded-xl border border-line bg-surface/60 p-3 text-muted">开播提醒正在准备中，暂时无法提交订阅。这里填写的邮箱不会保存。</p>}
            {error && <p role="alert" className="mt-2 text-today">{error}</p>}
          </div>
          <button type="submit" disabled={availability !== 'ready' || submitting || !consent}
            className="ui-press mt-4 min-h-12 w-full rounded-full bg-live px-5 py-3 text-control font-semibold text-base transition-opacity disabled:cursor-not-allowed disabled:opacity-40">
            {submitting ? '正在提交…' : availability === 'unavailable' ? '订阅即将开放' : '发送确认邮件（还需确认）'}
          </button>
          <p className="mt-3 text-center text-meta leading-relaxed text-faint">提醒来自本站观测，可能稍晚于实际开播。</p>
        </form>}
      </div>

      {pushReady && <div role="tabpanel" id={`${id}-push-panel`} aria-labelledby={`${id}-push-tab`} hidden={activeTab !== 'push'} className="mt-5">
        <LiveAlertPushSection availability={pushReady} testCode={testCode} onTestCode={onTestCode}
          onSubscribedChange={setPushOn} onUseEmail={() => chooseTab('email')} />
      </div>}
    </div>
  </dialog>
}
