import { getGalleryCollection } from './gallery'
import type { Dataset } from './data'
import type { Entry } from './schema'
import type { GameProfile } from './narrative'

/**
 * 关系网络（游戏详情页的出口）。
 * 全部来自数据派生：同年编年史 / 相关栏目（tags ∩ series 名称）/ 同年画廊。
 * 每一类都是可点击的出口——详情页不是终点，是转盘。
 */
export type RelationItem = {
  label: string
  href: string
  hint?: string
}

export type RelationRail = {
  title: string
  items: RelationItem[]
}

export function buildGameRails(profile: GameProfile, ds: Dataset): RelationRail[] {
  const rails: RelationRail[] = []
  const years = new Set(profile.entries.map((e) => e.date.slice(0, 4)))

  // 同年编年史
  const yearItems = [...years]
    .sort()
    .map((y) => ({ label: `${y} 年`, href: `/archive/?y=${y}` }))
  if (yearItems.length) rails.push({ title: '同年编年史', items: yearItems.slice(0, 4) })

  // 相关栏目：tags 与已登记 series 名称的交集
  const seriesNames = new Set([...ds.series.values()].map((s) => s.name))
  const tagCounts = new Map<string, number>()
  for (const e of profile.entries) {
    for (const tag of e.tags) {
      if (!seriesNames.has(tag)) continue
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const tagItems = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, n]) => ({ label: tag, href: `/archive/?q=${encodeURIComponent(tag)}`, hint: `${n} 场` }))
  if (tagItems.length) rails.push({ title: '相关栏目', items: tagItems })

  // 同年画廊（素材报告中与这些年份重合的照片）
  const matched = getGalleryCollection().items.filter((g) => years.has(g.year))
  rails.push({
    title: '水友保存的照片',
    items: [{ label: '打开画廊', href: '/gallery/', hint: matched.length ? `${matched.length} 张同年` : undefined }],
  })

  return rails
}

/**
 * 条目详情页的出口：同年编年史 + 相关栏目（tags ∩ series 名称）+ 同游戏的其他记录。
 * 全部数据派生，不猜文本。
 */
export function buildEntryRails(entry: Entry, ds: Dataset): RelationRail[] {
  const rails: RelationRail[] = []
  const year = entry.date.slice(0, 4)
  const month = Number(entry.date.slice(5, 7))

  // 同游戏的其他记录（同一场被折叠过的同系列录像一并算）
  const sameGame = ds.entries
    .filter((e) => e.id !== entry.id && e.games.some((g) => entry.games.includes(g)))
    .slice(0, 6)
  if (sameGame.length) {
    rails.push({
      title: '同游戏的其他记录',
      items: sameGame.map((e) => ({ label: `${e.date} ${e.title}`, href: `/e/${e.id}/` })),
    })
  }

  // 相关栏目：tags 与已登记 series 名称的交集
  const seriesNames = new Set([...ds.series.values()].map((s) => s.name))
  const tagItems = [...new Set(entry.tags.filter((t) => seriesNames.has(t)))]
    .slice(0, 3)
    .map((t) => ({ label: t, href: `/archive/?q=${encodeURIComponent(t)}`, hint: '在录播室里搜索' }))
  if (tagItems.length) rails.push({ title: '相关栏目', items: tagItems })

  rails.push({
    title: '同期编年史',
    items: [
      { label: `${year} 年`, href: `/archive/?y=${year}` },
      { label: `${year} 年 ${month} 月`, href: `/archive/?y=${year}&m=${month}` },
    ],
  })

  return rails
}
