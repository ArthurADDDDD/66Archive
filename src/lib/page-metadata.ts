import type { Metadata } from 'next'
import { siteUrl } from './site-url'
import { getShareCardDescription, getShareCardImage } from './share-cards'

/**
 * 每个页面的 `title` / `description` / canonical / 社交卡片
 * =======================================================
 *
 * 从前只有 canonical 是各页自己写的，`title` 与 `description` 全都继承根 layout 的
 * 那一份——于是 `/chronicle/`、`/archive/`、`/games/` 的浏览器标签、收藏夹条目、
 * 搜索结果标题一字不差，全是「女流编年史」。同时全站一个 `og:` 标签都没有，
 * 链接贴到微信 / 微博 / QQ / B站动态里只会渲染成一条没有卡片的裸链。
 *
 * 这个函数把这四件事收在一处：给一个路径和一句人话，社交卡片自己长出来。
 *
 * ## 为什么 openGraph 里要重复写 title / description
 *
 * Next 的 metadata **不会**把顶层 `title` / `description` 自动灌给 `openGraph`——
 * 只有根 layout 里声明过 `openGraph` 时才有继承，且继承的是根那一份的字面值，
 * 不是当前页的。不在这里显式写一遍，每页分享出去都会是同一段站点简介。
 *
 * ## title 走根 layout 的 template
 *
 * 传进来的 `title` 是短名（「录播室」），根 layout 的 `%s · 女流编年史` 负责补站名。
 * `openGraph.title` 则要自己拼全称：社交卡片没有 template 这一层。
 */
export const SITE_NAME = '女流编年史'

/**
 * 站点级简介与分享卡片图的兜底值。
 *
 * 这两个常量本身**不是**当前生效的文案/图片——那份活的数据在
 * data/share-cards.yaml 与 data/share-card-image.json，由后台「分享卡片」页面维护
 * （走暂存 → 推送 → CI，og 标签只在构建时写进 HTML 一次，不是即时生效）。这里留着
 * 只是给 share-cards.ts 在两份数据文件缺失时兜底，同时也是这两份文件最初的取值来源。
 */
export const SITE_DESCRIPTION =
  '2010 年至今的视频与直播索引。只收录链接，不搬运资源——每一次播放都回到原平台。'

/**
 * 全站默认社交卡片图兜底。1200×630，暗色底 + 站名 + 一句人话，不放任何统计数字。
 * 每个页面都能在后台「分享卡片」页面单独设自己的图；没单独设过的页面用这张。
 */
export const OG_IMAGE = '/images/og/site.jpg'

/** 首页当前生效的分享图——读 data/share-cards.yaml 的 home 条目，没设过就用 OG_IMAGE 兜底。 */
export const CURRENT_HOME_OG_IMAGE = getShareCardImage('home', OG_IMAGE)

/** 当前生效的首页/站点级简介——读 data/share-cards.yaml 的 home 条目，缺失就用 SITE_DESCRIPTION 兜底。 */
export const CURRENT_SITE_DESCRIPTION = getShareCardDescription('home', SITE_DESCRIPTION)

export function pageMetadata({
  path,
  title,
  description,
  shareId,
}: {
  /** 站内路径，带尾斜杠，例如 `/archive/` */
  path: string
  /** 短名；不含站名，由根 layout 的 template 补 */
  title?: string
  /**
   * 兜底文案，同时也是浏览器标签页 / 搜索结果摘要用的 `description`——这个不受
   * 「分享卡片」后台页面控制，永远是这里传入的值。
   */
  description: string
  /**
   * 这个页面在 data/share-cards.yaml 里的 id。传了才会用后台维护的社交卡片文案与
   * 图片覆盖默认值（文案只覆盖 og:/twitter: 那一份，不影响 `<meta name="description">`）；
   * 不传（比如 `/e/[id]/` 这种按条目动态生成描述的页面）就原样用 `description` 和全站默认图。
   */
  shareId?: string
}): Metadata {
  const url = siteUrl(path)
  const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME
  const shareDescription = shareId ? getShareCardDescription(shareId, description) : description
  const shareImage = shareId ? getShareCardImage(shareId, OG_IMAGE) : OG_IMAGE
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'zh_CN',
      url,
      title: fullTitle,
      description: shareDescription,
      images: [{ url: shareImage, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: shareDescription,
      images: [shareImage],
    },
  }
}
