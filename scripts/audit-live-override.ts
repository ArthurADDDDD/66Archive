/**
 * 实时文案覆盖审计（一次性诊断工具，不参与构建）
 *
 * 公开站是「服务端渲染基线 → 浏览器再用后台 /api/content/* 覆盖」。
 * 所以改完 narrative.ts / site-copy.ts 之后，必须回答一个问题：
 * **访客最终看到的到底是新基线，还是后台里那份旧文案？**
 *
 * 这个脚本把线上真实返回的覆盖载荷，喂给仓库里真正在用的合并函数
 * （applyLiveStoryYears / mergeSiteCopy），逐条对比「新基线」与「合并后」，
 * 把会被后台旧值盖掉的字段列出来。
 *
 * 用法：
 *   curl -s "$SITE/api/content/narrative"  > /tmp/lc_narrative.json   # $SITE = 公开站地址
 *   curl -s "$SITE/api/content/site-copy"  > /tmp/lc_site-copy.json
 *   npx tsx scripts/audit-live-override.ts
 */
import fs from 'node:fs'
import { getDataset, toTimelineEntries } from '../src/lib/data'
import { resolveStoryActs } from '../src/lib/narrative'
import { buildStorySections } from '../src/lib/story-years'
import { applyLiveStoryYears } from '../src/lib/live-content'
import { mergeSiteCopy } from '../src/components/LiveContentProvider'
import { SITE_COPY } from '../src/lib/site-copy'

type Row = { id: string; field: string; baseline: string; live: string }

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const narrativeDoc = readJson('/tmp/lc_narrative.json')
const copyDoc = readJson('/tmp/lc_site-copy.json')

if (!narrativeDoc || !copyDoc) {
  console.error('缺少线上载荷，请先 curl 到 /tmp/lc_narrative.json 与 /tmp/lc_site-copy.json')
  process.exit(1)
}

const ds = getDataset()
const timeline = toTimelineEntries(ds)
const storyActs = resolveStoryActs(ds, timeline)
const baseline = buildStorySections(storyActs, timeline)

const liveNarrative = (narrativeDoc.narrative ?? narrativeDoc) as {
  storyActs?: Parameters<typeof applyLiveStoryYears>[1]
  deletedIds?: string[]
}
const merged = applyLiveStoryYears(baseline, liveNarrative.storyActs, liveNarrative.deletedIds ?? [])

const shadowed: Row[] = []
const clean: string[] = []

for (let i = 0; i < baseline.length; i += 1) {
  const before = [baseline[i].hero, ...baseline[i].secondary].filter(Boolean)
  const after = [merged[i].hero, ...merged[i].secondary].filter(Boolean)
  for (const beat of before) {
    if (!beat) continue
    const final = after.find((candidate) => candidate?.id === beat.id)
    if (!final) {
      shadowed.push({ id: beat.id, field: '(整条被后台隐藏)', baseline: beat.title, live: '—' })
      continue
    }
    let dirty = false
    for (const field of ['date', 'kicker', 'title', 'body'] as const) {
      const a = beat[field] ?? ''
      const b = final[field] ?? ''
      if (a !== b) {
        shadowed.push({ id: beat.id, field, baseline: String(a), live: String(b) })
        dirty = true
      }
    }
    if (!dirty) clean.push(beat.id)
  }
}

console.log('='.repeat(78))
console.log('故事模式 · 会被后台旧文案盖掉的字段')
console.log('='.repeat(78))
if (shadowed.length === 0) {
  console.log('（无）新基线可以原样呈现给访客。')
} else {
  for (const row of shadowed) {
    console.log(`\n[${row.id}] ${row.field}`)
    console.log(`  新基线 : ${row.baseline}`)
    console.log(`  后台旧 : ${row.live}`)
  }
}
console.log(`\n未被覆盖（基线即最终显示）的节点 ${clean.length} 个：${clean.join(', ')}`)

console.log('\n' + '='.repeat(78))
console.log('站点文案 · 会被后台旧文案盖掉的字段')
console.log('='.repeat(78))
const liveCopy = (copyDoc.copy ?? copyDoc) as Parameters<typeof mergeSiteCopy>[1]
const mergedCopy = mergeSiteCopy(SITE_COPY, liveCopy)
let copyDirty = 0
for (const scope of ['homeSections', 'pages'] as const) {
  for (const block of SITE_COPY[scope]) {
    const final = mergedCopy[scope].find((candidate) => candidate.id === block.id)
    if (!final) continue
    for (const field of ['eyebrow', 'title', 'lede'] as const) {
      if (block[field] !== final[field]) {
        copyDirty += 1
        console.log(`\n[${scope}.${block.id}] ${field}`)
        console.log(`  新基线 : ${block[field]}`)
        console.log(`  后台旧 : ${final[field]}`)
      }
    }
  }
}
for (const room of SITE_COPY.rooms) {
  const final = mergedCopy.rooms.find((candidate) => candidate.id === room.id)
  if (final && room.body !== final.body) {
    copyDirty += 1
    console.log(`\n[rooms.${room.id}] body`)
    console.log(`  新基线 : ${room.body}`)
    console.log(`  后台旧 : ${final.body}`)
  }
}
if (copyDirty === 0) console.log('（无）')

console.log('\n注：故事模式的「归年」（storyYear）不在后台可覆盖范围内，')
console.log('    所以年份归位与跨年段落无论后台是否同步，都会立刻生效。')
