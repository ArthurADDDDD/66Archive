import { getDataset } from '@/lib/data'

export const dynamic = 'force-static'

function coverHost(value: string | undefined): string {
  if (!value) return '(missing)'
  if (value.startsWith('/')) return '(local)'
  try {
    return new URL(value).hostname
  } catch {
    return '(invalid)'
  }
}

export default function ImageProxyAuditPage() {
  const { entries } = getDataset()
  const counts = new Map<string, { entry: number; source: number; total: number }>()

  const add = (host: string, kind: 'entry' | 'source') => {
    const current = counts.get(host) ?? { entry: 0, source: 0, total: 0 }
    current[kind] += 1
    current.total += 1
    counts.set(host, current)
  }

  for (const entry of entries) {
    if (entry.cover) add(coverHost(entry.cover), 'entry')
    for (const source of entry.sources) {
      if (source.cover) add(coverHost(source.cover), 'source')
    }
  }

  const result = [...counts.entries()]
    .map(([host, value]) => ({ host, ...value }))
    .sort((a, b) => b.total - a.total || a.host.localeCompare(b.host))

  console.log('IMAGE_PROXY_HOST_AUDIT=' + JSON.stringify(result))
  return null
}
