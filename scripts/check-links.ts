/**
 * 只读链接存活检查。
 *
 * 默认扫描 data/entries 下的真实条目，只输出汇总，不修改 YAML：
 *   npx tsx scripts/check-links.ts --report
 *
 * 常用选项：
 *   --host bilibili.com    只检查指定主机
 *   --limit 20             最多检查 20 个唯一 URL
 *   --concurrency 6        并发数（默认 8）
 *   --timeout-ms 10000     单链接超时（默认 10000）
 *   --output report.json   将完整 JSON 报告写入指定文件
 *   --json                 将完整 JSON 报告输出到 stdout
 */

import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { EntriesFile, type Entry } from '../src/lib/schema'

type SuggestedStatus = 'alive' | 'dead' | 'unchecked'

interface Options {
  concurrency: number
  timeoutMs: number
  limit?: number
  host?: string
  output?: string
  json: boolean
  help: boolean
}

interface SourceReference {
  entryId: string
  file: string
  currentStatus: SuggestedStatus
}

interface LinkTarget {
  url: string
  host: string
  references: SourceReference[]
}

interface LinkResult extends LinkTarget {
  suggestedStatus: SuggestedStatus
  httpStatus?: number
  finalUrl?: string
  latencyMs: number
  reason: string
}

interface Report {
  generatedAt: string
  readOnly: true
  options: {
    concurrency: number
    timeoutMs: number
    limit: number | null
    host: string | null
  }
  inventory: {
    entryCount: number
    sourceReferences: number
    uniqueUrls: number
    selectedUrls: number
  }
  summary: {
    alive: number
    dead: number
    unchecked: number
    elapsedMs: number
  }
  byHost: Record<string, { total: number; alive: number; dead: number; unchecked: number }>
  results: LinkResult[]
}

const DATA_ENTRIES = path.join(process.cwd(), 'data', 'entries')

function usage(): string {
  return `
链接存活检查（只读，不回写 YAML）

用法：
  npx tsx scripts/check-links.ts --report [选项]

选项：
  --host <hostname>       只检查指定主机（支持 acfun.cn 等后缀匹配）
  --limit <number>        限制唯一 URL 数量
  --concurrency <number>  并发数，默认 8
  --timeout-ms <number>   单链接超时，默认 10000
  --output <file>         写出完整 JSON 报告
  --json                  将完整 JSON 报告输出到 stdout
  --help                  显示帮助

判定规则：
  2xx/3xx      → alive
  404/410      → dead
  其他 HTTP、超时、网络错误 → unchecked
`.trim()
}

