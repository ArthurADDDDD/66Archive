/**
 * 全量条目清点工具（本地专用，不部署、不进构建产物）。
 *
 * 为什么要有它：档案已经有 2600+ 条，绝大多数是机器/半自动补进来的，
 * 从来没有被人从头到尾看过一遍。这个工具把**每一条**摆出来让人确认，
 * 并且按「机器觉得这条可能有问题」排在前面，让有限的注意力花在刀刃上。
 *
 * 它只收集人的判断，**不改 data/**：判定写进 reviews.json，
 * 之后由落盘流程统一应用。看错了随时改回来，不会污染档案。
 *
 * 用法：
 *   node scripts/audit/server.mjs                  只监听本机
 *   HOST=0.0.0.0 node scripts/audit/server.mjs     开放局域网（另一台电脑上看）
 *
 * 数据来源是仓库里的 data/** 本身，随时反映当前真实状态。
 */

import { createServer } from 'node:http'
import { readFile, writeFile, rename, copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'node:fs/promises'
import yaml from 'js-yaml'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const REVIEWS = path.join(HERE, 'reviews.json')
const BACKUP_DIR = path.join(HERE, 'reviews-backups')
// 4173 是标签校准工具的端口，两个工具可能同时开着，所以这里另起一个。
const PORT = Number(process.env.PORT || 4174)
// 默认只听本机。跟 calibrate 一样：这个工具没有任何鉴权，
// 不该在没人明确要求的情况下就挂到整个局域网上。
const HOST = process.env.HOST || '127.0.0.1'

/**
 * 档案里现存最早的直播录像是 2015-01-21，但**具体哪天首播尚无定论**
 * （01-21 的录像/评论与 01-22「斗鱼首秀」标题互相矛盾，见 data/reports/missing-resources.md）。
 * 所以这里不拿某一天当硬边界，只把「2015 年之前出现 live」当成矛盾——
 * 那几年档案里确实全部是投稿视频。
 */
const NO_LIVE_BEFORE = '2015-01-01'

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
        series: e.series || null,
        note: e.note || '',
        segments: (e.segments || []).map((s) => ({ at: s.at, label: s.label || null, game: s.game || null })),
        sources: (e.sources || []).map((s) => ({
          url: s.url,
          kind: s.kind || '',
          status: s.status || '',
          account: s.account || null,
          parts: s.parts ?? null,
        })),
      })
    }
  }
  return entries
}

async function loadYamlMap(rel, key = 'id') {
  const raw = yaml.load(await readFile(path.join(REPO, rel), 'utf8')) || []
  const map = new Map()
  for (const item of raw) if (item && item[key]) map.set(item[key], item)
  return map
}

async function loadReviews() {
  if (!existsSync(REVIEWS)) return {}
  try {
    return JSON.parse(await readFile(REVIEWS, 'utf8'))
  } catch {
    return {}
  }
}

let saveCount = 0
const SNAPSHOT_EVERY = 25

/**
 * 原子写：先写临时文件再 rename。
 * 每次调用前都是现读硬盘再合并，不是拿内存里的旧快照写回去，
 * 所以两台设备先后各存一条不会互相吞掉对方。
 */
