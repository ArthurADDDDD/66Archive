import { FEATURE_VIDEO_CREDITS } from './gallery-feature-video-credits'

/**
 * 纪念画廊里单独置顶的一期纪念视频。
 *
 * 它不是女流本人的投稿，也不是直播录像，所以不进 `data/entries`；
 * 画廊页只放这一条，按特例写在这里。素材出处的逐条清单见
 * `gallery-feature-video-credits.ts`。
 */

const STAGES = [
  { key: 1, label: 'STAGE 1 · 视频时代', span: '2010 — 2014' },
  { key: 2, label: 'STAGE 2 · 大周的那些年', span: '2015 — 2023' },
  { key: 3, label: 'STAGE 3 · 人生新阶段', span: '2022 — 现在' },
  { key: 4, label: 'BONUS · 水友的心意', span: '' },
  { key: 5, label: '尾声 · 年份肖像与闪回', span: '' },
  { key: 6, label: '音乐', span: '' },
] as const

export const GALLERY_FEATURE_VIDEO = {
  title: '【女流66】这么多个日夜',
  url: 'https://www.bilibili.com/video/BV1toay6REAB',
  cover: 'https://i2.hdslb.com/bfs/archive/b336ed65146ffaef917e55378631eecb7d5794f2.jpg',
  platform: '哔哩哔哩',
  uploader: '可达鸭来溜溜',
  date: '2026.10.02',
  duration: '9:43',
  blurb: [
    '2010.05.08 第一支视频，到 2026.10.03，5992 天。',
    '素材来自女流66 历年的投稿和直播录像，还有水友们的录播、搬运和作品。',
  ],
  stages: STAGES.map((s) => ({ ...s, credits: FEATURE_VIDEO_CREDITS[s.key] })),
  thanks: '片头片尾的像素画面是为这期视频单独做的；封面墙上的封面来自女流档案馆收录的条目，手写字的纸面取自《暖风》。谢谢每一位留下这些画面的人。片中的统计以女流档案馆目前的收录为准，难免有遗漏。',
} as const
