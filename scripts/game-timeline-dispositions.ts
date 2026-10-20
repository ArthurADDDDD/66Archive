/**
 * 游戏时间轴的已复核风险清单（2026-10-20）。
 *
 * 这些条目不会因为「看起来像缺口」而被自动归类；每一条都在这里留下处置结论。
 * `test-game-timeline-gaps.ts` 用它区分：
 *   - 已登记、已复核的缺口 → 汇总输出，不再每次刷屏；
 *   - 新出现、未登记的缺口 → 直接让测试失败。
 * 已经修复的缺口必须从清单移除，避免某天复发时被旧记录静默放行。
 */

/** 已有可播放互补源与缺乏可用录像/证据必须分开登记。 */
export type GapStatus = 'playable_complement' | 'source_unverified' | 'no_known_replay' | 'evidence_insufficient'

export type ReviewedGap = {
  entry: string
  games: string[]
  status: GapStatus
  reason: string
}

/** partial / unknown 覆盖下，按具体游戏区分已有可播放录像、链接受阻与真实缺源。 */
export const REVIEWED_GAPS: ReviewedGap[] = [
  {
    entry: '2015-01-27-live-01',
    games: ['i-wanna-be-the-xylem'],
    status: 'playable_complement',
    reason: 'A站 ac1708393 片头画面证实 I Wanna，来源可播放；主 basis 为《新超级马里奥兄弟U》。',
  },
  {
    entry: '2015-01-27-live-01',
    games: ['super-mario-3d-world'],
    status: 'evidence_insufficient',
    reason: '3D World 仍有历史标签，但两条 A 站来源均未找到该游戏画面；未找到录像，不能认作已有互补源。',
  },
  {
    entry: '2015-01-29-live-01',
    games: ['im-scared', 'super-mario-3d-world', 'rhythm-heaven', 'just-dance'],
    status: 'source_unverified',
    reason: '基准 B 站单 P 仅 19:36；两条优酷来源只返回反爬/跳转页，未能确认可播放与分 P，标签保留。',
  },
  {
    entry: '2015-07-06-live-01',
    games: ['minecraft'],
    status: 'no_known_replay',
    reason: '唯一来源是 198 秒片段，只含 Besiege；Minecraft 不在该片段内。',
  },
  {
    entry: '2016-01-04-live-02',
    games: ['banished', 'papers-please'],
    status: 'playable_complement',
    reason: '基准 ac2440577 只覆盖《命运交叉的客店》；ac2440642 片头抽帧为 Banished，ac2441013 片头抽帧为 Papers, Please，两条均可播放。',
  },
  {
    entry: '2016-02-20-live-01',
    games: ['rusty-lake'],
    status: 'evidence_insufficient',
    reason: '基准为完整街霸 5 录像；抽帧 1:00 / 1:00:00 / 2:00:00 / 2:13:20 均为街霸 5 与分享菜单，未见生锈小湖。',
  },
  {
    entry: '2016-08-17-live-03',
    games: ['starbound', 'overwatch'],
    status: 'playable_complement',
    reason: '基准 B 站 P1 只含难死塔；A站 ac3029701 的 P1/P2 为星界边境、ac3029731 的 P1/P2 为守望先锋，均从各自视频片头开始。',
  },
  {
    entry: '2017-01-18-live-01',
    games: ['reigns-classic'],
    status: 'playable_complement',
    reason: '基准 B 站只有 P1/P2（几何冲刺）；A站 ac3415701 的 P1/P2 均为王权，从视频片头开始。',
  },
  {
    entry: '2017-02-17-live-01',
    games: ['kalimba'],
    status: 'evidence_insufficient',
    reason: '基准三 P 的旧分段均为几何冲刺，未找到 Kalimba 的画面或分 P 标题证据。',
  },
  {
    entry: '2017-04-04-live-01',
    games: ['super-bomberman-r', 'zelda-botw'],
    status: 'playable_complement',
    reason: '基准只有 P1（12Switch）；A站 ac3601511 片头为超级炸弹人R，ac3601510 的 P1/P2 为塞尔达，均从视频片头开始。',
  },
  {
    entry: '2022-11-02-live-01',
    games: ['the-past-within'],
    status: 'playable_complement',
    reason: 'A站 ac39540914（23395s）含 Endoparasitic → The Past Within；The Past Within 约 17180s（4:46:20）开始，可播放。A站无秒级 URL 参数，精确跳转需来源覆盖/结构方案。',
  },
  {
    entry: '2023-09-17-live-01',
    games: ['party-animals'],
    status: 'playable_complement',
    reason: 'A站 ac42398567（P2，19499s）约 250s–2550s 为猛兽派对，随后切回匹诺曹的谎言；它是一条独立视频，A站只能跳到分P开头。',
  },
  {
    entry: '2023-11-09-live-01',
    games: ['magicraft'],
    status: 'playable_complement',
    reason: 'A站 ac42909912（P1，11285s）约 1790s–3870s 为魔法工艺，之后是鹅鹅鸭；它是一条独立视频，A站只能跳到分P开头。',
  },
]

