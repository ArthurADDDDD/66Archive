import { getDataset, toTimelineEntries } from '@/lib/data'

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

  return Response.json({
    entries,
    isDemo: ds.isDemo,
    hiddenUnreviewed: allEntries.length - entries.length,
  })
}
