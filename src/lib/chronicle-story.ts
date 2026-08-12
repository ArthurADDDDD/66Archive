import type { TimelineEntry } from './data'
import { proxyImage } from './platforms'
import { formatDuration } from './ui'

/**
 * 编年史 · 故事模式的数据层。
 * 事件两级：Hero（真正的重要节点）+ Secondary（值得展示）。
 * 硬规则（与 narrative.ts 相同）：
 * - CURATED 只引用真实条目 id，id 缺失时静默降级 + build warn。
 * - 派生事件的 kicker 只陈述可验证事实（最长的一晚 / 系列首期 / 开播周年），不编历史。
 * - 数字全部构建期从数据派生。
 * 2011 年档案为空（真实缺口）——故事模式如实展示，不假装。
 */

export type StoryEvent = {
  entryId: string
  date: string
  title: string
  /** 短眉标：策展或派生 */
  kicker: string
  /** 一句话：策展文案或派生事实 */
  line?: string
  cover: string | null
  href: string
  durationLabel?: string
  /** 是否是策展事件（决定默认展示顺序与强调） */
  curated: boolean
}

/**
 * 年份视觉层级（让故事模式的滚动节奏出现「大大小小」）：
 * - highlight：转折 / 起点类年份，配完整 Hero（封面 + 一句话 + Secondary）。
 * - normal：普通年份，紧凑 Hero 行（只有日期 + 眉标 + 标题），不占大版面。
 * - sparse：资料很少（<= 8 条）或为空的年份，只有一句诚实的注脚，不硬凑 Hero。
 * highlight 名单是策展决定（2010 第一支视频 / 2015 从录像到直播 / 2016 砒霜起点 /
 * 2017 几何冲刺马拉松 / 2023 斗鱼最后一晚 / 2024 又见面了 / 2025 重新开始的第二年）；
 * sparse 由数据决定（isEmpty 或条数过少），不靠人工。
 */
export type StoryYearKind = 'highlight' | 'normal' | 'sparse'

export type StoryYear = {
  year: number
  kind: StoryYearKind
  count: number
  /** 这一年已录时长（分钟，未知则 0） */
  durationMinutes: number
  /** 有时长记录的条数 */
  durationCount: number
  hero: StoryEvent | null
  secondary: StoryEvent[]
  /** 2011：档案为空的年份 */
  isEmpty: boolean
}

export type ChronicleStory = {
  years: StoryYear[]
  total: number
  latestYear: number
}

/** 值得完整 Hero 的年份（策展决定，见 StoryYearKind 注释）。 */
const HIGHLIGHT_YEARS = new Set([2010, 2015, 2016, 2017, 2023, 2024, 2025])

/** 资料少到不值得配 Hero 的阈值（条数），数据驱动，不人工指定年份 */
const SPARSE_MAX_COUNT = 8

