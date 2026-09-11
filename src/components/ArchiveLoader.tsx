'use client'

import { startTransition, useEffect, useState } from 'react'
import { Timeline } from './Timeline'
import { SiteNav } from './SiteNav'
import {
  decodeArchivePayload,
  type ArchivePayload,
  type EncodedArchivePayload,
} from '@/lib/archive-payload'
import type { ArchiveNav } from '@/lib/archive-nav'

let archiveRequest: Promise<ArchivePayload> | null = null

/**
 * 取走首屏预取的结果，并从全局上摘掉（预取脚本见 `app/archive/page.tsx`）。
 *
 * **只认一次**是关键：一个已经 settle 的 promise 每次 await 都返回同一个结果，
 * 不摘掉的话，一次预取失败会让「重新加载档案」按钮永远重播那次失败。
 */
function takeBooted(): Promise<unknown> | null {
  if (typeof window === 'undefined') return null
  const holder = window as { __i6i6ArchiveBoot?: Promise<unknown> }
  const pending = holder.__i6i6ArchiveBoot
  if (!pending) return null
  delete holder.__i6i6ArchiveBoot
  return pending
}

/** 预取脚本只保证「要么是解析出来的 JSON，要么是 null」，形状还得自己认一遍。 */
function isEncodedPayload(value: unknown): value is EncodedArchivePayload {
  return Boolean(value) && Array.isArray((value as EncodedArchivePayload).entries)
}

/**
 * 解码必须在这里做完，不能留到渲染时按需展开：`Timeline` 的首帧 memo 就要读
 * `aliveCount`（「只看还能播的」筛选）。整份 2,711 条的解码在 node 里量过是毫秒级，
 * 与 JSON.parse 本身（中位数 9.2 ms）相比可以忽略。
 */
function requestArchive(dataUrl: string): Promise<ArchivePayload> {
  return fetch(dataUrl).then(async (response) => {
    if (!response.ok) throw new Error(`archive data returned ${response.status}`)
    return decodeArchivePayload((await response.json()) as EncodedArchivePayload)
  })
}

/**
 * 地址由服务端当 prop 传下来（见 `app/archive/page.tsx`），带着按载荷字节算出的
 * 版本号。**不要在这里写死 `/archive-data.json`**：那样重试会绕开版本号，
 * 拿到边缘上可能是上一版的那份，而且不报任何错。
 */
function fetchArchive(dataUrl: string): Promise<ArchivePayload> {
  if (archiveRequest) return archiveRequest
  // 首屏预取多半已经在路上了，直接接手，省掉「等水合再发请求」那一整趟。
  // 有意不给它加超时竞速：这份载荷三百多 KB，放弃一个在途请求再从零下载只会更慢；
  // 真失败了下面的 catch 会清掉模块缓存，「重新加载档案」照常能重来。
  const booted = takeBooted()
  archiveRequest = (booted
    ? booted.then((data) => (isEncodedPayload(data) ? decodeArchivePayload(data) : requestArchive(dataUrl)))
    : requestArchive(dataUrl)
  ).catch((error) => {
    // 失败不能永久污染模块缓存；“重试”必须真的再发一次请求。
    archiveRequest = null
    throw error
  })
  return archiveRequest
}

export function ArchiveLoader({ nav, dataUrl }: { nav: ArchiveNav; dataUrl: string }) {
  const [payload, setPayload] = useState<ArchivePayload | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void fetchArchive(dataUrl).then(
      (data) => {
        // 2,700+ 条数据的首次计算放进低优先级更新，先让已打开的页面与导航保持可交互。
        if (active) startTransition(() => setPayload(data))
      },
      () => {
        if (active) setFailed(true)
      },
    )
    return () => {
      active = false
    }
  }, [attempt, dataUrl])

  function retry() {
    setFailed(false)
    setAttempt((value) => value + 1)
  }

  if (payload) {
    return (
      <Timeline
        entries={payload.entries}
        isDemo={payload.isDemo}
        hiddenUnreviewed={payload.hiddenUnreviewed}
        extra={<ArchiveBreadcrumb />}
      />
    )
  }

  return <ArchiveLoadingShell nav={nav} failed={failed} onRetry={retry} />
}

