'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type LiveWindow = {
  sessions: number
  totalMinutes: number
  /** 这个时间窗是否完全落在观测期内。false 表示观测开始得比窗口晚，数字偏小。 */
  covered: boolean
}

type LiveStatusSnapshot = {
  status: 'live' | 'offline'
  platform: string
  roomUrl: string
  title?: string
  startedAt?: string
  lastEndedAt?: string
  observedAt: string
  monitoringSince: string
  recent7d: LiveWindow
  recent30d: LiveWindow
}

/** 生产环境前台与接口同域时留空即可；本地联调可指向别处。 */
const CONTENT_ORIGIN = (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, '')
const STATUS_PATH = '/api/content/live-status'
const REFRESH_MS = 60_000
const REQUEST_TIMEOUT_MS = 6_000
/**
 * 观测超过这个时间没更新，就不再显示这个圆点。
 *
 * 「在播」和「不在播」都是有保质期的结论：观测停了之后，最后一次的结论只会越来越
 * 可能是错的。而一份「最后一次成功的内容」被继续返回，对文案是好事，对直播状态不是。
 * 所以过期与否由前台自己按 observedAt 判定，不依赖接口那一侧的新鲜度。
 */
const STALE_LIMIT_MS = 10 * 60_000

/**
 * 本地开发用的固定样本：只有在 URL 上显式写了 `?live=live` / `?live=offline` 时才用，
 * 用来核对两种状态的样式。默认不启用——接口没通就该看见「什么都不显示」，
 * 那才是线上的真实行为。
 */
function localDemo(status: 'live' | 'offline'): LiveStatusSnapshot {
  const now = Date.now()
  return {
    status,
    platform: '抖音直播',
    roomUrl: 'https://live.douyin.com/',
    title: status === 'live' ? '测试直播间标题' : '上一场的标题',
    startedAt: status === 'live' ? new Date(now - 2 * 60 * 60 * 1000 - 18 * 60 * 1000).toISOString() : undefined,
    lastEndedAt: status === 'offline' ? new Date(now - 19 * 60 * 60 * 1000).toISOString() : undefined,
    observedAt: new Date(now - 34 * 1000).toISOString(),
    monitoringSince: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    recent7d: { sessions: 3, totalMinutes: 487, covered: false },
    recent30d: { sessions: 11, totalMinutes: 1_936, covered: false },
  }
}

function validWindow(value: unknown): value is LiveWindow {
  const item = value as Partial<LiveWindow> | undefined
  return typeof item?.sessions === 'number' && typeof item.totalMinutes === 'number' && typeof item.covered === 'boolean'
}

function validSnapshot(value: unknown): value is LiveStatusSnapshot {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<LiveStatusSnapshot>
  return (item.status === 'live' || item.status === 'offline')
    && typeof item.platform === 'string'
    && typeof item.roomUrl === 'string'
    && typeof item.observedAt === 'string'
    && typeof item.monitoringSince === 'string'
    && validWindow(item.recent7d)
    && validWindow(item.recent30d)
}

