import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import {
  Account,
  AccountsFile,
  Entry,
  EntriesFile,
  Game,
  GamesFile,
  Series,
  SeriesFile,
  Source,
} from './schema'

const ROOT = process.cwd()
const DATA = path.join(ROOT, 'data')

function readYaml(file: string): unknown {
  if (!fs.existsSync(file)) return []
  return yaml.load(fs.readFileSync(file, 'utf8')) ?? []
}

function readDir(dir: string): unknown[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort()
    .flatMap((f) => {
      const parsed = readYaml(path.join(dir, f))
      return Array.isArray(parsed) ? parsed : [parsed]
    })
}

export type Dataset = {
  entries: Entry[]
  games: Map<string, Game>
  series: Map<string, Series>
  accounts: Map<string, Account>
  /** 真实数据为空、正在用演示数据兜底时为 true —— 前端必须显著标注 */
  isDemo: boolean
}

let cache: Dataset | null = null

export function getDataset(): Dataset {
  if (cache) return cache

  const real = readDir(path.join(DATA, 'entries'))
  const isDemo = real.length === 0
  const rawEntries = isDemo ? readDir(path.join(DATA, '_demo')) : real

  const entries = EntriesFile.parse(rawEntries).sort((a, b) =>
    b.date === a.date ? (b.time ?? '').localeCompare(a.time ?? '') : b.date.localeCompare(a.date),
  )

  const games = GamesFile.parse(readYaml(path.join(DATA, 'games.yaml')))
  const series = SeriesFile.parse(readYaml(path.join(DATA, 'series.yaml')))
  const accounts = AccountsFile.parse(readYaml(path.join(DATA, 'accounts.yaml')))

  cache = {
    entries,
    isDemo,
    games: new Map(games.map((g) => [g.id, g])),
    series: new Map(series.map((s) => [s.id, s])),
    accounts: new Map(accounts.map((a) => [a.id, a])),
  }
  return cache
}

/** 时间轴卡片需要的最小载荷，避免把整个数据集塞进客户端 */
export type TimelineEntry = {
  id: string
  type: 'live' | 'video'
  date: string
  time?: string
  title: string
  platform: string
  duration_min?: number
  games: { id: string; name: string }[]
  tags: string[]
  cover: string | null
  /** 默认来源的原平台地址；展开后可切换到其他来源。 */
  primaryUrl: string | null
  sources: TimelineSource[]
  /** 被数据审校明确标成同场、并在时间轴中折叠的其他记录数。 */
  mergedEntryCount: number
  confidence: string
  sourceCount: number
  /** 明确标记为 alive 的来源数；unchecked 不能冒充已核验可用。 */
  aliveCount: number
  uncheckedCount: number
  deadCount: number
  seriesName?: string
  /** 分段在时长上的占比，用于卡片上的色带 */
  bands: { game: string | null; name: string; from: number; to: number }[]
  demo?: boolean
}

export type TimelineSource = Pick<Source, 'url' | 'kind' | 'status'> & {
  accountName?: string
  /** 来源原本所属条目的标题，帮助用户区分不同录像版本。 */
  entryTitle: string
}

const SAME_LIVE_NOTE = /与 ([a-z0-9-]+) 属同场直播的不同录像，前端可作备选源切换/g

function linkedEntryIds(note?: string): string[] {
  if (!note) return []
  return [...note.matchAll(SAME_LIVE_NOTE)].map((match) => match[1])
}

/**
 * DeepSeek 的 #017 把同场录像保留为独立条目，并在 note 中互相标记。
 * 前端只消费这项明确标记，不按“同一天”猜测，避免误合并同日不同节目。
 */
export function buildSourceGroups(entries: Entry[]): Map<string, Entry[]> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const adjacent = new Map<string, Set<string>>()

  for (const entry of entries) {
    for (const linkedId of linkedEntryIds(entry.note)) {
      if (!byId.has(linkedId)) continue
      if (!adjacent.has(entry.id)) adjacent.set(entry.id, new Set())
      if (!adjacent.has(linkedId)) adjacent.set(linkedId, new Set())
      adjacent.get(entry.id)?.add(linkedId)
      adjacent.get(linkedId)?.add(entry.id)
    }
  }

  const groups = new Map<string, Entry[]>()
  for (const entry of entries) {
    if (groups.has(entry.id)) continue
    const pending = [entry.id]
    const seen = new Set<string>()
    while (pending.length) {
      const id = pending.pop()
      if (!id || seen.has(id)) continue
      seen.add(id)
      for (const neighbor of adjacent.get(id) ?? []) pending.push(neighbor)
    }
    const group = [...seen]
      .map((id) => byId.get(id))
      .filter((item): item is Entry => Boolean(item))
      .sort((a, b) => a.id.localeCompare(b.id))
    for (const item of group) groups.set(item.id, group)
  }
  return groups
}

export function toTimelineEntries(ds: Dataset): TimelineEntry[] {
  const groups = buildSourceGroups(ds.entries)

  return ds.entries.flatMap((e) => {
    const group = groups.get(e.id) ?? [e]
    if (group[0]?.id !== e.id) return []

    const sources = group
      .flatMap((item) => item.sources.map((source) => ({
        url: source.url,
        kind: source.kind,
        status: source.status,
        accountName: source.account ? ds.accounts.get(source.account)?.name : undefined,
        entryTitle: item.title,
      })))
      .filter((source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index)
    const total = (e.duration_min ?? 0) * 60
    const rawBands = e.segments.map((s, i) => {
      const from = hms(s.at)
      const next = e.segments[i + 1]
      const to = next ? hms(next.at) : total || from
      return {
        game: s.game ?? null,
        name: s.game ? (ds.games.get(s.game)?.name ?? s.game) : s.label,
        from: total ? from / total : 0,
        to: total ? Math.min(to / total, 1) : 0,
      }
    })

    // 首个分段之前的那段时间也要占位，否则色带会凭空少一截
    const lead = rawBands[0]?.from
    const bands =
      lead && lead > 0
        ? [{ game: null, name: '开播前 / 未分段', from: 0, to: lead }, ...rawBands]
        : rawBands

    return {
      id: e.id,
      type: e.type,
      date: e.date,
      time: e.time,
      title: e.title,
      platform: e.platform,
      duration_min: e.duration_min,
      games: e.games.map((g) => ({ id: g, name: ds.games.get(g)?.name ?? g })),
      tags: e.tags,
      cover: e.cover ?? null,
      primaryUrl: sources.find((source) => source.status === 'alive')?.url ?? sources[0]?.url ?? null,
      sources,
      mergedEntryCount: group.length - 1,
      confidence: e.confidence,
      sourceCount: sources.length,
      aliveCount: sources.filter((s) => s.status === 'alive').length,
      uncheckedCount: sources.filter((s) => s.status === 'unchecked').length,
      deadCount: sources.filter((s) => s.status === 'dead').length,
      seriesName: e.series ? ds.series.get(e.series)?.name : undefined,
      bands: total ? bands : [],
      demo: e.demo,
    }
  })
}

function hms(tc: string): number {
  const [h, m, s] = tc.split(':').map(Number)
  return h * 3600 + m * 60 + s
}
