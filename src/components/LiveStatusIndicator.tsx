'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type LiveWindow = {
  sessions: number
  totalMinutes: number
}

type LiveStatusSnapshot = {
  status: 'live' | 'offline'
  platform: string
  roomUrl: string
  title?: string
  startedAt?: string
  lastEndedAt?: string
  observedAt: string
  recent7d: LiveWindow
  recent30d: LiveWindow
}

const REFRESH_MS = 60_000

function localDemo(status: 'live' | 'offline'): LiveStatusSnapshot {
  const now = Date.now()
  return {
    status,
    platform: '抖音直播',
    roomUrl: 'https://www.douyin.com/',
    title: status === 'live' ? '测试直播间标题' : undefined,
    startedAt: status === 'live' ? new Date(now - 2 * 60 * 60 * 1000 - 18 * 60 * 1000).toISOString() : undefined,
    lastEndedAt: status === 'offline' ? new Date(now - 19 * 60 * 60 * 1000).toISOString() : undefined,
    observedAt: new Date(now - 34 * 1000).toISOString(),
    recent7d: { sessions: 3, totalMinutes: 487 },
    recent30d: { sessions: 11, totalMinutes: 1_936 },
  }
}

function validSnapshot(value: unknown): value is LiveStatusSnapshot {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<LiveStatusSnapshot>
  return (item.status === 'live' || item.status === 'offline')
    && typeof item.platform === 'string'
    && typeof item.roomUrl === 'string'
    && typeof item.observedAt === 'string'
    && typeof item.recent7d?.sessions === 'number'
    && typeof item.recent7d?.totalMinutes === 'number'
    && typeof item.recent30d?.sessions === 'number'
    && typeof item.recent30d?.totalMinutes === 'number'
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

/**
 * 首页的轻量直播状态灯。
 *
 * 生产环境只展示监控接口返回的事实；接口不可用时整块静默消失。
 * 本地开发默认提供一份可交互的直播中示例，URL 加 `?live=offline` 可检查未开播状态。
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

      try {
        const response = await fetch('/api/live-status', { cache: 'no-store' })
        if (!response.ok) throw new Error('live status unavailable')
        const next: unknown = await response.json()
        if (!cancelled && validSnapshot(next)) setSnapshot(next)
      } catch {
        // 前端原型阶段：本地默认展示直播中，方便直接验收；生产失败必须保持安静，绝不造状态。
        if (!cancelled && process.env.NODE_ENV !== 'production') setSnapshot(localDemo('live'))
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
  const live = snapshot.status === 'live'
  const liveTitle = snapshot.title?.trim() || '她现在正在直播。'

  const indicator = (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={live ? `${liveTitle}，打开直播状态` : '女流66 当前未开播，打开直播记录'}
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
                <h2 className="mt-2 text-h3 font-semibold text-ink">{live ? liveTitle : '现在没有开播。'}</h2>
                <p className="mt-2 text-body text-muted">
                  {live
                    ? `${snapshot.platform}${currentDuration ? ` · 已观测 ${currentDuration}` : ''}`
                    : snapshot.lastEndedAt
                      ? `上次下播于 ${relativeTime(snapshot.lastEndedAt, now)}`
                      : '等待下一次开播记录。'}
                </p>
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
              开播与下播时间来自本站定时观测，可能与平台实际时间相差一个检查周期。
              最近检查：{relativeTime(snapshot.observedAt, now)}。
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
      <dt className="font-mono text-meta text-faint">{label}</dt>
      <dd className="mt-1.5 text-control font-semibold text-ink">{value.sessions} 次</dd>
      <dd className="mt-0.5 text-meta text-muted">{durationLabel(value.totalMinutes)}</dd>
    </div>
  )
}
