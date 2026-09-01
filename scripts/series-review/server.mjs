/**
 * 系列标签人工复核器（本地专用）。
 *
 * 用法：node scripts/series-review/server.mjs
 * 打开：http://127.0.0.1:4174
 *
 * 本工具永远不写 data/**。它只把当前档案和「疑似漏标」摆出来，供人工逐条勾选；
 * 导出的 JSON 是下一步人工复核后才可导入正式档案的审校计划。
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { glob } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const PORT = Number(process.env.PORT || 4174)
const HOST = process.env.HOST || '127.0.0.1'

const REVIEW_TAGS = ['一起See', '户外', '聊天']
const SEE_HINT = /一起\s*see|一起看|发布会|直面会|颁奖|预告|\bPV\b|看.{0,12}(视频|电影|节目|动画|晚会|榜单|歌手)|老歌.{0,8}盘点/i
const OUTDOOR_HINT = /户外|探店|旅行|旅游|线下|展台|见闻录|开学季|嘉年华/i
const CHAT_HINT = /夜话|话疗|聊天|来聊|畅聊|闲聊/i

async function loadCandidates() {
  const files = []
  for await (const file of glob(path.join(REPO, 'data/entries/*.yaml'))) files.push(file)
  files.sort()

  const entries = []
  for (const file of files) {
    const parsed = yaml.load(await readFile(file, 'utf8')) || []
    for (const entry of parsed) {
      if (!entry?.id) continue
      const tags = entry.tags || []
      // 不读采集注释：其中常有“游戏前聊两句”之类的过程性描述，
      // 以它猜分类会把大量游戏误塞进人工队列。
      const text = [entry.title, ...(entry.segments || []).map((segment) => segment.label)].filter(Boolean).join('\n')
      const suggested = []
      if (SEE_HINT.test(text) && !tags.includes('一起See')) suggested.push('一起See')
      if (OUTDOOR_HINT.test(text) && !tags.includes('户外')) suggested.push('户外')
      // “聊天”在游戏分段口语中尤其常见，只用标题做疑似提示。
      if (CHAT_HINT.test(entry.title || '') && !tags.includes('聊天')) suggested.push('聊天')
      const current = REVIEW_TAGS.filter((tag) => tags.includes(tag))
      if (!current.length && !suggested.length) continue

      entries.push({
        id: entry.id,
        file: path.relative(REPO, file),
        date: entry.date || '',
        time: entry.time || null,
        title: entry.title || '',
        type: entry.type || '',
        platform: entry.platform || '',
        confidence: entry.confidence || 'medium',
        durationMin: entry.duration_min ?? null,
        games: entry.games || [],
        tags,
        current,
        suggested,
        note: entry.note || '',
        segments: (entry.segments || []).map((segment) => ({ at: segment.at, label: segment.label })),
        sources: (entry.sources || []).map((source) => ({ url: source.url, kind: source.kind, status: source.status })),
      })
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
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

const candidates = await loadCandidates()
console.log(`系列标签复核候选 ${candidates.length} 条（${REVIEW_TAGS.join(' / ')}）`)

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`)
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = await readFile(path.join(HERE, 'index.html'), 'utf8')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return res.end(html)
  }
  if (req.method === 'GET' && url.pathname === '/api/candidates') {
    return json(res, 200, { reviewTags: REVIEW_TAGS, generatedAt: new Date().toISOString(), entries: candidates })
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('Not found')
}).listen(PORT, HOST, () => {
  console.log(`打开 http://${HOST}:${PORT}`)
})
