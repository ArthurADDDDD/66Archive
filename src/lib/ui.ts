import type { TimelineEntry } from './data'

/**
 * 时长条在常见区间内保持线性，但设置上限，避免补齐长直播时长后
 * 又把月度列表撑成一条需要滚很久的长轴。
 */
export const PX_PER_MIN = 0.12
export const BAR_MIN = 8
export const BAR_MAX = 64

export function barHeight(e: TimelineEntry): number {
  if (!e.duration_min) return BAR_MIN
  return Math.max(BAR_MIN, Math.min(BAR_MAX, e.duration_min * PX_PER_MIN))
}

export function formatDuration(min?: number): string {
  if (!min) return '时长未知'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h} 小时 ${m ? `${m} 分` : ''}`.trim() : `${m} 分钟`
}

export function formatClock(min?: number): string {
  if (!min) return '--:--'
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/**
 * 游戏色带的取色：固定 8 色调色板，按游戏 id 稳定哈希分配。
 * 用有限调色板而不是随机 HSL，避免整页失控成彩虹。
 */
const GAME_COLORS = [
  '#7FB2E5', '#C6A0E8', '#7FD6B8', '#E8B96B',
  '#E58F8F', '#8FCBE8', '#B9CE7F', '#D89BC4',
]

export function gameColor(id: string | null): string {
  if (!id) return '#3C4256' // 非游戏时段（杂谈等）用中性灰
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return GAME_COLORS[h % GAME_COLORS.length]
}

/**
 * 时期分界由数据推导，不写死年份——真实的转折点尚未考证（见 docs/03 第八节）。
 * 规则：直播条目数首次超过视频条目数的那一年。
 */
export function deriveEraBoundary(entries: TimelineEntry[]): number | null {
  const byYear = new Map<number, { live: number; video: number }>()
  for (const e of entries) {
    const y = Number(e.date.slice(0, 4))
    const cur = byYear.get(y) ?? { live: 0, video: 0 }
    cur[e.type]++
    byYear.set(y, cur)
  }
  const years = [...byYear.keys()].sort((a, b) => a - b)
  for (const y of years) {
    const c = byYear.get(y)!
    if (c.live > c.video) return y
  }
  return null
}

export function yearHistogram(entries: TimelineEntry[]) {
  const map = new Map<number, number>()
  for (const e of entries) {
    const y = Number(e.date.slice(0, 4))
    map.set(y, (map.get(y) ?? 0) + 1)
  }
  const years = [...map.keys()].sort((a, b) => b - a)
  const max = Math.max(1, ...map.values())
  return years.map((y) => ({ year: y, count: map.get(y)!, ratio: map.get(y)! / max }))
}

export const MONTH_CN = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
