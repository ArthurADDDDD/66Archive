/**
 * 页面文字（`SITE_COPY.texts`）的登记检查。
 *
 * 这几百条文字散在几十个组件里，靠人对不可能不漏。漏登记在页面上表现为直接显示 id，
 * 多登记（组件已经不用了）会在后台留下一条改了也没用的输入框——两种都不报错，所以在这里拦。
 *
 *   npm run test:site-texts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { SITE_COPY } from '../src/lib/site-copy'

/** id 前缀 = 这句话随哪些页面烤进 HTML。新前缀要同时在对应页面的烤入里点名。 */
const KNOWN_PREFIXES = [
  'site-', 'home-', 'trail-', 'stats-', 'gallery-', 'games-', 'game-', 'series-',
  'chronicle-', 'archive-', 'entry-', 'contact-', 'form-',
]

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = path.join(dir, item.name)
    if (item.isDirectory()) return walk(full)
    return /\.(ts|tsx)$/.test(item.name) ? [full] : []
  })
}

const problems: string[] = []
const registered = new Set(SITE_COPY.texts.map((item) => item.id))
const used = new Map<string, string[]>()
const note = (id: string, file: string) => used.set(id, [...(used.get(id) ?? []), file])

for (const file of walk('src')) {
  if (file.endsWith(path.join('lib', 'site-copy.ts'))) continue
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/<SiteText(?:Paragraphs)?\s+id="([^"]+)"/g)) note(match[1], file)
  for (const match of source.matchAll(/useSiteText\('([^']+)'\)/g)) note(match[1], file)
  // useSiteTexts() 约定赋给 `t`：只在调用了它的文件里认 t('…')，免得误抓别的同名函数。
  if (/const t = useSiteTexts\(\)/.test(source)) {
    for (const match of source.matchAll(/\bt\('([a-z][a-z0-9-]*)'/g)) note(match[1], file)
  }
  if (/<SiteText(?:Paragraphs)?\s+id=\{/.test(source)) problems.push(`${file}：SiteText 的 id 必须是字面量，动态拼出来的 id 这里查不到`)
  // 放在常量表里、再用 t(item.xxx) 取的那种（如联系页的三种来意）：
  // 源码里只要出现一个和已登记 id 完全相同的字符串字面量，就算用到。
  for (const match of source.matchAll(/'([a-z][a-z0-9-]*)'/g)) {
    if (registered.has(match[1])) note(match[1], file)
  }
}

const ids = SITE_COPY.texts.map((item) => item.id)
const seen = new Set<string>()
for (const item of SITE_COPY.texts) {
  if (seen.has(item.id)) problems.push(`重复的 id：${item.id}`)
  seen.add(item.id)
  if (!KNOWN_PREFIXES.some((prefix) => item.id.startsWith(prefix))) problems.push(`${item.id}：前缀不在已知分组里（见 KNOWN_PREFIXES）`)
  if (!item.group.trim() || !item.label.trim()) problems.push(`${item.id}：group / label 不能为空`)
  if (!item.text.trim()) problems.push(`${item.id}：基线文字不能为空`)
  const tokens = new Set([...item.text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]))
  const declared = new Set(item.vars ?? [])
  for (const token of tokens) if (!declared.has(token)) problems.push(`${item.id}：文字里的 {${token}} 没写进 vars`)
  for (const name of declared) if (!tokens.has(name)) problems.push(`${item.id}：vars 里的 ${name} 在基线文字里没出现`)
}

for (const [id, files] of used) {
  if (!seen.has(id)) problems.push(`${id}：组件在用但没有登记（${[...new Set(files)].join('、')}）`)
}
for (const id of ids) {
  if (!used.has(id)) problems.push(`${id}：登记了但没有组件在用`)
}

if (problems.length > 0) {
  console.error(problems.map((line) => `  ✗ ${line}`).join('\n'))
}
assert.equal(problems.length, 0, `页面文字登记有 ${problems.length} 处问题`)
console.log(`site texts: ${ids.length} 条登记，${used.size} 个 id 在组件里用到，全部对得上`)
