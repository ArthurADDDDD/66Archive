import { getDataset, toTimelineEntries } from '@/lib/data'
import { resolveStoryActs } from '@/lib/narrative'
import { ChronicleView } from '@/components/ChronicleView'

/**
 * 编年史：故事模式（默认）+ 档案模式。
 * 档案模式 = 完整 Timeline，能力一条不丢；故事模式在档案之上加一层叙事（32 节详版三幕）。
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
  const latestYear = Number(visibleEntries[0]?.date.slice(0, 4)) || new Date().getFullYear()

  return (
    <ChronicleView
      storyActs={storyActs}
      total={visibleEntries.length}
      latestYear={latestYear}
      entries={visibleEntries}
      isDemo={ds.isDemo}
      hiddenUnreviewed={allEntries.length - visibleEntries.length}
    />
  )
}
