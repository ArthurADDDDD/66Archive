import { getDataset, toTimelineEntries } from '@/lib/data'
import { Timeline } from '@/components/Timeline'

export default function Home() {
  const ds = getDataset()
  const entries = toTimelineEntries(ds)
  return <Timeline entries={entries} isDemo={ds.isDemo} />
}
