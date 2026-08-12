import { getDataset, toTimelineEntries } from '@/lib/data'
import { resolveChronicleStory } from '@/lib/chronicle-story'
import { ChronicleView } from '@/components/ChronicleView'

/**
 * 编年史：故事模式（默认）+ 档案模式。
 * 档案模式 = 完整 Timeline，能力一条不丢；故事模式在档案之上加一层叙事。
 * 深链（?y=…/?q=…）仍直达档案模式并恢复上下文。
 */
export default function ChroniclePage() {
  const ds = getDataset()
  const allEntries = toTimelineEntries(ds)
  const visibleEntries =
    process.env.NODE_ENV === 'development' && !ds.isDemo
      ? allEntries.filter((entry) => entry.uncheckedCount === 0)
      : allEntries

  const story = resolveChronicleStory(visibleEntries)

  return (
    <ChronicleView
      story={story}
      entries={visibleEntries}
      isDemo={ds.isDemo}
      hiddenUnreviewed={allEntries.length - visibleEntries.length}
    />
  )
}
