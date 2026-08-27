/**
 * 把人给的归类规则，套到「没有任何内容标注」的条目上，产出一份**建议**（只读）。
 *
 *   node scripts/audit/propose-tags.mjs            打印摘要
 *   node scripts/audit/propose-tags.mjs --json     产出 tag-proposals.json（清点页会读它）
 *
 * 规则不是机器猜的，是 2026-08-27 人工逐条反馈 + 分类问答定下来的：
 *   1. 标题直接写了分类的（砒霜 / 佩奇 / 一起see / 一起看）→ 照写
 *   2. 展会·活动·发布会**现场**（人在直播间外）→ 户外
 *   3. 远程看发布会 → 一起See
 *   4. 歌友会 / 唱歌 → 佩奇 + 聊天
 *   5. 其余没游戏的：出门在外 → 户外；在直播间里 → 聊天
 *
 * **证据不只看标题。** 人工提示：答案常藏在分 P 标签和档案备注里——
 * 「直播修电脑」的备注写着斗鱼回放原标题是「糖豆人练练个人技」（其实是游戏），
 * 「儿时的游戏」的分 P 写着「游戏前聊10块钱的」（说明确实在玩游戏）。
 * 所以匹配的语料是 标题 + 分 P 标签 + note 三者，且分 P / 备注命中时置信度更高——
 * 它们比标题更接近当场实际内容。
 *
 * **这个脚本不写 data/**。** 它只产出建议，由人在清点页上逐条确认或否掉。
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
        note: e.note || '',
        segmentLabels: (e.segments || []).map((s) => s.label).filter(Boolean),
      })
    }
  }
  return out
}

/** 去掉「P1-」「Part2」「6.5-」「-弹幕版」这类编号噪音，只留下真正描述内容的字。 */
function cleanLabel(raw) {
  return String(raw || '')
    .replace(/^[Pp]\d+\s*[-－.]?\s*/, '')
    .replace(/^[Pp]art\s*\d+\s*[-－.]?\s*/, '')
    .replace(/^\.?\d+(\.\d+)*\s*[-－]?\s*/, '')
    .replace(/^\d{1,4}[-.]\d{1,2}([-.]\d{1,2})?\s*[-－]?\s*/, '')
    .replace(/\s*[-－]?\s*(弹幕版|纯净版|字幕版)$/, '')
    .replace(/^女流\s*[-－]\s*/, '')
    .trim()
}

