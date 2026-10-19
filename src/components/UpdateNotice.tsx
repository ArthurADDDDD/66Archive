'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { UpdateTag } from './UpdateTag'
import { UpdateCopy } from './UpdateCopy'
import { SiteText } from './SiteText'
import { useLiveEditActive, useSiteText } from './LiveContentProvider'
import {
  getUpdateNotice,
  shouldShowUpdateNotice,
  UPDATE_NOTICE_STORAGE_KEY,
  type UpdateNoticeData,
} from '@/lib/update-notice'

/**
 * Recent feature highlights are shown once per browser version.
 * Mobile is a centered dismissible dialog; desktop keeps a non-blocking card.
 * Full history lives on /updates/ and opens in a separate tab.
 */
export function UpdateNotice() {
  const pathname = usePathname()
  const liveEditing = useLiveEditActive()
  const closeLabel = useSiteText('site-update-notice-close')
  const regionLabel = useSiteText('site-update-notice-region')
  const [notice, setNotice] = useState<UpdateNoticeData | null>(null)
  const [mobile, setMobile] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)')
    const check = () => setMobile(media.matches)
    check()
    media.addEventListener('change', check)
    return () => media.removeEventListener('change', check)
  }, [])

  useEffect(() => {
    // Reading history in this tab must never trigger or retain the announcement.
    if (pathname === '/updates' || pathname?.startsWith('/updates/')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice(null)
      return
    }
    // Inside live editing, only the dedicated preview shortcut may open this card.
    // All other editor pages stay unobstructed, including the homepage and privacy page.
    const preview = liveEditing && new URLSearchParams(window.location.search).get('edit-update-notice') === '1'
    if (liveEditing && !preview) return
    // A push-test link already opens its own dialog.
    if (!liveEditing && window.location.hash.includes('push-test=')) return
    const next = getUpdateNotice()
    if (!next) return

    let seen: string | null = null
    try {
      seen = window.localStorage.getItem(UPDATE_NOTICE_STORAGE_KEY)
    } catch {
      // The current visit still works if storage is unavailable.
    }
    if (!liveEditing && !shouldShowUpdateNotice(seen, next)) return

    const timer = window.setTimeout(() => {
      setNotice(next)
      // A preview must not count as a visitor seeing the release announcement.
      if (!liveEditing) {
        try {
          window.localStorage.setItem(UPDATE_NOTICE_STORAGE_KEY, next.version)
        } catch {
          // No personal data or server-side tracking is involved.
        }
      }
    }, liveEditing ? 0 : 1200)
    return () => window.clearTimeout(timer)
  }, [pathname, liveEditing])

  // Only the mobile version blocks the background. Restore scroll and focus on close.
  useEffect(() => {
    if (!notice || !mobile) return
    const previousFocus = document.activeElement
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = originalOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [notice, mobile])

  if (!notice || pathname === '/updates' || pathname?.startsWith('/updates/')) return null

  function onCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setNotice(null)
    }
    if (!mobile || event.key !== 'Tab') return
    const nodes = cardRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')
    if (!nodes?.length) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[3px] sm:pointer-events-none sm:items-end sm:justify-end sm:bg-transparent sm:p-6 sm:backdrop-blur-none"
      onMouseDown={(event) => { if (mobile && event.target === event.currentTarget) setNotice(null) }}
    >
      <aside
        ref={cardRef}
        role={mobile ? 'dialog' : 'complementary'}
        aria-modal={mobile ? true : undefined}
        aria-labelledby="visitor-update-notice-title"
        onKeyDown={onCardKeyDown}
        className="ui-sheet-in pointer-events-auto flex max-h-[min(84dvh,39rem)] w-full max-w-[28rem] flex-col overflow-hidden rounded-[1.5rem] border border-live/35 bg-base text-ink shadow-[0_28px_100px_rgba(0,0,0,0.6)] sm:max-h-[min(78dvh,37rem)] sm:rounded-2xl sm:bg-base/95 sm:shadow-[0_24px_80px_rgba(0,0,0,0.46)] sm:backdrop-blur-xl"
      >
        <header className="shrink-0 border-b border-line/60 px-5 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-meta tracking-wide text-live"><SiteText id="site-update-notice-eyebrow" /></p>
              <h2 id="visitor-update-notice-title" className="mt-1 text-h3 font-semibold"><SiteText id="site-update-notice-title" /></h2>
              <p className="mt-1 text-meta leading-relaxed text-muted"><SiteText id="site-update-notice-lede" /></p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setNotice(null)}
              aria-label={closeLabel}
              className="ui-press -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-h3 text-muted hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-live"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        <div
          role="region"
          aria-label={regionLabel}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 [scrollbar-width:thin] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-live"
        >
          <ol className="divide-y divide-line/50">
            {notice.updates.map((update) => (
              <li key={`${update.date}-${update.source ?? update.title}`} className="py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <time dateTime={update.date} className="mr-1 font-mono text-meta text-faint tnum">
                    {update.date.replaceAll('-', '.')}
                  </time>
                  {(update.tags ?? []).slice(0, 2).map((tag) => <UpdateTag key={tag} label={tag} />)}
                </div>
                <h3 className="mt-2 text-control font-semibold text-ink"><UpdateCopy category="feature" entry={update} field="title" /></h3>
                <p className="mt-1 text-control leading-relaxed text-muted"><UpdateCopy category="feature" entry={update} field="text" /></p>
              </li>
            ))}
          </ol>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line/60 px-5 py-3.5">
          <p className="text-meta text-faint"><SiteText id="site-update-notice-once" /></p>
          <Link
            href="/updates/"
            prefetch={false}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setNotice(null)}
            className="ui-press inline-flex min-h-11 shrink-0 items-center rounded-full border border-live/45 bg-live/10 px-4 text-control font-medium text-live hover:border-live/70 hover:bg-live/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-live"
          >
            <SiteText id="site-update-notice-history" />
          </Link>
        </footer>
      </aside>
    </div>
  )
}
