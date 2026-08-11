/**
 * 数据质量审计（只读）。
 *
 *   npx tsx scripts/audit-data.ts
 *   npx tsx scripts/audit-data.ts --json
 *   npx tsx scripts/audit-data.ts --output /tmp/data-audit.json
 *
 * 本脚本只报告疑点，不修改 data/**，也不把“空月”自动认定为漏采。
 */

import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import {
  AccountsFile,
  EntriesFile,
  GamesFile,
  SeriesFile,
  type Account,
  type Entry,
  type Game,
} from '../src/lib/schema'

interface Options {
  json: boolean
  output?: string
  help: boolean
}

interface EntryRecord {
  entry: Entry
  file: string
}

interface MissingMonthGroup {
  label: string
  from: string
  to: string
  months: string[]
  note: string
}

interface AuditReport {
  generatedAt: string
  readOnly: true
  totals: {
    entries: number
    files: number
    games: number
    series: number
    accounts: number
  }
  distribution: {
    byType: Record<string, number>
    byPlatform: Record<string, number>
    byConfidence: Record<string, number>
    bySourceStatus: Record<string, number>
  }
  coverage: {
    withDuration: number
    withGames: number
    withSeries: number
    withSegments: number
    withTime: number
    withCover: number
    withoutSources: number
    allSourcesDead: number
  }
  missingMonths: MissingMonthGroup[]
  duplicateIds: { id: string; files: string[] }[]
  duplicateUrls: { url: string; entryIds: string[] }[]
  possibleDuplicateEntries: { date: string; title: string; entryIds: string[] }[]
  titleGameCandidates: { entryId: string; title: string; gameId: string; matched: string }[]
  lowConfidenceWithoutNote: { entryId: string; file: string }[]
}

const ROOT = process.cwd()
const DATA = path.join(ROOT, 'data')

function usage(): string {
  return `
数据质量审计（只读）

用法：
  npx tsx scripts/audit-data.ts [--json] [--output <file>]

选项：
  --json          将完整 JSON 输出到 stdout
  --output <file> 将完整 JSON 写入指定文件
  --help          显示帮助
`.trim()
}

function parseArgs(argv: string[]): Options {
  const options: Options = { json: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--json':
        options.json = true
        break
      case '--output':
        options.output = argv[++i]
        if (!options.output) throw new Error('--output 需要文件路径')
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new Error(`未知参数：${argv[i]}`)
    }
  }
  return options
}

function readYaml(file: string): unknown {
  return yaml.load(fs.readFileSync(file, 'utf8')) ?? []
}

function loadEntries(): EntryRecord[] {
  const directory = path.join(DATA, 'entries')
  const records: EntryRecord[] = []
  for (const filename of fs.readdirSync(directory).filter((file) => /\.ya?ml$/.test(file)).sort()) {
    const entries = EntriesFile.parse(readYaml(path.join(directory, filename)))
    records.push(...entries.map((entry) => ({ entry, file: `data/entries/${filename}` })))
  }
  return records
}

