/**
 * 站点公开地址的唯一来源
 * ======================
 * canonical、robots、sitemap 三处都要拼绝对 URL，而 AGENTS.md 要求「凡是需要站点地址
 * 的地方都走环境变量，不要新增写死的域名」。所以域名只在这里出现一次，其余地方一律
 * 通过 `siteOrigin()` / `siteUrl()` 取。
 *
 * `FALLBACK_SITE_ORIGIN` 原本住在 `baked-content.ts` 里，现在挪到这儿由两边共用——
 * 两份各自维护的默认域名迟早会在换域名时漏掉一处。
 */

/**
 * 谁都没配时的最后兜底。**这不是切换开关**：换域名要改的是发布流水线传进来的
 * `SITE_ORIGIN`，改这个常量不会让发布构建改变行为。
 */
export const FALLBACK_SITE_ORIGIN = 'https://nvliu.wiki'

/** 站点公开地址，末尾不带斜杠。 */
export function siteOrigin(): string {
  return (process.env.SITE_ORIGIN?.trim() || FALLBACK_SITE_ORIGIN).replace(/\/$/, '')
}

/**
 * 把站内路径拼成绝对 URL。
 *
 * `next.config.mjs` 是 `trailingSlash: true`，静态导出出来的每个页面都带尾斜杠。
 * canonical 和 sitemap 里的地址必须和真实可访问的地址逐字一致——少一个斜杠就是
 * 指向一个会 301 的地址，等于把权重指给了跳转源。所以这里强制补齐尾斜杠，
 * 首页除外（`/` 本身已经是它的规范形式）。
 */
export function siteUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  const withSlash = clean === '/' || clean.endsWith('/') ? clean : `${clean}/`
  return `${siteOrigin()}${withSlash}`
}
