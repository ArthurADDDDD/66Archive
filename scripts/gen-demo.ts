/**
 * 生成演示数据，只为在真实数据到位前验证 Schema 与界面。
 *
 * ⚠️ 产出的每一条都带 `demo: true` 与「【示例】」标题前缀，站点会显著标注。
 * 它不是、也不得被当作任何真实记录。真实数据一旦进入 data/entries/，
 * 演示数据会自动被忽略（见 src/lib/data.ts）。
 *
 *   npx tsx scripts/gen-demo.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

// 固定种子，保证每次生成结果一致，diff 干净
let seed = 66
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))
const pad = (n: number) => String(n).padStart(2, '0')

const GAMES = [
  'the-witcher-3', 'dark-souls-3', 'stardew-valley', 'minecraft', 'portal-2',
  'red-dead-redemption-2', 'hollow-knight', 'disco-elysium', 'baldurs-gate-3',
  'resident-evil-4', 'outer-wilds', 'elden-ring',
]
const VIDEO_TITLES = [
  '实况解说 第%期', '流程攻略 第%集', '剧情向剪辑 第%期', '这一关我卡了三小时',
  '开箱与吐槽 第%期', '新手向教程 第%集',
]
const LIVE_TITLES = [
  '晚上好，继续开荒', '通宵挑战最终 BOSS', '随便播播 顺便聊天',
  '这个结局我真没想到', '全成就收集 第%天', '联动直播 一起玩',
]

type Src = { url: string; account?: string; kind: string; parts?: number; status: string }
const entries: Record<string, unknown>[] = []

for (let year = 2010; year <= 2026; year++) {
  // 早年以视频为主，后期以直播为主：只是为了让界面上能看到两个时期的过渡
  const isVideoEra = year <= 2015
  const count = isVideoEra ? int(6, 14) : int(10, 20)

  for (let i = 0; i < count; i++) {
    const month = int(1, 12)
    const day = int(1, 28)
    if (year === 2026 && month > 8) continue
    const type = isVideoEra ? (rnd() < 0.85 ? 'video' : 'live') : rnd() < 0.25 ? 'video' : 'live'
    const platform = isVideoEra
      ? pick(['youku', 'youku', 'bilibili'])
      : type === 'live'
        ? pick(['bilibili', 'bilibili', 'douyu', 'douyin'])
        : 'bilibili'

    const games = rnd() < 0.85 ? [pick(GAMES)] : []
    if (rnd() < 0.2 && games.length) {
      const second = pick(GAMES)
      if (second !== games[0]) games.push(second)
    }

    const duration = type === 'live' ? int(90, 620) : int(8, 45)
    const template = type === 'live' ? pick(LIVE_TITLES) : pick(VIDEO_TITLES)
    const title = `【示例】${template.replace('%', String(int(1, 60)))}`

    const sources: Src[] = [
      { url: `https://example.invalid/demo/${year}${pad(month)}${pad(day)}-${i}`, kind: type === 'live' ? 'original' : 'original', status: 'unchecked' },
    ]
    if (type === 'live' && rnd() < 0.6) {
      sources.push({ url: `https://example.invalid/demo-replay/${year}-${i}`, kind: 'replay', parts: int(2, 6), status: rnd() < 0.15 ? 'dead' : 'unchecked' })
    }

    // 分段：只有直播才有，这是「那天播了什么游戏」的时间精度
    const segments: { at: string; game?: string | null; label: string }[] = []
    if (type === 'live' && games.length) {
      let cursor = int(2, 20) * 60
      segments.push({ at: fmt(cursor), game: games[0], label: '开播' })
      cursor += int(60, 180) * 60
      if (cursor < duration * 60 - 1800) {
        if (games.length > 1) {
          segments.push({ at: fmt(cursor), game: games[1], label: '换游戏' })
          cursor += int(60, 150) * 60
        }
        if (cursor < duration * 60 - 900) {
          segments.push({ at: fmt(cursor), game: null, label: '杂谈 / 读评论' })
        }
      }
    }

    entries.push({
      id: `${year}-${pad(month)}-${pad(day)}-${type}-${pad(i + 1)}`,
      type,
      date: `${year}-${pad(month)}-${pad(day)}`,
      ...(type === 'live' ? { time: `${pad(int(14, 21))}:${pick(['00', '30'])}` } : {}),
      title,
      platform,
      duration_min: duration,
      games,
      tags: rnd() < 0.25 ? [pick(['杂谈', '联动', '通宵', '首播', '完结'])] : [],
      confidence: 'low',
      sources,
      segments,
      note: '演示数据，非真实记录',
      demo: true,
    })
  }
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${pad(h)}:${pad(m)}:00`
}

entries.sort((a, b) => String(a.date).localeCompare(String(b.date)))

const out = path.join(process.cwd(), 'data/_demo/demo-entries.yaml')
fs.writeFileSync(
  out,
  `# 自动生成的演示数据 —— 非真实记录，勿引用。\n` +
    `# 由 scripts/gen-demo.ts 生成；真实数据进入 data/entries/ 后本文件自动失效。\n` +
    yaml.dump(entries, { lineWidth: 120, noRefs: true }),
)
console.log(`已生成 ${entries.length} 条演示数据 → ${out}`)
