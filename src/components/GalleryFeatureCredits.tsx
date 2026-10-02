'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { FeatureCredit } from '@/lib/gallery-feature-video-credits'

type Stage = { key: number; label: string; span: string; credits: readonly FeatureCredit[] }

/** 去掉协议和 www，表格里只占一行；完整地址放在 title 上。 */
function shortUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, '')
}

/** 同一阶段里按出处归组：视频按账号，照片单独一组（每张图的出处写在行里）。 */
function groupStage(credits: readonly FeatureCredit[]) {
  const groups = new Map<string, FeatureCredit[]>()
  for (const c of credits) {
    const key = c.kind === 'photo' ? '照片' : c.who
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return [...groups.entries()].sort((a, b) => (a[0] === '照片' ? 1 : b[0] === '照片' ? -1 : b[1].length - a[1].length))
}

/**
 * 素材出处清单：二百多条一次铺开要往下拉很久，所以按阶段分页签，
 * 每个阶段里再按账号归组，每条压成一行，整块限高、在框内滚动。
 */
export function GalleryFeatureCredits({ stages }: { stages: readonly Stage[] }) {
  const [active, setActive] = useState(stages[0]?.key ?? 1)
  const stage = stages.find((s) => s.key === active) ?? stages[0]
  if (!stage) return null

  return (
    <div>
      <div role="tablist" aria-label="按阶段查看" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {stages.map((s) => {
          const on = s.key === stage.key
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(s.key)}
              className={`ui-press shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-meta transition-colors sm:text-control ${
                on ? 'border-live/60 bg-live/10 text-ink' : 'border-line/70 text-muted hover:border-line hover:text-ink'
              }`}
            >
              {s.label}
              <span className={`ml-1.5 tnum ${on ? 'text-live' : 'text-faint'}`}>{s.credits.length}</span>
            </button>
          )
        })}
      </div>

      {stage.span && <p className="mt-3 font-mono text-meta text-faint tnum">{stage.span}</p>}

      <div role="tabpanel" className="mt-3 max-h-[30rem] overflow-y-auto overscroll-contain rounded-lg border border-line/50 bg-base/40">
        {groupStage(stage.credits).map(([who, rows]) => (
          <section key={who} aria-label={who}>
            <h4 className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-line/50 bg-surface/95 px-3 py-1.5 text-meta font-medium text-ink backdrop-blur-sm sm:px-4">
              <span className="truncate">{who}</span>
              <span className="shrink-0 font-normal text-faint tnum">{rows.length}</span>
            </h4>
            <ol>
              {rows.map((c, i) => (
                <li
                  key={i}
                  className="grid items-baseline gap-x-3 border-b border-line/30 px-3 py-2 text-meta last:border-b-0 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:px-4 sm:py-1.5 lg:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,16rem)_4.5rem]"
                >
                  <span className="font-mono text-faint tnum">{c.date}</span>
                  <div className="min-w-0">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={c.title}
                      className="ui-press line-clamp-2 rounded-sm text-ink hover:text-live sm:line-clamp-none sm:block sm:truncate"
                    >
                      {c.title}
                    </a>
                    {c.kind === 'photo' && c.who && <p className="truncate text-faint">{c.who}</p>}
                    <p className="truncate font-mono text-faint lg:hidden" title={c.url}>
                      {shortUrl(c.url)}
                    </p>
                  </div>
                  <span className="hidden truncate font-mono text-faint lg:block" title={c.url}>
                    {shortUrl(c.url)}
                  </span>
                  {c.entry && (
                    <span className="sm:col-start-2 lg:col-start-auto lg:text-right">
                      <Link prefetch={false} href={`/e/${c.entry}/`} className="ui-press whitespace-nowrap rounded-sm text-live hover:text-ink">
                        档案馆条目
                      </Link>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}
