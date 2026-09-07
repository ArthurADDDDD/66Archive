import type { TimelineEntry, TimelineSource } from './data'

/**
 * `/archive-data.json` 的线上编码。
 *
 * **只是传输格式，不是新的数据模型。** 构建期的 `TimelineEntry` 一个字段都没变，
 * 所以 /chronicle/、/e/*、/games/*、首页、节目页这些构建期消费者完全不受影响；
 * 变的只有「这份 JSON 怎么写下来」和「浏览器怎么读回来」。
 *
 * 为什么值得做：这是全站最大的一个资源（原始 2.6 MB，线上 br 约 323 KB）。
 * 实测三处冗余合计占 br 后的 19.2%：
 *
 * | 冗余                        | br q4 省下 |
 * |-----------------------------|-----------:|
 * | `bands` 的 `to` / `name`    |    20,740 B |
 * | `sources[].entryTitle`      |    18,774 B |
 * | 五个可从 `sources` 重算的字段 |    15,780 B |
 *
 * 三处都是**构造上无损**的：`decode(encode(x))` 与 `x` 深度相等，
 * `scripts/test-archive-payload.ts` 会拿真实数据集逐条比对。
 * 有意**没有**动 `mergedEntryCount` 和 `confidence`——它们推不出来，
 * 省的那 847 B 不值得在载荷里写一个编出来的值。
 */

/**
 * 一条色带，按「能推出来的就不写」编码。长度即形态：
 *
 * - `[game, from]`             —— `to` 与 `name` 都能推出来（有 gameId 的色带）
 * - `[game, from, name]`       —— `to` 能推，`name` 要写（5,609 段无 gameId 的标签色带走这条）
 * - `[game, from, name, to]`   —— `to` 推不出来（实测只有 5 段：segment 的 `at` 越过了标称时长）；
 *                                 `name` 为 null 表示仍然按推导取
 *
 * 实测 7,345 段里 7,340 段的 `to` 可推、但只有 1,736 段的 `name` 可推——
 * 所以这两件事必须分开判断。早先版本要求两者同时可推才压缩，结果 5,611 段退回全写。
 */
type EncodedBand =
  | [game: string | null, from: number]
  | [game: string | null, from: number, name: string]
  | [game: string | null, from: number, name: string | null, to: number]

type EncodedSource = Omit<TimelineSource, 'entryTitle'> & { entryTitle?: string }

export type EncodedEntry = Omit<
  TimelineEntry,
  'bands' | 'sources' | 'primaryUrl' | 'sourceCount' | 'aliveCount' | 'uncheckedCount' | 'deadCount'
> & { bands: EncodedBand[]; sources: EncodedSource[] }

export type ArchivePayload = {
  entries: TimelineEntry[]
  isDemo: boolean
  hiddenUnreviewed: number
}

export type EncodedArchivePayload = {
  entries: EncodedEntry[]
  isDemo: boolean
  hiddenUnreviewed: number
}

/**
 * 色带的 `name`：有 gameId 时通常等于该条目 `games` 里同 id 的名字。
 * 「通常」不等于「总是」，所以对不上就照写——推导只在能精确还原时才省。
 */
function derivedBandName(entry: Pick<TimelineEntry, 'games'>, game: string | null): string | null {
  if (game === null) return null
  return entry.games.find((g) => g.id === game)?.name ?? null
}

/**
 * 色带的 `to`：绝大多数等于下一条的 `from`，最后一条等于 1。
 *
 * **不能无脑按这个规则解码**：有几场的 segment `at` 超过了标称时长，于是相邻两条并不首尾相接。
 * 所以这里只在真的相等时才省略，对不上就把 `to` 写出来。
 */
function derivedBandTo(bands: TimelineEntry['bands'], index: number): number {
  return index + 1 < bands.length ? bands[index + 1].from : 1
}

export function encodeArchiveEntry(entry: TimelineEntry): EncodedEntry {
  const {
    bands, sources, primaryUrl, sourceCount, aliveCount, uncheckedCount, deadCount, ...rest
  } = entry
  void primaryUrl; void sourceCount; void aliveCount; void uncheckedCount; void deadCount

  return {
    ...rest,
    sources: sources.map((source) => {
      const { entryTitle, ...restSource } = source
      // 5,572 条来源的 entryTitle 目前全都与条目标题逐字相同。仍然按条判断而不是一律删掉：
      // 哪天并入一条标题不同的合并记录，无条件删会把它静默改写成条目标题。
      return entryTitle === entry.title ? restSource : { ...restSource, entryTitle }
    }),
    bands: bands.map((band, index): EncodedBand => {
      const toDerivable = band.to === derivedBandTo(bands, index)
      const name = band.name === derivedBandName(entry, band.game) ? null : band.name
      if (!toDerivable) return [band.game, band.from, name, band.to]
      if (name === null) return [band.game, band.from]
      return [band.game, band.from, name]
    }),
  }
}

export function decodeArchiveEntry(encoded: EncodedEntry): TimelineEntry {
  const sources: TimelineSource[] = encoded.sources.map((source) => ({
    ...source,
    entryTitle: source.entryTitle ?? encoded.title,
  }))

  const bands: TimelineEntry['bands'] = []
  const derivedTo: number[] = []
  encoded.bands.forEach((band, index) => {
    const [game, from] = band
    const name = band.length >= 3 ? band[2] : null
    if (band.length < 4) derivedTo.push(index)
    bands.push({
      game,
      name: name ?? derivedBandName(encoded, game) ?? '',
      from,
      // `to` 要等整份填完才能推：它依赖下一条的 from。
      to: band.length === 4 ? band[3] : 0,
    })
  })
  for (const index of derivedTo) bands[index].to = derivedBandTo(bands, index)

  return {
    ...encoded,
    sources,
    bands,
    primaryUrl: sources.find((source) => source.status === 'alive')?.url ?? sources[0]?.url ?? null,
    sourceCount: sources.length,
    aliveCount: sources.filter((source) => source.status === 'alive').length,
    uncheckedCount: sources.filter((source) => source.status === 'unchecked').length,
    deadCount: sources.filter((source) => source.status === 'dead').length,
  }
}

export function encodeArchivePayload(payload: ArchivePayload): EncodedArchivePayload {
  return { ...payload, entries: payload.entries.map(encodeArchiveEntry) }
}

export function decodeArchivePayload(payload: EncodedArchivePayload): ArchivePayload {
  return { ...payload, entries: payload.entries.map(decodeArchiveEntry) }
}
