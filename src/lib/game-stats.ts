import type { Dataset, TimelineEntry } from './data'
import { toTimelineEntries } from './data'
import type { Binge, Comeback, GameStats } from './game-stats-format'
import { daysBetween } from './game-stats-format'

export type { GameStats, Binge, Comeback } from './game-stats-format'
export { formatGameDuration, formatHours, formatBoarding, daysBetween, gameFace, toGameCard } from './game-stats-format'

/** 两场之间断了这么多天以上，才算一次"回坑"值得说出来。 */
const COMEBACK_MIN_DAYS = 180
/** 两场之间不超过这么多天，算同一段"连着打"。 */
const BINGE_TOLERANCE_DAYS = 7

/**
 * 找出最长的一次中断。
 * "隔了 2,370 天，她又打开了《节奏天国》" —— 这一句是整个游戏库最有力的一句话，
 * 而它完全是算出来的，不需要任何人工标注。
 */
function findComeback(ascending: TimelineEntry[]): Comeback | undefined {
  let best: Comeback | undefined
  for (let i = 1; i < ascending.length; i++) {
    const gapDays = daysBetween(ascending[i - 1].date, ascending[i].date)
    if (gapDays >= COMEBACK_MIN_DAYS && gapDays > (best?.gapDays ?? 0)) {
      best = { gapDays, before: ascending[i - 1], after: ascending[i] }
    }
  }
  return best
}

/** 找出场次最多的那一段"连着打"。 */
function findBinge(ascending: TimelineEntry[]): Binge | undefined {
  if (ascending.length === 0) return undefined
  let best: TimelineEntry[] = []
  let run: TimelineEntry[] = [ascending[0]]
  const close = () => {
    if (run.length > best.length) best = run
  }
  for (let i = 1; i < ascending.length; i++) {
    if (daysBetween(ascending[i - 1].date, ascending[i].date) <= BINGE_TOLERANCE_DAYS) {
      run.push(ascending[i])
    } else {
      close()
      run = [ascending[i]]
    }
  }
  close()
  if (best.length < 3) return undefined
  return {
    from: best[0].date,
    to: best[best.length - 1].date,
    spanDays: daysBetween(best[0].date, best[best.length - 1].date) + 1,
    sessions: best.length,
    knownMinutes: best.reduce((n, e) => n + (e.duration_min ?? 0), 0),
  }
}

/**
 * 按游戏聚合出场记录。只统计 toTimelineEntries 去重后的场次，
 * 避免同一场直播的备用录播源把出场次数算重。
 * 只能在服务端组件使用 —— 依赖 data.ts 的 fs 读取。
 *
 * 结果按数据集缓存：静态导出时 /games/[id] 有 499 个页面，
 * 每页各算一遍全库会把 build 拖成几分钟。
 */
const cache = new WeakMap<Dataset, GameStats[]>()

export function buildGameStats(ds: Dataset): GameStats[] {
  const cached = cache.get(ds)
  if (cached) return cached

  const entries = toTimelineEntries(ds)
  const byGame = new Map<string, TimelineEntry[]>()
  for (const e of entries) {
    for (const g of e.games) {
      if (!byGame.has(g.id)) byGame.set(g.id, [])
      byGame.get(g.id)!.push(e)
    }
  }

  const stats: GameStats[] = []
  for (const game of ds.games.values()) {
    const list = [...(byGame.get(game.id) ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    const ascending = [...list].reverse()
    const durations = list.filter((e) => e.duration_min)
    const first = ascending[0]
    const last = ascending[ascending.length - 1]

    stats.push({
      id: game.id,
      name: game.name,
      aliases: game.aliases,
      cover: game.cover,
      note: game.note,
      released: game.released,
      sessionCount: list.length,
      knownDurationMin: durations.reduce((n, e) => n + (e.duration_min ?? 0), 0),
      knownDurationCount: durations.length,
      firstDate: first?.date ?? '',
      lastDate: last?.date ?? '',
      platforms: [...new Set(list.map((e) => e.platform))],
      entries: list,
      first,
      last,
      spanDays: first && last ? daysBetween(first.date, last.date) : 0,
      comeback: findComeback(ascending),
      binge: findBinge(ascending),
      daysFromRelease: game.released && first ? daysBetween(game.released, first.date) : undefined,
    })
  }

  const sorted = stats.sort((a, b) => b.sessionCount - a.sessionCount)
  cache.set(ds, sorted)
  return sorted
}

export function findGameStats(ds: Dataset, id: string): GameStats | undefined {
  return buildGameStats(ds).find((g) => g.id === id)
}

export type GameSegment = { entryId: string; date: string; at: string; label: string; count: number }

function normalizeLabel(label: string): string {
  // 录播分 P 前缀（P2- / P1.1- / Part3 / 24- ）和日期段是录制流程的产物，不是她打了什么。
  let out = label
  out = out.replace(/^(?:part|p)\s?\d+(\.\d+)?[-.\s]*/i, '')
  out = out.replace(/^\d{1,4}[-.]\d{1,2}(?:[-.]\d{1,2})?[-.\s]*/g, '')
  out = out.replace(/^\d+[-.\s]+/, '')
  out = out.replace(/[-\s]*day\s?\d+$/i, '')
  return out.replace(/^[-.\s]+|[-.\s]+$/g, '').trim()
}

/**
 * 这个游戏下面，分段里真正说了点什么的那些标签。
 *
 * 两件必须做对的事：
 *
 * 1. **段没写 game 字段时的归属。** 2016 年那批黑魂 3 的分段（`灰烬审判者古达P1`、
 *    `冷冽谷的波尔多P2`）根本没填 `segment.game`——只按 `s.game === id` 过滤会把
 *    全站最好的那批标签整个漏掉。所以：段自己指名了就按它，没指名、而且这一场只挂了
 *    这一个游戏，才算它的。挂了多个游戏又没指名的，不猜，丢掉。
 * 2. **把只是重复游戏名的标签滤掉。** 大量分段就写着"节奏天国""Elden Ring"，
 *    列出来是噪音。只留下比游戏名多说了一句的那些，剩不下就整段不显示。
 */
export function gameSegments(ds: Dataset, id: string): GameSegment[] {
  const game = ds.games.get(id)
  const known = new Set([game?.name ?? id, id, ...(game?.aliases ?? [])].map((s) => s.toLowerCase()))

  const found = new Map<string, GameSegment>()
  for (const e of ds.entries) {
    if (!e.games.includes(id)) continue
    for (const s of e.segments) {
      const ownedByThisGame = s.game === id || (!s.game && e.games.length === 1)
      if (!ownedByThisGame) continue
      const label = normalizeLabel(s.label)
      if (!label || known.has(label.toLowerCase())) continue
      const existing = found.get(label)
      if (existing) {
        existing.count++
        if (e.date < existing.date) Object.assign(existing, { entryId: e.id, date: e.date, at: s.at })
      } else {
        found.set(label, { entryId: e.id, date: e.date, at: s.at, label, count: 1 })
      }
    }
  }
  return [...found.values()].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))
}

