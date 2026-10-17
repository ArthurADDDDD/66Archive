/**
 * 游戏时间轴契约与游戏环节时长计算的测试（口径见 docs/game-time.md）。
 *
 * 这套数字算错了不会报错，只会让排行悄悄变样、或让跳转落到别的分 P，
 * 所以这里把口径里的每条规则都钉成一个断言，最后再在真实档案上跑一遍守恒检查。
 */
import assert from 'node:assert/strict'
import { getGameTimelines, getPublicDataset, toTimelineEntries } from '../src/lib/data'
import { checkGameTimelines } from '../src/lib/game-timeline-check'
import {
  buildJump,
  indexTimelines,
  sessionGameTime,
  summarizeGameTime,
  type SessionInput,
} from '../src/lib/game-time'
import { visibleGameIds } from '../src/lib/games'
import { allGameIds, getGameProfile } from '../src/lib/narrative'
import { Entry, GameTimeline, INDEPENDENT_SEGMENT_MIN_SEC, type TimelineSpan } from '../src/lib/schema'

const BV = 'https://www.bilibili.com/video/BV1iK4y1v7AT'
const AC = 'https://www.acfun.cn/v/ac17326766'
const parts = (...durations: number[]) => durations.map((duration_sec, i) => ({ page: i + 1, id: 1000 + i, duration_sec }))
type SpanInput = Partial<TimelineSpan> & Pick<TimelineSpan, 'page' | 'at'>
const span = (s: SpanInput): TimelineSpan => ({ precision: 'part', evidence: 'part_title', ...s }) as TimelineSpan
const timeline = (overrides: Partial<GameTimeline> & { spans: TimelineSpan[] }): GameTimeline =>
  GameTimeline.parse({ entry: 'e1', basis: BV, coverage: 'complete', parts: parts(2655, 2655, 3414), reviewed: '2026-10-17', ...overrides })
const session = (games: string[], duration_min?: number, id = 'e1'): SessionInput => ({ id, games: games.map((g) => ({ id: g })), duration_min })

// ── 定义常量只有一份 ────────────────────────────────────────────────
assert.equal(INDEPENDENT_SEGMENT_MIN_SEC, 300)

// ── 分 P 级时间轴：关联录像，不算已核实；独立环节（开播聊天）不计入任何游戏 ──
{
  const t = timeline({
    spans: [
      span({ page: 1, at: '00:00:00', kind: 'break', note: 'P1 标题「游戏前聊」' }),
      span({ page: 2, at: '00:00:00', game: 'paper-mario' }),
      span({ page: 3, at: '00:00:00', game: 'fall-guys', evidence: 'recording_break' }),
    ],
  })
  const mario = sessionGameTime(session(['paper-mario', 'fall-guys']), 'paper-mario', t)
  assert.equal(mario.associatedSec, 2655)
  assert.equal(mario.verifiedSec, 0, '分 P 边界不能算已核实')
  assert.equal(mario.lowerBound, false)
  assert.equal(mario.jump?.url, 'https://www.bilibili.com/video/BV1iK4y1v7AT/?p=2', 'part 精度只带 ?p=，不带 t')
  const fall = sessionGameTime(session(['paper-mario', 'fall-guys']), 'fall-guys', t)
  assert.equal(fall.associatedSec, 3414)
  assert.equal(mario.associatedSec + fall.associatedSec, 2655 + 3414, '开播聊天的 P1 不归任何游戏')
}

