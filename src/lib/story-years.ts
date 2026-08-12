import type { TimelineEntry } from './data'
import { actColorForDate, type ResolvedAct, type ResolvedBeat } from './narrative'

/**
 * 故事模式的年份编排。
 *
 * 视觉回到「年份脊柱」那一版（大年份左栏 + 一条竖线 + 每年少量代表条目），
 * 但**选条目的权力仍然在 STORY_ACTS**——这里不重新挑内容，只把已经策展好的 beats
 * 按年份归位，再补上该年的档案计数。所以改 narrative.ts 的策展列表，这里就跟着变。
 *
 * 年份分三档制造滚动节奏：
 *   highlight：这一年有大条目（hero / type / montage）——完整展开。
 *   normal：这一年只有小条目——紧凑一行。
 *   sparse：这一年没有策展条目——只留一句诚实的注脚 + 去档案的入口。
 * 档案为空的年份（2011）如实展示为缺口，不假装。
 */

export type StoryYearKind = 'highlight' | 'normal' | 'sparse'

export type StoryYear = {
  year: number
  kind: StoryYearKind
  /** 该年档案条目数（真实计数，不是策展条目数） */
  count: number
  durationMinutes: number
  durationCount: number
  isEmpty: boolean
  hero: ResolvedBeat | null
  secondary: ResolvedBeat[]
  accent: string
}

/** beat.date 形如 2010.05.08 / 2016.08 / 2015 / 2013—14 / ~2016—17，取第一个四位年份。 */
export function beatYear(date: string): number | null {
  const m = date.match(/\d{4}/)
  return m ? Number(m[0]) : null
}

/** 大条目优先级：hero > type > montage > small。同级取策展顺序里靠前的。 */
const SIZE_RANK: Record<string, number> = { hero: 0, type: 1, montage: 2, small: 3 }

export function buildStoryYears(acts: ResolvedAct[], timeline: TimelineEntry[]): StoryYear[] {
  // 1. 档案侧：每年的条目数与已录时长
  const archive = new Map<number, { count: number; durationMinutes: number; durationCount: number }>()
  for (const e of timeline) {
    const y = Number(e.date.slice(0, 4))
    if (!y) continue
    const row = archive.get(y) ?? { count: 0, durationMinutes: 0, durationCount: 0 }
    row.count += 1
    if (e.duration_min) {
      row.durationMinutes += e.duration_min
      row.durationCount += 1
    }
    archive.set(y, row)
  }

  // 2. 策展侧：把 beats 按年份归位（保持策展顺序）
  const beatsByYear = new Map<number, ResolvedBeat[]>()
  for (const act of acts) {
    for (const beat of act.beats) {
      const y = beatYear(beat.date)
      if (y === null) continue
      const list = beatsByYear.get(y)
      if (list) list.push(beat)
      else beatsByYear.set(y, [beat])
    }
  }

  // 3. 年份范围：档案与策展的并集，中间的空年份保留成缺口
  const allYears = [...new Set([...archive.keys(), ...beatsByYear.keys()])]
  if (allYears.length === 0) return []
  const from = Math.min(...allYears)
  const to = Math.max(...allYears)

  const years: StoryYear[] = []
  for (let year = from; year <= to; year++) {
    const stats = archive.get(year) ?? { count: 0, durationMinutes: 0, durationCount: 0 }
    const beats = [...(beatsByYear.get(year) ?? [])]
    const ranked = [...beats].sort((a, b) => (SIZE_RANK[a.size] ?? 9) - (SIZE_RANK[b.size] ?? 9))
    const hero = ranked[0] ?? null
    const secondary = beats.filter((b) => b !== hero)

    const kind: StoryYearKind =
      hero === null ? 'sparse' : hero.size === 'small' ? 'normal' : 'highlight'

    years.push({
      year,
      kind,
      count: stats.count,
      durationMinutes: stats.durationMinutes,
      durationCount: stats.durationCount,
      isEmpty: stats.count === 0,
      hero,
      secondary,
      accent: stats.count || hero ? actColorForDate(`${year}-06-01`) : '#7C8296',
    })
  }
  return years
}