function positiveInt(flag: string, raw: string | undefined): number {
  const value = Number(raw)
  if (!raw || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} 必须是正整数`)
  }
  return value
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    concurrency: 8,
    timeoutMs: 10_000,
    json: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--report':
        break
      case '--host':
        options.host = argv[++i]?.toLowerCase().replace(/^www\./, '')
        if (!options.host) throw new Error('--host 需要主机名')
        break
      case '--limit':
        options.limit = positiveInt('--limit', argv[++i])
        break
      case '--concurrency':
        options.concurrency = positiveInt('--concurrency', argv[++i])
        break
      case '--timeout-ms':
        options.timeoutMs = positiveInt('--timeout-ms', argv[++i])
        break
      case '--output':
        options.output = argv[++i]
        if (!options.output) throw new Error('--output 需要文件路径')
        break
      case '--json':
        options.json = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new Error(`未知参数：${arg}`)
    }
  }

  return options
}

function normalizeHost(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
}

function hostMatches(actual: string, requested: string): boolean {
  return actual === requested || actual.endsWith(`.${requested}`)
}

function loadTargets(): {
  entryCount: number
  sourceReferences: number
  targets: LinkTarget[]
} {
  if (!fs.existsSync(DATA_ENTRIES)) throw new Error(`目录不存在：${DATA_ENTRIES}`)

  const links = new Map<string, LinkTarget>()
  let entryCount = 0
  let sourceReferences = 0

  for (const filename of fs.readdirSync(DATA_ENTRIES).filter((file) => /\.ya?ml$/.test(file)).sort()) {
    const absolute = path.join(DATA_ENTRIES, filename)
    const raw = yaml.load(fs.readFileSync(absolute, 'utf8')) ?? []
    const entries: Entry[] = EntriesFile.parse(raw)
    entryCount += entries.length

    for (const entry of entries) {
      for (const source of entry.sources) {
        sourceReferences++
        const reference: SourceReference = {
          entryId: entry.id,
          file: `data/entries/${filename}`,
          currentStatus: source.status,
        }
        const existing = links.get(source.url)
        if (existing) {
          existing.references.push(reference)
        } else {
          links.set(source.url, {
            url: source.url,
            host: normalizeHost(source.url),
            references: [reference],
          })
        }
      }
    }
  }

  return { entryCount, sourceReferences, targets: [...links.values()] }
}

function statusFromHttp(target: LinkTarget, status: number): { status: SuggestedStatus; reason: string } {
  if (status >= 200 && status < 400) {
    const previouslyDead = target.references.some((reference) => reference.currentStatus === 'dead')
    if (previouslyDead) {
      return {
        status: 'unchecked',
        reason: `HTTP ${status} 与现有 dead 冲突，可能是平台软 404，需内容级复核`,
      }
    }
    return { status: 'alive', reason: `HTTP ${status}` }
  }
  if (status === 404 || status === 410) return { status: 'dead', reason: `HTTP ${status}` }
  return { status: 'unchecked', reason: `HTTP ${status} 不足以确认链接失效` }
}

function networkReason(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return '请求超时'
    return `${error.name}: ${error.message}`
  }
  return String(error)
}

async function probe(target: LinkTarget, timeoutMs: number): Promise<LinkResult> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        Range: 'bytes=0-0',
        'User-Agent':
          'Mozilla/5.0 (compatible; Chronicle66LinkChecker/0.1; +https://github.com/ArthurADDDDD/66archive)',
      },
    })
    const decision = statusFromHttp(target, response.status)
    await response.body?.cancel().catch(() => undefined)
    return {
      ...target,
      suggestedStatus: decision.status,
      httpStatus: response.status,
      finalUrl: response.url,
      latencyMs: Date.now() - started,
      reason: decision.reason,
    }
  } catch (error) {
    return {
      ...target,
      suggestedStatus: 'unchecked',
      latencyMs: Date.now() - started,
      reason: networkReason(error),
    }
  } finally {
    clearTimeout(timer)
  }
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let cursor = 0

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++
      if (index >= values.length) return
      results[index] = await mapper(values[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

function summarizeByHost(results: LinkResult[]): Report['byHost'] {
  const byHost: Report['byHost'] = {}
  for (const result of results) {
    const current = byHost[result.host] ?? { total: 0, alive: 0, dead: 0, unchecked: 0 }
    current.total++
    current[result.suggestedStatus]++
    byHost[result.host] = current
  }
  return Object.fromEntries(Object.entries(byHost).sort(([a], [b]) => a.localeCompare(b)))
}

function printSummary(report: Report): void {
  console.log('')
  console.log('  链接检查报告（只读）')
  console.log(
    `  条目 ${report.inventory.entryCount} · 来源引用 ${report.inventory.sourceReferences} · 唯一 URL ${report.inventory.uniqueUrls}`,
  )
  console.log(`  本次检查 ${report.inventory.selectedUrls} 个 URL · 用时 ${report.summary.elapsedMs} ms`)
  console.log(
    `  ✓ alive ${report.summary.alive} · ✗ dead ${report.summary.dead} · ? unchecked ${report.summary.unchecked}`,
  )

  for (const [host, counts] of Object.entries(report.byHost)) {
    console.log(
      `    ${host}: ${counts.total}（alive ${counts.alive} / dead ${counts.dead} / unchecked ${counts.unchecked}）`,
    )
  }

  const attention = report.results.filter((result) => result.suggestedStatus !== 'alive')
  if (attention.length) {
    console.log(`\n  需要关注（显示前 ${Math.min(20, attention.length)} 条）`)
    for (const result of attention.slice(0, 20)) {
      console.log(`    · [${result.suggestedStatus}] ${result.reason} · ${result.url}`)
    }
    if (attention.length > 20) console.log(`    …… 还有 ${attention.length - 20} 条，请使用 --output 查看完整报告`)
  }
  console.log('')
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const inventory = loadTargets()
  let selected = inventory.targets
  if (options.host) selected = selected.filter((target) => hostMatches(target.host, options.host!))
  if (options.limit) selected = selected.slice(0, options.limit)

  const started = Date.now()
  const results = await mapConcurrent(selected, options.concurrency, (target) => probe(target, options.timeoutMs))
  const count = (status: SuggestedStatus) => results.filter((result) => result.suggestedStatus === status).length
  const report: Report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    options: {
      concurrency: options.concurrency,
      timeoutMs: options.timeoutMs,
      limit: options.limit ?? null,
      host: options.host ?? null,
    },
    inventory: {
      entryCount: inventory.entryCount,
      sourceReferences: inventory.sourceReferences,
      uniqueUrls: inventory.targets.length,
      selectedUrls: results.length,
    },
    summary: {
      alive: count('alive'),
      dead: count('dead'),
      unchecked: count('unchecked'),
      elapsedMs: Date.now() - started,
    },
    byHost: summarizeByHost(results),
    results,
  }

  const serialized = `${JSON.stringify(report, null, 2)}\n`
  if (options.output) {
    const output = path.resolve(options.output)
    fs.writeFileSync(output, serialized)
    console.error(`完整报告已写入 ${output}`)
  }
  if (options.json) process.stdout.write(serialized)
  else printSummary(report)
}

main().catch((error) => {
  console.error(`链接检查失败：${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
