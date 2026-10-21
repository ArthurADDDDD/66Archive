import { normalizeGameKeyword } from '@/lib/vote-search'

/**
 * 录播室筛选面板里「在游戏列表中查找」的匹配。
 *
 * 只决定列表里**显示哪几行**，不改顺序（仍按场次从多到少）、不碰已选的游戏，
 * 也不进档案搜索词——它和「搜索全部记录」是两回事。
 *
 * 录播室载荷里每个游戏只带 id 和显示名，没有别名表；这里就只认这两样，
 * 不为了列表查找再往客户端多塞一份词库。标点、空格和大小写沿用投票搜索框的归一化。
 */
export function filterGameList<T extends { id: string; name: string }>(games: T[], keyword: string): T[] {
  const needle = normalizeGameKeyword(keyword)
  if (!needle) return games
  return games.filter((game) => normalizeGameKeyword(game.name).includes(needle) || normalizeGameKeyword(game.id).includes(needle))
}

/** 游戏厅「未分类」入口：genres 为空的游戏。它不是词表里的类型。 */
export const UNCLASSIFIED_GENRE = 'unclassified'

/**
 * 游戏厅类型筛选：多选取**并集**，游戏只要属于任一所选类型就显示（「视觉小说 + 橙光」= 两类合起来）。
 *
 * 结果保持输入顺序、每款只出现一次；排序由调用方照常做。空选择原样返回整份列表。
 * 「未分类」与其他类型互斥（界面上选它会清掉其他类型），选中时只看 genres 为空的游戏。
 */
export function filterGamesByGenres<T extends { genres: string[] }>(games: T[], selected: string[]): T[] {
  if (selected.length === 0) return games
  if (selected.includes(UNCLASSIFIED_GENRE)) return games.filter((game) => game.genres.length === 0)
  const wanted = new Set(selected)
  return games.filter((game) => game.genres.some((id) => wanted.has(id)))
}
