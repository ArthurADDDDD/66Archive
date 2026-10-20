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
    const haystacks = [game.name, game.id, ...game.aliases].map(normalizeGameKeyword)
    // 完全匹配优先于前缀/包含：搜原版「Reigns」或「王权」时，
    // 应把准确的作品排在「Reigns: Game of Thrones」等续作前面。
    // 仍保留既有前缀 > 包含的排序。
    let score = -1
    for (const hay of haystacks) {
      if (hay === needle) { score = 3; break }
      if (hay.startsWith(needle)) score = Math.max(score, 2)
      else if (hay.includes(needle)) score = Math.max(score, 1)
    }
    if (score > 0) scored.push({ game, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.game.name.localeCompare(b.game.name, 'zh'))
    .slice(0, MAX_RESULTS)
    .map((item) => item.game)
}
