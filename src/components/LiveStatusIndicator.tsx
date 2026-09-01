'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'

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
const FIRST_VISIT_HINT_KEY = '66archive:live-status-hint:v1'
/**
 * 观测超过这个时间没更新，就不再把圆点显示成「在播」或「未开播」。
 *
 * 「在播」和「不在播」都是有保质期的结论：观测停了之后，最后一次的结论只会越来越
 * 可能是错的。而一份「最后一次成功的内容」被继续返回，对文案是好事，对直播状态不是。
 * 所以过期与否由前台自己按 observedAt 判定，不依赖接口那一侧的新鲜度。
 */
const STALE_LIMIT_MS = 10 * 60_000

/**
 * 本地开发用的固定样本：URL 显式写 `?live=live|offline|stale|unavailable`
 * 时启用，用来核对所有展示状态；默认仍读取真实接口。
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
  return Number.isInteger(item?.sessions)
    && (item?.sessions ?? -1) >= 0
    && Number.isInteger(item?.totalMinutes)
    && (item?.totalMinutes ?? -1) >= 0
    && typeof item?.covered === 'boolean'
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validOptionalDate(value: unknown): value is string | undefined {
  return value === undefined || validDate(value)
}

function validOptionalText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function validRoomUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function validSnapshot(value: unknown): value is LiveStatusSnapshot {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<LiveStatusSnapshot>
  return (item.status === 'live' || item.status === 'offline')
    && typeof item.platform === 'string' && item.platform.trim().length > 0
    && validOptionalText(item.title)
    && validRoomUrl(item.roomUrl)
    && validOptionalDate(item.startedAt)
    && validOptionalDate(item.lastEndedAt)
    && validDate(item.observedAt)
    && validDate(item.monitoringSince)
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
  const timestamp = Date.parse(date)
  if (!Number.isFinite(timestamp)) return '时间待确认'
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60_000))
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
 * 全站的轻量直播状态灯。
 *
 * 灯只有一个圆点：灰色是不在播，红色呼吸是在播，详情要点开才看。
 * 数据来自只读接口 `/api/content/live-status`。接口不可用或观测过期时保留入口，
 * 但降级为中性「待确认」状态，不把旧结论冒充当前事实。
 */
