import type { Metadata } from 'next'
import { siteUrl } from './site-url'

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

/** 站点级简介。根 layout 与所有没有自己简介的路由共用这一句。 */
export const SITE_DESCRIPTION =
  '2010 年至今的视频与直播索引。只收录链接，不搬运资源——每一次播放都回到原平台。'

/** 社交卡片图。1200×630，暗色底 + 站名 + 一句人话，不放任何统计数字。 */
export const OG_IMAGE = '/images/og/site.jpg'

export function pageMetadata({
  path,
  title,
  description,
}: {
  /** 站内路径，带尾斜杠，例如 `/archive/` */
  path: string
  /** 短名；不含站名，由根 layout 的 template 补 */
  title?: string
  description: string
}): Metadata {
  const url = siteUrl(path)
  const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME
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
      description,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
  }
}
