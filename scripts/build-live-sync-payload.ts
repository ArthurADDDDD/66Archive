/**
 * 生成「后台实时文案」同步载荷（一次性运维工具，不参与构建）
 *
 * 背景：前台是「服务端渲染基线 → 浏览器再用后台 /api/content/* 覆盖」。
 * 后台里存着一份完整的故事模式文案，改公开仓的 narrative.ts 不会让访客看到新文案，
 * 必须把后台那份也更新掉。这个脚本产出可直接导入后台的载荷。
 *
 * 它不是「拿基线粗暴盖掉后台」：PRESERVE_FROM_LIVE 里列的节点保留后台现有文案
 * （那些是管理员自己写的、比基线更好的内容，例如本人采访原话、名场面台词），
 * 其余按新基线覆盖，并补上基线新增、后台还没有的节点。
 *
 * 用法：
 *   curl -s "$SITE/api/content/narrative" > /tmp/lc_narrative.json   # $SITE = 公开站地址
 *   npx tsx scripts/build-live-sync-payload.ts > /tmp/narrative-sync.json
 */
import fs from 'node:fs'
import { getDataset, toTimelineEntries } from '../src/lib/data'
import { HOMEPAGE_ACTS, STORY_ACTS, HIGHLIGHTS, resolveHomepage, type Act, type Beat } from '../src/lib/narrative'

/**
 * 保留后台现有文案的节点。
 * 这些不是本次要修的内容，而是管理员在后台自己写下的更好版本——
 * 同步时不该被公开仓基线覆盖掉。
 */
const PRESERVE_FROM_LIVE = new Set([
  'first-video', // 后台是本人采访里的原话，比基线转述更好
  'three-books', // 管理员自己的排版与梗
  'number-723', // 名场面台词
  'yuanweiji',
  'dalishi',
])

type LiveBeatPayload = {
  id: string
  kicker: string
  title: string
  body: string
  visible: boolean
  date: string
  important: boolean
  size: string
  chips: string[]
  footnote: { text: string; rel: string; date: string }
  tail: string
}

const liveDoc = JSON.parse(fs.readFileSync('/tmp/lc_narrative.json', 'utf8'))
const live = liveDoc.narrative ?? liveDoc
const liveBeatById = new Map<string, LiveBeatPayload>()
for (const scope of ['homeActs', 'storyActs'] as const) {
  for (const act of live[scope] ?? []) {
    for (const beat of act.beats ?? []) liveBeatById.set(`${scope}:${beat.id}`, beat)
  }
}

const ds = getDataset()
const timeline = toTimelineEntries(ds)
const home = resolveHomepage(ds, timeline)

function toLiveBeat(beat: Beat, scope: 'homeActs' | 'storyActs'): LiveBeatPayload {
  const existing = liveBeatById.get(`${scope}:${beat.id}`)
  if (existing && PRESERVE_FROM_LIVE.has(beat.id)) return existing
  return {
    id: beat.id,
    kicker: beat.kicker ?? '',
    title: beat.title,
    body: beat.body ?? '',
    visible: existing?.visible ?? true,
    date: beat.date,
    important: Boolean(beat.important),
    size: beat.size,
    chips: beat.chips ?? [],
    footnote: {
      text: beat.gameWorld?.text ?? '',
      rel: beat.gameWorld?.rel ?? '',
      date: beat.gameWorld?.date ?? '',
    },
    tail: beat.tail ?? '',
  }
}

function toLiveAct(act: Act, scope: 'homeActs' | 'storyActs') {
  const existing = (live[scope] ?? []).find((candidate: { id: string }) => candidate.id === act.id)
  return {
    id: act.id,
    kicker: act.kicker,
    title: act.title,
    body: act.body,
    visible: existing?.visible ?? true,
    label: act.label,
    years: act.years,
    color: act.color,
    closer: { line: act.closer?.line ?? '', tail: act.closer?.tail ?? '' },
    beats: act.beats.map((beat) => toLiveBeat(beat, scope)),
  }
}

const payload = {
  version: live.version ?? 1,
  homeActs: HOMEPAGE_ACTS.map((act) => toLiveAct(act, 'homeActs')),
  storyActs: STORY_ACTS.map((act) => toLiveAct(act, 'storyActs')),
  highlights: HIGHLIGHTS.map((highlight) => {
    const existing = (live.highlights ?? []).find((candidate: { id: string }) => candidate.id === highlight.id)
    if (existing && PRESERVE_FROM_LIVE.has(highlight.id)) return existing
    return {
      id: highlight.id,
      kicker: highlight.kicker,
      title: highlight.title,
      body: highlight.body,
      visible: existing?.visible ?? true,
      date: highlight.date,
      emphasis: highlight.emphasis ?? '',
      expanded: existing?.expanded ?? false,
    }
  }),
  deletedIds: live.deletedIds ?? [],
}

// 摘要写到 stderr，载荷本身走 stdout，方便直接重定向成文件
const liveStoryIds = new Set((live.storyActs ?? []).flatMap((a: { beats: { id: string }[] }) => a.beats.map((b) => b.id)))
const added = STORY_ACTS.flatMap((a) => a.beats).filter((b) => !liveStoryIds.has(b.id)).map((b) => b.id)
const preserved = [...PRESERVE_FROM_LIVE].filter((id) => liveStoryIds.has(id))
console.error(`故事节点：基线 ${STORY_ACTS.flatMap((a) => a.beats).length} 个，后台 ${liveStoryIds.size} 个`)
console.error(`新增（后台还没有）：${added.join(', ') || '无'}`)
console.error(`保留后台现有文案：${preserved.join(', ') || '无'}`)
console.error(`首页高光：${home.highlights.length} 条`)

process.stdout.write(JSON.stringify(payload, null, 2))