// ── 已核实：两端 ≤1 分钟 + 内部已检查；缺任何一项都不算 ─────────────────
{
  const spans = (scanned: boolean) => [
    span({ page: 1, at: '00:00:00', kind: 'break' }),
    span({ page: 1, at: '00:12:30', game: 'paper-mario', precision: 'approx', evidence: 'human_watch', scanned }),
    span({ page: 3, at: '00:05:00', game: 'fall-guys', precision: 'exact', evidence: 'human_watch', scanned }),
  ]
  const ok = sessionGameTime(session(['paper-mario', 'fall-guys']), 'paper-mario', timeline({ spans: spans(true) }))
  assert.equal(ok.associatedSec, 2655 * 2 - 750 + 300)
  assert.equal(ok.verifiedSec, ok.associatedSec)
  assert.equal(ok.jump?.url, 'https://www.bilibili.com/video/BV1iK4y1v7AT/?p=1&t=750')
  // 最后一个环节的终点是录像结尾，算精确
  const last = sessionGameTime(session(['paper-mario', 'fall-guys']), 'fall-guys', timeline({ spans: spans(true) }))
  assert.equal(last.verifiedSec, 3414 - 300)
  const unscanned = sessionGameTime(session(['paper-mario', 'fall-guys']), 'paper-mario', timeline({ spans: spans(false) }))
  // 模型读缩略图得出的分钟级边界：再准也不算已核实
  const byThumbs = timeline({ spans: spans(true).map((x, i) => (i === 0 ? x : { ...x, evidence: 'thumbnails' as const })) })
  const thumbs = sessionGameTime(session(['paper-mario', 'fall-guys']), 'paper-mario', byThumbs)
  assert.equal(thumbs.verifiedSec, 0, 'thumbnails 证据不能冒充人工核对')
  assert.equal(thumbs.associatedSec, ok.associatedSec)
  assert.equal(unscanned.verifiedSec, 0, '只定位了两端、没查内部，不算已核实')
  assert.equal(unscanned.associatedSec, ok.associatedSec)
  // 终点是分 P 级边界：这一段也不能算已核实
  const fuzzyEnd = timeline({
    spans: [
      span({ page: 1, at: '00:00:00', game: 'paper-mario', scanned: true }),
      span({ page: 3, at: '00:00:00', game: 'fall-guys', scanned: true }),
    ],
  })
  assert.equal(sessionGameTime(session(['paper-mario', 'fall-guys']), 'paper-mario', fuzzyEnd).verifiedSec, 0)
  assert.equal(sessionGameTime(session(['paper-mario', 'fall-guys']), 'fall-guys', fuzzyEnd).verifiedSec, 0)
}

// ── 中途独立环节被排除；反复切换时同一游戏的环节相加，跳转取第一个 ──────
{
  const t = timeline({
    spans: [
      span({ page: 1, at: '00:00:00', game: 'paper-mario', scanned: true }),
      span({ page: 1, at: '00:40:00', kind: 'break', precision: 'approx', evidence: 'human_watch', note: '吃饭' }),
      span({ page: 2, at: '00:10:00', game: 'fall-guys', precision: 'approx', evidence: 'human_watch', scanned: true }),
      span({ page: 3, at: '00:00:00', game: 'paper-mario', precision: 'approx', evidence: 'human_watch', scanned: true }),
    ],
  })
  const mario = sessionGameTime(session(['paper-mario', 'fall-guys']), 'paper-mario', t)
  assert.equal(mario.associatedSec, 2400 + 3414)
  assert.equal(mario.verifiedSec, 2400 + 3414, '录像开头算精确起点')
  assert.equal(mario.jump?.page, 1)
  const fall = sessionGameTime(session(['paper-mario', 'fall-guys']), 'fall-guys', t)
  assert.equal(fall.associatedSec, 2655 - 600)
  assert.equal(fall.verifiedSec, 2655 - 600, '两端都是人工定位（终点 = 下一环节的 approx 起点）且内部已查，算已核实')
}

// ── 未核对环节：可能属于任何一款，进上限，所有游戏都只是下限 ────────────
{
  const t = timeline({
    spans: [
      span({ page: 1, at: '00:00:00', game: 'paper-mario' }),
      span({ page: 2, at: '00:00:00', kind: 'unknown' }),
      span({ page: 3, at: '00:00:00', game: 'fall-guys' }),
    ],
  })
  for (const g of ['paper-mario', 'fall-guys']) {
    const r = sessionGameTime(session(['paper-mario', 'fall-guys']), g, t)
    assert.equal(r.unknownUpperSec, 2655)
    assert.equal(r.lowerBound, true)
  }
}

