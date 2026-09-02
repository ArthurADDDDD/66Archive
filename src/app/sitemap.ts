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
   * **全站都不写 `lastModified`。**
   *
   * 曾经在记录页上填过 `entry.date`，那是错的：`entry.date` 是这场直播/这个视频
   * **发生**的日期，不是这个页面**最后修改**的时间。一条 2015 年的记录如果今天
   * 补了标题或时长，页面变了而 `entry.date` 纹丝不动——填它等于持续告诉搜索引擎
   * 「这页十年没动过」，反而压制重新抓取。
   *
   * 这个项目目前没有任何可靠的「页面最后修改时间」可用（数据文件没有逐条的
   * 修订时间戳，构建时间又对每一页都一样，同样没有信息量）。sitemap 允许缺省
   * 这个字段，而一个语义不对的时间戳比没有更糟：Google 一旦认定 lastmod 不可信，
   * 会连带忽略整份 sitemap 的时间信息。所以宁可只给 `url`。
   */
  const entryPages: MetadataRoute.Sitemap = ds.entries.map((entry) => ({
    url: siteUrl(`/e/${entry.id}/`),
  }))

  const gamePages: MetadataRoute.Sitemap = allGameIds(ds)
    .filter((id) => !REDIRECTED_GAME_IDS.has(id))
    .map((id) => ({ url: siteUrl(`/games/${id}/`) }))

  const seriesPages: MetadataRoute.Sitemap = [...ds.series.keys()].map((id) => ({
    url: siteUrl(`/series/${id}/`),
  }))

  return [...staticPages, ...entryPages, ...gamePages, ...seriesPages]
}