function countBy<T>(values: T[], key: (value: T) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) {
    const name = key(value)
    counts[name] = (counts[name] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

function monthIndex(month: string): number {
  const [year, value] = month.split('-').map(Number)
  return year * 12 + value - 1
}

function monthFromIndex(index: number): string {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

function missingMonths(from: string, to: string, present: Set<string>): string[] {
  const missing: string[] = []
  for (let index = monthIndex(from); index <= monthIndex(to); index++) {
    const month = monthFromIndex(index)
    if (!present.has(month)) missing.push(month)
  }
  return missing
}

function spanFor(entries: Entry[]): { from: string; to: string } | null {
  if (!entries.length) return null
  const months = entries.map((entry) => entry.date.slice(0, 7)).sort()
  return { from: months[0], to: months.at(-1)! }
}

function collectMissingMonths(records: EntryRecord[], accounts: Account[]): MissingMonthGroup[] {
  const groups: MissingMonthGroup[] = []
  const entries = records.map((record) => record.entry)

  for (const [label, selected] of [
    ['video 条目内部跨度', entries.filter((entry) => entry.type === 'video')],
    ['douyu 直播条目内部跨度', entries.filter((entry) => entry.type === 'live' && entry.platform === 'douyu')],
    ['douyin 直播条目内部跨度', entries.filter((entry) => entry.type === 'live' && entry.platform === 'douyin')],
  ] as const) {
    const span = spanFor(selected)
    if (!span) continue
    const present = new Set(selected.map((entry) => entry.date.slice(0, 7)))
    groups.push({
      label,
      ...span,
      months: missingMonths(span.from, span.to, present),
      note: '仅表示首末条目之间没有记录，不等于确认漏采。',
    })
  }

  const maxEntryMonth = entries.map((entry) => entry.date.slice(0, 7)).sort().at(-1)
  // Entry.platform 表示首播平台，不是每个回放 source 的平台。
  // 因此这里只用斗鱼/抖音官方直播账号窗口检查直播覆盖；B 站搬运和未注明
  // active_to 的优酷账号不能据此推断时间轴空月。
  for (const account of accounts.filter(
    (item) => item.role === 'official' && item.active_from && ['douyu', 'douyin'].includes(item.platform),
  )) {
    const selected = entries.filter((entry) => entry.platform === account.platform)
    const present = new Set(selected.map((entry) => entry.date.slice(0, 7)))
    const to = account.active_to ?? maxEntryMonth
    if (!to || monthIndex(to) < monthIndex(account.active_from!)) continue
    groups.push({
      label: `${account.name}（${account.platform}）账号活跃期`,
      from: account.active_from!,
      to,
      months: missingMonths(account.active_from!, to, present),
      note: '依据 accounts.yaml 的账号活跃期列出；空月可能是停更、停播或尚未采集。',
    })
  }

  return groups
}

function normalizeTitle(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

function findDuplicates(records: EntryRecord[]): Pick<
  AuditReport,
  'duplicateIds' | 'duplicateUrls' | 'possibleDuplicateEntries'
> {
  const ids = new Map<string, Set<string>>()
  const urls = new Map<string, Set<string>>()
  const titleKeys = new Map<string, Entry[]>()

  for (const { entry, file } of records) {
    const files = ids.get(entry.id) ?? new Set<string>()
    files.add(file)
    ids.set(entry.id, files)

    for (const source of entry.sources) {
      const entryIds = urls.get(source.url) ?? new Set<string>()
      entryIds.add(entry.id)
      urls.set(source.url, entryIds)
    }

    const key = `${entry.date}|${normalizeTitle(entry.title)}`
    const group = titleKeys.get(key) ?? []
    group.push(entry)
    titleKeys.set(key, group)
  }

  return {
    duplicateIds: [...ids]
      .filter(([, files]) => files.size > 1)
      .map(([id, files]) => ({ id, files: [...files].sort() })),
    duplicateUrls: [...urls]
      .filter(([, entryIds]) => entryIds.size > 1)
      .map(([url, entryIds]) => ({ url, entryIds: [...entryIds].sort() })),
    possibleDuplicateEntries: [...titleKeys.values()]
      .filter((entries) => entries.length > 1)
      .map((entries) => ({
        date: entries[0].date,
        title: entries[0].title,
        entryIds: entries.map((entry) => entry.id).sort(),
      })),
  }
}

function containsTerm(title: string, term: string): boolean {
  const normalizedTitle = title.normalize('NFKC').toLowerCase()
  const normalizedTerm = term.normalize('NFKC').toLowerCase().trim()
  if (!normalizedTerm) return false
  if (/^[a-z0-9]+$/i.test(normalizedTerm)) {
    const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(normalizedTitle)
  }
  return normalizedTitle.includes(normalizedTerm)
}

function titleGameCandidates(records: EntryRecord[], games: Game[]): AuditReport['titleGameCandidates'] {
  const candidates: AuditReport['titleGameCandidates'] = []
  for (const { entry } of records) {
    for (const game of games) {
      if (entry.games.includes(game.id)) continue
      const matched = [game.name, ...game.aliases]
        .filter((term) => term.length >= 2)
        .sort((a, b) => b.length - a.length)
        .find((term) => containsTerm(entry.title, term))
      if (matched) candidates.push({ entryId: entry.id, title: entry.title, gameId: game.id, matched })
    }
  }
  return candidates
}

function createReport(): AuditReport {
  const records = loadEntries()
  const entries = records.map((record) => record.entry)
  const games = GamesFile.parse(readYaml(path.join(DATA, 'games.yaml')))
  const series = SeriesFile.parse(readYaml(path.join(DATA, 'series.yaml')))
  const accounts = AccountsFile.parse(readYaml(path.join(DATA, 'accounts.yaml')))
  const sources = entries.flatMap((entry) => entry.sources)
  const duplicates = findDuplicates(records)

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    totals: {
      entries: entries.length,
      files: new Set(records.map((record) => record.file)).size,
      games: games.length,
      series: series.length,
      accounts: accounts.length,
    },
    distribution: {
      byType: countBy(entries, (entry) => entry.type),
      byPlatform: countBy(entries, (entry) => entry.platform),
      byConfidence: countBy(entries, (entry) => entry.confidence),
      bySourceStatus: countBy(sources, (source) => source.status),
    },
    coverage: {
      withDuration: entries.filter((entry) => entry.duration_min).length,
      withGames: entries.filter((entry) => entry.games.length).length,
      withSeries: entries.filter((entry) => entry.series).length,
      withSegments: entries.filter((entry) => entry.segments.length).length,
      withTime: entries.filter((entry) => entry.time).length,
      withCover: entries.filter((entry) => entry.cover).length,
      withoutSources: entries.filter((entry) => !entry.sources.length).length,
      allSourcesDead: entries.filter(
        (entry) => entry.sources.length > 0 && entry.sources.every((source) => source.status === 'dead'),
      ).length,
    },
    missingMonths: collectMissingMonths(records, accounts),
    ...duplicates,
    titleGameCandidates: titleGameCandidates(records, games),
    lowConfidenceWithoutNote: records
      .filter(({ entry }) => entry.confidence === 'low' && !entry.note)
      .map(({ entry, file }) => ({ entryId: entry.id, file })),
  }
}

function percent(value: number, total: number): string {
  return total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%'
}

function printReport(report: AuditReport): void {
  const total = report.totals.entries
  console.log('')
  console.log('  数据质量审计（只读）')
  console.log(
    `  条目 ${total} · 文件 ${report.totals.files} · 游戏 ${report.totals.games} · 系列 ${report.totals.series} · 账号 ${report.totals.accounts}`,
  )
  console.log(`  类型：${Object.entries(report.distribution.byType).map(([key, value]) => `${key} ${value}`).join(' · ')}`)
  console.log(
    `  覆盖：时长 ${report.coverage.withDuration} (${percent(report.coverage.withDuration, total)}) · 游戏 ${report.coverage.withGames} (${percent(report.coverage.withGames, total)}) · 系列 ${report.coverage.withSeries} (${percent(report.coverage.withSeries, total)}) · 分段 ${report.coverage.withSegments} (${percent(report.coverage.withSegments, total)})`,
  )
  console.log(
    `  疑点：重复 ID ${report.duplicateIds.length} · 重复 URL ${report.duplicateUrls.length} · 同日同标题 ${report.possibleDuplicateEntries.length} · 标题游戏候选 ${report.titleGameCandidates.length}`,
  )

  console.log('\n  空月份（仅供调查，不代表确认漏采）')
  for (const group of report.missingMonths) {
    const display = group.months.length ? group.months.join(', ') : '无'
    console.log(`    · ${group.label} ${group.from}~${group.to}: ${display}`)
  }

  if (report.possibleDuplicateEntries.length) {
    console.log(`\n  同日同标题（显示前 ${Math.min(10, report.possibleDuplicateEntries.length)} 组）`)
    for (const item of report.possibleDuplicateEntries.slice(0, 10)) {
      console.log(`    · ${item.date} ${item.title}: ${item.entryIds.join(', ')}`)
    }
  }

  if (report.titleGameCandidates.length) {
    console.log(`\n  标题明确游戏候选（显示前 ${Math.min(10, report.titleGameCandidates.length)} 条）`)
    for (const item of report.titleGameCandidates.slice(0, 10)) {
      console.log(`    · ${item.entryId}: ${item.gameId}（命中“${item.matched}”）`)
    }
  }
  console.log('')
}

function main(): void {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const report = createReport()
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  if (options.output) {
    const output = path.resolve(options.output)
    fs.writeFileSync(output, serialized)
    console.error(`完整报告已写入 ${output}`)
  }
  if (options.json) process.stdout.write(serialized)
  else printReport(report)
}

try {
  main()
} catch (error) {
  console.error(`数据审计失败：${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
