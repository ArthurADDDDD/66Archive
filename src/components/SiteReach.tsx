'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 「建站以来大概有多少人来过」——实时滚动的精确计数。
 *
 * ## 「精确」是相对 visitor_key 口径说的
 *
 * 后台按 `visitor_key` 去重，而那个 key 是对客户端 IP 做的 HMAC——同一个宿舍、
 * 公司或校园网出口是同一个 key，手机换基站又会变成新的 key。它同时低估和高估
 * 真实人数，这个偏差没法消除。但站长明确要的是「看得见涨」而不是「量级取整」，
 * 所以这里如实显示接口给的整数，不再做 `Math.floor(n/100)*100` 那种取整——
 * 数字本身仍是近似的，只是不再额外把这份近似伪装成模糊。
 *
 * ## 轮询节奏跟着网关缓存走
 *
 * `/api/content/reach` 在 nginx 那层有 10s 微缓存（见 06-nvliu-content-cache.conf），
 * 同一时间段内所有访客的轮询会命中同一份缓存响应，不会把请求量放大成访客数的倍数。
 * 这里按 10s 轮询，刚好对齐缓存窗口——轮得更快只是在等同一份缓存过期，没有意义。
 *
 * ## 拿不到就不出现（首次），拿不到就不后退（之后）
 *
 * 站是静态导出的，这个数在运行期拉。首次请求失败或还没有任何数据，页面上
 * 直接不渲染这一行。轮询中途失败就保留上一次成功的值，不把已经在看的人
 * 的数字冲掉——一次抖动不该让「建站以来」看起来在缩水。
 */

const CONTENT_ORIGIN = (process.env.NEXT_PUBLIC_CONTENT_ORIGIN ?? '').replace(/\/$/, '')
const REQUEST_TIMEOUT_MS = 4000
const POLL_INTERVAL_MS = 10_000
const COUNT_UP_DURATION_MS = 800

type Reach = { visitors?: number; since?: string | null; truncated?: boolean }

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/** 把 `displayed` 从当前值数字滚动到 `to`；`prefers-reduced-motion` 时直接跳变。 */
function useCountUp(target: number | null): number {
  const [displayed, setDisplayed] = useState<number>(target ?? 0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (target === null) return
    const from = displayed
    if (target === from) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      // 同步跳变到新值，不跑 rAF 循环——这就是在同步一个外部事实（用户的动效偏好），
      // 不是级联渲染的诱因。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayed(target)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_UP_DURATION_MS)
      const next = Math.round(from + (target - from) * easeOutCubic(progress))
      setDisplayed(next)
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return displayed
}

export function SiteReach({ className = '' }: { className?: string }) {
  const [reach, setReach] = useState<Reach | null>(null)

  useEffect(() => {
    let cancelled = false

    const poll = () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      fetch(`${CONTENT_ORIGIN}/api/content/reach`, { signal: controller.signal, credentials: 'omit' })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: Reach | null) => {
          if (!cancelled && body && typeof body.visitors === 'number') setReach(body)
          // 失败或格式不对：什么都不做，保留上一次成功的值。
        })
        .catch(() => {})
        .finally(() => clearTimeout(timer))
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const visitors = reach?.visitors ?? null
  const displayed = useCountUp(visitors)

  if (visitors === null || visitors < 1) return null

  /*
   * 「建站到现在」是站长定的说法。要说清楚的是：这个数是**下限**，不是完整历史——
   * 接口给的 `since` 是埋点有记录的第一天（2026-08-31 迁站时 analytics 没跟着
   * 快照过来，之前的计数清零了），在那之前来过的人不在里面。
   */
  return (
    <p className={`text-meta text-faint ${className}`}>
      建站到现在，大概有{' '}
      <span className="font-mono text-control font-semibold text-ink tnum">{displayed.toLocaleString()}</span>{' '}
      个人来过这里。
      {/*
        后台的日桶受保留期约束。等最早那一批开始被清理，这个数就会少算历史——
        接口会自报 truncated，这里跟着改口，而不是让它悄悄往下掉。
      */}
      {reach?.truncated && <span className="ml-1">（更早的记录已经过了保留期，这个数只算得到近一段时间。）</span>}
    </p>
  )
}