/** 策展事件（id 全部来自数据核验；line 只陈述可核验事实）。 */
const CURATED_YEAR_EVENTS: Record<number, { hero?: StoryEventSeed; secondary?: StoryEventSeed[] }> = {
  2010: {
    hero: { entryId: '2010-05-08-video-01', kicker: '第一支视频', line: '大三那年上传的小游戏解说。一切从这里开始。' },
    secondary: [
      { entryId: '2010-06-30-video-01', kicker: '爆款', line: '第一次，有非常多人听见了她。' },
      { entryId: '2010-09-19-video-01', kicker: '系列解说' },
    ],
  },
  2012: {
    hero: { entryId: '2012-08-26-video-01', kicker: '停更前的最后一眼', line: '这一年的档案只有 4 条；之后是约 11 个月的停更。' },
  },
  2013: {
    hero: { entryId: '2013-09-30-video-01', kicker: '代表作', line: '恢复更新后的完整全流程，也是视频时代后期的代表作。' },
    secondary: [{ entryId: '2013-08-29-video-01', kicker: '恢复更新', line: '停更近一年后恢复更新的首作。' }],
  },
  2014: {
    hero: { entryId: '2014-12-25-video-01', kicker: '大结局', line: '视频时代最后一部完整全流程的收尾。' },
    secondary: [{ entryId: '2014-11-14-video-01', kicker: '栏目' }],
  },
  2015: {
    hero: { entryId: '2015-01-24-video-01', kicker: '从录像，到直播', line: '2015-01-21 斗鱼首播后的第一份直播录像。' },
  },
  2016: {
    hero: { entryId: '2016-08-07-live-01', kicker: '一个星期日', line: '心灵砒霜第一期。游戏暂停，邮件打开。' },
    secondary: [
      { entryId: '2016-04-29-live-01', kicker: '档案里的斗鱼起点', line: '档案从这一天开始记录斗鱼直播。' },
      { entryId: '2016-06-04-live-01', kicker: '执念', line: '几何冲刺，从这一晚开始。' },
    ],
  },
  2017: {
    hero: { entryId: '2017-02-16-live-01', kicker: '十多个小时的晚上', line: '几何冲刺的马拉松夜之一——这一场就打了 7 个多小时。' },
    secondary: [
      { entryId: '2017-01-21-live-01', kicker: '直播两周年' },
      { entryId: '2017-06-03-live-01', kicker: '最长的一晚', line: '《见证者》，568 分钟。' },
    ],
  },
  2018: {
    hero: { entryId: '2018-08-27-live-01', kicker: '高光', line: 'PlayStation 全球第 5 亿台纪念限定 PS4 Pro 的开箱之夜。' },
    secondary: [
      { entryId: '2018-01-21-live-03', kicker: '三周年' },
      { entryId: '2018-11-29-live-02', kicker: '古剑奇谭' },
    ],
  },
  2019: {
    hero: { entryId: '2019-01-21-live-01', kicker: '四周年' },
    secondary: [{ entryId: '2019-09-15-live-01', kicker: '最长的一期砒霜', line: '心灵砒霜 · 469 分钟。' }],
  },
  2020: {
    hero: { entryId: '2020-07-21-live-01', kicker: '这一年的游戏', line: '《对马岛之鬼》，396 分钟。' },
    secondary: [{ entryId: '2020-12-31-live-01', kicker: '跨年', line: '一起跨年的晚上。' }],
  },
  2021: {
    hero: { entryId: '2021-07-05-live-01', kicker: '最长的一晚', line: '出门走走逛逛，554 分钟。' },
    secondary: [{ entryId: '2021-05-29-live-01', kicker: '特别场' }],
  },
  2022: {
    hero: { entryId: '2022-10-05-live-01', kicker: '这一年最长的一晚', line: '《Brotato》，707 分钟。' },
  },
  2023: {
    hero: { entryId: '2023-11-30-live-01', kicker: '斗鱼最后一晚', line: '66聊聊——停播前的最后一场。' },
    secondary: [
      { entryId: '2023-11-29-live-01', kicker: 'see you around~' },
      { entryId: '2023-01-21-live-01', kicker: '八周年 · 除夕' },
    ],
  },
  2024: {
    hero: { entryId: '2024-08-18-live-01', kicker: '又见面了', line: '停播八个多月后，她回来了。' },
    secondary: [
      { entryId: '2024-02-29-live-01', kicker: '幕间唯一记录' },
      { entryId: '2024-12-10-live-02', kicker: '黑神话：悟空大更新' },
    ],
  },
  2025: {
    hero: { entryId: '2025-03-07-live-01', kicker: '重新开始的第二年', line: '《双人成行 2》，736 分钟。' },
  },
  2026: {
    hero: { entryId: '2026-02-27-live-01', kicker: '新作首播', line: '《生化危机 9》最高画质首播。' },
    secondary: [{ entryId: '2026-08-10-live-01', kicker: '就在前几天', line: '档案里最新的一条记录。' }],
  },
}

type StoryEventSeed = {
  entryId: string
  kicker: string
  line?: string
}

/** 派生眉标：只陈述数据里能验证的事实 */
function deriveKicker(entry: TimelineEntry, index: number): string {
  const milestone = entry.tags.find((t) => t === '首作' || t === '代表作' || t === '直播过渡')
  if (milestone) return milestone === '直播过渡' ? '转折' : milestone
  if (/周年/.test(entry.title)) return '周年'
  if (entry.seriesName && index === 0) return `${entry.seriesName} · 第一期`
  if (entry.duration_min && entry.duration_min >= 300) return '这一年最长的一晚'
  return entry.type === 'live' ? '直播' : '视频'
}

