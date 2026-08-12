import type { Dataset, TimelineEntry } from './data'
import { proxyImage } from './platforms'
import { formatDuration } from './ui'

/**
 * 叙事层 · 策展内容（唯一的前端策展源）
 * ====================================
 * 只有这个文件里的文案与高光选择是「架构/前端」角色写的叙事内容。
 * 硬规则：
 * - 所有数字在构建期从数据派生（countBetween / tags / games 字段），文案禁止硬编码数字。
 * - 高光引用真实条目 id；id 缺失时 resolve 静默降级（条目自动从列表消失），绝不编造。
 * - 不修改 data/**，不动 schema —— 数据层原样保留。
 * - 日期一律用数据里的真实日期（如 PS4 开箱是 2018-08-27，不是流传记忆里的 2017）。
 */

export type ActId = 'act-i' | 'act-ii' | 'interlude' | 'act-iii'

export function actColor(id: ActId): string {
  return ACTS.find((a) => a.id === id)?.color ?? '#5A5F73'
}

/** 按日期返回所属幕的颜色；幕间年份返回 faint，作为留白。 */
export function actColorForDate(date: string): string {
  for (const a of ACTS) {
    if (a.id === 'interlude') continue
    if (date >= a.from && (!a.to || date <= a.to)) return a.color
  }
  return '#5A5F73'
}

export type Act = {
  id: ActId
  label: string
  years: string
  /** 起止（含），to 为空表示开放结束 */
  from: string
  to: string
  color: string
  kicker: string
  title: string
  body: string[]
  /** 这一幕的代表视觉（取该条目的 cover） */
  heroEntryId: string
  /** 这一幕内的高光条目（渲染在幕内的 beat 列表） */
  beatIds: string[]
}

/**
 * 三幕边界是策展的（历史事实，不是数据分布推导）：
 * - ACT I 至 2015-12-31：视频时代（优酷解说，档案完整 78 条）。
 * - ACT II 2016-01-01 起：档案里斗鱼直播实际从 2016-04-29 开始（首条 黑暗之魂3）；
 *   但 nvliu.me 与 2015-01-24 直播录像旁证 2015-01-21 已在斗鱼首播（见 data/references.yaml），
 *   所以文案如实说明「档案从 2016 记起」，不把档案缺口伪装成历史边界。
 * - 幕间 2023-12-01 ~ 2024-08-17：斗鱼合同到期停播，档案里只有 2024-02-29 一条语音直播。
 * - ACT III 2024-08-18 起：抖音首秀，开放结束（NOW）。
 */
export const ACTS: Act[] = [
  {
    id: 'act-i',
    label: '视频时代',
    years: '2010 — 2015',
    from: '2010-01-01',
    to: '2015-12-31',
    color: '#E0A244', // token: video
    kicker: 'ACT I · 视频时代',
    title: '一个人录视频的年代',
    body: [
      '早期互联网。一个大学生在优酷上传小游戏解说，低清截图、自制上传、一个麦克风。',
      '没有直播，没有弹幕，只有「被很多人看到」。',
    ],
    heroEntryId: '2010-05-08-video-01', // 迷画之塔
    beatIds: ['2010-05-08-video-01', '2010-06-30-video-01', '2015-01-24-video-01'],
  },
  {
    id: 'act-ii',
    label: '直播间 156277',
    years: '2016 — 2023',
    from: '2016-01-01',
    to: '2023-11-30',
    color: '#5BC8E8', // token: live
    kicker: 'ACT II · 直播间 156277',
    title: '大家一起经历得最久的一段',
    body: [
      '直播、游戏、水友、弹幕。很多个晚上。',
      '心灵砒霜从星期日开始，几何冲刺有过执念的几天，5 亿台纪念 PS4 Pro 的开箱也在这里。',
      '档案从 2016 年 4 月记起——而她 2015 年 1 月 21 日，就已经在斗鱼开播。',
    ],
    heroEntryId: '2016-08-07-live-01', // 心灵砒霜第一期
    beatIds: ['2016-06-04-live-01', '2016-08-07-live-01', '2018-08-27-live-01', '2023-11-30-live-01'],
  },
  {
    id: 'interlude',
    label: '幕间',
    years: '2023.11 — 2024.08',
    from: '2023-12-01',
    to: '2024-08-17',
    color: '#A78BFA',
    kicker: 'INTERLUDE · 幕间',
    title: '空白',
    body: [],
    heroEntryId: '2024-02-29-live-01', // 幕间唯一记录
    beatIds: ['2024-02-29-live-01'],
  },
  {
    id: 'act-iii',
    label: '又见面了',
    years: '2024 — ',
    from: '2024-08-18',
    to: '',
    color: '#FF6B75', // token: today
    kicker: 'ACT III · 又见面了',
    title: '还没有结束',
    body: [
      '新平台，新阶段，重新开始。',
      '依然在玩游戏，依然有人在看。故事正在发生。',
    ],
    heroEntryId: '2024-08-18-live-01', // 抖音首秀
    beatIds: ['2024-08-18-live-01', '2024-12-10-live-02'],
  },
]

