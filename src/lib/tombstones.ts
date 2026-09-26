/**
 * 后台「删除公开仓基线条目」留下的墓碑（`narrative.deletedIds`）怎么匹配。
 *
 * 首页 ACT、直播间梗（高光）、编年史故事模式三处的 stable id 各自独立，但会重名：
 * `celeste`、`binge-game`、`xinling-pishuang` 既是高光 id 也是故事节点 id，
 * `see-you-around`、`back-again`、幕 id `act-ii` 首页和编年史都有。墓碑原来只写裸 id、
 * 三处共用，于是在后台删一条高光，编年史里同名的卡也跟着消失
 * （受苦记录 #03《Celeste》就是这么没的）。
 *
 * 后台现在写墓碑时带作用域：`home.<id>` / `highlight.<id>` / `story.<id>`，只隐藏那一处。
 * 旧的裸 id 墓碑保持原来的含义——三处都隐藏——所以已有数据的前台表现不变；
 * 要把旧墓碑收窄到某一处，在后台墓碑列表里改。
 * 基线与 `custom-*` 的 stable id 都不含点号，前缀不会和真实 id 撞上。
 */
export type TombstoneScope = 'home' | 'highlight' | 'story'

/** 返回「这个 id 在这一处是否已被删除」的判断函数（集合只建一次）。 */
export function tombstoneMatcher(deletedIds: readonly string[] | undefined, scope: TombstoneScope): (id: string) => boolean {
  const set = new Set(deletedIds ?? [])
  if (set.size === 0) return () => false
  return (id) => set.has(id) || set.has(`${scope}.${id}`)
}
