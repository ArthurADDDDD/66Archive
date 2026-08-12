/**
 * 时期 + 封面画质。
 *
 * 这两件事写在同一个文件里，因为它们在这个站里是同一件事：
 * 十六年里同一个位置的一张封面，像素数差了将近一百倍，而这个差距是真的。
 *
 * 实测（2026-08-12，抽样自 data/entries 的真实 cover URL）：
 *
 *   m.ykimg.com（优酷 2010–2015）        200×112，少数 448×252，~5–22 KB
 *   tx-free-imgs.acfun.cn/content/…      480×270，~40 KB      （2016–2018 的录播稿）
 *   tx-free-imgs.acfun.cn/newUpload/…    1800×1125 / 1920×1080，~0.4–1.6 MB
 *   i*.hdslb.com/bfs/archive/…           1920×1080，少数 250×141
 *
 * 也就是说：01-vision 里"画质随时间变清晰"这个判断方向上成立（2010 年的图确实只有
 * 200 像素宽），但它不是一条干净的"一个时期一种分辨率"的规则——A 站期内部就同时存在
 * 480 宽和 1920 宽两种稿件。所以这里不按时期硬编码尺寸，只做两件事：
 *
 *   1. 永远不放大。请求代理时带上不放大的开关，200 宽的原图就只回 200 宽。
 *      放进更大的格子里它自然是糊的——那个糊是 2010 年优酷的糊，不是我们加的滤镜。
 *   2. 老图在版面里占更小的格子（eraTileSpan）。宁可让它小，也不要插值成假的清晰。
 */

export type EraId = 'video' | 'douyu' | 'douyin'

export type Era = {
  id: EraId
  /** 时期名，用在正文里 */
  name: string
  /** 极短标签，用在角标 */
  short: string
  color: string
  /** 起始年份（含）。终点由下一个时期的起点决定。 */
  fromYear: number
}

/**
 * 时期分界按年份切，规则写死在这里而不是从数据推：
 * 2015 年内部同时有优酷解说和最早的斗鱼录像，按条目数推导会把 2015 判进直播期，
 * 但这一年上传到优酷的仍然是"视频"。以内容事实为准，不以计数为准。
 */
export const ERAS: Era[] = [
  { id: 'video', name: '视频时期', short: '优酷', color: '#E0A244', fromYear: 2010 },
  { id: 'douyu', name: '斗鱼时期', short: '斗鱼', color: '#5BC8E8', fromYear: 2016 },
  { id: 'douyin', name: '抖音时期', short: '抖音', color: '#FF6B75', fromYear: 2024 },
]

export function eraOf(date: string): Era {
  const year = Number(date.slice(0, 4))
  let current = ERAS[0]
  for (const era of ERAS) if (year >= era.fromYear) current = era
  return current
}

/*
 * 这里刻意**没有**"按时期给一个原图宽度上限"的表。
 *
 * 试过，然后发现它必然是错的：A 站期内部 `/content/` 是 480 宽、`/newUpload/` 是 1920 宽，
 * 按时期查表只会得到一个骗人的数字。"不放大"这条性质由代理侧兜底
 * （见 src/lib/platforms.ts 的 proxyImage），不依赖任何一张需要人去维护的对照表。
 *
 * 格子占几格是版面决定，写在用它的组件里（CoverWall 的 SPAN），不放这儿——
 * 那是排版参数，不是关于时期的事实。
 */
