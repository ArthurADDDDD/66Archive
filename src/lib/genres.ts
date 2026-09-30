/**
 * 游戏类型词表（受控）。`data/games.yaml` 的 `genres` 只能使用这里登记过的 id，
 * Schema 会拦住未登记值——与 tags.yaml 同一个道理：写错一个字不能让游戏静静地
 * 从筛选里消失。
 *
 * 一个游戏可以有多个类型（例如「艾尔登法环」= `arpg` + `open-world`），
 * 前台筛选按「同时包含所选的全部类型」过滤。类型是关于游戏本身的客观分类，
 * 不是主播的评价；拿不准的游戏留空，归入「未分类」，不要猜。
 *
 * 新增类型：在这里加一行即可（id 小写连字符、label 是前台显示名）。
 * 后台审核助手使用的词表由这份文件同步，改动时两边一并更新。
 */
export const GENRES = [
  { id: 'roguelike', label: 'Roguelike', en: 'Roguelike / Roguelite' },
  { id: 'rpg', label: 'RPG', en: 'RPG' },
  { id: 'jrpg', label: 'JRPG', en: 'JRPG（日式角色扮演）' },
  { id: 'arpg', label: '动作 RPG', en: 'Action RPG' },
  { id: 'mmorpg', label: '网游 MMO', en: 'MMORPG / 网络游戏' },
  { id: 'action', label: '动作', en: 'Action' },
  { id: 'soulslike', label: '类魂', en: 'Soulslike' },
  { id: 'metroidvania', label: '类银河恶魔城', en: 'Metroidvania' },
  { id: 'platformer', label: '平台跳跃', en: 'Platformer' },
  { id: 'adventure', label: '冒险', en: 'Adventure' },
  { id: 'open-world', label: '开放世界', en: 'Open World' },
  { id: 'puzzle', label: '解谜', en: 'Puzzle' },
  { id: 'horror', label: '恐怖', en: 'Horror' },
  { id: 'visual-novel', label: '视觉小说', en: 'Visual Novel / AVG' },
  { id: 'chengguang', label: '橙光 / 互动文字', en: 'Interactive Fiction (Orange Light / 66RPG)' },
  { id: 'shooter', label: '射击', en: 'FPS / TPS / Shooter' },
  { id: 'battle-royale', label: '大逃杀', en: 'Battle Royale' },
  { id: 'moba', label: 'MOBA', en: 'MOBA' },
  { id: 'fighting', label: '格斗', en: 'Fighting' },
  { id: 'strategy', label: '策略', en: 'Strategy' },
  { id: 'card', label: '卡牌 / 棋牌', en: 'Card / Board' },
  { id: 'tower-defense', label: '塔防', en: 'Tower Defense' },
  { id: 'simulation', label: '模拟经营', en: 'Simulation / Management' },
  { id: 'survival', label: '生存', en: 'Survival' },
  { id: 'sandbox', label: '沙盒建造', en: 'Sandbox / Crafting' },
  { id: 'party', label: '聚会 / 合作', en: 'Party / Co-op' },
  { id: 'racing', label: '竞速', en: 'Racing' },
  { id: 'sports', label: '体育', en: 'Sports' },
  { id: 'rhythm', label: '音乐节奏', en: 'Rhythm / Music' },
  { id: 'casual', label: '休闲', en: 'Casual' },
] as const

export type GenreId = (typeof GENRES)[number]['id']

export const GENRE_IDS = GENRES.map((genre) => genre.id) as [GenreId, ...GenreId[]]

const LABELS: Map<string, string> = new Map(GENRES.map((genre) => [genre.id, genre.label]))

export function genreLabel(id: string): string {
  return LABELS.get(id) ?? id
}
