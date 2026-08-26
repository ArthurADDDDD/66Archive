/**
 * 把人工校准结果（decisions.json + note-mapping.json）编译成一份**应用计划**。
 *
 * 刻意分成「编译计划」和「应用计划」两步：这一步只读不写，产出一份可以完整
 * 读一遍的 plan.json + 人类可读的摘要。data/** 是这个项目的档案本体，
 * 直接从一堆自由文本备注推导出改动再写进去，出错了很难看出是哪一步错的。
 *
 *   node scripts/calibrate/build-plan.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'node:fs/promises'
import yaml from 'js-yaml'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')

/** 备注里出现这些词，就给条目补上对应标签。用户的备注不只写了游戏，也写了场次性质。 */
const TAG_RULES = [
  ['一起See', /一起\s*see/i],
  ['聊天', /聊天/],
  ['户外', /户外/],
  ['语音直播', /语音直播/],
  ['心灵砒霜', /心灵砒霜/],
  ['佩奇', /佩奇/],
  ['唱歌', /唱歌/],
]

const decisions = JSON.parse(await readFile(path.join(HERE, 'decisions.json'), 'utf8'))
const mapping = JSON.parse(await readFile(path.join(HERE, 'note-mapping.json'), 'utf8'))
const games = yaml.load(await readFile(path.join(REPO, 'data/games.yaml'), 'utf8')) || []
const tagsVocab = yaml.load(await readFile(path.join(REPO, 'data/tags.yaml'), 'utf8')) || []

const knownGameIds = new Set(games.map((g) => g.id))
const knownTags = new Set(tagsVocab.map((t) => t.name))

// 现有条目，用来判断标签是不是已经有了、type 要不要改。
const entries = new Map()
for await (const file of glob(path.join(REPO, 'data/entries/*.yaml'))) {
  for (const e of yaml.load(await readFile(file, 'utf8')) || []) {
    if (e && typeof e === 'object') entries.set(e.id, { ...e, __file: path.relative(REPO, file) })
  }
}

const plan = {
  newGames: [],
  newTags: [],
  entryUpdates: [],
  unresolved: [],
  problems: [],
}

// ---- 新游戏 ----
for (const [id, spec] of Object.entries(mapping.newGames)) {
  if (knownGameIds.has(id)) {
    plan.problems.push(`新游戏 id 与词库已有的冲突：${id}`)
    continue
  }
  plan.newGames.push({ id, name: spec.name, aliases: spec.aliases || [] })
}

// ---- 新标签 ----
for (const [tag] of TAG_RULES) {
  if (!knownTags.has(tag)) plan.newTags.push(tag)
}

const reclassify = mapping.reclassify || {}

for (const [entryId, decision] of Object.entries(decisions)) {
  const entry = entries.get(entryId)
  if (!entry) {
    plan.problems.push(`decisions 里的条目在 data/** 找不到：${entryId}`)
    continue
  }

  // 备注和判定矛盾时以备注为准（见 note-mapping.json 的 reclassify）。
  const kind = reclassify[entryId] || decision.kind
  const note = (decision.note || '').trim()

  // 游戏：优先用页面里直接选的，其次用备注映射表。
  let gameIds = []
  if (kind === 'game') {
    if (decision.games && decision.games.length) {
      gameIds = decision.games.map((g) => g.id).filter(Boolean)
    } else if (mapping.entries[entryId]) {
      gameIds = mapping.entries[entryId]
    }
  }

  const badGame = gameIds.filter((g) => !knownGameIds.has(g) && !mapping.newGames[g])
  if (badGame.length) plan.problems.push(`${entryId} 引用了未知游戏：${badGame.join(', ')}`)

  // 标签：从备注抽，去掉条目已有的。
  const wantTags = TAG_RULES.filter(([, re]) => re.test(note)).map(([t]) => t)
  const haveTags = new Set(entry.tags || [])
  const addTags = wantTags.filter((t) => !haveTags.has(t))

  // type：只有人在页面里明确改过才动。
  const typeChange = decision.type && decision.type !== entry.type ? decision.type : null

  // noSpecificGame：视频时代这类标题没写具体游戏名的（多半是小游戏合集），
  // 用户明确说了不必为了「填一个游戏」硬造一个词库条目——标题本身已经是描述。
  // 这不是「还没处理」，是「处理成了『不特指』」，不该再进 unresolved。
  if (kind === 'game' && gameIds.length === 0 && !decision.noSpecificGame) {
    plan.unresolved.push({ id: entryId, date: entry.date, title: entry.title, note })
  }

  if (gameIds.length || addTags.length || typeChange) {
    plan.entryUpdates.push({
      id: entryId,
      file: entry.__file,
      date: entry.date,
      title: entry.title,
      ...(gameIds.length ? { setGames: gameIds } : {}),
      ...(addTags.length ? { addTags } : {}),
      ...(typeChange ? { setType: typeChange, fromType: entry.type } : {}),
      ...(note ? { note } : {}),
    })
  }
}

await writeFile(path.join(HERE, 'plan.json'), JSON.stringify(plan, null, 1), 'utf8')

console.log('=== 应用计划 ===')
console.log(`新增游戏          ${plan.newGames.length}`)
console.log(`新增标签          ${plan.newTags.length}  ${plan.newTags.join(' ') || '（无）'}`)
console.log(`要改的条目        ${plan.entryUpdates.length}`)
console.log(`  其中补游戏      ${plan.entryUpdates.filter((u) => u.setGames).length}`)
console.log(`  其中补标签      ${plan.entryUpdates.filter((u) => u.addTags).length}`)
console.log(`  其中改 type     ${plan.entryUpdates.filter((u) => u.setType).length}`)
console.log(`判为游戏但仍无名  ${plan.unresolved.length}  ← 需要第二轮`)
console.log(`问题              ${plan.problems.length}`)
for (const p of plan.problems.slice(0, 20)) console.log(`  ⚠ ${p}`)
console.log(`\n计划写入 ${path.relative(REPO, path.join(HERE, 'plan.json'))}`)
