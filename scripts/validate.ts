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
  TagsFile,
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
const tags = parseOrFail(TagsFile, load('tags.yaml'), 'tags.yaml') ?? []

const gameIds = new Set(games.map((g) => g.id))
const seriesIds = new Set(series.map((s) => s.id))
const accountIds = new Set(accounts.map((a) => a.id))
const tagNames = new Set(tags.map((t) => t.name))

// 词表自身的一致性
const seenTag = new Set<string>()
for (const tag of tags) {
  if (seenTag.has(tag.name)) errors.push(`tags.yaml → 标签 "${tag.name}" 重复登记`)
  seenTag.add(tag.name)
  if (tag.binds_series && !seriesIds.has(tag.binds_series)) {
    errors.push(`tags.yaml → 标签 "${tag.name}" 的 binds_series 指向未登记的系列 "${tag.binds_series}"`)
  }
}

// 与系列同名的标签是承重耦合（series.ts / relations.ts 按名字精确匹配），必须显式声明。
// 不声明的话，将来给 series.yaml 加一个恰好与某标签同名的系列，会静默改变前台归类。
const seriesNameToId = new Map(series.map((s) => [s.name, s.id]))
for (const tag of tags) {
  const collidingId = seriesNameToId.get(tag.name)
  if (collidingId && tag.binds_series !== collidingId) {
    errors.push(
      `tags.yaml → 标签 "${tag.name}" 与系列 "${collidingId}" 同名，前端会据此归类，` +
        `必须写明 binds_series: ${collidingId}`,
    )
  }
  if (tag.binds_series && !collidingId) {
    errors.push(`tags.yaml → 标签 "${tag.name}" 声明了 binds_series，但没有同名系列，归类不会发生`)
  }
}

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
    for (const t of e.tags) {
      if (!tagNames.has(t)) {
        errors.push(`${file} → "${e.id}" 使用了未登记的标签 "${t}"（需先加进 data/tags.yaml）`)
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
console.log(`  游戏 ${games.length} · 系列 ${series.length} · 账号 ${accounts.length} · 标签 ${tags.length}`)

const usedTags = new Set(entries.flatMap((e) => e.tags))
const unusedTags = tags.filter((t) => !usedTags.has(t.name)).map((t) => t.name)
if (unusedTags.length) warnings.push(`标签词表里有 ${unusedTags.length} 个暂未被使用：${unusedTags.join('、')}`)

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
