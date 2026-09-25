/**
 * 站名的**公开仓基线**。
 *
 * 当前生效的站名在后台「标题 · 导航 · 页头」的站点标题（site-copy 的 `site.title`）：
 * - 页头、菜单、直播状态胶囊、浏览器标题在运行时读后台值（`useSiteCopy().site.title`）；
 * - `<title>` 模板、og: / twitter: 这些构建期写死进 HTML 的，读发布时冻结的那份后台文案
 *   （见 `site-name-build.ts`）。
 * 这个常量只在两者都拿不到时兜底（本地离线构建、后台文案缺站名）。
 *
 * 单独成一个文件，是因为**客户端组件也要用它**；`page-metadata.ts` 经 `share-cards.ts`
 * 引入了 `node:fs`，是服务端专用模块，被客户端组件 import 会把它拖进浏览器包里。
 *
 * 注意与栏目名区分——「编年史 / Chronicle」是栏目，旧站名「女流编年史」改名后不再用作站名。
 */
export const SITE_NAME = '女流档案馆'

