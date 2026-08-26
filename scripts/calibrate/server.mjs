/**
 * 游戏标签校准工具（本地专用，不部署、不进构建产物）。
 *
 * 为什么要有它：档案里 1018 条没有游戏标签，机器判读只能给出建议——
 * 「户外」可能其实在玩游戏、`type: live` 可能其实是投稿视频，这些只有人能定。
 * 所以这个工具**只收集人的判断**，不直接改 data/**：判断存进 decisions.json，
 * 之后由落盘流程统一应用。误判在这里可以随时改回来，不会污染档案。
 *
 * 用法：
 *   node scripts/calibrate/server.mjs
 *   然后打开 http://localhost:4173
 *
 * 数据来源是仓库里的 data/** 本身，所以随时反映当前真实状态，不会和档案漂移。
 */

import { createServer } from 'node:http'
import { readFile, writeFile, rename, copyFile, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'node:fs/promises'
import yaml from 'js-yaml'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const DECISIONS = path.join(HERE, 'decisions.json')
const BACKUP_DIR = path.join(HERE, 'decisions-backups')
const PORT = Number(process.env.PORT || 4173)
// 默认只听本机。要让局域网内的另一台设备连进来，显式设 HOST=0.0.0.0——
// 这是有意的默认值：这个工具没有任何登录/鉴权，写在这里的每一条判断都是
// 直接可写的，不该在没人要求的情况下就把它挂到整个局域网上。
const HOST = process.env.HOST || '127.0.0.1'

/** 归一化：忽略大小写、空格与常见标点，让「1,2switch」能匹配「1-2-Switch」。 */
function normalize(s) {
  return String(s || '').toLowerCase().replace(/[\s,._:\-()（）【】[\]、《》"'!！?？~～]/g, '')
}

async function loadEntries() {
  const files = []
  for await (const f of glob(path.join(REPO, 'data/entries/*.yaml'))) files.push(f)
  files.sort()
  const entries = []
  for (const file of files) {
    const docs = yaml.load(await readFile(file, 'utf8')) || []
    for (const e of docs) {
      if (!e || typeof e !== 'object') continue
      entries.push({
        id: e.id,
        file: path.relative(REPO, file),
        date: e.date || '',
        time: e.time || null,
        title: e.title || '',
        type: e.type || '',
        platform: e.platform || '',
        confidence: e.confidence || '',
        durationMin: e.duration_min ?? null,
        games: e.games || [],
        tags: e.tags || [],
        note: e.note || '',
        segments: (e.segments || []).map((s) => s.label).filter(Boolean),
        sources: (e.sources || []).map((s) => ({ url: s.url, kind: s.kind, status: s.status, account: s.account || null })),
      })
    }
  }
  return entries
}

async function loadGames() {
  const raw = yaml.load(await readFile(path.join(REPO, 'data/games.yaml'), 'utf8')) || []
  return raw.map((g) => ({ id: g.id, name: g.name, aliases: g.aliases || [] }))
}

function loadSuggestions() {
  const p = path.join(HERE, 'suggestions.json')
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}
}

async function loadDecisions() {
  if (!existsSync(DECISIONS)) return {}
  try {
    return JSON.parse(await readFile(DECISIONS, 'utf8'))
  } catch {
    return {}
  }
}

let saveCount = 0
/** 每隔 N 次写入留一份带时间戳的快照，供「不小心点错清除全清空了」这类误操作回滚用。 */
const SNAPSHOT_EVERY = 20

/**
 * 原子写：先写临时文件再 rename。
 * 这份文件是纯人工劳动的唯一产物，中途崩溃把它截断了就是几小时白干。
 *
 * 每次调用前 loadDecisions() 都是现读硬盘再合并，不是拿内存里的旧快照写回去，
 * 所以两台设备先后各存一条不会互相吞掉对方——除非两个请求真的同一瞬间并发，
 * 这在人工操作的节奏下概率很低。留着定期快照只是给这种小概率情况加一道保险，
 * 顺带也防「不小心点了清除」这类误操作。
 */
async function saveDecisions(all) {
  const tmp = DECISIONS + '.tmp'
  await writeFile(tmp, JSON.stringify(all, null, 1), 'utf8')
  await rename(tmp, DECISIONS)

  saveCount += 1
  if (saveCount % SNAPSHOT_EVERY === 0) {
    await mkdir(BACKUP_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await copyFile(DECISIONS, path.join(BACKUP_DIR, `decisions-${stamp}.json`)).catch(() => {})
  }
}

function json(res, code, body) {
  const payload = JSON.stringify(body)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

const entries = await loadEntries()
const games = await loadGames()
const suggestions = loadSuggestions()

/**
 * 心灵砒霜漏标嫌疑。来源：砒霜是周日固定档，从首播到停播区间内，
 * 每一个「有条目却没打砒霜标签」的周日都值得看一眼——
 * 标题就是游戏名的除外（那只是当周日在玩游戏，档期真实空缺）。
 */
const pishuangPath = path.join(HERE, 'pishuang-suspects.json')
const pishuangSuspects = existsSync(pishuangPath) ? JSON.parse(readFileSync(pishuangPath, 'utf8')) : {}

/**
 * 第二步的默认填充：把「我判读过、也解析出具体游戏 id」的条目预先摆进候选框，
 * 用户只需要确认（保存）或者改掉——不用每条都从零搜索。
 * 只在用户自己还没选过游戏时生效，绝不覆盖已经填好的。
 */
const resolvedPath = path.join(HERE, 'resolved-suggestions.json')
const resolvedSuggestions = existsSync(resolvedPath) ? JSON.parse(readFileSync(resolvedPath, 'utf8')) : {}

// 标题里直接出现词库游戏名的，作为一类建议来源；与人工判读表合并成统一的 suggestion。
const gameIndex = games.map((g) => ({
  ...g,
  variants: [g.name, ...g.aliases].map(normalize).filter((v) => v.length >= 2),
}))
for (const e of entries) {
  if (e.games.length) continue
  const hay = normalize(e.title)
  const hits = gameIndex.filter((g) => g.variants.some((v) => hay.includes(v)))
  e.vocabHits = hits.map((g) => ({ id: g.id, name: g.name }))
  const s = suggestions[e.id]
  if (s) {
    e.suggestion = s
  } else if (hits.length) {
    e.suggestion = { verdict: 'vocab-hit', game: hits.map((h) => h.name).join(' / '), note: '' }
  } else {
    e.suggestion = null
  }
  if (resolvedSuggestions[e.id]) e.resolvedGames = resolvedSuggestions[e.id]
}

/**
 * 时代分期。这不是装饰，是一条硬约束：
 * 2015-01-22 斗鱼首秀之前**根本没有直播**，档案里 2010–2014 全部是 `type: video`。
 * 所以那几年的条目不可能是「户外直播」「直播过渡」之类——机器判读一旦这么标就一定错。
 */
function eraOf(date) {
  if (!date) return { key: 'unknown', label: '' }
  if (date < '2015-01-22') return { key: 'video', label: '视频时代（还没开始直播）' }
  if (date < '2024-01-01') return { key: 'douyu', label: '斗鱼时期' }
  return { key: 'douyin', label: '抖音时期' }
}

/**
 * 自我审计：把「我的判读大概率错了」的地方标出来，让人优先看这些。
 *
 * 这些规则不修正判读，只是**指出矛盾**——机器判读是靠标题关键词的，
 * 关键词互相打架时（标题里明写着在玩游戏、却被归成寒暄）几乎总是判读错。
 */
const PLAY_HINT = /(玩|通关|试玩|实况|攻略|速通|联机|开黑|单机|手游|新游|首发|发售)/
const GAME_WORD = /游戏/
function flagsFor(e, era) {
  const f = []
  const v = e.suggestion ? e.suggestion.verdict : null
  const t = e.title || ''
  if (v === 'nongame' && GAME_WORD.test(t) && PLAY_HINT.test(t)) {
    f.push('标题明说在玩游戏，但我判成了「非游戏」——大概率是我错了')
  } else if (v === 'nongame' && GAME_WORD.test(t)) {
    f.push('标题里有「游戏」二字，但我判成了「非游戏」，请复核')
  }
  if (era.key === 'video' && e.type !== 'video') {
    f.push('这条早于斗鱼首秀，却不是 video —— 时代与类型对不上')
  }
  if (era.key === 'video' && /户外|直播/.test(t)) {
    f.push('视频时代不存在「直播/户外」，标题里的这个词只是措辞')
  }
  if (!e.suggestion) f.push('我没给出判读，需要你从零判断')
  return f
}

for (const e of entries) {
  e.era = eraOf(e.date)
  if (!e.games.length) e.flags = flagsFor(e, e.era)
  if (pishuangSuspects[e.id]) {
    e.flags = e.flags || []
    e.flags.push(`⛩ ${pishuangSuspects[e.id]}`)
  }
}

const untagged = entries.filter((e) => !e.games.length)
const flagged = untagged.filter((e) => e.flags && e.flags.length).length
console.log(`档案条目 ${entries.length}，其中未打游戏标签 ${untagged.length}，游戏词库 ${games.length}`)
console.log(`其中 ${flagged} 条我自己标了「可能判错」，建议先看这批`)

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = await readFile(path.join(HERE, 'index.html'), 'utf8')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return res.end(html)
  }

  if (req.method === 'GET' && url.pathname === '/api/data') {
    return json(res, 200, { entries: untagged, games, decisions: await loadDecisions() })
  }

  // 轻量端点，只回判断本身（几十 KB，不含全部条目/词库那 800KB+）。
  // 前端用它定期轮询，让两台设备各自的进度条和列表状态不会长时间对不上。
  if (req.method === 'GET' && url.pathname === '/api/decisions') {
    return json(res, 200, { decisions: await loadDecisions() })
  }

  // 全量条目（含已打标签的），用于「其实这条也标错了」的场景。
  if (req.method === 'GET' && url.pathname === '/api/all') {
    return json(res, 200, { entries })
  }

  if (req.method === 'POST' && url.pathname === '/api/decision') {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 2_000_000) { res.writeHead(413); return res.end() }
    }
    let payload
    try { payload = JSON.parse(body) } catch { return json(res, 400, { error: 'bad json' }) }
    const all = await loadDecisions()
    // 一次可以提交一条或一批（批量用于「把这一组一起标成同一款游戏」）。
    const items = Array.isArray(payload) ? payload : [payload]
    for (const item of items) {
      if (!item || typeof item.id !== 'string') continue
      if (item.__delete) delete all[item.id]
      else all[item.id] = { ...item, savedAt: new Date().toISOString() }
    }
    await saveDecisions(all)
    return json(res, 200, { ok: true, total: Object.keys(all).length })
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('not found')
})

function lanAddresses() {
  const out = []
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address)
    }
  }
  return out
}

server.listen(PORT, HOST, () => {
  console.log(`\n校准页已启动： http://localhost:${PORT}`)
  if (HOST === '0.0.0.0') {
    const lan = lanAddresses()
    if (lan.length) {
      console.log(`局域网内可以从这些地址连进来：`)
      for (const ip of lan) console.log(`  http://${ip}:${PORT}`)
      console.log(`（只在同一个局域网内有效；没有做鉴权，别把这个端口转发到公网）`)
    } else {
      console.log(`没找到局域网网卡地址 —— 检查一下这台机器是不是接了网络`)
    }
  } else {
    console.log(`只监听本机（127.0.0.1）。要让局域网内的其他设备连进来，用 HOST=0.0.0.0 重新启动。`)
  }
  console.log(`你的判断会存进： ${path.relative(REPO, DECISIONS)}`)
  console.log(`改完告诉我，我按这份文件回写 data/**\n`)
})
