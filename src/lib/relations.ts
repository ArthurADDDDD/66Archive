import { getGalleryCollections } from './gallery-photos-manifest'
import type { Dataset } from './data'
import type { Entry } from './schema'
import type { GameProfile } from './narrative'

/**
 * 关系网络（游戏详情页的出口）。
 * 全部来自数据派生：同年编年史 / 相关栏目 / 同年画廊。
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

  // 相关栏目：优先使用 series.yaml 里显式声明的 game 关系；再补 tags 与系列名的精确交集。
  // 这样像「大周MC → minecraft」这种已经在数据层确认的关系会真正出现在游戏页上，
  // 不需要为了做导航而给每一场历史录像补一个展示性 tag。
  const relatedSeries = [...ds.series.entries()]
    .filter(([, s]) => s.game === profile.id)
    .map(([id, s]) => ({ label: s.name, href: `/series/${id}/`, hint: '系列' }))

  const linkedNames = new Set(relatedSeries.map((item) => item.label))
  const seriesNames = new Set([...ds.series.values()].map((s) => s.name))
  const tagCounts = new Map<string, number>()
  for (const e of profile.entries) {
    for (const tag of e.tags) {
      if (!seriesNames.has(tag) || linkedNames.has(tag)) continue
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const taggedSeries = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => ({ label: tag, href: `/archive/?q=${encodeURIComponent(tag)}`, hint: `${n} 场` }))
  const seriesItems = [...relatedSeries, ...taggedSeries].slice(0, 3)
  if (seriesItems.length) rails.push({ title: '相关栏目', items: seriesItems })

  // 同年画廊：发布版两个策展顺序（纪念 + 全量）去重后与这些年份重合的照片
  const collections = getGalleryCollections()
  const byId = new Map([...collections.featured, ...collections.all].map((p) => [p.id, p]))
  const matched = [...byId.values()].filter((g) => g.year !== null && years.has(g.year))
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
