'use client'

import { useEffect, useState } from 'react'

type PresenceCounts = {
  global: number
  current: number
}

type PresenceIndicatorProps = {
  pageKey: string
  mode: 'global' | 'page'
  className?: string
}

const HEARTBEAT_MS = 40_000
const SESSION_KEY = 'i6i6:presence:v1'

function getVisitorId() {
  let visitorId = sessionStorage.getItem(SESSION_KEY)
  if (visitorId) return visitorId

  visitorId = crypto.randomUUID()
  sessionStorage.setItem(SESSION_KEY, visitorId)
  return visitorId
}

export function PresenceIndicator({ pageKey, mode, className = '' }: PresenceIndicatorProps) {
  const [counts, setCounts] = useState<PresenceCounts | null>(null)

  useEffect(() => {
    let cancelled = false

    async function heartbeat() {
      if (document.visibilityState !== 'visible') return

      try {
        const response = await fetch('/api/vote/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId: getVisitorId(), pageKey }),
          cache: 'no-store',
          keepalive: true,
        })
        if (!response.ok) return

        const next = (await response.json()) as PresenceCounts
        if (!cancelled && Number.isFinite(next.global) && Number.isFinite(next.current)) {
          setCounts({
            global: Math.max(0, Math.floor(next.global)),
            current: Math.max(0, Math.floor(next.current)),
          })
        }
      } catch {
        // Presence is ambient UI. Network failures should stay invisible.
      }
    }

    void heartbeat()
    const interval = window.setInterval(() => void heartbeat(), HEARTBEAT_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void heartbeat()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [pageKey])

  if (!counts) return null

  const count = mode === 'global' ? counts.global : counts.current
  if (count < 1) return null

  const label = mode === 'global'
    ? count === 1
      ? '你正在这里'
      : `${count.toLocaleString()} 人正在这里`
    : count === 1
      ? '你正在翻阅这份档案'
      : `${count.toLocaleString()} 人正在看`

  return (
    <span className={`inline-flex items-center gap-1.5 text-meta text-faint opacity-70 ${className}`}>
      <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-faint" />
      <span>{label}</span>
    </span>
  )
}
