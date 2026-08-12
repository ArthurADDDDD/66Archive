import type { Dataset, TimelineEntry } from './data'
import { toTimelineEntries } from './data'
import type { Account } from './schema'
import { ERAS, eraOf, type EraId } from './covers'

/**
 * 首页要说的那几句话的事实来源。
 *
 * 规矩只有一条：**这里的每个数字都从 data/ 现算，没有一个是抄在代码里的常量。**
 * 数据补录之后页面自己会变——这是这个站和"写死了一段生涯简介的模板站"的区别。
 * 引文同理：所有 「…」 里的句子都是从 entries / accounts 的原文里取出来的，
 * 不是文案写的（见 01-vision 第八节"能引用就不要撰写"）。
 */

export type EraSummary = {
  id: EraId
  name: string
  short: string
  color: string
  fromYear: number
  count: number
  firstDate: string
  lastDate: string
}

export type ArchiveFacts = {
  /** 去重后的场次数（同场多录像算一条） */
  entryCount: number
  /** 有记录的直播 / 更新日 */
  activeDays: number
  /** 已知时长合计（小时），只统计填了 duration 的场次 */
  knownHours: number
  knownDurationEntries: number
  /** 已知时长换算成"不吃不睡的多少天" */
  knownDays: number
  yearSpan: { from: number; to: number }
  first: TimelineEntry
  last: TimelineEntry
  gamesPlayed: number
  gamesRegistered: number
  playedOnce: number
  seriesWithEntries: number
  segmentCount: number
  segmentEntryCount: number
  /** 全站外链总数 / 她自己发的 / 别人录的 */
  sourceTotal: number
  originalSources: number
  replaySources: number
  fanArchiveAccounts: number
  officialAccounts: number
  eras: EraSummary[]
  coverCount: number
}

export function buildArchiveFacts(ds: Dataset): ArchiveFacts {
  const entries = toTimelineEntries(ds)
  // 同一天可能有好几场，"第一条 / 最新一条"要按开播时间排到底，不能只比日期。
  const ascending = [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? '').localeCompare(b.time ?? '') ||
      a.id.localeCompare(b.id),
  )

  const playedIds = new Set<string>()
  const perGame = new Map<string, number>()
  for (const e of entries) {
    for (const g of e.games) {
      playedIds.add(g.id)
      perGame.set(g.id, (perGame.get(g.id) ?? 0) + 1)
    }
  }

  let sourceTotal = 0
  let originalSources = 0
  let segmentCount = 0
  let segmentEntryCount = 0
  for (const e of ds.entries) {
    for (const s of e.sources) {
      sourceTotal++
      if (s.kind === 'original') originalSources++
    }
    if (e.segments.length) {
      segmentCount += e.segments.length
      segmentEntryCount++
    }
  }

  const knownDuration = entries.filter((e) => e.duration_min)
  const knownMinutes = knownDuration.reduce((n, e) => n + (e.duration_min ?? 0), 0)

  const byEra = new Map<EraId, TimelineEntry[]>()
  for (const e of ascending) {
    const id = eraOf(e.date).id
    if (!byEra.has(id)) byEra.set(id, [])
    byEra.get(id)!.push(e)
  }

  const accounts = [...ds.accounts.values()]

  return {
    entryCount: entries.length,
    activeDays: new Set(entries.map((e) => e.date)).size,
    knownHours: Math.round(knownMinutes / 60),
    knownDurationEntries: knownDuration.length,
    knownDays: Math.round(knownMinutes / 60 / 24),
    yearSpan: {
      from: Number(ascending[0]?.date.slice(0, 4) ?? 0),
      to: Number(ascending[ascending.length - 1]?.date.slice(0, 4) ?? 0),
    },
    first: ascending[0],
    last: ascending[ascending.length - 1],
    gamesPlayed: playedIds.size,
    gamesRegistered: ds.games.size,
    playedOnce: [...perGame.values()].filter((n) => n === 1).length,
    seriesWithEntries: new Set(entries.filter((e) => e.seriesId).map((e) => e.seriesId)).size,
    segmentCount,
    segmentEntryCount,
    sourceTotal,
    originalSources,
    replaySources: sourceTotal - originalSources,
    fanArchiveAccounts: accounts.filter((a) => a.role === 'fan-archive').length,
    officialAccounts: accounts.filter((a) => a.role === 'official').length,
    coverCount: entries.filter((e) => e.cover).length,
    eras: ERAS.map((era) => {
      const list = byEra.get(era.id) ?? []
      return {
        ...era,
        count: list.length,
        firstDate: list[0]?.date ?? '',
        lastDate: list[list.length - 1]?.date ?? '',
      }
    }),
  }
}

