'use client'

import { createContext, useContext } from 'react'
import type { GameGenreMap } from '@/lib/archive-payload'

/**
 * 录播室里「游戏 → 类型」的对照表，由 ArchiveLoader 从载荷顶层取出后提供。
 * 其它页面（节目页、游戏页）复用同一个条目详情组件但不提供它，那里就不显示类型——
 * 游戏页自己的页头已经写着类型。
 */
const GameGenresContext = createContext<GameGenreMap>({})

export const GameGenresProvider = GameGenresContext.Provider

export function useGameGenres(): GameGenreMap {
  return useContext(GameGenresContext)
}
