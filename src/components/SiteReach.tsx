'use client'

import { useEffect, useState } from 'react'

/**
 * 「建站以来大概有多少人来过」。
 *
 * ## 为什么是「大概」
 *
 * 后台按 `visitor_key` 去重，而那个 key 是对客户端 IP 做的 HMAC——同一个宿舍、
 * 公司或校园网出口是同一个 key，手机换基站又会变成新的 key。它同时低估和高估，
 * 所以页面上只给一个取整后的量级，不给精确值。写成「累计 UV 12,345」就是把一个
 * 近似值伪装成读数了。
 *
 * ## 拿不到就不出现
 *
 * 站是静态导出的，这个数在运行期拉。接口不可用、被限流、或者还没有任何数据，
 * 都直接什么都不渲染——数据页少一行，比挂一个「加载失败」好。
 */

const CONTENT_ORIGIN = (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, '')
const REQUEST_TIMEOUT_MS = 4000

type Reach = { visitors?: number; since?: string | null; truncated?: boolean }

/** `2026-08-31` → `2026 年 8 月`。日期精确到天没有意义，也会让人以为这个数很精确。 */
function monthLabel(since: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(since)
  if (!match) return null
  return `${match[1]} 年 ${Number(match[2])} 月`
}

/** 取整到一个量级。不说「多」——正好落在整数上时那个字就是错的。 */
function approximate(n: number): string {
  if (n < 10) return String(n)
  const step = n < 100 ? 10 : n < 1000 ? 100 : 1000
  return (Math.floor(n / step) * step).toLocaleString()
}

export function SiteReach({ className = '' }: { className?: string }) {
  const [reach, setReach] = useState<Reach | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    fetch(`${CONTENT_ORIGIN}/api/content/reach`, { signal: controller.signal, credentials: 'omit' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Reach | null) => {
        if (!cancelled && body && typeof body.visitors === 'number') setReach(body)
      })
      .catch(() => {
        // 静默。这一行不出现，页面照常。
      })
      .finally(() => clearTimeout(timer))

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [])

  const visitors = reach?.visitors ?? 0
  if (visitors < 1) return null

  /*
   * **不写「建站以来」。** 站比埋点早，接口给的 `since` 是有记录的第一天，
   * 不是建站那天——写成「建站以来」等于把一个起点不明的数说成完整历史，
   * 而这个站的规矩是宁可少说也不多说。有 since 就说清从哪个月开始算。
   */
  const since = reach?.since ? monthLabel(reach.since) : null

  return (
    <p className={`text-meta text-faint ${className}`}>
      {since ? `从 ${since} 开始记，` : ''}大概有 <span className="font-mono text-control font-semibold text-ink tnum">{approximate(visitors)}</span> 个人来过这里。
      {/*
        后台的日桶受保留期约束。等最早那一批开始被清理，这个数就会少算历史——
        接口会自报 truncated，这里跟着改口，而不是让它悄悄往下掉。
      */}
      {reach?.truncated && <span className="ml-1">（更早的记录已经过了保留期，这个数只算得到近一段时间。）</span>}
    </p>
  )
}
