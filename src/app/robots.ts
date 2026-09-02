import type { MetadataRoute } from 'next'
import { siteOrigin } from '@/lib/site-url'

/**
 * `output: 'export'` 下 metadata route 必须显式声明静态，否则构建期直接报
 * 「export const dynamic = "force-static" not configured」并中断。
 */
export const dynamic = 'force-static'

/**
 * `/robots.txt`（Next App Router 的 metadata route，`output: 'export'` 下在构建期生成静态文件）。
 *
 * 在此之前站点根本没有这个文件：线上一天被请求 130+ 次、全部 404，`/sitemap.xml` 同理。
 *
 * **屏蔽名单刻意只有两项。** 这个站的价值就是被搜到，任何多余的 disallow 都是自断经脉：
 *
 * - `/api/` —— 只读内容接口与投票接口，返回 JSON，不是页面，抓了也进不了索引。
 * - `/admin` —— 后台控制台和站点同源（`ADMIN_ORIGIN` 就是本站），不该出现在任何搜索结果里。
 *
 * **`/archive-data.json` 绝不能加进来。** `/archive/` 的正文是客户端从这个 JSON 拉的
 * （SSG 出来的 HTML 只是个壳），屏蔽它等于让 Googlebot 渲染出一个空档案页——
 * 那是「屏蔽正常档案页面」的隐蔽形式，只是绕了一层资源依赖。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin'] }],
    // 这里是文件不是页面，所以直接拼 origin：`siteUrl()` 会给页面路径补尾斜杠。
    sitemap: `${siteOrigin()}/sitemap.xml`,
  }
}
