'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { deviceIsSubscribed, detectPushEnvironment, disablePush, enablePush, sendTestNotification, type PushAvailability, type PushEnvironment } from '@/lib/live-push'

type Ready = Extract<PushAvailability, { enabled: true }>
type State = 'checking' | 'off' | 'on' | 'denied' | 'push-service' | 'error' | 'needs-code' | Exclude<PushEnvironment['kind'], 'supported'>

const MESSAGES: Partial<Record<State, string>> = {
  'in-app': '微信、QQ 等应用里的浏览器不支持网页通知。点右上角「…」选择「在浏览器中打开」后再开启，或改用邮件提醒。',
  'ios-install': 'iPhone / iPad 需要先把本站添加到主屏幕：在 Safari 点「分享」→「添加到主屏幕」，再从主屏幕图标打开本站，回到这里开启。需要 iOS 16.4 或更高版本。',
  'ios-old': '网页通知需要 iOS / iPadOS 16.4 或更高版本。可以改用邮件提醒。',
  unsupported: '这个浏览器不支持网页通知，可以改用邮件提醒。',
  insecure: '当前连接不支持网页通知。',
  denied: '本站的通知权限已被关闭。请在浏览器的网站设置里允许 nvliu.wiki 发送通知，然后点「重新检查」。',
  'push-service': '没能连上这个浏览器的推送服务。部分网络环境下 Chrome 等浏览器无法使用推送，可以换用 Edge、Firefox、Safari，或改用邮件提醒。',
  error: '浏览器通知暂时不可用，请稍后再试。',
}

