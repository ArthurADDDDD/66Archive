import type { MetadataRoute } from 'next'
import { getDataset } from '@/lib/data'
import { allGameIds } from '@/lib/narrative'
import { siteUrl } from '@/lib/site-url'

/**
 * `output: 'export'` 下 metadata route 必须显式声明静态，否则构建期直接报
 * 「export const dynamic = "force-static" not configured」并中断。
 */
export const dynamic = 'force-static'

/**
 * `/sitemap.xml`（Next App Router 的 metadata route，构建期生成静态文件）。
 *
 * **数据源刻意和三条动态路由的 `generateStaticParams()` 完全一致**——都是同一个
 * 同步的 `getDataset()`。这样 sitemap 里的地址和真正被静态导出的页面天然一一对应，
 * 既不会列出不存在的页面，也不会因为多一条取数途径而在构建期引入新的不稳定依赖。
 *
 * 规模：8 个静态页 + 2600+ 条记录 + 游戏 + 节目，合计不到三千条。sitemap 协议的
 * 上限是 50,000 条 / 50MB，单文件放得下，不需要 `generateSitemaps()` 分片
 * （分片在 `output: 'export'` 下还要额外处理产物命名，徒增复杂度）。
 */

/** 八个静态页面。地址写成带尾斜杠的形式，和 `trailingSlash: true` 的导出产物逐字一致。 */
const STATIC_PATHS = [
  '/',
  '/chronicle/',
  '/archive/',
  '/games/',
  '/series/',
  '/stats/',
  '/gallery/',
  '/contact/',
] as const

/**
 * `/games/maplestory-classic/` 是 `permanentRedirect('/games/maplestory/')`，
 * 不是一个真实页面。sitemap 该列的是规范地址，不是会 301 的跳转源。
 */
const REDIRECTED_GAME_IDS = new Set(['maplestory-classic'])

export default function sitemap(): MetadataRoute.Sitemap {
  const ds = getDataset()

  const staticPages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: siteUrl(path) }))

  /**
   * 只有记录页带 `lastModified`，因为只有这里有一个**真实存在**的日期可用。
   * 游戏页 / 节目页 / 索引页的「最后更新时间」需要凭空构造，按 AGENTS.md 的
   * 「不编造数据」，宁可不写——sitemap 允许缺省这个字段，而一个编出来的时间戳
   * 会让 Google 认定整份 sitemap 的时间不可信，反而不如没有。
   */
  const entryPages: MetadataRoute.Sitemap = ds.entries.map((entry) => ({
    url: siteUrl(`/e/${entry.id}/`),
    lastModified: entry.date,
  }))

  const gamePages: MetadataRoute.Sitemap = allGameIds(ds)
    .filter((id) => !REDIRECTED_GAME_IDS.has(id))
    .map((id) => ({ url: siteUrl(`/games/${id}/`) }))

  const seriesPages: MetadataRoute.Sitemap = [...ds.series.keys()].map((id) => ({
    url: siteUrl(`/series/${id}/`),
  }))

  return [...staticPages, ...entryPages, ...gamePages, ...seriesPages]
}
