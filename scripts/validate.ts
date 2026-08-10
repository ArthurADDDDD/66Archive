/**
 * 数据校验闸门。任何数据 PR 必须先过这里。
 *   npm run validate
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import {
  AccountsFile,
  EntriesFile,
  GamesFile,
  SeriesFile,
  type Entry,
} from '../src/lib/schema'

const DATA = path.join(process.cwd(), 'data')
const errors: string[] = []
const warnings: string[] = []

function load(file: string): unknown {
  const p = path.join(DATA, file)
  if (!fs.existsSync(p)) return []
  return yaml.load(fs.readFileSync(p, 'utf8')) ?? []
}

function loadDir(dir: string): { file: string; items: unknown[] }[] {
  const p = path.join(DATA, dir)
  if (!fs.existsSync(p)) return []
  return fs
    .readdirSync(p)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => {
      const parsed = yaml.load(fs.readFileSync(path.join(p, f), 'utf8')) ?? []
      return { file: `${dir}/${f}`, items: Array.isArray(parsed) ? parsed : [parsed] }
    })
}

function parseOrFail<T>(schema: { parse: (v: unknown) => T }, value: unknown, where: string): T | null {
  try {
    return schema.parse(value)
  } catch (err) {
    const issues = (err as { issues?: { path: (string | number)[]; message: string }[] }).issues
    if (issues) {
      for (const i of issues) errors.push(`${where} → [${i.path.join('.')}] ${i.message}`)
    } else {
      errors.push(`${where} → ${String(err)}`)
    }
    return null
  }
}

const games = parseOrFail(GamesFile, load('games.yaml'), 'games.yaml') ?? []
const series = parseOrFail(SeriesFile, load('series.yaml'), 'series.yaml') ?? []
const accounts = parseOrFail(AccountsFile, load('accounts.yaml'), 'accounts.yaml') ?? []

const gameIds = new Set(games.map((g) => g.id))
const seriesIds = new Set(series.map((s) => s.id))
const accountIds = new Set(accounts.map((a) => a.id))

const entries: Entry[] = []
const seenId = new Map<string, string>()

for (const { file, items } of [...loadDir('entries'), ...loadDir('_demo')]) {
  const parsed = parseOrFail(EntriesFile, items, file)
  if (!parsed) continue
  for (const e of parsed) {
    const prev = seenId.get(e.id)
    if (prev) errors.push(`${file} → id 重复 "${e.id}"（另一处在 ${prev}）`)
    else seenId.set(e.id, file)

    // 引用完整性：外键必须存在，否则前端会静默显示成裸 id
    for (const g of e.games) {
      if (!gameIds.has(g)) errors.push(`${file} → "${e.id}" 引用了未登记的游戏 "${g}"`)
    }
    if (e.series && !seriesIds.has(e.series)) {
      errors.push(`${file} → "${e.id}" 引用了未登记的系列 "${e.series}"`)
    }
    for (const s of e.sources) {
      if (s.account && !accountIds.has(s.account)) {
        errors.push(`${file} → "${e.id}" 的源引用了未登记的账号 "${s.account}"`)
      }
    }

    // 数据质量提醒（不阻断合并，但要看得见）
    if (e.sources.length === 0) warnings.push(`"${e.id}" 没有任何来源链接`)
    if (e.type === 'live' && !e.duration_min) warnings.push(`"${e.id}" 是直播但缺时长`)
    if (e.confidence === 'low' && !e.note) {
      warnings.push(`"${e.id}" 标了 confidence: low 但没写 note 说明存疑点`)
    }
    if (e.date > new Date().toISOString().slice(0, 10)) {
      errors.push(`${file} → "${e.id}" 的日期在未来`)
    }
    entries.push(e)
  }
}

const real = entries.filter((e) => !e.demo)
const demo = entries.filter((e) => e.demo)

console.log('')
console.log(`  条目 ${real.length} 条（另有演示数据 ${demo.length} 条）`)
console.log(`  游戏 ${games.length} · 系列 ${series.length} · 账号 ${accounts.length}`)

if (warnings.length) {
  console.log(`\n  ⚠ ${warnings.length} 条提醒`)
  for (const w of warnings.slice(0, 20)) console.log(`    · ${w}`)
  if (warnings.length > 20) console.log(`    …… 还有 ${warnings.length - 20} 条`)
}

if (errors.length) {
  console.error(`\n  ✗ ${errors.length} 条错误，校验未通过\n`)
  for (const e of errors) console.error(`    · ${e}`)
  console.error('')
  process.exit(1)
}

console.log('\n  ✓ 校验通过\n')