async function saveReviews(all) {
  const tmp = REVIEWS + '.tmp'
  await writeFile(tmp, JSON.stringify(all, null, 1), 'utf8')
  await rename(tmp, REVIEWS)

  saveCount += 1
  if (saveCount % SNAPSHOT_EVERY === 0) {
    await mkdir(BACKUP_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await copyFile(REVIEWS, path.join(BACKUP_DIR, `reviews-${stamp}.json`)).catch(() => {})
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
const games = await loadYamlMap('data/games.yaml')
const seriesMap = await loadYamlMap('data/series.yaml')
const accounts = await loadYamlMap('data/accounts.yaml')
const tagVocab = new Set([...(await loadYamlMap('data/tags.yaml', 'name')).keys()])

/**
 * 机器自检。**只指出可疑，不下结论**——每一条都要人来定。
 * 目的是排序：把最可能有错的排在前面，置信度高又没有任何疑点的可以快速扫过去。
 *
 * 严重度 high 的是「几乎一定要改」，medium 是「值得看一眼」。
 */
function checksFor(e, ctx) {
  const out = []
  const add = (severity, code, text) => out.push({ severity, code, text })

  // —— 结构性硬矛盾 ——
  if (!e.date) add('high', 'no-date', '没有日期')
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) add('high', 'bad-date', `日期格式不对：${e.date}`)
  if (!e.title) add('high', 'no-title', '没有标题')
  if (e.date && e.date < NO_LIVE_BEFORE && e.type === 'live') {
    add('high', 'era-type', '2015 年之前档案里全部是投稿视频，这条却是 live')
  }
  if (e.date && e.date > ctx.today) add('high', 'future', '日期在今天之后')

  // —— 平台与类型 ——
  if (e.type === 'live' && ['youku', 'youtube'].includes(e.platform)) {
    add('medium', 'live-platform', `直播却挂在 ${e.platform} 上，多半是录像转载而不是直播平台`)
  }

  // —— 来源 ——
  if (!e.sources.length) add('high', 'no-source', '没有任何来源链接')
  else {
    const alive = e.sources.filter((s) => s.status === 'alive').length
    const dead = e.sources.filter((s) => s.status === 'dead').length
    if (alive === 0 && dead === e.sources.length) add('medium', 'all-dead', '所有来源都已标记失效')
    else if (alive === 0) add('medium', 'none-alive', '没有任何一个来源被确认可用（都是 unchecked）')
    for (const s of e.sources) {
      if (s.account && !accounts.has(s.account)) add('high', 'bad-account', `来源账号 ${s.account} 不在 accounts.yaml 里`)
    }
  }

  // —— 时长 ——
  if (e.type === 'live' && e.durationMin == null) add('medium', 'no-duration', '直播但没有时长')
  if (e.durationMin != null) {
    if (e.durationMin <= 0) add('high', 'bad-duration', `时长是 ${e.durationMin}`)
    else if (e.durationMin > 24 * 60) add('high', 'long-duration', `时长 ${(e.durationMin / 60).toFixed(1)} 小时，超过一天`)
    else if (e.type === 'live' && e.durationMin < 5) add('medium', 'short-live', `直播只有 ${e.durationMin} 分钟`)
  }

  // —— 词表引用 ——
  for (const g of e.games) if (!games.has(g)) add('high', 'bad-game', `游戏 id ${g} 不在 games.yaml 里`)
  if (e.series && !seriesMap.has(e.series)) add('high', 'bad-series', `系列 id ${e.series} 不在 series.yaml 里`)
  for (const t of e.tags) if (!tagVocab.has(t)) add('medium', 'bad-tag', `标签「${t}」不在受控词表里`)
  for (const s of e.segments) if (s.game && !games.has(s.game)) add('high', 'bad-segment-game', `分段游戏 id ${s.game} 不在词表里`)

  // —— 标题里的日期和 date 字段对不上 ——
  const m = e.title.match(/(20\d{2})[-.\/年](\d{1,2})[-.\/月](\d{1,2})/)
  if (m && e.date) {
    const inTitle = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
    if (inTitle !== e.date) add('high', 'date-mismatch', `标题里写的是 ${inTitle}，date 字段却是 ${e.date}`)
  }

  // —— 疑似重复 ——
  if (ctx.dupIds.has(e.id)) add('medium', 'duplicate', `同一天还有标题几乎一样的另一条（${ctx.dupIds.get(e.id)}）`)
  // 同一个链接挂在多条上：可能是拆错/重复录入，也可能是一个合集录像本来就横跨好几天。
  // 机器分不出这两种，所以只标出来给人看，不当成硬错误。
  for (const s of e.sources) {
    const others = (ctx.urlOwners.get(s.url) || []).filter((id) => id !== e.id)
    if (others.length) {
      add('medium', 'shared-source', `同一个链接还挂在另外 ${others.length} 条上（${others.slice(0, 4).join('、')}${others.length > 4 ? ' 等' : ''}）——是合集跨天就没问题，是拆错就要改`)
    }
  }

  // —— 分段超出时长 ——
  if (e.durationMin != null && e.durationMin > 0) {
    for (const seg of e.segments) {
      const sec = hmsToSeconds(seg.at)
      if (sec != null && sec > e.durationMin * 60) {
        add('high', 'segment-overflow', `分段时间点 ${seg.at} 超过了这条的总时长（${e.durationMin} 分钟）`)
        break
      }
    }
  }

  // —— 内容标注 ——
  if (!e.games.length && !e.tags.length && !e.series) add('medium', 'no-content-tag', '既没有游戏、也没有标签和系列，内容完全没被标注')

  return out
}

/** "1:02:33" / "12:05" → 秒。解析不了返回 null（不猜）。 */
function hmsToSeconds(at) {
  if (typeof at !== 'string') return null
  const parts = at.split(':').map((n) => Number(n))
  if (parts.some((n) => !Number.isFinite(n))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[\s,._:\-()（）【】[\]、《》"'!！?？~～]/g, '')
}

/** 同一天 + 标题归一化后相同 = 疑似重复。只报告，不合并。 */
function findDuplicates(list) {
  const byKey = new Map()
  for (const e of list) {
    const key = `${e.date}::${normalizeTitle(e.title)}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(e)
  }
  const dup = new Map()
  for (const group of byKey.values()) {
    if (group.length < 2) continue
    for (const e of group) dup.set(e.id, group.filter((x) => x.id !== e.id).map((x) => x.id).join('、'))
  }
  return dup
}

const today = new Date().toISOString().slice(0, 10)
const dupIds = findDuplicates(entries)
/** url → 引用它的条目 id 列表。同一个链接被两条条目引用几乎总是录入问题。 */
const urlOwners = new Map()
for (const e of entries) {
  for (const s of e.sources) {
    if (!s.url) continue
    if (!urlOwners.has(s.url)) urlOwners.set(s.url, [])
    if (!urlOwners.get(s.url).includes(e.id)) urlOwners.get(s.url).push(e.id)
  }
}
const ctx = { today, dupIds, urlOwners }

const SEVERITY_RANK = { high: 0, medium: 1 }
const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2, '': 1 }

for (const e of entries) {
  e.checks = checksFor(e, ctx)
  e.worst = e.checks.length ? e.checks.reduce((a, c) => Math.min(a, SEVERITY_RANK[c.severity] ?? 9), 9) : 9
  // 展示用：把 id 换成名字，省得人自己去查词表
  e.gameNames = e.games.map((id) => (games.get(id)?.name) || id)
  e.seriesName = e.series ? (seriesMap.get(e.series)?.name || e.series) : null
  e.accountNames = [...new Set(e.sources.map((s) => s.account).filter(Boolean))]
    .map((id) => accounts.get(id)?.name || id)
}

/**
 * 默认排序：先按「有多严重的疑点」，再按置信度低的优先，最后按日期倒序。
 * 这样一路往下点，最需要人判断的永远在最前面；置信度高又干净的条目沉到最后，
 * 可以在列表模式里成批扫过去。
 */
entries.sort((a, b) =>
  a.worst - b.worst ||
  (CONFIDENCE_RANK[a.confidence] ?? 1) - (CONFIDENCE_RANK[b.confidence] ?? 1) ||
  b.date.localeCompare(a.date),
)

const stats = {
  total: entries.length,
  high: entries.filter((e) => e.worst === 0).length,
  medium: entries.filter((e) => e.worst === 1).length,
  clean: entries.filter((e) => e.worst === 9).length,
  byConfidence: entries.reduce((acc, e) => ((acc[e.confidence || '(未标)'] = (acc[e.confidence || '(未标)'] || 0) + 1), acc), {}),
}

console.log(`档案条目 ${stats.total} 条`)
console.log(`  机器自检：${stats.high} 条有「几乎一定要改」的疑点，${stats.medium} 条值得看一眼，${stats.clean} 条没查出问题`)
console.log(`  置信度分布：${Object.entries(stats.byConfidence).map(([k, v]) => `${k} ${v}`).join(' · ')}`)

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = await readFile(path.join(HERE, 'index.html'), 'utf8')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return res.end(html)
  }

  if (req.method === 'GET' && url.pathname === '/api/data') {
    return json(res, 200, { entries, stats, reviews: await loadReviews() })
  }

  // 轻量端点：只回判定本身，供多设备定期同步进度用。
  if (req.method === 'GET' && url.pathname === '/api/reviews') {
    return json(res, 200, { reviews: await loadReviews() })
  }

  if (req.method === 'POST' && url.pathname === '/api/review') {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 4_000_000) { res.writeHead(413); return res.end() }
    }
    let payload
    try { payload = JSON.parse(body) } catch { return json(res, 400, { error: 'bad json' }) }
    const all = await loadReviews()
    const items = Array.isArray(payload) ? payload : [payload]
    for (const item of items) {
      if (!item || typeof item.id !== 'string') continue
      if (item.__delete) delete all[item.id]
      else all[item.id] = { ...item, savedAt: new Date().toISOString() }
    }
    await saveReviews(all)
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
  console.log(`\n清点页已启动： http://localhost:${PORT}`)
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
  console.log(`你的判定会存进： ${path.relative(REPO, REVIEWS)}`)
  console.log(`清点完告诉我，我按这份文件逐条改 data/**\n`)
})
