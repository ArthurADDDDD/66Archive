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
