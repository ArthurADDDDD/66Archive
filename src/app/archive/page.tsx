import Link from 'next/link'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { Timeline } from '@/components/Timeline'
import { BackToTop } from '@/components/ScrollAffordances'

/**
 * 录播室：档案模式。完整 Timeline，能力一条不丢，搜索/筛选/年份/来源全部保留。
 * 深链（?y=/?m=/?q=/?p=/?t=/?g=/?alive=）由 Timeline 自己在客户端恢复
 * （静态导出无法在服务端读 searchParams）。
 */
export default function ArchivePage() {
  const ds = getDataset()
  const allEntries = toTimelineEntries(ds)
  const visibleEntries =
    process.env.NODE_ENV === 'development' && !ds.isDemo
      ? allEntries.filter((entry) => entry.uncheckedCount === 0)
      : allEntries

  return (
    <>
      <Timeline
        entries={visibleEntries}
        isDemo={ds.isDemo}
        hiddenUnreviewed={allEntries.length - visibleEntries.length}
        extra={<ArchiveBreadcrumb />}
      />
      <BackToTop />
    </>
  )
}

/** 面包屑：Chronicle · 录播室，带一条回编年史的入口——两个页面靠链接互通，不是模式切换。 */
function ArchiveBreadcrumb() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta uppercase tracking-[0.16em] text-live">
      <span>Chronicle</span>
      <span aria-hidden className="text-faint/50">·</span>
      <span>录播室</span>
      <span aria-hidden className="text-faint/40">/</span>
      <Link href="/chronicle/" className="ui-press rounded-sm text-live transition-colors hover:text-ink">
        看编年史 →
      </Link>
    </div>
  )
}
