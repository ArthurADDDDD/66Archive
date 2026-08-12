import type { Dataset } from './data'
import { buildGameStats } from './game-stats'
import { toGameCard, type GameCard } from './game-stats-format'

/**
 * 首页那段"游戏库"的取材——像打开自己 Steam 库时会看到的那几排：
 * 玩得最久 / 隔了很久又打开 / 只播过一次 / 打了很多年终于通关。
 *
 * 每一排的排序规则都是写死的公式（时长 / 中断天数 / 场次 / 跨度），
 * 但**选哪几排**、**每排叫什么名字**是人定的，这条和 `highlights.ts` 是同一条纪律：
 * 允许有判断，但判断落在"问什么问题"上，答案必须是算出来的。
 *
 * 同一个游戏不会出现在两排里——先出现的排占住这个游戏，后面的排跳过它，
 * 不然"打了十年终于通关"和"隔了很久又打开"会抢同一张《节奏天国》。
 */

export type GameShelfRow = {
  key: string
  label: string
  hint: string
  games: (GameCard & { badge: string })[]
}

const COMPLETION_TITLE = /通关|结局|完结|大结局|全收集/

export function buildGameShelf(ds: Dataset): GameShelfRow[] {
  const stats = buildGameStats(ds)
  const used = new Set<string>()
  const take = (list: typeof stats, n: number) => {
    const picked = list.filter((g) => !used.has(g.id)).slice(0, n)
    for (const g of picked) used.add(g.id)
    return picked
  }

  // 打了很多年，最后一场标题自己说"通关"了——这条不是猜的，是标题原文匹配到的。
  const legacy = take(
    [...stats]
      .filter((g) => g.sessionCount >= 5 && g.spanDays >= 1000 && g.last && COMPLETION_TITLE.test(g.last.title))
      .sort((a, b) => b.spanDays - a.spanDays),
    2,
  ).map((g) => ({
    ...toGameCard(g),
    badge: `跨度 ${(g.spanDays / 365).toFixed(0)} 年 · 通关`,
  }))

  // 隔了很久，最近又打开了——排除已经在"通关"那排出现过的。
  const reopened = take(
    [...stats].filter((g) => (g.comeback?.gapDays ?? 0) >= 365).sort((a, b) => b.comeback!.gapDays - a.comeback!.gapDays),
    4,
  ).map((g) => ({ ...toGameCard(g), badge: `隔了 ${g.comeback!.gapDays.toLocaleString()} 天又打开` }))

  // 只播过一次。202 个里最容易被忘掉的那批。
  const once = take(
    [...stats].filter((g) => g.sessionCount === 1).sort((a, b) => b.firstDate.localeCompare(a.firstDate)),
    4,
  ).map((g) => ({ ...toGameCard(g), badge: '只播过一次' }))

  // 玩得最久。纯按已知时长排，不做别的判断。
  const duration = take(
    [...stats].sort((a, b) => b.knownDurationMin - a.knownDurationMin),
    4,
  ).map((g) => ({ ...toGameCard(g), badge: `${Math.round(g.knownDurationMin / 60)} 小时` }))

  const rows: GameShelfRow[] = [
    { key: 'legacy', label: '打了很多年，通关了', hint: '标题原文写着"通关"，不是猜的', games: legacy },
    { key: 'reopened', label: '隔了很久，又打开了', hint: '中断超过一年才算数', games: reopened },
    { key: 'once', label: '只播过一次', hint: '202 个里最容易被忘掉的那批', games: once },
    { key: 'duration', label: '玩得最久', hint: '按已知时长排', games: duration },
  ]
  return rows.filter((r) => r.games.length > 0)
}