// ── 录像不全（A 站续号只挂了后半场）：数字是下限，上限开放 ─────────────
{
  const t = timeline({
    basis: AC,
    coverage: 'partial',
    parts: [{ page: 1, id: '16459422', duration_sec: 2707.805 }, { page: 2, id: '16459423', duration_sec: 2709.558 }],
    spans: [span({ page: 1, at: '00:00:00', game: 'demons-souls' })],
  })
  const r = sessionGameTime(session(['demons-souls', 'other']), 'demons-souls', t)
  assert.equal(r.associatedSec, 2707.805 + 2709.558, '只用基准来源自己的分 P 时长，不用条目 duration_min')
  assert.equal(r.lowerBound, true)
  assert.equal(r.upperOpen, true)
  assert.equal(r.jump?.url, 'https://www.acfun.cn/v/ac17326766')
}

// ── 没有时间轴的场次 ────────────────────────────────────────────────
{
  const single = sessionGameTime(session(['fall-guys'], 120), 'fall-guys')
  assert.deepEqual([single.basis, single.associatedSec, single.verifiedSec], ['single', 7200, 0], '单游戏整场只算关联录像')
  const multi = sessionGameTime(session(['paper-mario', 'fall-guys'], 259), 'fall-guys')
  assert.deepEqual([multi.basis, multi.associatedSec, multi.unknownUpperSec], ['none', 0, 259 * 60], '多游戏未拆分：0 小时，整场进上限')
  const noDuration = sessionGameTime(session(['fall-guys']), 'fall-guys')
  assert.deepEqual([noDuration.basis, noDuration.associatedSec, noDuration.upperOpen], ['none', 0, true])
  // 策展游戏按标题匹配：游戏不在 games 里时也要算进「这一场有几款」
  assert.equal(sessionGameTime(session([], 60), 'geometry-dash').basis, 'single')
  assert.equal(sessionGameTime(session(['minecraft'], 60), 'geometry-dash').basis, 'none')
}

// ── 系列父 ID：与具体作品同挂时算一款；父 ID 继承具体作品的环节 ────────────────
{
  const single = sessionGameTime(session(['maplestory', 'maplestory-classic'], 120), 'maplestory-classic')
  assert.equal(single.basis, 'single', '只玩冒险岛怀旧服、同挂系列父 ID 的场次不是多游戏场次')
  assert.equal(sessionGameTime(session(['maplestory', 'maplestory-classic'], 120), 'maplestory').associatedSec, 7200, '系列页同样拿到这一场')
  const t = timeline({ spans: [span({ page: 1, at: '00:00:00', game: 'rusty-lake' }), span({ page: 3, at: '00:00:00', game: 'maplestory-classic' })] })
  assert.equal(sessionGameTime(session(['rusty-lake', 'maplestory', 'maplestory-classic']), 'maplestory', t).associatedSec, 3414)
  assert.equal(sessionGameTime(session(['rusty-lake', 'maplestory', 'maplestory-classic']), 'maplestory-classic', t).associatedSec, 3414)
}

// ── 跳转链接 ────────────────────────────────────────────────────────
assert.equal(buildJump(`${BV}?p=7`, 3, 0, 'part')?.url, 'https://www.bilibili.com/video/BV1iK4y1v7AT/?p=3', '基准 url 自带的 ?p= 不得残留')
assert.equal(buildJump(BV, 3, 412, 'approx')?.url, 'https://www.bilibili.com/video/BV1iK4y1v7AT/?p=3&t=412')
assert.equal(buildJump(AC, 3, 412, 'exact')?.url, 'https://www.acfun.cn/v/ac17326766_3', 'A 站没有秒级参数')
assert.equal(buildJump(AC, 3, 412, 'exact')?.seeks, false)
assert.equal(buildJump('https://b23.tv/abc', 1, 0, 'part'), null)

