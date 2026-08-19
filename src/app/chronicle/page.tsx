import { getDataset, toTimelineEntries } from '@/lib/data'
import { resolveStoryActs } from '@/lib/narrative'
import { buildStorySections } from '@/lib/story-years'
import { ChronicleView } from '@/components/ChronicleView'

/**
 * 编年史：故事模式。年份脊柱时间线，条目仍来自 STORY_ACTS 的策展列表
 * （buildStoryYears 只做归位与计数）。完整逐条档案在 /archive/（录播室）。
 */
export default function ChroniclePage() {
  const ds = getDataset()
  const allEntries = toTimelineEntries(ds)
  const visibleEntries =
    process.env.NODE_ENV === 'development' && !ds.isDemo
      ? allEntries.filter((entry) => entry.uncheckedCount === 0)
      : allEntries

  const storyActs = resolveStoryActs(ds, visibleEntries)
  const storySections = buildStorySections(storyActs, visibleEntries)
  const latestYear = Number(visibleEntries[0]?.date.slice(0, 4)) || new Date().getFullYear()

  return <ChronicleView storySections={storySections} total={visibleEntries.length} latestYear={latestYear} />
}
