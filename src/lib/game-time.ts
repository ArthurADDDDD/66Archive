/**
 * 游戏环节时长与精准跳转的唯一计算入口。口径定义见 docs/game-time.md，这里只实现它。
 *
 * 每一场 × 每款游戏只会落进三档之一，前台不得自行换算：
 * - 已核实（verifiedSec）：时间轴里两端 ≤1 分钟、内部已检查的游戏环节。唯一能叫「游玩时长」的数字。
 * - 关联录像（associatedSec，包含已核实）：边界只到分 P 的环节，或只挂一款游戏的整场录像。
 * - 未知：多游戏场次没有时间轴、缺时长、录像不全。只计场次，不计入任何小时数；
 *   可能属于这款游戏的上限另记在 unknownUpperSec / upperOpen，供界面画区间。
 *
 * 纯函数，不读文件；数据由调用方传入（data.ts 的 getGameTimelines）。
 */
import { toSeconds, type GameTimeline, type TimelineSpan } from './schema'

/** 「游玩时长排行」开放门槛：已核实时长至少占关联录像时长的比例。 */
export const PLAYTIME_RANK_MIN_VERIFIED_SHARE = 0.8

export type GameJump = {
  url: string
  platform: 'bilibili' | 'acfun'
  page: number
  offsetSec: number
  precision: TimelineSpan['precision']
  /** 链接能不能直接落到秒；A 站只能落到分 P 开头，part 精度也只给分 P。 */
  seeks: boolean
}

export type SessionGameTime = {
  entryId: string
  /** timeline = 按时间轴；single = 只挂这一款游戏的整场；none = 归属未知 */
  basis: 'timeline' | 'single' | 'none'
  verifiedSec: number
  associatedSec: number
  /** 归属不明、但可能属于这款游戏的时长上限（未拆分场次的整场、时间轴里的 unknown 环节）。 */
  unknownUpperSec: number
  /** 还有长度不明的部分（缺时长、录像不是整场）。 */
  upperOpen: boolean
  /** 这一场的数字只是下限（录像不全或有未核对环节）。 */
  lowerBound: boolean
  jump: GameJump | null
}

export type GameTimeSummary = {
  sessions: number
  /** 时长归属已知的场次：有时间轴，或只挂这一款游戏且有时长。 */
  attributedSessions: number
  timelineSessions: number
  /** 归属未知的场次：多游戏未拆分，或缺时长。 */
  unattributedSessions: number
  lowerBoundSessions: number
  verifiedSec: number
  associatedSec: number
  unknownUpperSec: number
  upperOpen: boolean
  /** verifiedSec / associatedSec；associatedSec 为 0 时为 0。 */
  verifiedShare: number
  /** 只有它为 true 时，界面才能出现「游玩时长」排行。 */
  playtimeRankable: boolean
  perSession: SessionGameTime[]
}

/** 计时所需的最小场次信息（TimelineEntry 天然满足）。 */
export type SessionInput = {
  id: string
  games: { id: string }[]
  duration_min?: number
}

const BV = /BV[0-9A-Za-z]{10}/
const AC = /acfun\.cn\/v\/ac(\d+)/

/** 从基准来源 url 取出跳转需要的视频标识；取不出来返回 null（validate 据此报错）。 */
export function parseBasis(url: string): { platform: 'bilibili'; bvid: string } | { platform: 'acfun'; ac: string } | null {
  if (/bilibili\.com\//.test(url)) {
    const m = url.match(BV)
    return m ? { platform: 'bilibili', bvid: m[0] } : null
  }
  const m = url.match(AC)
  return m ? { platform: 'acfun', ac: m[1] } : null
}

export function buildJump(basis: string, page: number, offsetSec: number, precision: TimelineSpan['precision']): GameJump | null {
  const parsed = parseBasis(basis)
  if (!parsed) return null
  if (parsed.platform === 'bilibili') {
    // B 站 p 越界会退回 P1 而 t 照样生效，所以页号必须来自时间轴快照，这里不做任何推断。
    const seeks = precision !== 'part' && offsetSec > 0
    const url = `https://www.bilibili.com/video/${parsed.bvid}/?p=${page}${seeks ? `&t=${offsetSec}` : ''}`
    return { url, platform: 'bilibili', page, offsetSec, precision, seeks }
  }
  // A 站 `_N` 是 videoList 数组序；没有可用的秒级参数。
  const url = `https://www.acfun.cn/v/ac${parsed.ac}${page > 1 ? `_${page}` : ''}`
  return { url, platform: 'acfun', page, offsetSec, precision, seeks: false }
}

export function recordedSec(timeline: GameTimeline): number {
  return timeline.parts.reduce((sum, part) => sum + part.duration_sec, 0)
}

/** startChecked / endChecked：这一端是否由人工在录像里定位到 ≤1 分钟（录像本身的开头结尾天然确定）。 */
type ResolvedSpan = { span: TimelineSpan; startSec: number; endSec: number; startChecked: boolean; endChecked: boolean }