// ── 汇总与排行门槛 ──────────────────────────────────────────────────
{
  const verifiedAll = timeline({
    spans: [span({ page: 1, at: '00:00:00', game: 'fall-guys', precision: 'exact', evidence: 'human_watch', scanned: true })],
  })
  const one = summarizeGameTime('fall-guys', [session(['fall-guys'])], indexTimelines([verifiedAll]))
  assert.equal(one.playtimeRankable, true)
  const mixed = summarizeGameTime(
    'fall-guys',
    [session(['fall-guys']), session(['fall-guys'], 100, 'e2'), session(['fall-guys', 'paper-mario'], 200, 'e3')],
    indexTimelines([verifiedAll]),
  )
  assert.equal(mixed.sessions, 3)
  assert.equal(mixed.attributedSessions, 2)
  assert.equal(mixed.unattributedSessions, 1)
  assert.equal(mixed.timelineSessions, 1)
  assert.equal(mixed.associatedSec, 2655 + 2655 + 3414 + 6000)
  assert.equal(mixed.verifiedSec, 2655 + 2655 + 3414)
  assert.equal(mixed.unknownUpperSec, 12000)
  assert.equal(mixed.playtimeRankable, false, '有未拆分场次就不能进游玩时长排行')
}

// ── Schema：结构规则 ────────────────────────────────────────────────
const rejects = (overrides: Record<string, unknown>, why: string) =>
  assert.equal(GameTimeline.safeParse({ entry: 'e1', basis: BV, coverage: 'complete', parts: parts(100, 100), reviewed: '2026-10-17', spans: [span({ page: 1, at: '00:00:00', game: 'a' })], ...overrides }).success, false, why)
rejects({ spans: [span({ page: 1, at: '00:00:10', game: 'a', precision: 'approx' })] }, '第一个环节必须从录像开头开始')
rejects({ spans: [span({ page: 1, at: '00:00:00', game: 'a' }), span({ page: 2, at: '00:00:30', game: 'b' })] }, 'part 精度不能带分 P 内时间')
rejects({ spans: [span({ page: 1, at: '00:00:00', game: 'a', kind: 'break' })] }, 'game 与 kind 只能写一项')
rejects({ spans: [span({ page: 1, at: '00:00:00', game: 'a' }), span({ page: 2, at: '00:00:00', game: 'a' })] }, '相邻相同环节要合并')
rejects({ spans: [span({ page: 1, at: '00:00:00', game: 'a' }), span({ page: 1, at: '00:02:00', game: 'b', precision: 'approx' })] }, '超出分 P 时长')
rejects({ spans: [span({ page: 1, at: '00:00:00', game: 'a' }), span({ page: 3, at: '00:00:00', game: 'b' })] }, '分 P 不在 parts 里')
rejects({ parts: [{ page: 1, id: 1, duration_sec: 100 }, { page: 3, id: 3, duration_sec: 100 }] }, '分 P 有缺口时不能标整场覆盖')
rejects({ parts: [{ page: 2, id: 2, duration_sec: 100 }, { page: 3, id: 3, duration_sec: 100 }], spans: [span({ page: 2, at: '00:00:00', game: 'a' })] }, '不从 P1 起也不能标整场覆盖')
rejects({ reviewed: undefined }, '没有人工确认日期不能入库')
rejects({ spans: [span({ page: 1, at: '00:00:00', game: 'a', precision: 'approx', evidence: 'part_title' })] }, '分 P 标题不能支撑分钟级精度')
rejects({ spans: [span({ page: 1, at: '00:00:00', game: 'a', precision: 'exact', evidence: 'recording_break' })] }, '录像断点不能支撑秒级精度')
assert.equal(GameTimeline.safeParse({ entry: 'e1', basis: BV, coverage: 'partial', parts: [{ page: 6, id: 6, duration_sec: 100 }], reviewed: '2026-10-17', spans: [span({ page: 6, at: '00:00:00', game: 'a' })] }).success, true, '续号来源标 partial 合法')

