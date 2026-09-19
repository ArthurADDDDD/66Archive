/**
 * 站名常量。
 *
 * 单独成一个文件，是因为**客户端组件也要用它**：根 layout 的 title template
 * （`%s · 女流编年史`）把这个字符串拼进了每一页的 `<title>`，`LiveDocumentMeta`
 * 在浏览器里改标题时需要认出并替换掉那个后缀。
 *
 * 不能直接从 `page-metadata.ts` 取——那个文件经 `share-cards.ts` 引入了 `node:fs`，
 * 是明确的服务端专用模块，被客户端组件 import 会把它拖进浏览器包里。
 *
 * `page-metadata.ts` 再从这里 re-export，所以服务端那一侧的 import 路径不变。
 */
export const SITE_NAME = '女流编年史'
