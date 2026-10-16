'use client'

import { startTransition, useEffect, useState } from 'react'
import { Timeline } from './Timeline'
import { GameGenresProvider } from './GameGenresContext'
import { SiteNav } from './SiteNav'
import { SiteText } from './SiteText'
import type { ArchivePayload } from '@/lib/archive-payload'
import { createArchiveLoader, type ArchiveBootHolder } from '@/lib/archive-loader'
import type { ArchiveNav } from '@/lib/archive-nav'

const fetchArchive = createArchiveLoader({ holder: typeof window === 'undefined' ? undefined : window as ArchiveBootHolder })

export function ArchiveLoader({ nav, dataUrl }: { nav: ArchiveNav; dataUrl: string }) {
  // A new dataset gets a fresh loading/error state, never the previous version's Timeline.
  return <ArchiveVersion key={dataUrl} nav={nav} dataUrl={dataUrl} />
}

function ArchiveVersion({ nav, dataUrl }: { nav: ArchiveNav; dataUrl: string }) {
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
      <GameGenresProvider value={payload.gameGenres ?? {}}>
        <Timeline
          entries={payload.entries}
          isDemo={payload.isDemo}
          hiddenUnreviewed={payload.hiddenUnreviewed}
          extra={<ArchiveBreadcrumb />}
        />
      </GameGenresProvider>
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
                <p className="text-lg font-semibold text-ink"><SiteText id="archive-load-failed-title" /></p>
                <p className="mt-2 measure-body text-body text-muted"><SiteText id="archive-load-failed-body" /></p>
                <button type="button" onClick={onRetry} className="ui-press mt-5 rounded-full border border-live/60 bg-live/5 px-5 py-2.5 text-sm text-live hover:bg-live/10">
                  <SiteText id="archive-load-retry" />
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
                  <h1 className="measure-hero mt-2 text-h1 font-semibold"><SiteText id="archive-title" /></h1>
                  <p className="measure-body mt-3 text-body text-muted">
                    <SiteText id="archive-lede" />
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
                  <h2 className="text-meta uppercase tracking-[0.16em] text-faint"><SiteText id="archive-year-clues" /></h2>
                  <span className="text-meta text-faint"><SiteText id="archive-year-pick" vars={{ era: nav.activeEraLabel }} /></span>
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
      <span>Archive</span>
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