export function resolveChronicleStory(entries: TimelineEntry[]): ChronicleStory {
  const entryById = new Map(entries.map((e) => [e.id, e]))
  const byYear = new Map<number, TimelineEntry[]>()
  for (const e of entries) {
    const y = Number(e.date.slice(0, 4))
    if (!byYear.has(y)) byYear.set(y, [])
    byYear.get(y)!.push(e)
  }

  const firstYear = Math.min(...byYear.keys())
  const latestYear = Math.max(...byYear.keys())
  const years: StoryYear[] = []

  for (let year = firstYear; year <= latestYear; year++) {
    const list = (byYear.get(year) ?? []).sort((a, b) => a.date.localeCompare(b.date))
    if (list.length === 0) {
      years.push({ year, kind: 'sparse', count: 0, durationMinutes: 0, durationCount: 0, hero: null, secondary: [], isEmpty: true })
      continue
    }
    const kind: StoryYearKind =
      list.length <= SPARSE_MAX_COUNT && !HIGHLIGHT_YEARS.has(year)
        ? 'sparse'
        : HIGHLIGHT_YEARS.has(year)
          ? 'highlight'
          : 'normal'

    const durationMinutes = list.reduce((s, e) => s + (e.duration_min ?? 0), 0)
    const durationCount = list.filter((e) => e.duration_min).length
    const curated = CURATED_YEAR_EVENTS[year]

    const resolve = (seed: StoryEventSeed): StoryEvent | null => {
      const entry = entryById.get(seed.entryId)
      if (!entry) {
        if (process.env.NODE_ENV !== 'production') console.warn(`[chronicle-story] ${seed.entryId} 缺失，已跳过`)
        return null
      }
      return {
        entryId: entry.id,
        date: entry.date,
        title: entry.title,
        kicker: seed.kicker,
        line: seed.line,
        cover: entry.cover ? proxyImage(entry.cover, 640) : null,
        href: `/e/${entry.id}/`,
        durationLabel: entry.duration_min ? formatDuration(entry.duration_min) : undefined,
        curated: true,
      }
    }

    const used = new Set<string>()
    const hero = curated?.hero ? resolve(curated.hero) : null
    if (hero) used.add(hero.entryId)

    // 派生候选：按信号强度排序
    const derivedCandidates: TimelineEntry[] = [...list].sort((a, b) => {
      const aSig = signal(a)
      const bSig = signal(b)
      return bSig - aSig || (b.duration_min ?? 0) - (a.duration_min ?? 0)
    })

    const secondary: StoryEvent[] = []
    for (const seed of curated?.secondary ?? []) {
      if (secondary.length >= 2) break
      const ev = resolve(seed)
      if (ev && !used.has(ev.entryId)) {
        used.add(ev.entryId)
        secondary.push(ev)
      }
    }
    for (const entry of derivedCandidates) {
      if (secondary.length >= 2) break
      if (used.has(entry.id)) continue
      secondary.push({
        entryId: entry.id,
        date: entry.date,
        title: entry.title,
        kicker: deriveKicker(entry, list.indexOf(entry)),
        line: entry.duration_min ? undefined : undefined,
        cover: null,
        href: `/e/${entry.id}/`,
        durationLabel: entry.duration_min ? formatDuration(entry.duration_min) : undefined,
        curated: false,
      })
    }

    years.push({ year, kind, count: list.length, durationMinutes, durationCount, hero, secondary, isEmpty: false })
  }

  return { years, total: entries.length, latestYear }
}

/** 派生事件的信号分：里程碑 tag / 周年 / 长时长 / 系列首期 */
function signal(entry: TimelineEntry): number {
  let s = 0
  if (entry.tags.some((t) => t === '首作' || t === '代表作' || t === '直播过渡')) s += 5
  if (/周年|纪念|生日/.test(entry.title)) s += 3
  if (entry.duration_min && entry.duration_min >= 300) s += 2
  if (entry.seriesName) s += 1
  return s
}