/** 把环节换算到基准录像的时间上：起点 = 前面分 P 时长之和 + 分 P 内时间。 */
export function resolveSpans(timeline: GameTimeline): ResolvedSpan[] {
  const partStart = new Map<number, number>()
  let cursor = 0
  for (const part of timeline.parts) {
    partStart.set(part.page, cursor)
    cursor += part.duration_sec
  }
  const total = cursor
  // 已核实只认人工：缩略图、弹幕给出的分钟级位置再准，也只是关联录像
  const checked = (s: TimelineSpan) => s.precision !== 'part' && s.evidence === 'human_watch'
  return timeline.spans.map((span, i) => {
    const next = timeline.spans[i + 1]
    const startSec = (partStart.get(span.page) ?? 0) + toSeconds(span.at)
    const endSec = next ? (partStart.get(next.page) ?? 0) + toSeconds(next.at) : total
    return {
      span,
      startSec,
      endSec,
      // 录像开头与结尾本身是确定的：第一个环节的起点、最后一个环节的终点都算已定位。
      startChecked: i === 0 || checked(span),
      endChecked: next ? checked(next) : true,
    }
  })
}

function fromTimeline(session: SessionInput, gameId: string, timeline: GameTimeline): SessionGameTime {
  let verifiedSec = 0
  let associatedSec = 0
  let unknownUpperSec = 0
  let jump: GameJump | null = null
  for (const r of resolveSpans(timeline)) {
    const length = r.endSec - r.startSec
    if (r.span.kind === 'unknown') {
      unknownUpperSec += length
      continue
    }
    if (r.span.game !== gameId) continue
    associatedSec += length
    if (r.startChecked && r.endChecked && r.span.scanned) verifiedSec += length
    jump ??= buildJump(timeline.basis, r.span.page, toSeconds(r.span.at), r.span.precision)
  }
  const partial = timeline.coverage !== 'complete'
  return {
    entryId: session.id,
    basis: 'timeline',
    verifiedSec,
    associatedSec,
    unknownUpperSec,
    upperOpen: partial,
    lowerBound: partial || unknownUpperSec > 0,
    jump,
  }
}

/** 一场里某款游戏的时长归属。`gameId` 可以不在 session.games 里（策展游戏按标题匹配的场次）。 */
export function sessionGameTime(session: SessionInput, gameId: string, timeline?: GameTimeline): SessionGameTime {
  if (timeline) return fromTimeline(session, gameId, timeline)
  const gameCount = new Set([...session.games.map((g) => g.id), gameId]).size
  const durationSec = session.duration_min ? session.duration_min * 60 : null
  const base = { entryId: session.id, verifiedSec: 0, associatedSec: 0, unknownUpperSec: 0, upperOpen: false, lowerBound: false, jump: null }
  if (durationSec === null) return { ...base, basis: 'none', upperOpen: true }
  if (gameCount === 1) return { ...base, basis: 'single', associatedSec: durationSec }
  return { ...base, basis: 'none', unknownUpperSec: durationSec }
}

export function summarizeGameTime(
  gameId: string,
  sessions: SessionInput[],
  timelinesByEntry: ReadonlyMap<string, GameTimeline>,
): GameTimeSummary {
  const perSession = sessions.map((s) => sessionGameTime(s, gameId, timelinesByEntry.get(s.id)))
  const sum = (pick: (s: SessionGameTime) => number) => perSession.reduce((total, s) => total + pick(s), 0)
  const verifiedSec = sum((s) => s.verifiedSec)
  const associatedSec = sum((s) => s.associatedSec)
  const unknownUpperSec = sum((s) => s.unknownUpperSec)
  const upperOpen = perSession.some((s) => s.upperOpen)
  const unattributedSessions = perSession.filter((s) => s.basis === 'none').length
  const lowerBoundSessions = perSession.filter((s) => s.lowerBound).length
  const verifiedShare = associatedSec > 0 ? verifiedSec / associatedSec : 0
  return {
    sessions: perSession.length,
    attributedSessions: perSession.length - unattributedSessions,
    timelineSessions: perSession.filter((s) => s.basis === 'timeline').length,
    unattributedSessions,
    lowerBoundSessions,
    verifiedSec,
    associatedSec,
    unknownUpperSec,
    upperOpen,
    verifiedShare,
    playtimeRankable:
      perSession.length > 0 &&
      unattributedSessions === 0 &&
      lowerBoundSessions === 0 &&
      unknownUpperSec === 0 &&
      !upperOpen &&
      associatedSec > 0 &&
      verifiedShare >= PLAYTIME_RANK_MIN_VERIFIED_SHARE,
    perSession,
  }
}

export function indexTimelines(timelines: GameTimeline[]): Map<string, GameTimeline> {
  return new Map(timelines.map((t) => [t.entry, t]))
}
