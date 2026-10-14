export type CollectionLogItem = {
  id: string
  type: 'live' | 'video' | 'gallery'
  title: string
  contentDate: string | null
  recordedAt: string
  href: string
}
export type CollectionLogPage = { items: CollectionLogItem[]; nextCursor: string | null }

/** 公共接口也要校验形状；格式损坏不能让日志显示猜测时间或任意外部链接。 */
export function parseCollectionLogPage(value: unknown): CollectionLogPage | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  if (!Array.isArray(body.items) || body.items.length > 30 || !(body.nextCursor === null || (typeof body.nextCursor === 'string' && /^[A-Za-z0-9_-]{1,1000}$/.test(body.nextCursor)))) return null
  const items: CollectionLogItem[] = []
  for (const raw of body.items) {
    if (!raw || typeof raw !== 'object') return null
    const item = raw as Record<string, unknown>
    if (typeof item.id !== 'string' || !item.id || typeof item.title !== 'string' || !['live','video','gallery'].includes(String(item.type)) || typeof item.recordedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(item.recordedAt) || !Number.isFinite(Date.parse(item.recordedAt))) return null
    if (item.contentDate !== null && (typeof item.contentDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.contentDate))) return null
    const href = item.type === 'gallery' ? '/gallery/' : `/e/${encodeURIComponent(item.id)}/`
    if (item.href !== href) return null
    items.push({ id: item.id, type: item.type as CollectionLogItem['type'], title: item.title, contentDate: item.contentDate as string | null, recordedAt: item.recordedAt, href })
  }
  return { items, nextCursor: body.nextCursor as string | null }
}

const BEIJING = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})
export function collectionTimestamp(iso: string): string { return BEIJING.format(new Date(iso)).replaceAll('/', '.') }
