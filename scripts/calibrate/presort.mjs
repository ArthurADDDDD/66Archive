/**
 * 预分离：给每条未打游戏标签的条目一个「初判」，写进 suggestions.json。
 *
 * 这只是给人工核对**减少工作量**，不是结论——校准页会把每条初判都摆出来让人点是/否。
 * 所以这里的取舍是：**宁可把握不大就标 unsure，也不要自信地判错**。
 * 判错比不判更贵：不判只是多花一次人工，判错会被顺手确认掉，然后进档案。
 *
 *   node scripts/calibrate/presort.mjs
 *
 * 人工判读表（judgments.json）优先级最高：那是逐条看过的，机器规则不许覆盖它。
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'node:fs/promises'
import yaml from 'js-yaml'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')

const norm = (s) => String(s || '').toLowerCase().replace(/[\s,._:\-()（）【】[\]、《》"'!！?？~～]/g, '')

/** 斗鱼首秀。这之前档案里没有任何 live，全是投稿视频。 */
const FIRST_STREAM = '2015-01-22'

// ---------- 规则 ----------
// 顺序有意义：越靠前越强。命中即停。

/** 明确在玩游戏的措辞。比任何「这看起来像闲聊」的信号都强。 */
const PLAYING = /(玩|通关|试玩|实况|攻略|速通|联机|开黑|单机|手游|新游|首发|发售|周目|全收集|白金|结局|BOSS|boss)/

/** 一起看 / 发布会 / 展会：是在看别人玩或看资讯，不是自己玩。 */
const WATCHING = /(一起看|一起see|发布会|前瞻|预告|新视频|资讯|颁奖|典礼|盛典|TGA|E3|ChinaJoy|核聚变|展会|展台|见面会|专访|采访|访谈|宣讲|年会|峰会|大会)/i

/** 固定节目。这些是栏目名，不是游戏。 */
const PROGRAM = /(心灵砒霜|戏说封神|戏说聊斋|陪你下午茶|图游天下|剪剪世界|大周好声音|大周歌会|大周有嘻哈|午夜音乐台|歌友会|演唱会|斗歌|K歌|歌房|唱歌|跨年|生日特辑|周年|纪念)/

/** 生活/线下。注意：只有在**没有**PLAYING 信号时才作数。 */
const IRL = /(做饭|下厨|厨艺|吃|喝|失眠|睡|生病|化妆|做头发|剪个头|理发|搬家|收拾|组装|手工|开箱|拆箱|逛|旅|户外|散步|遛|健身|减肥|练车|科目|拍照|写真|cos|聚餐|拜年|除夕|春节|请假|休息|回家|在路上|草原|京都|上海|重庆|北京|广州|成都)/i

/** 斗鱼自动生成的标题：零信息。 */
const DOUYU_AUTO = /(【\d{4}-\d{2}-\d{2}\s*\d+点场】|156277直播间|钻粉|双倍|亲密度|\d{4}\/\d{2}\/\d{2}\s*\d+时场)/

/** 抖音寒暄语。同样只在没有 PLAYING 信号时才作数。 */
const DOUYIN_CHAT = /(好多人呐|刷到就是缘|突袭|开播|快乐|好久不见|热闹|大家好)/

/** 标题本身没有内容。 */
const EMPTY_TITLE = /^(直播录像|录像|\d+日|开播啦?|hi|嗨|测试)$/i

function presort(entry, vocabHits) {
  const t = entry.title || ''
  const tags = new Set(entry.tags || [])
  const isVideoEra = (entry.date || '') < FIRST_STREAM

  // 词库直接命中 —— 最强信号，但仍然要人确认（同名游戏、"一起看"某游戏预告都会误命中）。
  if (vocabHits.length) {
    if (WATCHING.test(t)) {
      return { verdict: 'watching', game: vocabHits.map((h) => h.name).join(' / '), note: '标题命中了游戏名，但像是「一起看」而不是自己玩' }
    }
    return { verdict: 'vocab-hit', game: vocabHits.map((h) => h.name).join(' / '), note: '' }
  }

  if (PROGRAM.test(t) || tags.has('心灵砒霜')) {
    return { verdict: 'nongame', game: '', note: '固定节目' }
  }
  if (WATCHING.test(t)) {
    return { verdict: 'nongame', game: '', note: '看发布会/展会/访谈，不是自己玩' }
  }

  // PLAYING 必须排在 IRL 和寒暄之前：
  // 「今晚玩新的射击游戏！好多人呐」既有寒暄也有「玩」，答案显然是在玩游戏。
  if (PLAYING.test(t)) {
    return { verdict: 'game-unknown', game: '', note: '标题说在玩游戏，但没写是哪款' }
  }

  if (DOUYU_AUTO.test(t)) return { verdict: 'zeroinfo', game: '', note: '斗鱼自动标题，没有内容' }
  if (EMPTY_TITLE.test(t.trim())) return { verdict: 'zeroinfo', game: '', note: '标题没有内容' }

  // 视频时代不存在「户外直播」。这一条挡住了把 2010–2014 投稿误判成线下活动。
  if (IRL.test(t) && !isVideoEra) return { verdict: 'nongame', game: '', note: '线下/生活内容' }
  if (DOUYIN_CHAT.test(t) && !isVideoEra) return { verdict: 'zeroinfo', game: '', note: '寒暄标题，看不出内容' }

  // 视频时代的兜底：这个阶段她投稿的基本都是小游戏解说，
  // 所以「看不出」在这里更可能是「某款没写名字的小游戏」，而不是「不是游戏」。
  if (isVideoEra) {
    return { verdict: 'unsure', game: '', note: '视频时代投稿，多半是某款小游戏，需要认' }
  }

  return { verdict: 'unsure', game: '', note: '标题看不出内容' }
}

// ---------- 主流程 ----------
const files = []
for await (const f of glob(path.join(REPO, 'data/entries/*.yaml'))) files.push(f)
files.sort()

const games = (yaml.load(await readFile(path.join(REPO, 'data/games.yaml'), 'utf8')) || []).map((g) => ({
  id: g.id,
  name: g.name,
  variants: [g.name, ...(g.aliases || [])].map(norm).filter((v) => v.length >= 2),
}))

const manualPath = path.join(HERE, 'judgments.json')
const manual = existsSync(manualPath) ? JSON.parse(readFileSync(manualPath, 'utf8')) : {}

const out = {}
const counts = {}
let n = 0
for (const file of files) {
  for (const e of yaml.load(await readFile(file, 'utf8')) || []) {
    if (!e || typeof e !== 'object' || (e.games && e.games.length)) continue
    n += 1
    const hay = norm(e.title)
    const hits = games.filter((g) => g.variants.some((v) => hay.includes(v))).map((g) => ({ id: g.id, name: g.name }))

    // 逐条看过的判读优先，机器规则不覆盖。
    const s = manual[e.id] ? { ...manual[e.id], source: 'manual' } : { ...presort(e, hits), source: 'auto' }
    out[e.id] = s
    counts[s.verdict] = (counts[s.verdict] || 0) + 1
  }
}

await writeFile(path.join(HERE, 'suggestions.json'), JSON.stringify(out, null, 1), 'utf8')
console.log(`预分离完成：${n} 条未打标签`)
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`)
}
console.log(`\n写入 ${path.relative(REPO, path.join(HERE, 'suggestions.json'))}`)
