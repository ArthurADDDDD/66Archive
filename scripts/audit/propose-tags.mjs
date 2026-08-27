/**
 * 把人给的归类规则，套到「没有任何内容标注」的条目上，产出一份**建议**（只读）。
 *
 *   node scripts/audit/propose-tags.mjs            打印摘要
 *   node scripts/audit/propose-tags.mjs --json     产出 tag-proposals.json（清点页会读它）
 *
 * 规则不是机器猜的，是 2026-08-27 人工逐条反馈 + 四个分类问题的回答定下来的：
 *   1. 标题直接写了分类的（砒霜 / 佩奇 / 一起see / 一起看）→ 照写
 *   2. 展会·活动·发布会**现场**（人在直播间外）→ 户外
 *   3. 远程看发布会 → 一起See
 *   4. 歌友会 / 唱歌 → 佩奇 + 聊天
 *   5. 其余没游戏的：出门在外 → 户外；在直播间里 → 聊天
 *
 * **这个脚本不写 data/**。** 它只产出建议，由人在清点页上逐条确认或否掉。
 * 规则 5 那批必然有误判——出门/在家只能从标题猜，猜错很正常，否掉即可。
 */

import { readFile, writeFile } from 'node:fs/promises'
import { glob } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')

async function loadEntries() {
  const files = []
  for await (const f of glob(path.join(REPO, 'data/entries/*.yaml'))) files.push(f)
  files.sort()
  const out = []
  for (const file of files) {
    const docs = yaml.load(await readFile(file, 'utf8')) || []
    for (const e of docs) {
      if (!e || typeof e !== 'object' || !e.id) continue
      out.push({
        id: e.id,
        file: path.relative(REPO, file),
        date: e.date || '',
        title: e.title || '',
        type: e.type || '',
        tags: e.tags || [],
        games: e.games || [],
        series: e.series || null,
      })
    }
  }
  return out
}

/** 规则按顺序匹配，先命中的赢；confidence 决定人要不要重点复核。 */
const RULES = [
  // —— 1. 标题直接写了 ——
  { id: 'title-pishuang', test: /砒霜|pishuang/i, tags: ['心灵砒霜'], confidence: 'high',
    why: '标题里直接写了心灵砒霜' },
  { id: 'title-yiqi-see', test: /一起see|一起看/i, tags: ['一起See'], confidence: 'high',
    why: '标题里直接写了一起see / 一起看' },

  // —— 4. 歌友会 / 唱歌（放在佩奇之前：「佩奇的唱歌歌友会」按这条走）——
  { id: 'singing', test: /歌友会|唱歌|K起来|歌会/i, tags: ['佩奇', '聊天'], confidence: 'high',
    why: '歌友会 / 唱歌场次，人工定为佩奇 + 聊天' },

  { id: 'title-peiqi', test: /佩奇/, tags: ['佩奇'], confidence: 'high',
    why: '标题里直接写了佩奇' },

  // —— 2/3. 展会与发布会：带「现场 / 展台 / 展会」的是人在外面，其余是远程看 ——
  { id: 'expo-onsite', test: /现场|展台|展会|漫展|ACG展|峰会|年会|盛典|嘉年华|核聚变|见闻|游戏展/i,
    tags: ['户外'], confidence: 'high',
    why: '展会 / 活动现场，人在直播间外' },
  { id: 'presentation-remote', test: /发布会|直面会|State of Play|Direct/i,
    tags: ['一起See'], confidence: 'high',
    why: '远程看发布会' },

  // —— 5. 其余：出门在外 vs 在直播间里。这两条**只能从标题猜**，误判在所难免 ——
  {
    id: 'outdoor-guess',
    test: /出门|逛|在路上|钓|草原|旅|爬山|散步|遛|外面|公园|海边|街|探店|旅行|京都|神社|高铁|猴山|王府井|大明塔|汗蒸|做头发|拍照|拍摄|活动|吃货|火锅|一日吃|溜达|自驾|骑行|露营|野餐|采摘|温泉|滑雪|开学|上海|重庆|广州|北京核聚变|成都/i,
    tags: ['户外'], confidence: 'guess',
    why: '标题读着像人在直播间外——只能靠标题猜，判错就否掉',
  },
  {
    id: 'chat-guess',
    test: /.*/,
    tags: ['聊天'], confidence: 'guess',
    why: '没有游戏、也看不出在外面，按「在直播间里跟大家待着」归为聊天',
  },
]

const entries = await loadEntries()
const untagged = entries.filter((e) => !e.games.length && !e.tags.length && !e.series)

const proposals = {}
const byRule = new Map()
for (const e of untagged) {
  const rule = RULES.find((r) => r.test.test(e.title))
  if (!rule) continue
  proposals[e.id] = { id: e.id, tags: rule.tags, rule: rule.id, why: rule.why, confidence: rule.confidence, title: e.title, date: e.date, file: e.file }
  if (!byRule.has(rule.id)) byRule.set(rule.id, [])
  byRule.get(rule.id).push(e)
}

console.log(`没有任何内容标注的条目：${untagged.length} 条，全部给出了建议\n`)
for (const rule of RULES) {
  const rows = byRule.get(rule.id) || []
  if (!rows.length) continue
  const mark = rule.confidence === 'guess' ? '（靠猜，必须逐条看）' : ''
  console.log(`${rule.id}  →  ${rule.tags.join(' + ')}   ${rows.length} 条 ${mark}`)
  console.log(`   ${rule.why}`)
  for (const e of rows.slice(0, 6)) console.log(`     ${e.date}  ${e.title.slice(0, 42)}`)
  if (rows.length > 6) console.log(`     …还有 ${rows.length - 6} 条`)
  console.log()
}
const sure = Object.values(proposals).filter((p) => p.confidence === 'high').length
console.log(`可以放心批量应用的（标题/规则直给）：${sure} 条`)
console.log(`必须人工逐条确认的（靠标题猜）：${Object.keys(proposals).length - sure} 条`)

if (process.argv.includes('--json')) {
  const out = path.join(HERE, 'tag-proposals.json')
  await writeFile(out, JSON.stringify(proposals, null, 1), 'utf8')
  console.log(`\n已写出 ${path.relative(REPO, out)}——清点页会把它显示成「建议标签」，由你确认。`)
}
