import type { ResolvedBeat } from './narrative'

/**
 * 补充高光基线。
 *
 * 这些条目有外部史料链接，但目前不属于 data/** 的档案条目，所以仍由前端策展层维护。
 * 与普通 HIGHLIGHTS 不同的是，它们单独放在这个轻量模块里，让公开前台和后台快照导入
 * 读取同一份稳定 ID / 文案 / 链接，避免只在 HighlightStrip 里出现、后台却完全看不见。
 *
 * 注意：date 是展示日期。dont-like-nvliu / nature-gift 的精确来源发布时间仍需按原页面
 * 元数据复核后再收窄；在复核完成前不伪造具体日。链接和跳转点按已给出的原始来源保留。
 */
export const EXTRA_HIGHLIGHTS: ResolvedBeat[] = [
  {
    id: 'dont-like-nvliu',
    act: 'act-ii',
    date: '2015',
    size: 'type',
    kicker: '砒霜名场面',
    title: '我就是不喜欢那个女流！',
    body: '「我就是不喜欢那个女流！」',
    href: 'https://www.bilibili.com/video/BV1bx411j7Gx?p=2&t=1907',
    external: true,
    cover: null,
    emphasis: 'P2 · 31:47',
  },
  {
    id: 'douyu-gandie',
    act: 'act-ii',
    date: '2021.09.21',
    size: 'type',
    kicker: '查房名场面',
    title: '斗鱼干爹',
    body: '「斗鱼干爹，定不负你。」',
    href: 'https://www.bilibili.com/video/BV1fk4y1k7uN?p=2&t=3122',
    external: true,
    cover: null,
    emphasis: 'P2 · 52:02',
  },
  {
    id: 'nature-gift',
    act: 'act-ii',
    date: '2022',
    size: 'type',
    kicker: '砒霜名场面',
    title: '感谢大自然的馈赠',
    body: '「感谢大自然的馈赠。」',
    href: 'https://m.acfun.cn/v/?ac=35552495',
    external: true,
    cover: null,
    emphasis: '01:22:48',
  },
]
