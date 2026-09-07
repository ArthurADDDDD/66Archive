import { getDataset, toTimelineEntries } from '@/lib/data'
import { encodeArchivePayload } from '@/lib/archive-payload'

export const dynamic = 'force-static'

/**
 * 录播室的静态数据载荷。与页面路由拆开后，点击导航会先得到轻量外壳；这份大数据
 * 再由浏览器单独请求并在同一次浏览会话中复用，不再阻塞所有站内导航。
 */
export function GET() {
  const ds = getDataset()
  const allEntries = toTimelineEntries(ds)
  const entries =
    process.env.NODE_ENV === 'development' && !ds.isDemo
      ? allEntries.filter((entry) => entry.uncheckedCount === 0)
      : allEntries

  // 线上编码见 lib/archive-payload.ts：只压缩「怎么写下来」，条目形状不变，
  // 解码在 ArchiveLoader 里，构造上无损（scripts/test-archive-payload.ts 逐条比对）。
  return Response.json(
    encodeArchivePayload({
      entries,
      isDemo: ds.isDemo,
      hiddenUnreviewed: allEntries.length - entries.length,
    }),
  )
}