function ArchiveLoadingShell({ nav, failed, onRetry }: { nav: ArchiveNav; failed: boolean; onRetry: () => void }) {
  return (
    <>
      <header className="ui-slide-down border-b border-line bg-base/95">
        <div className="site-header-container flex flex-wrap items-center gap-2 px-page py-3 sm:flex-nowrap sm:gap-3">
          <SiteNav active="archive" />
          {!failed && (
            <div aria-hidden className="contents">
              <div className="w-auto sm:ml-auto sm:w-full sm:max-w-[360px]">
                <div className="h-11 w-11 rounded-md border border-line bg-surface/70 motion-safe:animate-pulse sm:h-9 sm:w-full" />
              </div>
              <div className="h-11 w-16 shrink-0 rounded-md border border-line bg-surface/70 motion-safe:animate-pulse sm:h-9" />
            </div>
          )}
        </div>
      </header>
      <main className="ui-page-in site-container-wide px-page pb-16" aria-busy={!failed}>
        {failed ? (
          <div className="pt-10">
            <ArchiveBreadcrumb />
            <section className="mt-8 rounded-xl border border-line bg-surface/45 px-5 py-10 sm:px-8">
              <div role="alert">
                <p className="text-lg font-semibold text-ink">档案数据暂时没有加载成功</p>
                <p className="mt-2 measure-body text-body text-muted">页面已经打开，可以直接重试；其他栏目和背景音乐不会被这次失败卡住。</p>
                <button type="button" onClick={onRetry} className="ui-press mt-5 rounded-full border border-live/60 bg-live/5 px-5 py-2.5 text-sm text-live hover:bg-live/10">
                  重新加载档案
                </button>
              </div>
            </section>
          </div>
        ) : (
          <>
            <section className="pb-8 pt-4 sm:py-10">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div>
                  <ArchiveBreadcrumb />
                  <h1 className="measure-hero mt-2 text-h1 font-semibold">从记得的内容，找到那段时间。</h1>
                  <p className="measure-body mt-3 text-body text-muted">
                    每个年份和月份都列出真实标题作为线索，不需要先记住准确日期；知道关键词时，也可以直接搜索全部公开记录。
                  </p>
                </div>
                {/*
                  这里原本还有「已录时长」与「时长覆盖 %」。两个都是校对口径——
                  覆盖率是给补档的人看的进度条，累计时长是把一个人的十六年结算成一个数，
                  对来找某一场的人没有任何用处。这些留在联系页的征集语境里说更合适。
                  剩下的这一个是搜索范围，构建期就算好，没有理由等 2.7MB 的载荷才显示。
                */}
                <dl className="text-meta uppercase tracking-[0.16em] text-faint tnum">
                  <ShellStat label="能翻的记录" value={nav.total.toLocaleString()} />
                </dl>
              </div>
            </section>

            {/*
              时间定位：真的导航，不是占位。

              这一块只依赖各年各时期的条数与标题，与那份 2.7MB 的档案载荷无关，
              但此前它要等载荷到齐才画得出来——在此之前用户看到的是一屏脉冲灰条。
              现在构建期就把它烤进 HTML：首屏立刻可读、可点、可分享。
              这些年份是真链接（`/archive/?y=YYYY`），载荷没到也能直接跳；
              载荷到达后 Timeline 接管同一块区域，数字一致，不会跳。
            */}
            <section aria-label="时间定位" className="rounded-xl border border-line bg-surface/45 p-3 sm:p-5">
              <div className="grid gap-2 sm:grid-cols-3">
                {nav.eras.map((era) => (
                  <a
                    key={era.id}
                    href={`/archive/?y=${era.id === 'douyin' ? nav.latestYear : era.to}`}
                    className="ui-card ui-press flex min-w-0 items-center justify-between rounded-lg border border-line bg-base/30 px-4 py-3 text-left text-muted hover:bg-raised/60"
                  >
                    <span className="min-w-0">
                      <span className="block text-control font-medium">{era.label}</span>
                      <span className="mt-0.5 block font-mono text-meta text-faint tnum">{era.detail}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[1.375rem] font-bold leading-none tnum opacity-75">
                      {era.count.toLocaleString()}
                    </span>
                  </a>
                ))}
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-meta uppercase tracking-[0.16em] text-faint">年度线索</h2>
                  <span className="text-meta text-faint">{nav.activeEraLabel} · 选一年看看</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {nav.years.map((year) => (
                    <a
                      key={year.year}
                      href={`/archive/?y=${year.year}`}
                      className="ui-card ui-press flex min-h-[116px] min-w-0 flex-col rounded-lg border border-line bg-base/40 p-3 text-left hover:border-muted hover:bg-raised/50"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-xl font-bold tnum">{year.year}</span>
                        <span className="shrink-0 text-meta text-faint tnum">
                          <span className="font-mono text-[0.9375rem] font-semibold text-ink">{year.count.toLocaleString()}</span> 条 ·{' '}
                          <span className="font-mono text-[0.9375rem] font-semibold text-ink">{year.months}</span> 个月
                        </span>
                      </span>
                      {/* 「已录 N 小时 / 时长待补」是补档进度，不是这一年发生了什么。
                          来找某一场的人用不上它，口径的事留在联系页的征集语境里说。 */}
                      <span className="mt-2 block space-y-1">
                        {year.titles.map((title) => (
                          <span key={title} className="block truncate text-meta leading-snug text-muted">{title}</span>
                        ))}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  )
}

/** 录播室页头只保留当前页面标识；年份范围和跨页跳转在这里都属于重复信息。 */
function ArchiveBreadcrumb() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta uppercase tracking-[0.16em] text-live [&~p]:hidden [&~span]:hidden">
      <span>Chronicle</span>
      <span aria-hidden className="text-faint/50">·</span>
      <span>录播室</span>
    </div>
  )
}

/** 与 Timeline 的 Stat 同一份排版；首屏外壳与接管后的正文必须长得一样，否则会跳。 */
function ShellStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta uppercase tracking-[0.16em] text-faint">{label}</dt>
      <dd className="mt-1.5 whitespace-nowrap font-mono text-[1.0625rem] font-bold tracking-normal text-ink tnum sm:text-[1.375rem]">
        {value}
        {unit && <span className="ml-1 font-sans text-meta font-normal text-faint">{unit}</span>}
      </dd>
    </div>
  )
}