export function LiveStatusIndicator() {
  const pathname = usePathname()
  const [snapshot, setSnapshot] = useState<LiveStatusSnapshot | null>(null)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [mounted, setMounted] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [showFirstVisitHint, setShowFirstVisitHint] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // 路由切换会替换页头节点；每次都重新取得当前 SiteNav 预留的位置。
    const frame = requestAnimationFrame(() => {
      setPortalTarget(document.querySelector<HTMLElement>('[data-live-status-slot]'))
      setMounted(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  useEffect(() => {
    const forceHint = process.env.NODE_ENV !== 'production'
      && new URLSearchParams(window.location.search).get('hint') === 'live'
    try {
      if (!forceHint && window.localStorage.getItem(FIRST_VISIT_HINT_KEY)) return
      if (!forceHint) window.localStorage.setItem(FIRST_VISIT_HINT_KEY, 'shown')
    } catch {
      // 隐私模式或存储被禁用时照常显示；提示本身不值得阻塞页面。
    }
    const showFrame = requestAnimationFrame(() => setShowFirstVisitHint(true))
    const hideTimer = window.setTimeout(() => setShowFirstVisitHint(false), 5_000)
    return () => {
      cancelAnimationFrame(showFrame)
      window.clearTimeout(hideTimer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let activeController: AbortController | null = null

    async function refresh() {
      // 页面恢复联网或重新获得可见性时会立即刷新；取消旧请求，避免旧的
      // offline 响应晚于新的 live 响应到达后把状态倒退回去。
      activeController?.abort()
      activeController = null

      const forced = new URLSearchParams(window.location.search).get('live')
      if (process.env.NODE_ENV !== 'production' && forced === 'unavailable') {
        if (!cancelled) setSnapshot(null)
        return
      }
      if (process.env.NODE_ENV !== 'production' && (forced === 'offline' || forced === 'live' || forced === 'stale')) {
        if (!cancelled) {
          const demo = localDemo(forced === 'offline' ? 'offline' : 'live')
          setSnapshot(forced === 'stale'
            ? { ...demo, observedAt: new Date(Date.now() - STALE_LIMIT_MS - 60_000).toISOString() }
            : demo)
        }
        return
      }

      const controller = new AbortController()
      activeController = controller
      const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        const response = await fetch(`${CONTENT_ORIGIN}${STATUS_PATH}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('live status unavailable')
        const next: unknown = await response.json()
        if (cancelled) return
        // 拿不到合规的快照就保持上一次的显示，而不是把灯换成一个错的状态。
        if (validSnapshot(next)) setSnapshot(next)
      } catch {
        // 接口不通或超时时保留上一份数据；渲染层会在它过期后自动降级为待确认。
      } finally {
        window.clearTimeout(timer)
        if (activeController === controller) activeController = null
      }
    }

    const refreshWhenVisible = () => {
      if (document.hidden) return
      setNow(Date.now())
      void refresh()
    }

    void refresh()
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS)
    const clockTimer = window.setInterval(() => setNow(Date.now()), 30_000)
    window.addEventListener('online', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      cancelled = true
      activeController?.abort()
      window.clearInterval(refreshTimer)
      window.clearInterval(clockTimer)
      window.removeEventListener('online', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
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
    return durationLabel((now - Date.parse(snapshot.startedAt)) / 60_000)
  }, [now, snapshot])

  if (!mounted || !portalTarget) return null
  const stale = snapshot === null || now - Date.parse(snapshot.observedAt) > STALE_LIMIT_MS
  const mode: LiveStatusSnapshot['status'] | 'unknown' = stale ? 'unknown' : snapshot.status
  const live = mode === 'live'
  const offline = mode === 'offline'
  const liveTitle = snapshot?.title?.trim() || ''
  const roomUrl = snapshot?.roomUrl ?? null
  const label = live
    ? '正在直播，打开直播状态'
    : offline
      ? '当前未开播，打开直播记录'
      : '直播状态暂时不可确认，打开说明'

  const indicator = (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setShowFirstVisitHint(false)
          setOpen((value) => !value)
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        data-live-status={mode}
        className={`ui-press flex h-11 items-center gap-2 rounded-sm text-sm font-semibold tracking-tight transition-colors ${
          live
            ? 'text-ink hover:text-today'
            : offline
              ? 'text-ink/85 hover:text-ink'
              : 'text-muted hover:text-ink'
        }`}
      >
        <span className="relative flex h-3 w-3 items-center justify-center" aria-hidden>
          {live && <span className="absolute h-3 w-3 animate-ping rounded-full bg-today/20 motion-reduce:animate-none" />}
          <span className={`relative h-1.5 w-1.5 rounded-full ${
            live
              ? 'bg-today shadow-[0_0_10px_rgba(255,107,117,0.8)]'
              : offline
                ? 'bg-faint/60'
                : 'border border-muted bg-transparent'
          }`} />
        </span>
        <span>女流编年史</span>
      </button>

      {showFirstVisitHint && !open && (
        <p
          role="status"
          className="ui-sheet-in pointer-events-none absolute left-0 top-full z-50 mt-1.5 whitespace-nowrap rounded-lg border border-line/80 bg-base/95 px-3 py-2 text-meta font-normal tracking-normal text-muted shadow-[0_12px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl"
        >
          点击查看直播间状态
        </p>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="直播状态"
          className="ui-sheet-in absolute left-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line/90 bg-base/95 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl"
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                live
                  ? 'bg-today shadow-[0_0_10px_rgba(255,107,117,0.8)]'
                  : offline
                    ? 'bg-faint/70'
                    : 'border border-muted bg-transparent'
              }`} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-meta uppercase tracking-[0.16em] text-faint">Live monitor · 本站观测</p>
                <h2 className="mt-2 text-h3 font-semibold text-ink">
                  {live
                    ? liveTitle || '她现在正在直播。'
                    : offline
                      ? '现在没有开播。'
                      : snapshot
                        ? '直播状态需要重新确认。'
                        : '直播状态暂时不可用。'}
                </h2>
                <p className="mt-2 text-body text-muted">
                  {live
                    ? `${snapshot?.platform ?? ''}${currentDuration ? ` · 已观测 ${currentDuration}` : ''}`
                    : offline
                      ? snapshot?.lastEndedAt
                        ? `上次下播于 ${relativeTime(snapshot.lastEndedAt, now)}`
                        : '等待下一次开播记录。'
                      : snapshot
                        ? `最近一次成功检查在 ${relativeTime(snapshot.observedAt, now)}`
                        : '正在等待本站取得新的观测结果。'}
                </p>
                {offline && liveTitle && (
                  <p className="mt-1 text-meta text-faint">最近一场：{liveTitle}</p>
                )}
                {mode === 'unknown' && snapshot && (
                  <p className="mt-1 text-meta text-faint">
                    上次观测到：{snapshot.status === 'live' ? `正在直播${liveTitle ? ` · ${liveTitle}` : ''}` : '未开播'}
                  </p>
                )}
              </div>
            </div>

            {(live || mode === 'unknown') && roomUrl && (
              <a
                href={roomUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="ui-press mt-5 flex min-h-11 w-full items-center justify-between rounded-full bg-ink px-4 text-control font-medium text-base"
              >
                {live ? '去直播间看看' : '去直播间自行确认'}
                <span aria-hidden>↗</span>
              </a>
            )}

            {snapshot && (
              <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/70 bg-line/70">
                <LiveWindowStat label="最近 7 天" value={snapshot.recent7d} />
                <LiveWindowStat label="最近 30 天" value={snapshot.recent30d} />
              </dl>
            )}

            <p className="mt-4 text-meta leading-relaxed text-faint">
              {mode === 'unknown'
                ? '当前状态不可确认，因此这里不会把旧结果显示成「正在直播」或「未开播」。'
                : '现在在不在播来自本站定时观测，可能与平台实际时间相差一个检查周期。'}
              {snapshot && (
                <>
                  {' '}最近 7 / 30 天按站内档案已收录的场次统计；档案还没跟上的那几天，用观测补齐。
                  {(!snapshot.recent7d.covered || !snapshot.recent30d.covered) && dayLabel(snapshot.monitoringSince)
                    ? ` 这段时间还没有档案支撑，只统计了 ${dayLabel(snapshot.monitoringSince)} 开始观测到的部分。`
                    : ''}
                  {' '}最近检查：{relativeTime(snapshot.observedAt, now)}。
                </>
              )}
            </p>
          </div>
        </section>
      )}
    </div>
  )

  return createPortal(indicator, portalTarget)
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
