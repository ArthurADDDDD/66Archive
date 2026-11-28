/**
 * 采集落盘后的两项自动补全（后台 archive-edit 工作流在条目提交之后调用，尽力而为）：
 *
 * 1. 封面：来源是「一个投稿里的几 P」（url 带 `?p=N`，cover_unreliable）的条目，后台不借整个
 *    投稿的封面——那可能是另一场。这里改用这一场自己首 P 的首帧（B 站 pagelist 的 first_frame），
 *    它一定拍的是这一场。
 * 2. 游戏时间轴：多游戏场次没有时间轴时，游戏厅只能显示「尚未定位」。如果基准录像每个分 P 的
 *    标题都恰好点名条目里的一款游戏（如「燕云支持dlss5啦_…」「gta6来啦_…」），就按分 P 写一条
 *    `precision: part` + `evidence: part_title` 的时间轴。任何一个分 P 认不出或认出两款，
 *    整场放弃，留给人工——宁可缺，不可错。口径见 docs/game-time.md §2「自动时间轴」。
 *
 * 只处理后台采集新建（contributed_by: collection-review）、近 RECENT_DAYS 天内的条目；
 * 只追加，不改已有的封面或时间轴。
 *
 *   npx tsx scripts/collection-followups.ts            # 写入
 *   npx tsx scripts/collection-followups.ts --dry-run  # 只打印
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { EntriesFile, GamesFile, GameTimeline, GameTimelinesFile, type Entry } from '../src/lib/schema'
import { visibleGameIds } from '../src/lib/games'

export const RECENT_DAYS = 30
/** 两款游戏之间、或分 P 之间的录像空档超过它，就不能说基准录像覆盖整场（docs/game-time.md §1）。 */
export const MAX_GAP_SEC = 300

export type PageInfo = { page: number; cid: number; part: string; duration: number; first_frame?: string | null }
type GameTerms = { id: string; terms: string[] }

export function compactText(value: string): string {
  return value.toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '')
}

function termUsable(term: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(term) ? [...term].length >= 2 : term.length >= 3
}

/** 分 P 标题里录像组写的开始时刻（「…_2026-11-27_19_58_21_…」），读不出返回 null。 */
export function partStartMs(title: string): number | null {
  const m = title.match(/(\d{4})-(\d{2})-(\d{2})[_ T](\d{2})[_:](\d{2})[_:](\d{2})/)
  return m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`) : null
}

/** 每个分 P 恰好点名一款游戏时给出按分 P 的环节；否则 null。 */
export function deriveSpans(pages: PageInfo[], games: GameTerms[]): { page: number; game: string }[] | null {
  if (games.length < 2 || pages.length === 0) return null
  const spans: { page: number; game: string }[] = []
  const seen = new Set<string>()
  for (const page of pages) {
    const text = compactText(page.part.replace(/女流66|弹幕版|纯净版/g, ''))
    const hits = games.filter((game) => game.terms.some((term) => text.includes(term)))
    if (hits.length !== 1) return null
    const game = hits[0].id
    seen.add(game)
    if (spans.at(-1)?.game !== game) spans.push({ page: page.page, game })
  }
  // 条目里每款游戏都要在录像里出现；否则这份录像说明不了整场。
  return games.every((game) => seen.has(game.id)) ? spans : null
}

/** 能证明基准录像从 P1 起首尾相接（空档都不超过 MAX_GAP_SEC）才算 complete。 */
export function coverageOf(pages: PageInfo[]): 'complete' | 'unknown' {
  for (let i = 1; i < pages.length; i++) {
    const prev = partStartMs(pages[i - 1].part)
    const next = partStartMs(pages[i].part)
    if (prev === null || next === null) return 'unknown'
    const gap = (next - prev) / 1000 - pages[i - 1].duration
    if (gap > MAX_GAP_SEC || gap < -MAX_GAP_SEC) return 'unknown'
  }
  return pages[0]?.page === 1 && pages.length > 1 ? 'complete' : 'unknown'
}

/** 在条目的 `sources:` 前插入一行 cover，其余文本原样保留。 */
export function insertCover(text: string, entryId: string, url: string): string {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => new RegExp(`^\\s*- id: ${entryId.replace(/[-]/g, '\\-')}\\s*$`).test(line))
  if (start < 0) throw new Error(`找不到条目 ${entryId}`)
  const indent = ' '.repeat(lines[start].length - lines[start].trimStart().length + 2)
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*- id: /.test(lines[i]) && lines[i].length - lines[i].trimStart().length < indent.length) break
    if (lines[i].startsWith(`${indent}cover:`)) throw new Error(`条目 ${entryId} 已有封面`)
    if (lines[i] === `${indent}sources:`) {
      lines.splice(i, 0, `${indent}cover: "${url}"`)
      return lines.join('\n')
    }
  }
  throw new Error(`条目 ${entryId} 没有 sources 段`)
}

export function timelineYaml(t: GameTimeline): string {
  const out = [
    `- entry: ${t.entry}`,
    `  basis: ${t.basis}`,
    `  coverage: ${t.coverage}`,
    `  reviewed: '${t.reviewed}'`,
    ...(t.note ? [`  note: ${JSON.stringify(t.note)}`] : []),
    '  parts:',
    ...t.parts.flatMap((p) => [`  - page: ${p.page}`, `    id: ${p.id}`, `    duration_sec: ${p.duration_sec}`]),
    '  spans:',
    ...t.spans.flatMap((s) => [
      `  - page: ${s.page}`,
      `    at: ${s.at}`,
      `    game: ${s.game}`,
      `    precision: ${s.precision}`,
      `    evidence: ${s.evidence}`,
    ]),
  ]
  return `${out.join('\n')}\n`
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

async function pagelist(bvid: string): Promise<PageInfo[]> {
  const res = await fetch(`https://api.bilibili.com/x/player/pagelist?bvid=${bvid}`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
  })
  const body = (await res.json()) as { code: number; data?: PageInfo[] }
  if (body.code !== 0 || !Array.isArray(body.data)) throw new Error(`pagelist ${bvid} 返回 ${body.code}`)
  return body.data
}

