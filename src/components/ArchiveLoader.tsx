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
  archiveRequest = fetch('/archive-data.json', { cache: 'force-cache' })
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
        <div className="site-header-container flex items-center gap-3 px-page py-3">
          <SiteNav active="archive" />
        </div>
      </header>
      <main className="ui-page-in site-container-wide px-page pb-16 pt-10" aria-busy={!failed}>
        {failed && (
          <>
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