const GAMES = yaml.load(await readFile(path.join(REPO, 'data/games.yaml'), 'utf8')) || []
const normalize = (v) => String(v || '').toLowerCase().replace(/[\s,._:\-()（）【】[\]、《》"'!！?？~～]/g, '')
const GAME_INDEX = GAMES.map((g) => ({
  id: g.id,
  name: g.name,
  variants: [g.name, ...(g.aliases || [])].map(normalize).filter((v) => v.length >= 3),
}))

/**
 * 分 P 标签 / 备注里出现了词库里的游戏名 —— 这条其实是在玩游戏，不该只补标签。
 * 这类不给 tags 建议，单独列出来交给人补 games（补游戏要看原片，不能照抄一个词）。
 */
function gameHitsIn(text) {
  const hay = normalize(text)
  if (hay.length < 3) return []
  return GAME_INDEX.filter((g) => g.variants.some((v) => hay.includes(v)))
}

/**
 * 规则按顺序匹配，先命中的赢。
 * `where` 指明这条规则该在哪份语料里找：
 *   title   只看标题（标题直给的那几类）
 *   any     标题 + 分 P + 备注（内容线索，命中就算数）
 */
const RULES = [
  { id: 'title-pishuang', where: 'any', test: /砒霜|pishuang/i, tags: ['心灵砒霜'], confidence: 'high',
    why: '标题/分P/备注里直接写了心灵砒霜' },
  { id: 'title-yiqi-see', where: 'any', test: /一起see|一起看/i, tags: ['一起See'], confidence: 'high',
    why: '标题/分P/备注里直接写了一起see / 一起看' },

  // 歌友会 / 唱歌放在佩奇之前：「佩奇的唱歌歌友会」按这条走
  { id: 'singing', where: 'any', test: /歌友会|唱歌|K起来|唱K|歌会|cover|唱亿首歌/i, tags: ['佩奇', '聊天'], confidence: 'high',
    why: '歌友会 / 唱歌场次，人工定为佩奇 + 聊天' },

  { id: 'title-peiqi', where: 'any', test: /佩奇/, tags: ['佩奇'], confidence: 'high',
    why: '标题/分P/备注里直接写了佩奇' },

  /**
   * 出行线索排在「发布会」之前，顺序是有意的：
   * 「洛杉矶之行-发布会之前休整」说的是人已经在洛杉矶、发布会还没开始，
   * 按发布会规则会误判成「在直播间远程看发布会」。人在外面这件事优先。
   */
  { id: 'outdoor-from-segments', where: 'segments',
    test: /在路上|出发|之旅|之行|逛街|逛会儿街|路上|前往|走进|回家|出门|旅行|车展|休整/i,
    tags: ['户外'], confidence: 'high',
    why: '分P / 备注里写明了人在外面（出行、前往、逛街）' },

  // 展会与发布会：带「现场 / 展台 / 展会」的是人在外面，其余是远程看
  { id: 'expo-onsite', where: 'any',
    test: /现场|展台|展会|漫展|ACG展|峰会|年会|盛典|嘉年华|核聚变|见闻|游戏展|车展/i,
    tags: ['户外'], confidence: 'high',
    why: '展会 / 活动现场，人在直播间外' },
  { id: 'presentation-remote', where: 'any', test: /发布会|直面会|State of Play|Direct/i,
    tags: ['一起See'], confidence: 'high',
    why: '远程看发布会' },

  { id: 'chat-from-segments', where: 'segments',
    test: /聊\d*块钱|聊会儿天|聊天|专访|采访|访谈/i,
    tags: ['聊天'], confidence: 'high',
    why: '分P / 备注里写明了在聊天 / 做访谈' },

  // 以下两条**只能从标题猜**，误判在所难免
  {
    id: 'outdoor-guess', where: 'title',
    test: /出门|逛|在路上|钓|草原|旅|爬山|散步|遛|外面|公园|海边|街|探店|旅行|京都|神社|高铁|猴山|王府井|大明塔|汗蒸|做头发|拍照|拍摄|活动|吃货|火锅|一日吃|溜达|自驾|骑行|露营|野餐|采摘|温泉|滑雪|开学|上海|重庆|广州|成都|敦煌|科目/i,
    tags: ['户外'], confidence: 'guess',
    why: '标题读着像人在直播间外——只能靠标题猜，判错就否掉',
  },
  {
    id: 'chat-guess', where: 'title', test: /.*/,
    tags: ['聊天'], confidence: 'guess',
    why: '没有游戏、也看不出在外面，按「在直播间里跟大家待着」归为聊天',
  },
]

const entries = await loadEntries()
const untagged = entries.filter((e) => !e.games.length && !e.tags.length && !e.series)

const proposals = {}
const needGames = []
const byRule = new Map()

for (const e of untagged) {
  const segmentText = [...e.segmentLabels.map(cleanLabel), e.note].filter(Boolean).join(' | ')
  const corpus = { title: e.title, segments: segmentText, any: `${e.title} | ${segmentText}` }

  // 分 P / 备注里点名了词库里的游戏 —— 这条其实在玩游戏，标签解决不了，单独列出来
  const hits = gameHitsIn(segmentText)
  if (hits.length) {
    needGames.push({ ...e, hits, segmentText })
    continue
  }
  /**
   * 「游戏前聊10块钱的」这类分 P 说明这场**确实打了游戏**，只是游戏名不在词库里。
   * 不能因为里面有「聊」字就判成聊天场——那是把一场游戏直播错标成聊天。
   * 交给人看原片补 games。
   */
  if (/游戏前聊|游戏之前|开播聊天|设备调试/.test(segmentText)) {
    needGames.push({ ...e, hits: [], segmentText, reason: '分P 写着「游戏前聊…」，说明这场打了游戏，但游戏名不在词库里' })
    continue
  }

  const rule = RULES.find((r) => r.test.test(corpus[r.where] || ''))
  if (!rule) continue
  proposals[e.id] = {
    id: e.id, tags: rule.tags, rule: rule.id, why: rule.why,
    confidence: rule.confidence, title: e.title, date: e.date, file: e.file,
    evidence: rule.where === 'title' ? '' : segmentText.slice(0, 160),
  }
  if (!byRule.has(rule.id)) byRule.set(rule.id, [])
  byRule.get(rule.id).push(e)
}

console.log(`没有任何内容标注的条目：${untagged.length} 条\n`)
for (const rule of RULES) {
  const rows = byRule.get(rule.id) || []
  if (!rows.length) continue
  const mark = rule.confidence === 'guess' ? '（靠标题猜，必须逐条看）' : ''
  console.log(`${rule.id}  →  ${rule.tags.join(' + ')}   ${rows.length} 条 ${mark}`)
  for (const e of rows.slice(0, 5)) console.log(`     ${e.date}  ${e.title.slice(0, 40)}`)
  if (rows.length > 5) console.log(`     …还有 ${rows.length - 5} 条`)
  console.log()
}

if (needGames.length) {
  console.log(`\n分P / 备注里点到了词库里的游戏，需要补 games 而不是标签（${needGames.length} 条）：`)
  for (const e of needGames) {
    console.log(`  ${e.date}  ${e.title.slice(0, 30)}`)
    console.log(`      命中：${e.hits.map((h) => `${h.name}(${h.id})`).join('、')}`)
    console.log(`      出处：${e.segmentText.slice(0, 110)}`)
  }
}

const sure = Object.values(proposals).filter((p) => p.confidence === 'high').length
console.log(`\n有把握的建议（标题/分P/备注直给）：${sure} 条`)
console.log(`靠标题猜的建议（必须人工确认）：${Object.keys(proposals).length - sure} 条`)
console.log(`需要补 games 的：${needGames.length} 条`)

if (process.argv.includes('--json')) {
  const out = path.join(HERE, 'tag-proposals.json')
  await writeFile(out, JSON.stringify(proposals, null, 1), 'utf8')
  console.log(`\n已写出 ${path.relative(REPO, out)}`)
  const gOut = path.join(HERE, 'need-games.json')
  await writeFile(gOut, JSON.stringify(needGames.map((e) => ({
    id: e.id, date: e.date, title: e.title, evidence: e.segmentText,
    candidates: e.hits.map((h) => ({ id: h.id, name: h.name })),
  })), null, 1), 'utf8')
  console.log(`已写出 ${path.relative(REPO, gOut)}`)
}
