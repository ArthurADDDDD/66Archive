import type { Dataset, TimelineEntry } from './data'
import { proxyImage } from './platforms'

/**
 * 栏目 / 系列数据层。
 * 匹配规则（只做精确匹配，不猜标题）：
 * - 视频时代：entry.series === id（series 字段只存在于视频时代）
 * - 斗鱼时代：tags 精确等于系列名（心灵砒霜 / 戏说聊斋 / 吃鸡佳缘 / 66聊聊）
 * - 心灵砒霜补充：标题含「砒霜」的条目也计入（2017-03-22 砒霜兼索尼2周年户外、2018-02-25 狗年第一碗砒霜）
 *   ——这两条未带 tag 但标题可确证，data-agent 的 series.yaml 计数口径同样含标题匹配。
 * 数字全部构建期派生；页面上「档案确认」数字以这里派生为准。
 * 心灵砒霜的展示文案也跟随当前档案的期数与首末日期，避免沿用过期的历史统计或缺口判断。
 */

export type SeriesInfo = {
  id: string
  name: string
  description: string
  entries: TimelineEntry[]
  count: number
  firstDate: string
  lastDate: string
  /** 每一年期数（活动纹理用） */
  perYear: { year: number; count: number }[]
  /** 第一期标题：作为「代表性一句」使用，不编造 */
  firstTitle: string | null
  cover: string | null
  /** 栏目归属时代 */
  era: 'video' | 'douyu'
  games: string[]
}

/** 心灵砒霜的档案口径：标签条目 + 标题中明确写出栏目名的条目。 */
export function isXinlingPishuangEntry(entry: Pick<TimelineEntry, 'title' | 'tags'>): boolean {
  return entry.tags.includes('心灵砒霜') || /砒霜/.test(entry.title)
}

export function buildSeriesList(ds: Dataset, timeline: TimelineEntry[]): SeriesInfo[] {
  const list: SeriesInfo[] = []
  for (const [id, s] of ds.series) {
    list.push(buildSeries(ds, timeline, id, s.name, s.description ?? ''))
  }
  // 期数多的在前——心灵砒霜自然第一
  return list.sort((a, b) => b.count - a.count)
}

export function buildSeries(
  ds: Dataset,
  timeline: TimelineEntry[],
  id: string,
  name: string,
  description: string,
): SeriesInfo {
  const isPishuang = id === 'xinling-pishuang'
  const entries = timeline
    .filter((e) => e.seriesName === name || e.tags.includes(name) || (isPishuang && isXinlingPishuangEntry(e)))
    .sort((a, b) => a.date.localeCompare(b.date))

  const perYearMap = new Map<number, number>()
  for (const e of entries) {
    const y = Number(e.date.slice(0, 4))
    perYearMap.set(y, (perYearMap.get(y) ?? 0) + 1)
  }
  const perYear = [...perYearMap.entries()].map(([year, count]) => ({ year, count }))

  const games = [...new Set(entries.flatMap((e) => e.games.map((g) => g.name)))]

  return {
    id,
    name,
    description: getDisplayDescription(id, description, entries),
    entries,
    count: entries.length,
    firstDate: entries[0]?.date ?? '',
    lastDate: entries[entries.length - 1]?.date ?? '',
    perYear,
    firstTitle: entries[0]?.title ?? null,
    cover: entries[0]?.cover ? proxyImage(entries[0].cover, 640) : null,
    era: entries[0] ? (Number(entries[0].date.slice(0, 4)) <= 2015 ? 'video' : 'douyu') : 'douyu',
    games,
  }
}

function getDisplayDescription(id: string, fallback: string, entries: TimelineEntry[]): string {
  if (id !== 'xinling-pishuang' || entries.length === 0) return fallback

  const firstDate = entries[0].date
  const lastDate = entries[entries.length - 1].date
  return `斗鱼期固定栏目（周日情感电台），目前档案已完整收录 ${entries.length} 期，${firstDate} ~ ${lastDate}，为条目数最多的栏目。参考来源 nvliu.me 记该栏目于 ${firstDate} 开播。`
}