/**
 * 从账号档案的 note 里取出这个号自己写的那句话。
 *
 * accounts.yaml 里这些句子一律用『』括起来、并且由"简介 / 签名 / 自述 / 明言"引出，
 * 所以可以稳定地取出来，不需要把它们抄进组件。取最长的一条：同一条 note 里
 * 往往还有署名（『政委9527』『高妹』）这类短片段，最长的那条才是那句真正的自我介绍。
 */
const SELF_DESCRIPTION = /(?:简介|签名|自述|明言)[^『]{0,4}『([^』]+)』/g

export function selfDescription(account: Account): string | null {
  const found = [...(account.note ?? '').matchAll(SELF_DESCRIPTION)]
    .map((m) => m[1])
    .filter((s) => s.length >= 8)
    .sort((a, b) => b.length - a.length)
  return found[0] ?? null
}

export type ArchivistCard = {
  id: string
  name: string
  platform: string
  url: string
  quote: string | null
  activeFrom?: string
  activeTo?: string
}

/**
 * 录播号名单。按"有没有留下自述"和账号档案的完整度排序，
 * 让那句「我不是女流，我只是女流直播录像的搬运工」自己浮到最前面。
 *
 * 说明一件事实：Source.account 目前填充率为 0，所以这里**没有**按条目署名的能力，
 * 这份名单是账号档案本身，不是"这一条是谁录的"。页面上必须照实说，不能暗示前者。
 */
export function buildArchivists(ds: Dataset, limit = 12): ArchivistCard[] {
  return [...ds.accounts.values()]
    .filter((a) => a.role === 'fan-archive')
    .map((a) => ({
      id: a.id,
      name: a.name,
      platform: a.platform,
      url: a.url,
      quote: selfDescription(a),
      activeFrom: a.active_from,
      activeTo: a.active_to,
    }))
    .sort((a, b) => (b.quote?.length ?? 0) - (a.quote?.length ?? 0))
    .slice(0, limit)
}

export type WallTile = {
  id: string
  date: string
  title: string
  cover: string
  span: number
  eraId: EraId
}

/**
 * 首页封面墙的取样。
 *
 * 2,662 张全铺进静态 HTML 会让首页体积失控，所以按**索引均匀抽样**——
 * 均匀抽样会自动保住真实密度比例（视频期 78 / 斗鱼期 2,040 / 抖音期 544），
 * 抽出来的墙上，2010 年就是稀的，2017 年就是密的。
 * 不要改成"每年取相同张数"来让版面均匀：那会把这个站最基本的一条事实抹平。
 */
export function buildCoverWall(entries: TimelineEntry[], target: number): WallTile[] {
  const withCover = [...entries]
    .filter((e) => e.cover)
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)))
  if (withCover.length === 0) return []

  const step = Math.max(1, withCover.length / target)
  const tiles: WallTile[] = []
  for (let i = 0; i < withCover.length; i += step) {
    const e = withCover[Math.floor(i)]
    if (!e?.cover) continue
    tiles.push({
      id: e.id,
      date: e.date,
      title: e.title,
      cover: e.cover,
      span: 1,
      eraId: eraOf(e.date).id,
    })
  }
  return tiles
}