export type ReviewedCrossCheck = { entry: string; segmentAt: string; game: string; reason: string }

/**
 * 旧 `segments` 的游戏标签与新时间轴 unknown 区间重叠，但已确认不是漏归类。
 * 旧分段常使用整场累计时间，边界也比新时间轴粗，不能直接覆盖。
 */
export const REVIEWED_CROSS_CHECKS: ReviewedCrossCheck[] = [
  {
    entry: '2019-05-10-live-02',
    segmentAt: '02:45:02',
    game: 'rento',
    reason: 'P4 57:16 后画面仍是 RENTO，但出现 Because of inactivity；主播是否已完全停玩无法从静帧确认，保留 unknown。',
  },
]
/**
 * 已按多帧抽检复核、仍保留为 unknown 的长时间聊天段（≥30 分钟）。
 * 键：entry|page|at。新增长时间 unknown 必须先复核并登记，否则测试失败。
 */
export const REVIEWED_LONG_UNKNOWNS: Record<string, string> = {
  // 2026-10-20 收尾后已无 ≥30 分钟的 unknown；新增长时间 unknown 必须抽帧并在此登记。
}
export type ReviewedSpanBound = {
  entry: string
  game: string
  page: number
  at: string
  /** 该原始环节的起点到终点（秒）；同一游戏被合并展示时用 associatedSec 校验。 */
  durationSec: number
  /** 展示投影中的关联录像秒数（同款中途 break 会合并）。 */
  associatedSec: number
  verifiedSec: number
  toleranceSec?: number
  reason: string
}

