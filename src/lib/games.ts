/**
 * 某些条目同时保留系列 ID 与具体作品 ID，便于筛选覆盖整个系列；
 * 紧凑展示时只显示具体作品，避免同一条记录出现两个重复标签。
 */
const SPECIFIC_GAME_PARENTS: Record<string, string> = {
  'elden-ring-nightreign': 'elden-ring',
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
