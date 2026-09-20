import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

/**
 * 社交卡片图的选取规则
 * ====================
 *
 * 详情页本来就有自己的封面，但**绝大多数封面不能直接当 og:image 用**：
 *
 * - `https://i0.hdslb.com/...`、`https://m.ykimg.com/...` 是原平台地址，带防盗链。
 *   站内展示要靠 `proxyImage` 换 Referer 才取得到；社交平台的爬虫不会这么做，
 *   它拿到的是 403，卡片上就是一块空白。**这正是「metadata 里有地址、爬虫却取不到」
 *   那一类故障**。
 * - `https://images.weserv.nl/?...&output=webp` 是第三方代理，还是 webp。
 *   多了一跳第三方可用性，webp 在部分社交平台上也不渲染。
 *
 * 所以这里只认**站内自己托管的那一批封面**（`/images/covers/*.jpg`，随仓库提交、
 * 由 nginx 直出、实测可匿名取到）。取不到合适的就返回 null，调用方落回全站默认图。
 *
 * 另外还要挡尺寸：这批封面里混着 200×112 这种缩略图和 960×1706 的竖图。
 * 尺寸太小的社交平台会直接不渲染（又是一块空白），所以低于大卡推荐下限的一律不用。
 * 宽高按**实际文件**读出来写进 meta——声明值和真实尺寸对不上同样会被拒绝渲染。
 *
 * 只在构建期跑：`output: 'export'`，`generateMetadata` 在 Node 里执行，
 * 这个模块不会进浏览器包。94 个文件各读一次，结果在模块级缓存。
 */

/** og 大卡的推荐下限。低于这个尺寸的图在多数平台上不会被渲染成大图卡。 */
const MIN_WIDTH = 600
const MIN_HEIGHT = 315

/** 只接受站内托管的这一个前缀；其它一律当作「不可用」。 */
const LOCAL_PREFIX = '/images/'

export type ShareImage = { url: string; width: number; height: number }

const cache = new Map<string, ShareImage | null>()

/**
 * 把条目 / 系列 / 游戏的封面转成可用的社交卡片图；不合适就返回 null。
 *
 * 传进来的值可能已经过 `proxyImage`——它对 `/` 开头的地址原样返回，所以站内封面
 * 到这里仍然是 `/images/covers/xxx.jpg`，远程封面则会是 weserv 地址，正好被挡掉。
 */
export async function coverShareImage(cover: string | null | undefined): Promise<ShareImage | null> {
  if (!cover || !cover.startsWith(LOCAL_PREFIX)) return null

  const cached = cache.get(cover)
  if (cached !== undefined) return cached

  const result = await measure(cover)
  cache.set(cover, result)
  return result
}

async function measure(cover: string): Promise<ShareImage | null> {
  // 去掉查询串再落地到文件系统；`public/` 下的路径就是站内路径本身。
  const relative = cover.split('?')[0].replace(/^\//, '')
  const file = path.join(process.cwd(), 'public', relative)
  try {
    if (!fs.existsSync(file)) return null
    const { width, height } = await sharp(file).metadata()
    if (!width || !height) return null
    if (width < MIN_WIDTH || height < MIN_HEIGHT) return null
    return { url: cover, width, height }
  } catch {
    // 读不出来就当没有——社交卡片不值得让构建失败。
    return null
  }
}
