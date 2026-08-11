import { getDataset, toTimelineEntries } from '@/lib/data'
import { Timeline } from '@/components/Timeline'

export default function ChroniclePage() {
  const ds = getDataset()
  const allEntries = toTimelineEntries(ds)
  const visibleEntries = process.env.NODE_ENV === 'development' && !ds.isDemo
    ? allEntries.filter((entry) => entry.uncheckedCount === 0)
    : allEntries

  return (
    <Timeline
      entries={visibleEntries}
      isDemo={ds.isDemo}
      hiddenUnreviewed={allEntries.length - visibleEntries.length}
    />
  )
}