/** 本轮修复的关键边界：不仅要求游戏还在，还要求起止和时长没有被悄悄改动。 */
export const REVIEWED_SPAN_BOUNDS: ReviewedSpanBound[] = [
  {
    entry: '2015-02-10-live-01',
    game: 'super-mario-3d-world',
    page: 1,
    at: '00:32:10',
    durationSec: 3350,
    associatedSec: 3350,
    verifiedSec: 0,
    reason: '抽帧 32:30 已出现 3D World 标题，32:10 为标题/存档选择起点；旧边界 34:00 偏晚 110 秒。',
  },
  {
    entry: '2018-05-10-live-01',
    game: 'beat-saber',
    page: 1,
    at: '00:12:20',
    durationSec: 4541,
    associatedSec: 4541,
    verifiedSec: 0,
    reason: '抽帧 12:20 已戴上头显，13:10 为 Beat Saber 菜单；旧边界 15:30 偏晚 190 秒。',
  },
  {
    entry: '2018-11-02-live-01',
    game: 'lifeafter',
    page: 2,
    at: '00:00:00',
    durationSec: 4622,
    associatedSec: 4622,
    verifiedSec: 0,
    reason: 'P2 开头 6 秒已见《明日之后》第三人称画面与犬只同伴；旧边界 P2 0:36 偏晚 36 秒。',
  },
  {
    entry: '2019-01-07-live-01',
    game: 'human-fall-flat',
    page: 2,
    at: '00:02:40',
    durationSec: 6679,
    associatedSec: 6679,
    verifiedSec: 0,
    reason: '抽帧 P2 2:40 出现 Curve Digital 标志，即《人类一败涂地》启动；旧边界 P3 0:24 偏晚 305 秒。',
  },
  {
    entry: '2019-03-01-live-01',
    game: 'trials-rising',
    page: 1,
    at: '00:16:25',
    durationSec: 552,
    associatedSec: 552,
    verifiedSec: 0,
    reason: '抽帧 16:25 出现《特技摩托：崛起》世界地图，16:54 已是 TRIALS 地图；旧边界 17:24 偏晚 59 秒。',
  },
  {
    entry: '2015-01-27-live-01',
    game: 'new-super-mario-bros-u',
    page: 1,
    at: '00:00:00',
    durationSec: 5985,
    associatedSec: 5985,
    verifiedSec: 0,
    reason: 'A站投稿说明与抽帧均为《新超级马里奥兄弟U》；原时间轴误标为 3D 世界。',
  },
  {
    entry: '2017-12-13-live-01',
    game: 'pubg',
    page: 3,
    at: '00:00:00',
    durationSec: 3597,
    associatedSec: 3597,
    verifiedSec: 0,
    reason: 'A站完整 9P 源：P2.1/P2.2 为吃鸡，P3.1 起为漫漫长夜。',
  },
  {
    entry: '2017-12-13-live-01',
    game: 'the-long-dark',
    page: 5,
    at: '00:00:00',
    durationSec: 7716,
    associatedSec: 7716,
    verifiedSec: 0,
    reason: 'A站 P3.1–P3.5 均为漫漫长夜，从 P3.1 片头开始；补回 7,716 秒。',
  },
  {
    entry: '2020-10-20-live-01',
    game: 'rolo-to-the-rescue',
    page: 1,
    at: '00:08:30',
    durationSec: 12833,
    associatedSec: 12833,
    verifiedSec: 0,
    reason: 'P3 01:09:48 起仍是 Rolo 的 NO CONTINUE REMAINING 结算画面，01:10:05 才回到主机菜单。',
  },
  {
    entry: '2017-12-09-live-01',
    game: 'reigns-her-majesty',
    page: 2,
    at: '00:02:20',
    durationSec: 3916,
    associatedSec: 3916,
    verifiedSec: 0,
    reason: 'P2 抽帧 2:20 出现《王权：女王陛下》标题，直到 P3 谋杀之谜。',
  },
  {
    entry: '2017-06-05-live-01',
    game: 'tumbleseed',
    page: 3,
    at: '00:21:40',
    durationSec: 1313,
    associatedSec: 1313,
    verifiedSec: 0,
    reason: 'P3 21:40 起为 TumbleSeed；P4 抽帧 11 个位置均为水墨苏绣外景（人群、古建、舞台灯），已独立标为 break，不计入游戏。',
  },
  {
    entry: '2018-05-10-live-01',
    game: 'in-death',
    page: 1,
    at: '02:26:40',
    durationSec: 1750,
    associatedSec: 1750,
    verifiedSec: 0,
    reason: 'P1 抽帧 2:26:40 起为雪地弓箭 VR（In Death），直到 P2 开始。',
  },
  {
    entry: '2018-05-10-live-01',
    game: 'rec-room',
    page: 2,
    at: '00:00:00',
    durationSec: 1470,
    associatedSec: 1470,
    verifiedSec: 0,
    reason: 'P2 0:40 的切换并非独立环节；Rec Room 持续到 24:30。',
  },
  {
    entry: '2019-08-15-live-01',
    game: 'doraemon-story-of-seasons',
    page: 4,
    at: '00:00:00',
    durationSec: 9121,
    associatedSec: 9121,
    verifiedSec: 0,
    reason: 'P4/P5 抽帧为《哆啦A梦 牧场物语》，不是《重聚矿石镇》。',
  },
  {
    entry: '2020-04-02-live-01',
    game: 'reading-people',
    page: 5,
    at: '00:00:00',
    durationSec: 2198.901,
    associatedSec: 2198.901,
    verifiedSec: 0,
    toleranceSec: 0.01,
    reason: 'P5 抽帧为《察言观色》黑白红画面；P6 前 4:50 为片尾/菜单。',
  },
  {
    entry: '2020-04-02-live-01',
    game: 'animal-crossing-nh',
    page: 6,
    at: '00:04:50',
    durationSec: 1907.301 - 290,
    associatedSec: 1907.301 - 290,
    verifiedSec: 0,
    toleranceSec: 0.01,
    reason: 'P6 4:50 起为动物森友会机场；此前为《察言观色》片尾/菜单。',
  },
  {
    entry: '2020-09-18-live-01',
    game: 'pro-gymnast',
    page: 1,
    at: '00:00:00',
    durationSec: 10595,
    associatedSec: 10595,
    verifiedSec: 0,
    reason: 'P4 48:18 后抽帧仍为 Pro Gymnast 结算画面；旧 unknown 已并入游戏环节。',
  },
]

/** 已确认不属于游戏的标签 / 目录项，不能再回到条目里。 */
export const RETIRED_GAME_TAGS: { game: string; entries?: string[]; reason: string }[] = [
  { game: 'meituan', reason: '美团是外卖 App，不是游戏；2024-12 条目已移除，目录项已删除。' },
  {
    game: 'overwatch',
    entries: ['2019-11-22-live-01'],
    reason: '该场全片 P1–P4 抽帧均为聊天/Tangle Tower，未见守望先锋。',
  },
  {
    game: 'monopoly-plus',
    entries: ['2019-05-10-live-02'],
    reason: 'P4 实际为 RENTO，不是 MONOPOLY PLUS；条目与旧分段已改为 rento。',
  },
  {
    game: 'sos-fomt',
    entries: ['2019-08-15-live-01'],
    reason: 'P4/P5 实为《哆啦A梦 牧场物语》，不是《牧场物语：重聚矿石镇》。',
  },
]

/** 本轮新增/拆分的目录项。 */
export const EXPECTED_GAMES: { id: string; name: string }[] = [
  { id: 'reigns-classic', name: '王权' },
  { id: 'reigns-her-majesty', name: '王权：女王陛下' },
  { id: 'doraemon-story-of-seasons', name: '哆啦A梦 牧场物语' },
]
