import type { Dataset, TimelineEntry } from './data'
import { proxyImage } from './platforms'

/**
 * 栏目 / 系列数据层。
 * 匹配规则（只做精确匹配，不猜标题）：
 * - entry.series === id 对应的 seriesName
 * - 直播节目：tags 精确等于系列名（心灵砒霜 / 一起See / 戏说聊斋 / 吃鸡佳缘）
 * - 心灵砒霜补充：标题含「砒霜」的条目也计入（2017-03-22 砒霜兼索尼2周年户外、2018-02-25 狗年第一碗砒霜）
 * - 大周MC补充：标题明确写出「大周MC」「MC复兴大周」或「大周建国史」的条目计入。
 *   这里不是模糊猜 Minecraft：这些词本身就是当期录像使用的系列名；尤其 2016-06-29
 *   《MC复兴大周 day1》早于 2017《大周建国史》，用于避免把 2017 误当成整个系列起点。
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
  /**
   * 能不能数「第几期」。
   *
   * 这张表里混着两种东西：她自己起过名字的节目（心灵砒霜、一起 See、戏说封神、
   * 光之子全剧情……），和**档案自己分出来的桶**（`night-talk` 在数据里就叫「聊天」、
   * `outdoor-live` 叫「户外」、`press-events` 叫「发布会」，前台才改成现在的显示名）。
   *
   * 前者数期数是致敬——「294 期」等于说她出现过 294 个星期日。后者不是节目，
   * 是分类；给它标上「137 期」既不准确（她从没编过号），读起来也像在清点
   * 「这些场次不是在打游戏」。所以桶只说活跃年份，不报期数。
   *
   * 一起 See 虽然是她起的名字，但它是「开着就一起看」，没有编过号，详情页也按「场」数；
   * 节目单卡片上同样不报期数。
   */
  countsEpisodes: boolean
  games: string[]
}

/** 心灵砒霜的档案口径：标签条目 + 标题中明确写出栏目名的条目。 */
export function isXinlingPishuangEntry(entry: Pick<TimelineEntry, 'title' | 'tags'>): boolean {
  return entry.tags.includes('心灵砒霜') || /砒霜/.test(entry.title)
}

/** 大周MC的档案口径：只认标题中明确出现过的当期系列名，不把普通 Minecraft 场次猜进来。 */
export function isDazhouMcEntry(entry: Pick<TimelineEntry, 'title'>): boolean {
  return /大周MC|MC复兴大周|大周建国史/i.test(entry.title)
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
  const isDazhouMc = id === 'dazhou-mc'
  const entries = timeline
    .filter((e) => e.seriesName === name
      || e.tags.includes(name)
      || (isPishuang && isXinlingPishuangEntry(e))
      || (isDazhouMc && isDazhouMcEntry(e)))
    .sort((a, b) => a.date.localeCompare(b.date))

  const perYearMap = new Map<number, number>()
  for (const e of entries) {
    const y = Number(e.date.slice(0, 4))
    perYearMap.set(y, (perYearMap.get(y) ?? 0) + 1)
  }
  const perYear = [...perYearMap.entries()].map(([year, count]) => ({ year, count }))

  const games = [...new Set(entries.flatMap((e) => e.games.map((g) => g.name)))]
  const representativeCoverId = id === 'night-talk' ? '2016-10-20-video-01' : null
  const latestCoverEntry = id === 'press-events' ? [...entries].reverse().find((entry) => entry.cover) : null
  const coverEntry = latestCoverEntry
    ?? (representativeCoverId ? entries.find((entry) => entry.id === representativeCoverId) : null)
    ?? entries.find((entry) => entry.cover)

  return {
    id,
    name: getDisplayName(id, name),
    countsEpisodes: !ARCHIVE_BUCKETS.has(id) && id !== 'together-see',
    /*
     * 描述直接用 data/series.yaml 里的那一句，不再由代码覆盖。
     *
     * 原先 getDisplayDescription() 为心灵砒霜和一起 See 各拼一段带派生日期的文字，
     * 于是同一个字段有两个真相：数据里写一套、代码里又写一套，而页面上看到的是
     * 代码那套。一起 See 的那段说它「从斗鱼延续到抖音」——实际只在斗鱼，
     * 2017-12-17 ~ 2023-03-29，这个错就是这样藏了很久没人发现的。
     */
    description,
    entries,
    count: entries.length,
    firstDate: entries[0]?.date ?? '',
    lastDate: entries[entries.length - 1]?.date ?? '',
    perYear,
    firstTitle: entries[0]?.title ?? null,
    cover: coverEntry?.cover ? proxyImage(coverEntry.cover, 960) : null,
    category: getSeriesCategory(id, entries[0]?.type),
    games,
  }
}

/** 档案自己分出来的桶，不是她命名的节目。见 SeriesInfo.countsEpisodes。 */
const ARCHIVE_BUCKETS = new Set(['night-talk', 'outdoor-live', 'press-events'])

/**
 * 展示名。导出是因为 `/series/[id]/` 的 generateMetadata 拿不到 buildSeries 的结果
 * （那是页面组件里才算的），此前它直接用 series.yaml 的原始名，于是浏览器标签与
 * 社交卡片写「聊天」，页面正文的 h1 写「夜话 / 聊天」，同一个页面两个名字。
 * **注意它只能用来显示**：搜索、标签匹配一律用 series.yaml 里的原始名。
 */
export function seriesDisplayName(id: string, fallback: string): string {
  return getDisplayName(id, fallback)
}

function getDisplayName(id: string, fallback: string): string {
  if (id === 'night-talk') return '夜话 / 聊天'
  if (id === 'outdoor-live') return '户外直播'
  return fallback
}

function getSeriesCategory(id: string, firstType?: TimelineEntry['type']): SeriesInfo['category'] {
  if (id === 'xinling-pishuang') return 'long-running'
  if (id === 'xishuo-fengshen' || id === 'xishuo-liaozhai' || id === 'chiji-jiayuan') return 'themed'
  return firstType === 'video' ? 'video' : 'themed'
}
