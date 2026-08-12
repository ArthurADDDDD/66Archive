import { z } from 'zod'

/**
 * 全项目的数据契约。
 *
 * ⚠️ 本文件只由「架构角色」修改（见 AGENTS.md）。
 * 其他 Agent 需要新字段时走 docs/rfc/ 流程，不要私自增删。
 * 任何改动必须同步更新 docs/02-功能设计.md 的数据模型章节。
 */

export const PLATFORMS = ['youku', 'bilibili', 'youtube', 'douyu', 'douyin'] as const
export const Platform = z.enum(PLATFORMS)
export type Platform = z.infer<typeof Platform>

/** 置信度：拿不准的数据必须降级，禁止用推测填充历史 */
export const Confidence = z.enum(['high', 'medium', 'low'])
export type Confidence = z.infer<typeof Confidence>

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须是 YYYY-MM-DD')
const monthStr = z.string().regex(/^\d{4}-\d{2}$/, '年月必须是 YYYY-MM')
const clockStr = z.string().regex(/^\d{2}:\d{2}$/, '时间必须是 HH:MM')
/** 片段起点用 HH:MM:SS，因为直播动辄跨 10 小时 */
const timecodeStr = z
  .string()
  .regex(/^\d{2,3}:\d{2}:\d{2}$/, '时间码必须是 HH:MM:SS')
const idStr = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'id 只能是小写字母、数字与连字符')

/** 账号。fan-archive 是网友录播搬运号——直播期的主要资源入口，必须建模 */
export const Account = z.object({
  id: idStr,
  platform: Platform,
  name: z.string().min(1),
  url: z.string().url(),
  role: z.enum(['official', 'mirror', 'fan-archive']),
  active_from: monthStr.optional(),
  active_to: monthStr.optional(),
  confidence: Confidence.default('medium'),
  note: z.string().optional(),
})
export type Account = z.infer<typeof Account>

export const Game = z.object({
  id: idStr,
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  cover: z.string().optional(),
  /**
   * 游戏的公开发售日（客观资料，和 name/aliases 同一性质，与她的游玩记录无关）。
   *
   * 加这个字段是为了让"她是发售当天就播了，还是六年以后才玩"这一层能算出来
   * （见 docs/redesign/01-vision.md 第六节）。**可选，且必须逐个核实**：
   * 没核实的一律留空，前端在缺这个值时不显示该行，不会露馅，也不许拿"合理推测"填。
   * 同一作品多平台 / 多地区发售日不同时，取全球首发日，并在 note 里写清取的是哪个。
   */
  released: dateStr.optional(),
  note: z.string().optional(),
})
export type Game = z.infer<typeof Game>

export const Series = z.object({
  id: idStr,
  name: z.string().min(1),
  game: idStr.optional(),
  description: z.string().optional(),
})
export type Series = z.infer<typeof Series>

/**
 * 一个资源源。同一场直播的官方回放与各路网友录播都挂在同一条目下，
 * 不拆成多条——否则时间轴上一场会重复出现四次。
 */
export const Source = z.object({
  url: z.string().url(),
  account: idStr.optional(),
  kind: z.enum(['original', 'replay', 'clip', 'reupload']),
  parts: z.number().int().positive().optional(),
  /** 存活状态由 scripts/check-links 定期回写，采集时留空即可 */
  status: z.enum(['alive', 'dead', 'unchecked']).default('unchecked'),
  note: z.string().optional(),
})
export type Source = z.infer<typeof Source>

/**
 * 分段：这场几点开始打什么。
 * 本站的核心诉求「每一次直播播了什么游戏」由它承载，
 * 同时驱动详情页的分段进度条与带时间戳的外链跳转。
 */
export const Segment = z.object({
  at: timecodeStr,
  game: idStr.nullable().optional(),
  label: z.string().min(1),
})
export type Segment = z.infer<typeof Segment>

export const Entry = z
  .object({
    id: idStr,
    type: z.enum(['live', 'video']),
    date: dateStr,
    time: clockStr.optional(),
    title: z.string().min(1),
    platform: Platform,
    duration_min: z.number().int().positive().optional(),
    series: idStr.optional(),
    games: z.array(idStr).default([]),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    confidence: Confidence.default('medium'),
    sources: z.array(Source).default([]),
    segments: z.array(Segment).default([]),
    contributed_by: z.string().optional(),
    note: z.string().optional(),
    /** 仅供演示数据使用；真实条目不得设置 */
    demo: z.literal(true).optional(),
  })
  .superRefine((e, ctx) => {
    // segments 必须时间递增，否则进度条会画反
    for (let i = 1; i < e.segments.length; i++) {
      if (toSeconds(e.segments[i].at) <= toSeconds(e.segments[i - 1].at)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['segments', i, 'at'],
          message: `分段时间必须递增（${e.segments[i - 1].at} → ${e.segments[i].at}）`,
        })
      }
    }
    // segments 里出现的游戏必须也列在 games 里，保证筛选不漏
    for (const s of e.segments) {
      if (s.game && !e.games.includes(s.game)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['games'],
          message: `分段引用了 "${s.game}"，但它不在 games 列表里`,
        })
      }
    }
  })
export type Entry = z.infer<typeof Entry>

export function toSeconds(tc: string): number {
  const [h, m, s] = tc.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

export const AccountsFile = z.array(Account)
export const GamesFile = z.array(Game)
export const SeriesFile = z.array(Series)
export const EntriesFile = z.array(Entry)
