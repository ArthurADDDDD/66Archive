import type { Dataset, TimelineEntry } from './data'
import { proxyImage } from './platforms'

/**
 * 栏目 / 系列数据层。
 * 匹配规则（只做精确匹配，不猜标题）：
 * - 视频时代：entry.series === id（series 字段只存在于视频时代）
 * - 直播节目：tags 精确等于系列名（心灵砒霜 / 一起See / 戏说聊斋 / 吃鸡佳缘）
 * - 心灵砒霜补充：标题含「砒霜」的条目也计入（2017-03-22 砒霜兼索尼2周年户外、2018-02-25 狗年第一碗砒霜）
 *   ——这两条未带 tag 但标题可确证，data-agent 的 series.yaml 计数口径同样含标题匹配。
 * 数字全部构建期派生；页面上「档案确认」数字以这里派生为准。
 * 心灵砒霜的展示文案跟随当前档案的期数与首末日期，但不把“已收录”自动表述成“完整收录”。
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
  /** 节目页的内容形态；不按平台时代硬切，长期节目可以跨平台延续。 */
  category: 'long-running' | 'themed' | 'video'
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
    category: getSeriesCategory(id, entries[0]?.type),
    games,
  }
}

function getDisplayDescription(id: string, fallback: string, entries: TimelineEntry[]): string {
  if (entries.length === 0) return fallback

  const firstDate = entries[0].date
  const lastDate = entries[entries.length - 1].date
  if (id === 'xinling-pishuang') {
    return `斗鱼期固定栏目（周日情感电台），目前档案已收录 ${entries.length} 期，${firstDate} ~ ${lastDate}，为条目数最多的栏目。参考来源 nvliu.me 记该栏目于 2015-07-05 开播。`
  }
  if (id === 'together-see') {
    return `直播中与观众一起观看视频、节目、发布会、PV 和预告的长期节目。目前档案已确认 ${entries.length} 场，${firstDate} ~ ${lastDate}；它从斗鱼延续到抖音，新的确认记录会自动加入这里。`
  }
  return fallback
}

function getSeriesCategory(id: string, firstType?: TimelineEntry['type']): SeriesInfo['category'] {
  if (id === 'xinling-pishuang' || id === 'together-see') return 'long-running'
  if (id === 'xishuo-fengshen' || id === 'xishuo-liaozhai' || id === 'chiji-jiayuan') return 'themed'
  return firstType === 'video' ? 'video' : 'themed'
}