export type Highlight = {
  id: string
  act: ActId
  /** 锚点条目；缺失时该高光静默降级 */
  entryId?: string
  /** 链接目标覆盖（默认 /e/{entryId}/） */
  href?: string
  date: string
  kicker: string
  title: string
  body: string
  /** 背景纹理数字；含 {var} 占位符时在构建期用派生值填充 */
  emphasis?: string
}

/**
 * 首页高光（9 个）。日期与事实全部对过数据：
 * - 迷画之塔 / 变态人生大冒险 / 2015.01 过渡 来自 video-era-milestones.yaml（首作/代表作/直播过渡 tags）。
 * - PS4 开箱真实日期 2018-08-27（条目 5亿台纪念限定PS4pro开箱）。
 * - 2024.12 黑神话：悟空大更新（2024-12-10 起连续多场，games 字段可证）。
 */
export const HIGHLIGHTS: Highlight[] = [
  {
    id: 'first-video',
    act: 'act-i',
    entryId: '2010-05-08-video-01',
    date: '2010.05.08',
    kicker: '第一支视频',
    title: '迷画之塔',
    body: '大三那年上传的小游戏解说。一切从这里开始。',
    emphasis: '首作 · 13 分钟',
  },
  {
    id: 'binge-game',
    act: 'act-i',
    entryId: '2010-06-30-video-01',
    date: '2010.06.30',
    kicker: '爆款',
    title: '变态人生大冒险',
    body: '第一次，有非常多人听见了她。',
    emphasis: '210 万+ 播放',
  },
  {
    id: 'video-to-live',
    act: 'act-i',
    entryId: '2015-01-24-video-01',
    date: '2015.01',
    kicker: '转身',
    title: '从录像，到直播',
    body: '以前，大家看到的是已经录好的游戏。从这里开始，大家开始一起玩。',
    emphasis: '2015-01-21 首播',
  },
  {
    id: 'geometry-dash',
    act: 'act-ii',
    entryId: '2016-06-04-live-01',
    href: '/games/geometry-dash/',
    date: '2016.06',
    kicker: '执念',
    title: '几何冲刺',
    body: '那些反复重来的晚上，加起来十多个小时。',
    emphasis: '{geometryHours} 个小时',
  },
  {
    id: 'xinling-pishuang',
    act: 'act-ii',
    entryId: '2016-08-07-live-01',
    date: '2016.08.07',
    kicker: '一个星期日',
    title: '心灵砒霜 · 第一期',
    body: '游戏暂停。邮件打开。一个星期日。',
    emphasis: '{xinlingCount} 个被保存下来的晚上',
  },
  {
    id: 'ps4',
    act: 'act-ii',
    entryId: '2018-08-27-live-01',
    date: '2018.08.27',
    kicker: '高光',
    title: '5 亿台纪念限定 PS4 Pro 开箱',
    body: 'PlayStation 全球第 5 亿台纪念机型的开箱之夜。',
    emphasis: '2018',
  },
  {
    id: 'back-again',
    act: 'act-iii',
    entryId: '2024-08-18-live-01',
    date: '2024.08.18',
    kicker: '第三幕',
    title: '又见面了。',
    body: '停播八个多月后，她回来了。',
    emphasis: '2024-08-18',
  },
  {
    id: 'douyin-winter',
    act: 'act-iii',
    entryId: '2024-12-10-live-02',
    date: '2024.12',
    kicker: '新阶段',
    title: '黑神话：悟空 · 大更新',
    body: '重新开始的第一个冬天，她还在打游戏。',
    emphasis: '{wukongCount} 场 · 十二月',
  },
]