function bilibiliSource(url: string): { bvid: string; page: number | null } | null {
  const m = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]{10})(?:\/)?(?:\?p=(\d+))?$/)
  return m ? { bvid: m[1], page: m[2] ? Number(m[2]) : null } : null
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const root = process.cwd()
  const data = path.join(root, 'data')
  const entryDir = path.join(data, 'entries')
  const games = GamesFile.parse(yaml.load(fs.readFileSync(path.join(data, 'games.yaml'), 'utf8')))
  const timelinePath = path.join(data, 'game-timelines.yaml')
  const timelines = GameTimelinesFile.parse(yaml.load(fs.readFileSync(timelinePath, 'utf8')) ?? [])
  const withTimeline = new Set(timelines.map((t) => t.entry))
  const termsById = new Map(games.map((g) => [g.id, [g.name, ...(g.aliases ?? [])].map(compactText).filter(termUsable)]))
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
  const since = new Date(Date.now() - RECENT_DAYS * 86400_000).toISOString().slice(0, 10)

  const files = fs.readdirSync(entryDir).filter((f) => /\.ya?ml$/.test(f)).sort()
  const cache = new Map<string, PageInfo[]>()
  const pages = async (bvid: string) => {
    if (!cache.has(bvid)) {
      cache.set(bvid, await pagelist(bvid))
      await new Promise((r) => setTimeout(r, 1500))
    }
    return cache.get(bvid)!
  }
  const newTimelines: string[] = []
  let covers = 0

  for (const file of files) {
    const full = path.join(entryDir, file)
    let text = fs.readFileSync(full, 'utf8')
    const entries: Entry[] = EntriesFile.parse(yaml.load(text) ?? [])
    let changed = false
    for (const entry of entries) {
      if (entry.contributed_by !== 'collection-review' || entry.type !== 'live' || entry.date < since) continue
      const replays = entry.sources.filter((s) => s.kind === 'replay' && s.status === 'alive' && bilibiliSource(s.url))

      // ---- 封面：只补投稿分段来源，取这一场首 P 的首帧
      if (!entry.cover) {
        const segment = replays.map((s) => ({ s, b: bilibiliSource(s.url)! })).find(({ b }) => b.page !== null)
        if (segment) {
          try {
            const page = (await pages(segment.b.bvid)).find((p) => p.page === segment.b.page)
            if (page?.first_frame) {
              text = insertCover(text, entry.id, page.first_frame.replace(/^https:/, 'http:'))
              changed = true
              covers += 1
              console.log(`封面 ${entry.id} ← ${segment.b.bvid} P${page.page} 首帧`)
            }
          } catch (err) {
            console.warn(`封面 ${entry.id} 跳过：${(err as Error).message}`)
          }
        }
      }

      // ---- 时间轴：多游戏、还没有时间轴、整投稿来源的分 P 标题逐个点名游戏
      const visible = visibleGameIds(entry.games)
      if (visible.length < 2 || withTimeline.has(entry.id)) continue
      const terms = visible.map((id) => ({ id, terms: termsById.get(id) ?? [] }))
      for (const source of replays) {
        const b = bilibiliSource(source.url)!
        if (b.page !== null) continue
        let list: PageInfo[]
        try {
          list = await pages(b.bvid)
        } catch (err) {
          console.warn(`时间轴 ${entry.id} 跳过 ${b.bvid}：${(err as Error).message}`)
          continue
        }
        const spans = deriveSpans(list, terms)
        if (!spans) continue
        const timeline = GameTimeline.parse({
          entry: entry.id,
          basis: source.url,
          coverage: coverageOf(list),
          reviewed: today,
          note: '自动：分 P 标题逐个写明了游戏（scripts/collection-followups.ts），只到分 P 精度，未经人工核对。',
          parts: list.map((p) => ({ page: p.page, id: p.cid, duration_sec: p.duration })),
          spans: spans.map((s) => ({ page: s.page, at: '00:00:00', game: s.game, precision: 'part', evidence: 'part_title' })),
        })
        newTimelines.push(timelineYaml(timeline))
        withTimeline.add(entry.id)
        console.log(`时间轴 ${entry.id} ← ${b.bvid}：${spans.map((s) => `P${s.page} ${s.game}`).join('，')}（${timeline.coverage}）`)
        break
      }
    }
    if (changed && !dryRun) fs.writeFileSync(full, text)
  }

  if (newTimelines.length && !dryRun) {
    const existing = fs.readFileSync(timelinePath, 'utf8')
    fs.writeFileSync(timelinePath, `${existing.endsWith('\n') ? existing : `${existing}\n`}${newTimelines.join('')}`)
  }
  console.log(`${dryRun ? '[dry-run] ' : ''}补封面 ${covers} 条，新时间轴 ${newTimelines.length} 条`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
