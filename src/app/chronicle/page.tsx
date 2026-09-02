import type { Metadata } from 'next'
import { getDataset, toTimelineEntries } from '@/lib/data'
import { resolveStoryActs } from '@/lib/narrative'
import { buildStorySections } from '@/lib/story-years'
import { ChronicleView } from '@/components/ChronicleView'
import { LiveNarrativeSeed } from '@/components/LiveContentProvider'
import { fetchBakedContent } from '@/lib/baked-content'

/** canonical 指向自身的 apex 地址。根 layout 只给 metadataBase，canonical 必须各页自己声明。 */
export const metadata: Metadata = {
  alternates: { canonical: '/chronicle/' },
}

/**
 * 编年史：故事模式。年份脊柱时间线，条目仍来自 STORY_ACTS 的策展列表
 * （buildStoryYears 只做归位与计数）。完整逐条档案在 /archive/（录播室）。
 */
export default async function ChroniclePage() {
  const ds = getDataset()
  const allEntries = toTimelineEntries(ds)
  const visibleEntries =
    process.env.NODE_ENV === 'development' && !ds.isDemo
      ? allEntries.filter((entry) => entry.uncheckedCount === 0)
      : allEntries

  const storyActs = resolveStoryActs(ds, visibleEntries)
  const storySections = buildStorySections(storyActs, visibleEntries)
  const latestYear = Number(visibleEntries[0]?.date.slice(0, 4)) || new Date().getFullYear()

  const { narrative } = await fetchBakedContent()

  return (
    <LiveNarrativeSeed narrative={narrative}>
      <ChronicleView storySections={storySections} total={visibleEntries.length} latestYear={latestYear} />
    </LiveNarrativeSeed>
  )
}
