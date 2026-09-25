import { readBakedInput } from './baked-input'
import { SITE_NAME } from './site-name'

/**
 * 构建期写进 HTML 的站名（服务端专用）。
 *
 * 根 layout 的 metadata 必须保持静态（见 layout.tsx 的说明：改成 generateMetadata 会让
 * 两千多个条目页预渲染失败），所以这里不能 await 内容接口。发布构建总是带着
 * `CONTENT_BAKE_FILE`——一份冻结、校验过 hash 的后台文案——同步读它就够了。
 *
 * 这样后台改了站名，下一次部署时 `<title>`、og:site_name、分享卡片标题都跟着变，
 * 不需要再改代码。没有冻结文件（本地 dev / 离线构建）就用公开仓基线。
 */
function resolveBuildSiteName(): string {
  const file = process.env.CONTENT_BAKE_FILE
  if (!file) return SITE_NAME
  try {
    const content = readBakedInput(file, process.env.CONTENT_BAKE_SHA256 || '', process.env.SITE_ORIGIN || '')
    return content.copy?.site.title.trim() || SITE_NAME
  } catch {
    // 冻结文件本身有问题时 baked-content 会让整次构建失败，这里不必重复报错。
    return SITE_NAME
  }
}

export const BUILD_SITE_NAME = resolveBuildSiteName()
