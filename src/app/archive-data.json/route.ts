import { archivePayload } from '@/lib/archive-data-url'

export const dynamic = 'force-static'

/**
 * 录播室的静态数据载荷。与页面路由拆开后，点击导航会先得到轻量外壳；这份大数据
 * 再由浏览器单独请求并在同一次浏览会话中复用，不再阻塞所有站内导航。
 *
 * 载荷本体在 `lib/archive-data-url.ts` 里拼——那边同时按发出去的字节算出 URL 上的
 * 版本号，两者必须出自同一次构造，否则版本号就不代表这份字节了。
 */
export function GET() {
  // 线上编码见 lib/archive-payload.ts：只压缩「怎么写下来」，条目形状不变，
  // 解码在 ArchiveLoader 里，构造上无损（scripts/test-archive-payload.ts 逐条比对）。
  return Response.json(archivePayload())
}
