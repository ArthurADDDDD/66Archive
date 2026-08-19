import { getDataset, toTimelineEntries } from '@/lib/data'
import { resolveStoryActs } from '@/lib/narrative'
import { buildStorySections } from '@/lib/story-years'
import { ChronicleView } from '@/components/ChronicleView'

/**
 * 编年史：故事模式（默认）+ 档案模式。
 * 档案模式 = 完整 Timeline，能力一条不丢；
 * 故事模式 = 年份脊柱时间线，条目仍来自 STORY_ACTS 的策展列表（buildStoryYears 只做归位与计数）。
 * 深链（?y=…/?q=…）仍直达档案模式并恢复上下文。
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

  return (
    <ChronicleView
      storySections={storySections}
      total={visibleEntries.length}
      latestYear={latestYear}
      entries={visibleEntries}
      isDemo={ds.isDemo}
      hiddenUnreviewed={allEntries.length - visibleEntries.length}
    />
  )
}
