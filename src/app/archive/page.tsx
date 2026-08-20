import { getDataset, toTimelineEntries } from '@/lib/data'
import { Timeline } from '@/components/Timeline'
import { BackToTop } from '@/components/ScrollAffordances'
import styles from './archive.module.css'

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
    <div className={styles.archivePage}>
      <Timeline
        entries={visibleEntries}
        isDemo={ds.isDemo}
        hiddenUnreviewed={allEntries.length - visibleEntries.length}
        extra={<ArchiveBreadcrumb />}
      />
      <BackToTop />
    </div>
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