/** 幕间：空白本身就是设计。两行字 + 一条数据事实。 */
export const INTERLUDE = {
  firstDate: '2023.11.29',
  firstWord: 'see you around~',
  lastDate: '2024.08.18',
  lastWord: '又见面了。',
  /** 幕间唯一记录的诚实说明（数字构建期派生） */
  loneEntryId: '2024-02-29-live-01',
}

/** 未登记入 games.yaml 的策展游戏（几何冲刺等）。仅这里的 id 允许标题匹配，禁止全库猜标题。 */
export type CuratedGame = {
  id: string
  name: string
  aliases: string[]
  /** 一句话，占位符 {hours} 在构建期填充为派生总时长 */
  oneLiner: string
  /** 标题匹配规则（仅策展 id 可用） */
  entryTitlePattern: RegExp
  /** 覆盖现实说明，展示在详情页数据说明处 */
  note: string
}

export const CURATED_GAMES: Record<string, CuratedGame> = {
  'geometry-dash': {
    id: 'geometry-dash',
    name: '几何冲刺',
    aliases: ['Geometry Dash'],
    oneLiner: '从 2016 到 2017，几个晚上，加起来 {hours} 个小时。',
    entryTitlePattern: /几何冲刺/,
    note: '《几何冲刺》尚未登记入 data/games.yaml（待数据角色补录）；本站以标题匹配归档相关场次。',
  },
}

// ---------------------------------------------------------------------------
// 解析层（仅服务端组件调用，构建期执行）
// ---------------------------------------------------------------------------

export type ResolvedBeat = {
  id: string
  act: ActId
  date: string
  kicker: string
  title: string
  body: string
  href: string
  cover: string | null
  entryId: string | null
  emphasis?: string
}

export type ResolvedAct = {
  act: Act
  count: number
  heroCover: string | null
  heroEntry: TimelineEntry | null
  /** 这一幕内的高光（已解析，id 缺失自动剔除） */
  beats: ResolvedBeat[]
}

export type NowNode = {
  year: string
  label: string
  count: number
}

export type HomepageData = {
  acts: ResolvedAct[]
  interlude: { count: number; loneEntry: TimelineEntry | null }
  highlights: ResolvedBeat[]
  now: NowNode
  totals: { entries: number; years: number; series: number }
  /** 实际有数据的年份（升序，用于留白年份推导） */
  years: string[]
}

function countBetween(entries: TimelineEntry[], from: string, to: string): number {
  if (!to) return entries.filter((e) => e.date >= from).length
  return entries.filter((e) => e.date >= from && e.date <= to).length
}

