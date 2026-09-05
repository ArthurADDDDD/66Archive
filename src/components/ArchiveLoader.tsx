'use client'

import { startTransition, useEffect, useState } from 'react'
import type { TimelineEntry } from '@/lib/data'
import { Timeline } from './Timeline'
import { SiteNav } from './SiteNav'

type ArchivePayload = {
  entries: TimelineEntry[]
  isDemo: boolean
  hiddenUnreviewed: number
}

let archiveRequest: Promise<ArchivePayload> | null = null

function fetchArchive(): Promise<ArchivePayload> {
  if (archiveRequest) return archiveRequest
  archiveRequest = fetch('/archive-data.json', { cache: 'no-cache' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`archive data returned ${response.status}`)
      return response.json() as Promise<ArchivePayload>
    })
    .catch((error) => {
      // 失败不能永久污染模块缓存；“重试”必须真的再发一次请求。
      archiveRequest = null
      throw error
    })
  return archiveRequest
}

export function ArchiveLoader() {
  const [payload, setPayload] = useState<ArchivePayload | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void fetchArchive().then(
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
  }, [attempt])

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

  return <ArchiveLoadingShell failed={failed} onRetry={retry} />
}

function ArchiveLoadingShell({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
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
                  <p className="measure-body mt-3 text-body text-muted" role="status" aria-live="polite">
                    正在加载完整档案与年度线索…
                  </p>
                </div>
                <div aria-hidden className="grid grid-cols-3 gap-3 sm:flex sm:gap-6">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="w-20">
                      <div className="h-3 w-12 rounded bg-line/70 motion-safe:animate-pulse" />
                      <div className="mt-2 h-6 w-16 rounded bg-raised motion-safe:animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section aria-label="正在加载时间定位" className="rounded-xl border border-line bg-surface/45 p-3 sm:p-5">
              <div aria-hidden className="grid gap-2 sm:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="flex min-h-[62px] items-center justify-between rounded-lg border border-line bg-base/30 px-4 py-3">
                    <div className="space-y-2">
                      <div className="h-4 w-20 rounded bg-raised motion-safe:animate-pulse" />
                      <div className="h-3 w-16 rounded bg-line/70 motion-safe:animate-pulse" />
                    </div>
                    <div className="h-6 w-9 rounded bg-raised motion-safe:animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-meta uppercase tracking-[0.16em] text-faint">年度线索</h2>
                  <span className="text-meta text-faint">正在整理…</span>
                </div>
                <div aria-hidden className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="min-h-[116px] rounded-lg border border-line bg-base/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="h-6 w-14 rounded bg-raised motion-safe:animate-pulse" />
                        <div className="h-4 w-20 rounded bg-line/70 motion-safe:animate-pulse" />
                      </div>
                      <div className="mt-3 h-3 w-24 rounded bg-line/70 motion-safe:animate-pulse" />
                      <div className="mt-4 h-3 w-full rounded bg-raised motion-safe:animate-pulse" />
                      <div className="mt-2 h-3 w-3/4 rounded bg-raised motion-safe:animate-pulse" />
                    </div>
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
