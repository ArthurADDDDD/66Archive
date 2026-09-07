/**
 * 某些条目同时保留系列 ID 与具体作品 ID，便于筛选覆盖整个系列；
 * 紧凑展示时只显示具体作品，避免同一条记录出现两个重复标签。
 */
const SPECIFIC_GAME_PARENTS: Record<string, string> = {
  'elden-ring-nightreign': 'elden-ring',
  'maplestory-classic': 'maplestory',
}

export function visibleGameIds(gameIds: string[]): string[] {
  const present = new Set(gameIds)
  return gameIds.filter((id) => {
    const hasSpecificChild = Object.entries(SPECIFIC_GAME_PARENTS).some(
      ([specificId, parentId]) => parentId === id && present.has(specificId),
    )
    return !hasSpecificChild
  })
}

/** 游戏瓦片需要的极简载荷（避免把全部场次塞进客户端）。
 * 原本挂在 GameShelf 组件文件里，但那个组件已无人使用——类型留在这里。 */
export type GameCardData = {
  id: string
  name: string
  cover: string | null
  sessions: number
  totalMinutes: number
  hoursLabel: string
  firstDate: string | null
  lastDate: string | null
  curated: boolean
}

export type LibraryGame = {
  id: string
  name: string
  aliases: string[]
  face: string | null
  sessions: number
  totalMinutes: number
  knownDurationCount: number
  firstDate: string | null
  lastDate: string | null
  comebackDays: number
}

/**
 * 传输形态：列存，不是 745 个对象。
 *
 * 这一屏一次只画 60 张卡，但搜索和排序要在全部 745 个游戏上跑，所以整份数据
 * 必须到客户端——问题不在「传了多少条」，而在「用什么形状传」。
 * 745 个对象意味着同样的 10 个键名重复 745 遍，而 RSC 载荷是要内联进 HTML 的
 * （`/games/` 的 HTML 有 79% 是 flight 脚本，其中这个数组占 94.4%）。
 *
 * 转成「每个字段一个数组」之后，同类型的值挨在一起，brotli 能吃掉的重复多得多：
 * 实测 `/games/` HTML 66,908 → 56,062 B、`index.txt` 60,008 → 48,641 B
 * （brotli q4，与线上同一档）。注意**不是**去掉键名本身带来的——改成「745 个数组」
 * 的行元组形态只省 3,223 B，收益来自把同列的值放到一起。
 *
 * 还原成本在 node 里量过：745 条 0.32ms，比今天直接 `JSON.parse` 对象数组的
 * 0.46ms 还便宜。
 *
 * `LIBRARY_COLUMNS` 是两边唯一的约定，页面按它拆列、这里按它装回，
 * 顺序错开就会静默串字段，所以它必须只有这一处定义。
 */
export const LIBRARY_COLUMNS = [
  'id',
  'name',
  'aliases',
  'face',
  'sessions',
  'totalMinutes',
  'knownDurationCount',
  'firstDate',
  'lastDate',
  'comebackDays',
] as const satisfies readonly (keyof LibraryGame)[]

/** 列存载荷：外层与 `LIBRARY_COLUMNS` 等长，每一项是该字段的 745 个值。 */
export type LibraryColumns = {
  [K in (typeof LIBRARY_COLUMNS)[number]]: LibraryGame[K][]
}[(typeof LIBRARY_COLUMNS)[number]][]
