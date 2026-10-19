'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  getUpdateNotice,
  shouldShowUpdateNotice,
  UPDATE_NOTICE_STORAGE_KEY,
  type UpdateNoticeData,
} from '@/lib/update-notice'

/**
 * A small, non-modal card: show each curated feature-announcement version once
 * per browser, then stay silent until the leading update changes.
 *
 * Does not lock scrolling, intercept navigation, fetch an API or depend on the
 * site's deployment SHA (routine recording imports must not spam visitors).
 */
export function UpdateNotice() {
  const [notice, setNotice] = useState<UpdateNoticeData | null>(null)

  useEffect(() => {
    // The special push-testing entry opens its own dialog. Don't cover that workflow.
    if (window.location.hash.includes('push-test=')) return
    const next = getUpdateNotice()
    if (!next) return

    let seen: string | null = null
    try {
      seen = window.localStorage.getItem(UPDATE_NOTICE_STORAGE_KEY)
    } catch {
      // Private browsing / disabled storage: the current page can still show the notice.
    }
    if (!shouldShowUpdateNotice(seen, next)) return

    // Let the requested page render before showing a non-blocking notice.
    const timeout = window.setTimeout(() => {
      setNotice(next)
      // Mark as seen when actually displayed, not on every page render.
      try {
        window.localStorage.setItem(UPDATE_NOTICE_STORAGE_KEY, next.version)
      } catch {
        // Keep browsing functional even if storage is blocked or full.
      }
    }, 1200)
    return () => window.clearTimeout(timeout)
  }, [])

  if (!notice) return null

  return (
    <aside
      aria-labelledby="visitor-update-notice-title"
      className="ui-sheet-in fixed bottom-4 right-4 z-[90] flex max-h-[min(78dvh,37rem)] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-live/30 bg-base/95 text-ink shadow-[0_24px_80px_rgba(0,0,0,0.46)] backdrop-blur-xl sm:bottom-6 sm:right-6"
    >
      <header className="shrink-0 border-b border-line/60 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-meta tracking-wide text-live">WHAT’S NEW · 近 30 天</p>
            <h2 id="visitor-update-notice-title" className="mt-1 text-h3 font-semibold">女流档案馆更新啦</h2>
            <p className="mt-1 text-meta leading-relaxed text-muted">这次整理了 {notice.updates.length} 项值得看看的网站变化。</p>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="关闭更新提醒"
            className="ui-press -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-h3 text-muted hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-live"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {notice.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="更新分类">
            {notice.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-live/20 bg-live/5 px-2.5 py-1 text-meta text-live">{tag}</span>
            ))}
          </div>
        )}
      </header>

      <div role="region" aria-label="近一个月更新内容" tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 [scrollbar-width:thin] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-live">
        <ol className="divide-y divide-line/50">
          {notice.updates.map((update) => (
            <li key={`${update.date}-${update.source ?? update.title}`} className="py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <time dateTime={update.date} className="font-mono text-meta text-faint">{update.date.replaceAll('-', '.')}</time>
                {(update.tags ?? []).map((tag) => (
                  <span key={tag} className="rounded bg-surface px-1.5 py-0.5 text-[0.6875rem] text-muted">{tag}</span>
                ))}
              </div>
              <h3 className="mt-1 text-control font-semibold">{update.title}</h3>
              <p className="mt-1 text-control leading-relaxed text-muted">{update.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line/60 px-4 py-3 sm:px-5">
        <p className="text-meta text-faint">本次只提醒一次</p>
        <Link href="/stats/#site-updates" prefetch={false} onClick={() => setNotice(null)}
          className="ui-press inline-flex min-h-11 items-center rounded-full border border-live/35 px-4 text-control font-medium text-live hover:bg-live/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-live">
          查看完整更新 →
        </Link>
      </footer>
    </aside>
  )
}
