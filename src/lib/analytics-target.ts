/**
 * 站内链接 → 「点开」埋点目标。
 *
 * 编年史 / 首页三幕 / 高光条的节点卡都只拿到一个最终 href：策展数据里的锚点
 * 可能是条目，也可能被 `target.href` 改写成节目页（例如心灵砒霜的两个锚点），
 * 后台新增的高光还能自己填链接。**按最终 href 反推目标，而不是按策展里写的
 * 那个 kind**——否则点进节目页却记成条目，排行会算到另一条内容头上。
 *
 * 站内路径（/e/xxx/）与指向本站的完整 URL（https://本站/e/xxx/）都认——后台填
 * 跳转地址时贴地址栏里的 URL 比翻出站内路径顺手得多，两种写法指的是同一个页面。
 * 真正的外链（B 站切片、新闻稿）返回 undefined：它们不是站内内容，不进「最爱看」。
 *
 * ID 规则与后端 schema 的 `content.open` target 校验保持一致，对不上的一律
 * 返回 undefined——宁可少记一次，也不要发一个会被服务端整批拒掉的事件。
 */
import { FALLBACK_SITE_ORIGIN } from './site-url'

const INTERNAL_CONTENT_HREF = /^\/(e|games|series)\/([a-z0-9][a-z0-9_-]{0,119})\/?$/

/**
 * 站点自己的地址，构建期由 next.config.mjs 钉进服务端与客户端两份产物。
 * 没配就退回 site-url.ts 的兜底——域名在整个仓库里仍然只出现一次。
 */
const SELF_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN || FALLBACK_SITE_ORIGIN).replace(/\/$/, '')

/**
 * 把「指向本站的完整 URL」还原成站内路径。
 *
 * 后台填跳转地址时可以填站内路径，也可以填完整 URL——找一条记录的站内路径要先去
 * 翻档案，贴地址栏里的 URL 才是顺手的做法。两种写法指的是同一个页面，统计上不该
 * 只认其中一种。
 *
 * 只认自己的域名（忽略 www. 前缀与 http/https 差异）。域名对不上的一律当外链：
 * 别人站上恰好也有 /e/xxx/ 这种路径并不稀奇，认错了就是把点击记到自家内容头上。
 */
function selfPath(href: string): string | null {
  if (href.startsWith('/')) return href
  if (!/^https?:\/\//i.test(href)) return null
  const bare = (host: string) => host.toLowerCase().replace(/^www\./, '')
  try {
    const url = new URL(href)
    if (bare(url.hostname) !== bare(new URL(SELF_ORIGIN).hostname)) return null
    // 带查询串或锚点的链接落到具体页面之外（?from=、#section），不当作「点开这条内容」
    return url.search || url.hash ? null : url.pathname
  } catch {
    return null
  }
}

export function contentOpenTarget(href: string | null | undefined): string | undefined {
  if (!href) return undefined
  const path = selfPath(href)
  if (!path) return undefined
  const match = INTERNAL_CONTENT_HREF.exec(path)
  if (!match) return undefined
  const kind = match[1] === 'e' ? 'entry' : match[1] === 'games' ? 'game' : 'series'
  return `${kind}:${match[2]}`
}

/**
 * 直接摊进 `<Link>` 的埋点属性。没有站内目标时返回空对象，标签上不留多余属性。
 */
export function contentOpenProps(href: string | null | undefined): Record<string, string> {
  const target = contentOpenTarget(href)
  return target ? { 'data-analytics-event': 'content.open', 'data-analytics-target': target } : {}
}
