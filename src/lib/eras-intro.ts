import type { Dataset, TimelineEntry } from './data'
import { toTimelineEntries } from './data'
import { ERAS, type Era } from './covers'
import type { Platform } from './schema'

/**
 * 三个时代的入口卡。
 *
 * 每张卡的代表条目是**这个时期在它自己平台上的第一条记录**——不是按年份分界算出来的
 * 那种"第一条"（那样会把 2024 年初那场过渡期的 B 站语音直播错认成"抖音时期"的开始），
 * 是按 `entry.platform` 直接筛：优酷的第一条、斗鱼的第一条、抖音的第一条。
 * 三个数字都是算出来的，不是写死的 id——数据补录之后如果哪天冒出更早的一条，
 * 这里会自己换人。
 */

const PLATFORM_OF_ERA: Record<Era['id'], Platform> = {
  video: 'youku',
  douyu: 'douyu',
  douyin: 'douyin',
}

export type EraIntro = {
  era: Era
  count: number
  /** null = 这个时期还在继续，标签上显示"至今" */
  toYear: number | null
  opener: TimelineEntry
}

export function buildEraIntros(ds: Dataset): EraIntro[] {
  const entries = toTimelineEntries(ds)
  const ascending = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const years = ERAS.map((e) => e.fromYear)

  return ERAS.map((era, i) => {
    const platform = PLATFORM_OF_ERA[era.id]
    const opener = ascending.find((e) => e.platform === platform)
    const inEra = entries.filter((e) => e.platform === platform)
    return {
      era,
      count: inEra.length,
      toYear: years[i + 1] ? years[i + 1] - 1 : null,
      opener: opener!,
    }
  }).filter((e): e is EraIntro => Boolean(e.opener))
}
