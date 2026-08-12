/**
 * 她的斗鱼头像，按时间排。
 *
 * 这三张不是装饰素材，是十六年里她换过的三张脸——所以每一张都必须跟它的时间绑在一起出现，
 * 而不是轮播成一个"会动的 logo"。文件名里的日期就是资料里的时间，不要改成 v1/v2/v3。
 */
export const AVATARS = [
  { src: '/images/avatars/v1_2015.jpg', when: '2015', alt: '女流斗鱼头像 · 2015' },
  { src: '/images/avatars/v2_201712.jpg', when: '2017-12', alt: '女流斗鱼头像 · 2017 年 12 月' },
  { src: '/images/avatars/v3_202204.jpg', when: '2022-04', alt: '女流斗鱼头像 · 2022 年 4 月' },
] as const