// ── 交叉校验：与条目对不上的时间轴全部报错 ──────────────────────────────
{
  const entry = (id: string, extra: Record<string, unknown>) =>
    Entry.parse({ id, type: 'live', date: '2020-08-10', title: id, platform: 'douyu', duration_min: 259, ...extra })
  const entries = [
    entry('e1', { games: ['paper-mario', 'fall-guys'], sources: [{ url: BV, kind: 'replay' }, { url: AC, kind: 'replay' }] }),
    entry('e2', { games: ['paper-mario'], sources: [{ url: 'https://www.bilibili.com/video/BV1aaaaaaaaa', kind: 'replay' }], note: '与 e1 属同场直播的不同录像，前端可作备选源切换' }),
    entry('e3', { games: ['fall-guys'], sources: [{ url: 'https://v.douyu.com/show/abc', kind: 'replay' }] }),
  ]
  const good = timeline({ spans: [span({ page: 1, at: '00:00:00', game: 'paper-mario' }), span({ page: 3, at: '00:00:00', game: 'fall-guys' })] })
  assert.deepEqual(checkGameTimelines(entries, [good]).errors, [])
  const errorsOf = (t: GameTimeline) => checkGameTimelines(entries, [t]).errors.join('\n')
  assert.match(errorsOf({ ...good, entry: 'nope' }), /不存在的条目/)
  assert.match(errorsOf({ ...good, entry: 'e2', basis: 'https://www.bilibili.com/video/BV1aaaaaaaaa', spans: [span({ page: 1, at: '00:00:00', game: 'paper-mario' })] }), /代表条目 "e1"/)
  assert.match(errorsOf({ ...good, basis: 'https://www.bilibili.com/video/BV1zzzzzzzzz' }), /basis 不是这一场任何来源/)
  assert.match(errorsOf({ ...good, entry: 'e3', basis: 'https://v.douyu.com/show/abc', spans: [span({ page: 1, at: '00:00:00', game: 'fall-guys' })] }), /还不支持/)
  assert.match(errorsOf({ ...good, spans: [span({ page: 1, at: '00:00:00', game: 'minecraft' })] }), /不在条目的 games 里/)
  assert.match(errorsOf({ ...good, spans: [span({ page: 1, at: '00:00:00', game: 'paper-mario' })] }), /整场覆盖.*fall-guys/)
  assert.deepEqual(checkGameTimelines(entries, [{ ...good, coverage: 'partial', spans: [span({ page: 1, at: '00:00:00', game: 'paper-mario' })] }]).errors, [], 'partial 时允许有游戏不在录像里')
  assert.match(checkGameTimelines(entries, [good, { ...good }]).errors.join('\n'), /同一场只能有一条时间轴/)
  assert.match(errorsOf({ ...good, reviewed: '2999-01-01' }), /在未来/)
  // 系列父 ID 不要求单独有环节
  const series = [entry('m1', { games: ['rusty-lake', 'maplestory', 'maplestory-classic'], sources: [{ url: BV, kind: 'replay' }] })]
  const mt = timeline({ entry: 'm1', spans: [span({ page: 1, at: '00:00:00', game: 'rusty-lake' }), span({ page: 3, at: '00:00:00', game: 'maplestory-classic' })] })
  assert.deepEqual(checkGameTimelines(series, [mt]).errors, [])
}

