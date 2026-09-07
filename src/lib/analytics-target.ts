/**
 * 站内链接 → 「点开」埋点目标。
 *
 * 编年史 / 首页三幕 / 高光条的节点卡都只拿到一个最终 href：策展数据里的锚点
 * 可能是条目，也可能被 `target.href` 改写成节目页（例如心灵砒霜的两个锚点），
 * 后台新增的高光还能自己填链接。**按最终 href 反推目标，而不是按策展里写的
 * 那个 kind**——否则点进节目页却记成条目，排行会算到另一条内容头上。
 *
 * 外链（B 站切片、新闻稿）返回 undefined：它们不是站内内容，不进「最爱看」。
 *
 * ID 规则与后端 schema 的 `content.open` target 校验保持一致，对不上的一律
 * 返回 undefined——宁可少记一次，也不要发一个会被服务端整批拒掉的事件。
 */
const INTERNAL_CONTENT_HREF = /^\/(e|games|series)\/([a-z0-9][a-z0-9_-]{0,119})\/?$/

export function contentOpenTarget(href: string | null | undefined): string | undefined {
  if (!href) return undefined
  const match = INTERNAL_CONTENT_HREF.exec(href)
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
