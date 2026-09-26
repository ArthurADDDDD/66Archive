/**
 * 编年史按平台分成三段：视频时代 / 斗鱼156277 / 抖音。
 *
 * 首页 ACT 的三幕是叙事分法（第三幕从「双人模式」讲起，和斗鱼尾段重叠）；编年史
 * 更直接，按她在哪个平台上和大家见面来分，年份互不重叠。每一段里的内容照旧全部
 * 展开——分段解决的是「一口气读不完」，不是把内容藏起来。
 *
 * 归段只看年份段（StorySection.year），和首页三幕的边界无关。
 */
export type ChronicleEraId = 'video' | 'douyu' | 'douyin'

export type ChronicleEra = {
  id: ChronicleEraId
  label: string
  /** 手机底部胶囊放不下全名时用的两字简称 */
  shortLabel: string
  /** 年份范围（含）；to 为 null 表示一直到现在。 */
  from: number
  to: number | null
  color: string
}

export const CHRONICLE_ERAS: readonly ChronicleEra[] = [
  { id: 'video', label: '视频时代', shortLabel: '视频', from: 0, to: 2014, color: '#E0A244' },
  { id: 'douyu', label: '斗鱼156277', shortLabel: '斗鱼', from: 2015, to: 2023, color: '#5BC8E8' },
  { id: 'douyin', label: '抖音时代', shortLabel: '抖音', from: 2024, to: null, color: '#FF6B75' },
]

export const DEFAULT_CHRONICLE_ERA: ChronicleEraId = 'video'

export function isChronicleEra(value: string | null | undefined): value is ChronicleEraId {
  return CHRONICLE_ERAS.some((era) => era.id === value)
}

export function eraOfYear(year: number): ChronicleEraId {
  return (CHRONICLE_ERAS.find((era) => year >= era.from && (era.to === null || year <= era.to)) ?? CHRONICLE_ERAS[0]).id
}

export function inEra<T extends { year: number }>(items: readonly T[], era: ChronicleEraId): T[] {
  return items.filter((item) => eraOfYear(item.year) === era)
}