// ── 守恒（随机时间轴）：各游戏关联录像 + 独立环节 + 未核对 = 录像时长；已核实 ⊆ 关联录像 ──
{
  let seed = 7
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  const games = ['a', 'b', 'c']
  for (let round = 0; round < 300; round++) {
    const durations = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => 600 + Math.floor(rand() * 4000))
    const spans: TimelineSpan[] = []
    let previous = ''
    durations.forEach((duration, i) => {
      for (const at of [0, Math.floor(rand() * (duration - 1))].sort((x, y) => x - y)) {
        if (i === 0 && spans.length === 0 && at !== 0) continue
        const choice = ['a', 'b', 'c', 'break', 'unknown'][Math.floor(rand() * 5)]
        if (choice === previous || (spans.length && at === 0 && spans.at(-1)!.page === i + 1)) continue
        const precision = at === 0 ? (['part', 'approx', 'exact'] as const)[Math.floor(rand() * 3)] : 'approx'
        const clock = `${String(Math.floor(at / 3600)).padStart(2, '0')}:${String(Math.floor((at % 3600) / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`
        if (spans.length && spans.at(-1)!.page === i + 1 && spans.at(-1)!.at >= clock) continue
        spans.push(span({ page: i + 1, at: clock, precision, evidence: 'human_watch', scanned: rand() > 0.3, ...(games.includes(choice) ? { game: choice } : { kind: choice as 'break' | 'unknown' }) }))
        previous = choice
      }
    })
    if (spans.length === 0 || spans[0].at !== '00:00:00' || spans[0].page !== 1) continue
    const t = timeline({ parts: parts(...durations), spans })
    const total = durations.reduce((s, d) => s + d, 0)
    const perGame = games.map((g) => sessionGameTime(session(games), g, t))
    const associated = perGame.reduce((s, r) => s + r.associatedSec, 0)
    const unknown = perGame[0].unknownUpperSec
    assert.ok(associated + unknown <= total + 1e-6, `第 ${round} 轮：关联录像 + 未核对超过录像时长`)
    for (const r of perGame) assert.ok(r.verifiedSec <= r.associatedSec + 1e-6)
  }
}

// ── 真实档案：新口径不重复计算；没有时间轴的多游戏场次对任何游戏贡献 0 ───────
{
  const ds = getPublicDataset()
  const sessions = toTimelineEntries(ds)
  const byEntry = indexTimelines(getGameTimelines())
  const matched = new Map<string, number>()
  let associated = 0
  let naive = 0
  for (const id of allGameIds(ds)) {
    const profile = getGameProfile(ds, sessions, id)
    if (!profile) continue
    const summary = summarizeGameTime(id, profile.entries, byEntry)
    associated += summary.associatedSec
    naive += profile.totalMinutes * 60
    for (const s of summary.perSession) {
      const entry = profile.entries.find((e) => e.id === s.entryId)!
      matched.set(entry.id, (entry.duration_min ?? 0) * 60)
      if (s.basis === 'none') assert.equal(s.associatedSec, 0, `${s.entryId} 归属未知却计了时长`)
      if (!byEntry.has(s.entryId) && visibleGameIds([...new Set([...entry.games.map((g) => g.id), id])]).length > 1) {
        assert.equal(s.associatedSec, 0, `${s.entryId} 是没有时间轴的多游戏场次，不能给 ${id} 计时`)
      }
    }
  }
  // 只和「至少关联一款游戏的场次」的录像总时长比：旧口径超过它就是重复计算的直接证据
  const recorded = [...matched.values()].reduce((s, v) => s + v, 0)
  assert.ok(associated <= recorded, `新口径各游戏之和 ${associated} 秒超过这些场次的录像总时长 ${recorded} 秒`)
  const pct = (v: number) => `${((v / recorded) * 100).toFixed(1)}%`
  console.log(`  真实档案：关联游戏的场次 ${matched.size} 场、录像 ${Math.round(recorded / 3600)} 小时；` +
    `旧口径各游戏累加 ${Math.round(naive / 3600)} 小时（${pct(naive)}）；新口径关联录像 ${Math.round(associated / 3600)} 小时（${pct(associated)}）`)
}

console.log('OK  game-time 契约与计算测试通过')
