import { getDataset, toTimelineEntries } from '@/lib/data'
import { Timeline } from '@/components/Timeline'

export default function ChroniclePage() {
  const ds = getDataset()
  return <Timeline entries={toTimelineEntries(ds)} isDemo={ds.isDemo} />
}
