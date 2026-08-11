'use client'

import Link from 'next/link'
import type { TimelineEntry } from '@/lib/data'
import { PLATFORM_META, proxyImage } from '@/lib/platforms'
import { formatDuration } from '@/lib/ui'
import { SegmentBar } from './EntryRow'
import type { Platform } from '@/lib/schema'

/**
 * 悬停预览。桌面端停靠在右栏而不是跟随光标——内容有封面、分段、多个源，
 * 跟随式浮层会一直在视口里跳，停靠面板让眼睛有个固定的落点。
 */
export function Preview({ entry }: { entry: TimelineEntry | null }) {
  if (!entry) {
    return (
      <div className="flex h-64 items-center justify-center rounded border border-dashed border-line/60 px-6 text-center font-mono text-[11px] leading-relaxed text-faint">
        指向左侧任意一条
        <br />
        查看封面、分段与全部来源
      </div>
    )
  }

  const platform = PLATFORM_META[entry.platform as Platform]
  const cover = proxyImage(entry.cover ?? undefined, 480)

  return (
    <div className="overflow-hidden rounded border border-line bg-surface">
      <div className="relative aspect-video w-full bg-raised">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-mono text-[10px] tracking-widest text-faint">无封面</span>
          </div>
        )}
        <span
          className="absolute left-2 top-2 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold text-base"
          style={{ background: platform?.color }}
        >
          {platform?.name ?? entry.platform}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <div className="font-mono text-[11px] text-faint tnum">
            {entry.date}
            {entry.time && ` ${entry.time}`} · {formatDuration(entry.duration_min)}
          </div>
          <h3 className="mt-1 text-[15px] leading-snug text-ink">{entry.title}</h3>
          {entry.seriesName && (
            <div className="mt-1 font-mono text-[11px] text-live/80">系列 · {entry.seriesName}</div>
          )}
        </div>

        <SegmentBar entry={entry} />

        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((t) => (
              <span key={t} className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line pt-3 font-mono text-[11px]">
          <span className="text-faint">
            {entry.sourceCount} 个来源
            {entry.aliveCount > 0 && ` · ${entry.aliveCount} 个已核验`}
            {entry.uncheckedCount > 0 && ` · ${entry.uncheckedCount} 个未复查`}
            {entry.deadCount > 0 && ` · ${entry.deadCount} 个失效`}
          </span>
          <Link href={`/e/${entry.id}/`} className="text-live underline underline-offset-4">
            详情 →
          </Link>
        </div>
      </div>
    </div>
  )
}
