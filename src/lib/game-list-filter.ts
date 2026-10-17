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
