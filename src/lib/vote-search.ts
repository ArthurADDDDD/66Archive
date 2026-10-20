import type { VoteGame } from '@/lib/vote-api'

/**
 * 游戏搜索框的匹配逻辑。
 *
 * 单独放一个文件是为了能直接测：它是这个功能里唯一一段「说不清对错就会悄悄变差」
 * 的纯逻辑——排序错了没人会报 bug，用户只会觉得"搜不到"然后去填自由文本，
 * 而自由文本要人工处理，比一个能直接落盘的 game id 贵得多。
 */

/** 搜索结果最多显示这么多。词库有六百条，全渲染既慢又没人会翻到底。 */
const MAX_RESULTS = 24

export function normalizeGameKeyword(value: string): string {
  // 别名里既有「1,2switch」也有「1-2-Switch」，标点和大小写都不该影响匹配。
  return value.toLowerCase().replace(/[\s,._:-]/g, '')
}

export function searchGames(games: VoteGame[], keyword: string): VoteGame[] {
  const needle = normalizeGameKeyword(keyword)
  if (!needle) return []
  const scored: Array<{ game: VoteGame; score: number }> = []
  for (const game of games) {
    const titles = [game.name, ...game.aliases].map(normalizeGameKeyword)
    const id = normalizeGameKeyword(game.id)
    // 用户输入作品名称时，名字/别名精确命中优先于旧 ID 精确命中：
    // 游戏目录的历史 id `reigns` 实际对应「冰火王权」，但原版的正式英文名是 Reigns。
    // 保留 id 可搜索，并维持原有前缀优先于包含的规则。
    let score = -1
    for (const title of titles) {
      if (title === needle) { score = 4; break }
      if (title.startsWith(needle)) score = Math.max(score, 2)
      else if (title.includes(needle)) score = Math.max(score, 1)
    }
    if (id === needle) score = Math.max(score, 3)
    else if (id.startsWith(needle)) score = Math.max(score, 2)
    else if (id.includes(needle)) score = Math.max(score, 1)
    if (score > 0) scored.push({ game, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.game.name.localeCompare(b.game.name, 'zh'))
    .slice(0, MAX_RESULTS)
    .map((item) => item.game)
}
