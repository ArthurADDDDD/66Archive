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
   * 「建站到现在」是站长定的说法。要说清楚的是：这个数是**下限**，不是完整历史——
   * 接口给的 `since` 是埋点有记录的第一天（2026-08-31 迁站时 analytics 没跟着
   * 快照过来，之前的计数清零了），在那之前来过的人不在里面。
   *
   * 所以句子里用「大概」，数值也按量级取整，不给精确值；等保留期开始吃掉历史，
   * 接口会把 truncated 置真，下面那句跟着出现。
   */
  return (
    <p className={`text-meta text-faint ${className}`}>
      建站到现在，大概有 <span className="font-mono text-control font-semibold text-ink tnum">{approximate(visitors)}</span> 个人来过这里。
      {/*
        后台的日桶受保留期约束。等最早那一批开始被清理，这个数就会少算历史——
        接口会自报 truncated，这里跟着改口，而不是让它悄悄往下掉。
      */}
      {reach?.truncated && <span className="ml-1">（更早的记录已经过了保留期，这个数只算得到近一段时间。）</span>}
    </p>
  )
}