function durationLabel(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} 分钟`
  if (rest === 0) return `${hours} 小时`
  return `${hours} 小时 ${rest} 分`
}

function relativeTime(date: string | undefined, now: number) {
  if (!date) return '时间待确认'
  const elapsedMinutes = Math.max(0, Math.floor((now - new Date(date).getTime()) / 60_000))
  if (elapsedMinutes < 1) return '刚刚'
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前`
  const hours = Math.floor(elapsedMinutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

function dayLabel(date: string) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getFullYear()} 年 ${parsed.getMonth() + 1} 月 ${parsed.getDate()} 日`
}

/**
 * 首页的轻量直播状态灯。
 *
 * 灯只有一个圆点：灰色是不在播，红色呼吸是在播，详情要点开才看。
 * 数据来自只读接口 `/api/content/live-status`，接口不可用时整块静默消失——
 * 我们宁可什么都不显示，也不显示一个猜出来的状态。
 */
export function LiveStatusIndicator() {
  const [snapshot, setSnapshot] = useState<LiveStatusSnapshot | null>(null)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const forced = new URLSearchParams(window.location.search).get('live')
      if (process.env.NODE_ENV !== 'production' && (forced === 'offline' || forced === 'live')) {
        if (!cancelled) setSnapshot(localDemo(forced))
        return
      }

      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        const response = await fetch(`${CONTENT_ORIGIN}${STATUS_PATH}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('live status unavailable')
        const next: unknown = await response.json()
        if (cancelled) return
        // 拿不到合规的快照就保持上一次的显示，而不是把灯换成一个错的状态。
        if (validSnapshot(next)) setSnapshot(next)
      } catch {
        // 接口不通、超时、还没有任何一次成功观测——一律不显示，也不改已有显示。
      } finally {
        window.clearTimeout(timer)
      }
    }

    void refresh()
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS)
    const clockTimer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
      window.clearInterval(clockTimer)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const currentDuration = useMemo(() => {
    if (snapshot?.status !== 'live' || !snapshot.startedAt) return null
    return durationLabel((now - new Date(snapshot.startedAt).getTime()) / 60_000)
  }, [now, snapshot])

  if (!snapshot) return null
  // 过期的观测不显示：宁可什么都不说，也不说一个可能已经过时的状态。
  if (now - new Date(snapshot.observedAt).getTime() > STALE_LIMIT_MS) return null
  const live = snapshot.status === 'live'
  const liveTitle = snapshot.title?.trim() || ''

  const indicator = (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={live ? '正在直播，打开直播状态' : '当前未开播，打开直播记录'}
        className={`ui-press fixed bottom-5 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur transition-[border-color,background-color,color,box-shadow] sm:bottom-8 sm:left-8 ${
          live
            ? 'border-today/40 bg-today/10 text-ink shadow-[0_0_24px_rgba(255,107,117,0.12)] hover:border-today/70'
            : 'border-line/80 bg-surface/60 text-faint hover:border-muted/70 hover:text-muted'
        }`}
      >
        <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden>
          {live && <span className="absolute h-4 w-4 animate-ping rounded-full bg-today/20 motion-reduce:animate-none" />}
          <span className={`relative h-2 w-2 rounded-full ${live ? 'bg-today shadow-[0_0_10px_rgba(255,107,117,0.8)]' : 'bg-faint/60'}`} />
        </span>
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="直播状态"
          className="ui-sheet-in fixed bottom-20 left-4 right-4 z-50 w-auto overflow-hidden rounded-2xl border border-line/90 bg-base/95 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:bottom-[5.5rem] sm:left-8 sm:right-auto sm:w-[min(22rem,calc(100vw-4rem))]"
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${live ? 'bg-today shadow-[0_0_10px_rgba(255,107,117,0.8)]' : 'bg-faint/70'}`} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-meta uppercase tracking-[0.16em] text-faint">Live monitor · 本站观测</p>
                <h2 className="mt-2 text-h3 font-semibold text-ink">
                  {live ? liveTitle || '她现在正在直播。' : '现在没有开播。'}
                </h2>
                <p className="mt-2 text-body text-muted">
                  {live
                    ? `${snapshot.platform}${currentDuration ? ` · 已观测 ${currentDuration}` : ''}`
                    : snapshot.lastEndedAt
                      ? `上次下播于 ${relativeTime(snapshot.lastEndedAt, now)}`
                      : '等待下一次开播记录。'}
                </p>
                {!live && liveTitle && (
                  <p className="mt-1 text-meta text-faint">最近一场：{liveTitle}</p>
                )}
              </div>
            </div>

            {live && (
              <a
                href={snapshot.roomUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="ui-press mt-5 flex min-h-11 w-full items-center justify-between rounded-full bg-ink px-4 text-control font-medium text-base"
              >
                去直播间看看
                <span aria-hidden>↗</span>
              </a>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/70 bg-line/70">
              <LiveWindowStat label="最近 7 天" value={snapshot.recent7d} />
              <LiveWindowStat label="最近 30 天" value={snapshot.recent30d} />
            </dl>

            <p className="mt-4 text-meta leading-relaxed text-faint">
              现在在不在播来自本站定时观测，可能与平台实际时间相差一个检查周期。
              最近 7 / 30 天按站内档案已收录的场次统计；档案还没跟上的那几天，用观测补齐。
              {(!snapshot.recent7d.covered || !snapshot.recent30d.covered) && dayLabel(snapshot.monitoringSince)
                ? ` 这段时间还没有档案支撑，只统计了 ${dayLabel(snapshot.monitoringSince)} 开始观测到的部分。`
                : ''}
              {' '}最近检查：{relativeTime(snapshot.observedAt, now)}。
            </p>
          </div>
        </section>
      )}
    </div>
  )

  return createPortal(indicator, document.body)
}

function LiveWindowStat({ label, value }: { label: string; value: LiveWindow }) {
  return (
    <div className="bg-surface/80 p-3.5">
      <dt className="font-mono text-meta text-faint">
        {label}
        {!value.covered && <span className="ml-1 text-faint/70">（仅观测期）</span>}
      </dt>
      <dd className="mt-1.5 text-control font-semibold text-ink">{value.sessions} 次</dd>
      <dd className="mt-0.5 text-meta text-muted">{durationLabel(value.totalMinutes)}</dd>
    </div>
  )
}
