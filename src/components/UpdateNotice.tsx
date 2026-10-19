'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  getUpdateHistory,
  getUpdateNotice,
  shouldShowUpdateNotice,
  UPDATE_NOTICE_STORAGE_KEY,
  type UpdateHistoryItem,
  type UpdateNoticeData,
} from '@/lib/update-notice'

// The feature and archive logs are static; reuse them when the visitor opens history.
const HISTORY = getUpdateHistory()

/**
 * Show feature announcements once per browser, without interrupting navigation.
 * Past feature and collection updates remain available from the card itself.
 * Regular recording imports never change the announcement version.
 */
export function UpdateNotice() {
  const [notice, setNotice] = useState<UpdateNoticeData | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // A push-test deep link opens its own dialog. Do not overlap it.
    if (window.location.hash.includes('push-test=')) return
    const next = getUpdateNotice()
    if (!next) return

    let seen: string | null = null
    try {
      seen = window.localStorage.getItem(UPDATE_NOTICE_STORAGE_KEY)
    } catch {
      // Storage may be disabled; the card still works for this page.
    }
    if (!shouldShowUpdateNotice(seen, next)) return

    const timeout = window.setTimeout(() => {
      setNotice(next)
      try {
        window.localStorage.setItem(UPDATE_NOTICE_STORAGE_KEY, next.version)
      } catch {
        // No account or server-side tracking is needed.
      }
    }, 1200)
    return () => window.clearTimeout(timeout)
  }, [])

  if (!notice) return null

  const rows: UpdateHistoryItem[] = showHistory
    ? HISTORY
    : notice.updates.map((update) => ({ ...update, category: '功能' }))
  const switchView = () => {
    setShowHistory((current) => !current)
    if (listRef.current) listRef.current.scrollTop = 0
  }

  return (
    <aside
      aria-labelledby="visitor-update-notice-title"
      className="ui-sheet-in fixed bottom-4 right-4 z-[90] flex max-h-[min(78dvh,37rem)] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-live/30 bg-base/95 text-ink shadow-[0_24px_80px_rgba(0,0,0,0.46)] backdrop-blur-xl sm:bottom-6 sm:right-6"
    >
      <header className="shrink-0 border-b border-line/60 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-meta tracking-wide text-live">{showHistory ? '从建站至今' : '最近 30 天'}</p>
            <h2 id="visitor-update-notice-title" className="mt-1 text-h3 font-semibold">
              {showHistory ? '全部更新记录' : '网站有新变化啦'}
            </h2>
            <p className="mt-1 text-meta leading-relaxed text-muted">
              {showHistory ? '以前的新功能和补档记录，都能在这里翻。' : '最近这些功能，你可以试试看。'}
            </p>
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
      </header>

      <div
        id="visitor-update-notice-list"
        ref={listRef}
        role="region"
        aria-label={showHistory ? '全部历史更新记录' : '近期功能更新'}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 [scrollbar-width:thin] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-live"
      >
        <ol className="divide-y divide-line/50">
          {rows.map((update) => (
            <li key={`${update.category}-${update.date}-${update.source ?? update.title}`} className="py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <time dateTime={update.date} className="font-mono text-meta text-faint">
                  {update.date.replaceAll('-', '.')}
                </time>
                {showHistory && (
                  <span className="rounded bg-live/10 px-1.5 py-0.5 text-[0.6875rem] text-live">{update.category}</span>
                )}
                {(update.tags ?? []).slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded bg-surface px-1.5 py-0.5 text-[0.6875rem] text-muted">{tag}</span>
                ))}
              </div>
              <h3 className="mt-1 text-control font-semibold">{update.title}</h3>
              <p className="mt-1 text-control leading-relaxed text-muted">{update.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line/60 px-4 py-3 sm:px-5">
        <Link
          href="/stats/#site-updates"
          prefetch={false}
          onClick={() => setNotice(null)}
          className="ui-press inline-flex min-h-11 items-center rounded-md text-meta text-muted hover:text-live focus-visible:outline focus-visible:outline-2 focus-visible:outline-live"
        >
          去数据页看看
        </Link>
        <button
          type="button"
          aria-expanded={showHistory}
          aria-controls="visitor-update-notice-list"
          onClick={switchView}
          className="ui-press inline-flex min-h-11 items-center rounded-full border border-live/35 px-4 text-control font-medium text-live hover:bg-live/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-live"
        >
          {showHistory ? '返回最近更新' : '查看全部历史 →'}
        </button>
      </footer>
    </aside>
  )
}
