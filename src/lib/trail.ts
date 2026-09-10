'use client'

/**
 * 足迹：这台设备在本站点开过哪些记录
 * ==================================
 *
 * ## 要解决的问题
 *
 * 档案有两千多条、七百多款游戏、十六年。**一个人找到一次，不代表他能找到第二次。**
 * 看完一场回到站里，「我上次看的是二零几几年几月那一场？」——重新找一遍的成本，
 * 比看那一场本身还高。这是这份档案规模带来的必然问题，不是交互细节。
 *
 * ## 刻意不做的事
 *
 * - **不记播放进度。** 站上不嵌播放器，来源一律跳去 B站 / 斗鱼 / 优酷，
 *   播到第几秒只有那边知道，那边自己也会记。我们记的是**「是哪一场」**。
 * - **不跨设备。** 跨设备要么做账号、要么把浏览记录传到服务器，两件都不做：
 *   这个站的定位是只索引不搬运，不该为了一个便利功能开始持有访客数据。
 * - **不上报。** 这份数据只存在读者自己的浏览器里，站长看不到，也不进埋点。
 *   页面上会把这句话明写出来。
 *
 * ## 为什么区分「看过」和「点过播放」
 *
 * 在录播室里展开一行看了眼封面，和真的点了「在哔哩哔哩打开」跳出去，是两件事。
 * 只有后者才是「我在看这一场」。所以「继续」优先指向最近一条 `watched`，
 * 没有 watched 才退回最近一条浏览过的——否则随手划过的最后一条会顶掉真正在看的那场。
 */

export type TrailItem = {
  id: string
  title: string
  /** YYYY-MM-DD，用来在提示里显示「2018-03-28 那场」 */
  date: string
  /** 最后一次触碰的时间戳 */
  at: number
  /** 是否点过某个来源跳出去看 */
  watched: boolean
}

const STORAGE_KEY = 'i6i6:trail:v1'

/**
 * 保留条数。够覆盖「最近这阵子在翻的东西」，又不至于让 localStorage 里
 * 躺着一份完整的浏览史——留得越多，万一这台设备被别人用，暴露得越多。
 */
const MAX_ITEMS = 60

/** 同一条记录在这段时间内重复触碰不算新一次，避免来回切页面刷掉整份足迹。 */
const TOUCH_DEBOUNCE_MS = 30_000

/** 足迹变了的通知。storage 事件只在**其他**标签页触发，同页自己改要自己喊一声。 */
const CHANGE_EVENT = 'i6i6:trail:change'

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * 读取。任何一步出错都当作「没有足迹」——隐私模式、禁用站点数据、
 * 手改坏了的 JSON，都不该让页面挂掉，顶多是这个功能不出现。
 */
export function readTrail(): TrailItem[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is TrailItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as TrailItem).id === 'string' &&
        typeof (item as TrailItem).at === 'number',
      )
      .map((item) => ({
        id: item.id,
        title: typeof item.title === 'string' ? item.title : item.id,
        date: typeof item.date === 'string' ? item.date : '',
        at: item.at,
        watched: item.watched === true,
      }))
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

function writeTrail(items: TrailItem[]): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // 配额满或被禁用：静默放弃。足迹是锦上添花，不值得为它弹任何东西。
  }
}

/**
 * 记一条。`watched` 只会从 false 升到 true，不会被后来的一次浏览降回去——
 * 「我看过这一场」这件事一旦成立就不该被撤销。
 */
export function recordTrail(item: { id: string; title: string; date: string }, options?: { watched?: boolean }): void {
  if (!canUseStorage() || !item.id) return
  const watched = options?.watched === true
  const now = Date.now()
  const current = readTrail()
  const existing = current.find((row) => row.id === item.id)

  // 已经在最前面、刚刚才记过、而且这次也没带来新信息 → 什么都不做。
  if (existing && !watched && now - existing.at < TOUCH_DEBOUNCE_MS) return

  const next: TrailItem = {
    id: item.id,
    title: item.title || existing?.title || item.id,
    date: item.date || existing?.date || '',
    at: now,
    watched: watched || existing?.watched === true,
  }
  writeTrail([next, ...current.filter((row) => row.id !== item.id)])
}

export function clearTrail(): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // 同 writeTrail：清不掉就算了，不打断用户。
  }
}

/** 「继续」指向哪一条：优先最近一条真的点过播放的，否则最近浏览过的那条。 */
export function resumeTarget(items: TrailItem[]): TrailItem | null {
  return items.find((item) => item.watched) ?? items[0] ?? null
}

export function subscribeTrail(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) listener()
  }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}
