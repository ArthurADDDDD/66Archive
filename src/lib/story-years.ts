import type { TimelineEntry } from './data'
import { actColorForDate, type ResolvedAct, type ResolvedBeat } from './narrative'

/**
 * 故事模式的分段编排。
 *
 * 视觉是「年份脊柱」（大年份左栏 + 一条竖线 + 每段少量代表条目），
 * 但**选条目的权力仍然在 STORY_ACTS**——这里不重新挑内容，只把已经策展好的 beats
 * 归位，再补上该段的档案计数。改 narrative.ts 的策展列表，这里就跟着变。
 *
 * 两条这次特意分开的概念（以前混在一个 isEmpty 里）：
 * - **档案覆盖**（archiveCount / archiveEmpty）：这段时间站内保存了多少条录像。
 * - **故事覆盖**（hasStory）：这段时间有没有可以讲的、已确认的节点。
 *
 * 两者互不代表。2011 年站内一条录像也没有，但那一年她本科毕业、推免去了北大——
 * 「没有录像」不等于「不知道这一年发生了什么」，页面不能再把前者写成后者。
 *
 * 分段粒度默认一年一段；策展节点声明 `storySpan` 时（如 2007—2009 清华本科阶段），
 * 这一段吃掉它覆盖的所有年份，中间年份不再单独成段——避免出现连续三年的空段落。
 */

export type StorySectionKind = 'highlight' | 'normal' | 'sparse'

export type StorySection = {
  /** 起始年份，同时用作排序键与锚点 */
  year: number
  /** 结束年份；单年段等于 year */
  endYear: number
  /** 左栏显示的年份文本：`2011` 或 `2007 — 2009` */
  label: string
  kind: StorySectionKind
  /** 这一段覆盖年份里的档案条目数（真实计数，不是策展条目数） */
  archiveCount: number
  durationMinutes: number
  durationCount: number
  /** 这一段在档案里一条录像都没有 */
  archiveEmpty: boolean
  /** 这一段有已确认的故事节点（可能来自档案之外的公开资料） */
  hasStory: boolean
  hero: ResolvedBeat | null
  secondary: ResolvedBeat[]
  accent: string
}

/** 大条目优先级：hero > type > montage > small。同级取策展顺序里靠前的。 */
const SIZE_RANK: Record<string, number> = { hero: 0, type: 1, montage: 2, small: 3 }

type YearStats = { count: number; durationMinutes: number; durationCount: number }

const EMPTY_STATS: YearStats = { count: 0, durationMinutes: 0, durationCount: 0 }

function formatLabel(from: number, to: number): string {
  return from === to ? String(from) : `${from} — ${to}`
}

export function buildStorySections(acts: ResolvedAct[], timeline: TimelineEntry[]): StorySection[] {
  // 1. 档案侧：每年的条目数与已录时长
  const archive = new Map<number, YearStats>()
  for (const entry of timeline) {
    const year = Number(entry.date.slice(0, 4))
    if (!year) continue
    const row = archive.get(year) ?? { count: 0, durationMinutes: 0, durationCount: 0 }
    row.count += 1
    if (entry.duration_min) {
      row.durationMinutes += entry.duration_min
      row.durationCount += 1
    }
    archive.set(year, row)
  }

  // 2. 策展侧：按 storyYear / storySpan 归位（不再从展示日期里抓四位数字）
  const beatsByYear = new Map<number, ResolvedBeat[]>()
  const spanEnd = new Map<number, number>()
  for (const act of acts) {
    for (const beat of act.beats) {
      const year = beat.storyYear
      if (year === null || year === undefined) continue
      const list = beatsByYear.get(year)
      if (list) list.push(beat)
      else beatsByYear.set(year, [beat])
      if (beat.storyEndYear && beat.storyEndYear > year) {
        spanEnd.set(year, Math.max(spanEnd.get(year) ?? year, beat.storyEndYear))
      }
    }
  }

  // 3. 年份范围：档案与策展的并集
  const allYears = [...new Set([...archive.keys(), ...beatsByYear.keys()])]
  if (allYears.length === 0) return []
  const from = Math.min(...allYears)
  const to = Math.max(...allYears, ...spanEnd.values())

  const sections: StorySection[] = []
  for (let year = from; year <= to; year++) {
    const beats = [...(beatsByYear.get(year) ?? [])]

    // 跨年段只在「后面那些年自己没有故事节点」时才吃掉它们；
    // 否则 2007—2009 这种段落会把中间某一年真实发生的事情吞掉。
    let endYear = year
    const declaredEnd = spanEnd.get(year)
    if (declaredEnd && declaredEnd > year) {
      for (let next = year + 1; next <= declaredEnd; next++) {
        if (beatsByYear.has(next)) break
        endYear = next
      }
    }

    // 段内档案计数 = 覆盖到的每一年之和
    let archiveCount = 0
    let durationMinutes = 0
    let durationCount = 0
    for (let covered = year; covered <= endYear; covered++) {
      const stats = archive.get(covered) ?? EMPTY_STATS
      archiveCount += stats.count
      durationMinutes += stats.durationMinutes
      durationCount += stats.durationCount
    }

    const ranked = [...beats].sort((a, b) => (SIZE_RANK[a.size] ?? 9) - (SIZE_RANK[b.size] ?? 9))
    const hero = ranked[0] ?? null
    const secondary = beats.filter((beat) => beat !== hero)
    const hasStory = hero !== null

    const kind: StorySectionKind =
      hero === null ? 'sparse' : hero.size === 'small' ? 'normal' : 'highlight'

    sections.push({
      year,
      endYear,
      label: formatLabel(year, endYear),
      kind,
      archiveCount,
      durationMinutes,
      durationCount,
      archiveEmpty: archiveCount === 0,
      hasStory,
      hero,
      secondary,
      accent: archiveCount || hasStory ? actColorForDate(`${year}-06-01`) : '#7C8296',
    })

    year = endYear
  }
  return sections
}