function fillEmphasis(template: string | undefined, vars: Record<string, string>): string | undefined {
  if (!template) return undefined
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

/** 高光强调数字的派生变量（全部来自数据） */
function emphasisVars(ds: Dataset, timeline: TimelineEntry[]) {
  const geometry = timeline.filter((e) => e.title.includes('几何冲刺'))
  const geometryMinutes = geometry.reduce((sum, e) => sum + (e.duration_min ?? 0), 0)
  const xinlingCount = timeline.filter((e) => e.tags.includes('心灵砒霜')).length
  const wukongCount = timeline.filter((e) => e.games.some((g) => g.id === 'black-myth-wukong')).length
  return {
    geometryHours: Math.round(geometryMinutes / 60).toString(),
    xinlingCount: xinlingCount.toLocaleString(),
    wukongCount: wukongCount.toString(),
  }
}

export function resolveHomepage(ds: Dataset, timeline: TimelineEntry[]): HomepageData {
  const entryById = new Map(timeline.map((e) => [e.id, e]))
  const vars = emphasisVars(ds, timeline)
  const latestYear = timeline[0]?.date.slice(0, 4) ?? new Date().getFullYear().toString()
  const years = new Set(timeline.map((e) => e.date.slice(0, 4))).size

  const resolveBeat = (h: Highlight): ResolvedBeat[] => {
    const entry = h.entryId ? entryById.get(h.entryId) ?? null : null
    if (h.entryId && !entry) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[narrative] 高光 ${h.id} 锚点条目缺失: ${h.entryId}`)
      return []
    }
    return [
      {
        id: h.id,
        act: h.act,
        date: h.date,
        kicker: h.kicker,
        title: h.title,
        body: h.body,
        href: h.href ?? (entry ? `/e/${entry.id}/` : '/chronicle/'),
        cover: entry?.cover ? proxyImage(entry.cover ?? undefined, 640) : null,
        entryId: entry?.id ?? null,
        emphasis: fillEmphasis(h.emphasis, vars),
      },
    ]
  }

  const acts: ResolvedAct[] = ACTS.map((act) => {
    const heroEntry = entryById.get(act.heroEntryId) ?? null
    return {
      act,
      count: countBetween(timeline, act.from, act.to),
      heroCover: heroEntry?.cover ? proxyImage(heroEntry.cover ?? undefined, 900) : null,
      heroEntry,
      beats: act.beatIds.flatMap((entryId) => {
        const h = HIGHLIGHTS.find((x) => x.entryId === entryId || (x.href && x.href.includes(entryId)))
        return h ? resolveBeat(h) : []
      }),
    }
  })

  const highlights: ResolvedBeat[] = HIGHLIGHTS.flatMap((h) => {
    const entry = h.entryId ? entryById.get(h.entryId) ?? null : null
    if (h.entryId && !entry) {
      // id 缺失 → 静默降级（构建期 warn）
      if (process.env.NODE_ENV !== 'production') console.warn(`[narrative] 高光 ${h.id} 锚点条目缺失: ${h.entryId}`)
      return []
    }
    return [
      {
        id: h.id,
        act: h.act,
        date: h.date,
        kicker: h.kicker,
        title: h.title,
        body: h.body,
        href: h.href ?? (entry ? `/e/${entry.id}/` : '/chronicle/'),
        cover: entry?.cover ? proxyImage(entry.cover ?? undefined, 640) : null,
        entryId: entry?.id ?? null,
        emphasis: fillEmphasis(h.emphasis, vars),
      },
    ]
  })

  const interlude = ACTS.find((a) => a.id === 'interlude')!
  const loneEntry = entryById.get(INTERLUDE.loneEntryId) ?? null

  return {
    acts,
    interlude: { count: countBetween(timeline, interlude.from, interlude.to), loneEntry },
    highlights,
    now: {
      year: latestYear,
      label: '还在继续。',
      count: countBetween(timeline, '2024-08-18', ''),
    },
    totals: { entries: timeline.length, years, series: ds.series.size },
    years: [...new Set(timeline.map((e) => e.date.slice(0, 4)))].sort(),
  }
}

/** 首页高光的总时长文案（几何冲刺 beat 用） */
export function geometryDashTotalHours(timeline: TimelineEntry[]): number {
  const minutes = timeline.filter((e) => e.title.includes('几何冲刺')).reduce((s, e) => s + (e.duration_min ?? 0), 0)
  return Math.round(minutes / 60)
}

/** 游戏详情页数据（games/[id] 用）：字段匹配 ∪ 策展标题匹配 */
export type GameProfile = {
  id: string
  name: string
  aliases: string[]
  curated?: CuratedGame
  entries: TimelineEntry[]
  firstDate: string | null
  lastDate: string | null
  sessions: number
  totalMinutes: number
  hoursLabel: string
  cover: string | null
  /** 策展一句话（{hours} 已填充）；注册游戏为 null，页面上用数据行替代 */
  oneLiner: string | null
}

export function getGameProfile(ds: Dataset, timeline: TimelineEntry[], gameId: string): GameProfile | null {
  const registered = ds.games.get(gameId)
  const curated = CURATED_GAMES[gameId]
  if (!registered && !curated) return null

  const matches = timeline.filter((e) => {
    if (e.games.some((g) => g.id === gameId)) return true
    if (curated && curated.entryTitlePattern.test(e.title)) return true
    return false
  })

  const totalMinutes = matches.reduce((sum, e) => sum + (e.duration_min ?? 0), 0)
  const latestCover = matches.find((e) => e.cover)?.cover ?? null
  const name = curated?.name ?? registered?.name ?? gameId
  const oneLiner = curated
    ? curated.oneLiner.replace('{hours}', Math.round(totalMinutes / 60).toString())
    : null

  return {
    id: gameId,
    name,
    aliases: curated?.aliases ?? registered?.aliases ?? [],
    curated,
    entries: matches,
    firstDate: matches.length ? matches[matches.length - 1].date : null, // timeline 降序，最后一个是首次
    lastDate: matches[0]?.date ?? null,
    sessions: matches.length,
    totalMinutes,
    hoursLabel: formatDuration(totalMinutes),
    cover: latestCover ? proxyImage(latestCover ?? undefined, 900) : null,
    oneLiner,
  }
}