export function LiveAlertPushSection({ availability, testCode, onTestCode, onSubscribedChange, onUseEmail }: {
  availability: Ready
  testCode: string
  onTestCode: (code: string) => void
  onSubscribedChange?: (subscribed: boolean) => void
  onUseEmail?: () => void
}) {
  const id = useId()
  const env = useRef<PushEnvironment | null>(null), busy = useRef(false)
  const [state, setState] = useState<State>('checking')
  const [notice, setNotice] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [action, setAction] = useState<'' | 'enable' | 'disable' | 'test'>('')

  async function inspect(): Promise<State> {
    const detected = env.current ??= detectPushEnvironment()
    if (detected.kind !== 'supported') return detected.kind
    if (Notification.permission === 'denied') return 'denied'
    try { return await deviceIsSubscribed() ? 'on' : availability.mode === 'test' && !testCode ? 'needs-code' : 'off' }
    catch { return 'error' }
  }
  const recheck = () => { void inspect().then(setState) }
  useEffect(() => {
    let current = true
    void inspect().then(next => { if (current) setState(next) })
    return () => { current = false }
  }, [testCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // 父级 Tab 只显示轻量状态；检查中或偶发错误时保留上一次确定的结果。
  useEffect(() => {
    if (state === 'on') onSubscribedChange?.(true)
    else if (state !== 'checking' && state !== 'error') onSubscribedChange?.(false)
  }, [state, onSubscribedChange])

  async function run(name: 'enable' | 'disable' | 'test', task: () => Promise<void>) {
    if (busy.current) return
    busy.current = true; setAction(name); setNotice('')
    try { await task() } finally { busy.current = false; setAction('') }
  }
  // Permission is requested directly inside this click handler (Safari requires a user gesture).
  const enable = () => run('enable', async () => {
    const result = await enablePush(availability, env.current!, testCode || undefined)
    if (result === 'on') { setState('on'); setNotice('已开启。可以点「发送测试通知」确认这台设备能收到。'); return }
    setState(result === 'denied' ? 'denied' : result === 'push-service' ? 'push-service' : result === 'test-code' ? 'needs-code' : result === 'unavailable' ? 'error' : 'off')
    if (result === 'dismissed') setNotice('没有获得通知权限，浏览器通知未开启。')
    if (result === 'rate-limited') setNotice('操作有些频繁，请稍后再试。')
    if (result === 'test-code') setNotice('测试码无效或已使用。')
  })
  const disable = () => run('disable', async () => {
    const result = await disablePush()
    setState('off')
    setNotice(result === 'off' ? '已关闭这台设备的浏览器通知。' : '已在本机关闭。服务器暂时没有确认，之后的推送会被浏览器拒收并自动清理。')
  })
  const test = () => run('test', async () => {
    const result = await sendTestNotification()
    if (result === 'inactive') { setState('off'); setNotice('这台设备的订阅已失效，请重新开启。'); return }
    setNotice(result === 'queued' ? '已请求发送测试通知，通常几秒内到达。没看到时，检查系统通知设置和勿扰模式。' : result === 'rate-limited' ? '测试通知每小时最多 3 次，请稍后再试。' : '暂时无法发送测试通知，请稍后再试。')
  })

  const message = MESSAGES[state]
  const offerEmail = !!onUseEmail && state !== 'checking' && state !== 'off' && state !== 'on' && state !== 'needs-code'
  return <section aria-labelledby={`${id}-title`} className="text-ink">
    <h3 id={`${id}-title`} className="text-control font-semibold text-ink">浏览器通知</h3>
    <p className="mt-1 text-control leading-relaxed text-muted">{state === 'on' ? '这台设备已开启，开播时会收到一条通知。' : '无需邮箱，开播时直接通过当前设备的系统通知提醒你。'}</p>
    <div aria-live="polite" aria-atomic="true" className="text-meta leading-relaxed">
      {state === 'checking' && <p className="mt-3 text-faint">正在检查这个浏览器…</p>}
      {message && <p className="mt-3 text-muted">{message}</p>}
      {notice && <p role="status" className="mt-3 text-live">{notice}</p>}
    </div>
    {state === 'needs-code' && <form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); onTestCode(codeInput.trim().toUpperCase()) }}>
      <label htmlFor={`${id}-code`} className="sr-only">测试码</label>
      <input id={`${id}-code`} value={codeInput} onChange={event => setCodeInput(event.target.value)} maxLength={10} autoCapitalize="characters" autoComplete="off" placeholder="测试码"
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-base px-3 text-body text-ink placeholder:text-faint focus:border-live focus:outline-none" />
      <button type="submit" className="ui-press min-h-11 rounded-full border border-line px-4 text-control text-ink">确定</button>
    </form>}
    {(state === 'off' || state === 'push-service') && <>
      <button type="button" onClick={enable} disabled={!!action} className="ui-press mt-3 min-h-11 w-full rounded-full bg-live px-5 py-2.5 text-control font-semibold text-base disabled:cursor-not-allowed disabled:opacity-40">
        {action === 'enable' ? '正在开启…' : state === 'push-service' ? '重试' : '开启浏览器通知'}
      </button>
      <p className="mt-2 text-meta leading-relaxed text-faint">只对当前浏览器生效，可随时关闭。点击后浏览器会询问是否允许通知。</p>
    </>}
    {state === 'on' && <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={test} disabled={!!action} className="ui-press min-h-11 flex-1 rounded-full border border-live/40 px-4 text-control text-live disabled:opacity-40">{action === 'test' ? '正在请求…' : '发送测试通知'}</button>
      <button type="button" onClick={disable} disabled={!!action} className="ui-press min-h-11 flex-1 rounded-full border border-line px-4 text-control text-muted disabled:opacity-40">{action === 'disable' ? '正在关闭…' : '关闭'}</button>
    </div>}
    {state === 'denied' && <button type="button" onClick={recheck} className="ui-press mt-3 min-h-11 rounded-full border border-line px-4 text-control text-muted">重新检查</button>}
    {offerEmail && <button type="button" onClick={onUseEmail} className="ui-press mt-2 min-h-11 w-full rounded-full border border-line px-4 text-control text-muted hover:border-live/50 hover:text-ink">改用邮件提醒</button>}
  </section>
}
