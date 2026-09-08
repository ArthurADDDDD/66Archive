import { createHash } from 'node:crypto'
import { getDataset, toTimelineEntries } from './data'
import { encodeArchivePayload, type EncodedArchivePayload } from './archive-payload'

/**
 * 录播室载荷的**构建期身份**。
 *
 * 这份载荷不和 HTML / JS 一起原子切换：`/archive-data.json` 由边缘按
 * `s-maxage=600, stale-while-revalidate=86400` 独立缓存，HTML 只有
 * `s-maxage=60, stale-while-revalidate=300`。两条时钟各走各的，于是发布之后
 * 最长 24 小时里，新的 HTML 都可能配着上一版的载荷——2026-09-09 实测抓到过
 * 一次：`/archive/` 已经是新发布，`/archive-data.json` 还是 4.6 小时前那版。
 * 表现有两种，都很难查：新条目在录播室里看不见（HTML 里的年月计数却已经加一），
 * 以及 `f6e89ca` 那次的整页失败（新解码器拿到旧格式）。
 *
 * 边缘的后台再验证**要有人请求才会发生**，冷门 PoP 可以一直发旧的；而请求侧的
 * `Cache-Control: no-cache` 顶不动它（实测仍然 HIT），所以「让用户硬刷新」不是解法。
 *
 * 修法是给 URL 带一个由**载荷字节本身**算出来的版本号。这样：
 *
 * - 新发布 = 新 URL，边缘没见过 → 必然回源，第一个客户端就拿到对的那份；
 * - 老 URL 仍然指向同一个文件路径（query 不参与 nginx 的 `location =` 匹配，
 *   也不参与 `try_files $uri`），所以**任何旧 HTML 都不会 404**——回滚、
 *   两次连续发布、爬虫渲染、开着不动的标签页全都照常拿到当前那份，
 *   这也是有意不改成 `/archive-data-<hash>.json` 的原因：那种写法在这套 nginx 下
 *   落不进 `location = /archive-data.json`，会掉进兜底 404，且丢掉边缘 TTL。
 * - 缓存策略一个字都不用改，CDN 命中率不降；`d90853b` 去掉 `cache: 'no-cache'`
 *   拿到的回访收益也保住了——浏览器缓存按完整 URL 建键，旧条目命不中新版本。
 *
 * 版本号取**编码后载荷**的哈希，不是数据集的：只改编码格式、数据没动的那种发布
 * 同样必须换 URL，否则边缘会把旧格式喂给新解码器。反过来，只改代码、载荷字节没变
 * 的发布版本号不变，边缘缓存照常复用。
 *
 * ⚠️ 版本号只是让**错位可被发现并绕开**，不替代 `archive-payload.ts` 里的旧格式兼容：
 * 发布后头几分钟仍然可能是「旧 HTML/JS + 新载荷」（HTML 的窗口更短），解码器必须
 * 照旧能读上一版。
 */
let cached: { payload: EncodedArchivePayload; url: string } | null = null

function build(): { payload: EncodedArchivePayload; url: string } {
  if (cached) return cached

  const ds = getDataset()
  const allEntries = toTimelineEntries(ds)
  const entries =
    process.env.NODE_ENV === 'development' && !ds.isDemo
      ? allEntries.filter((entry) => entry.uncheckedCount === 0)
      : allEntries

  const payload = encodeArchivePayload({
    entries,
    isDemo: ds.isDemo,
    hiddenUnreviewed: allEntries.length - entries.length,
  })

  // 与 route handler 实际发出去的字节一致：`Response.json` 用的就是 JSON.stringify。
  const version = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)
  cached = { payload, url: `/archive-data.json?v=${version}` }
  return cached
}

/** 录播室载荷本体。只有 `app/archive-data.json/route.ts` 该用它。 */
export function archivePayload(): EncodedArchivePayload {
  return build().payload
}

/**
 * 带版本号的载荷地址。**服务端专用**——这个模块会拉起整个数据集，
 * 被客户端组件 import 会把 2.6 MB 数据打进 chunk。要在客户端用，从服务端当 prop 传下去。
 */
export function archiveDataUrl(): string {
  return build().url
}
