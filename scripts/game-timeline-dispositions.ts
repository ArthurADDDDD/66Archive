/**
 * 游戏时间轴的已复核风险清单（2026-10-20）。
 *
 * 这些条目不会因为「看起来像缺口」而被自动归类；每一条都在这里留下处置结论。
 * `test-game-timeline-gaps.ts` 用它区分：
 *   - 已登记、已复核的缺口 → 汇总输出，不再每次刷屏；
 *   - 新出现、未登记的缺口 → 直接让测试失败。
 * 已经修复的缺口必须从清单移除，避免某天复发时被旧记录静默放行。
 */

export { REVIEWED_GAPS } from '../src/lib/game-footage-evidence'
export type { GapStatus, ReviewedGap } from '../src/lib/game-footage-evidence'

export type ReviewedCrossCheck = { entry: string; segmentAt: string; game: string; reason: string }

/**
 * 旧 `segments` 的游戏标签与新时间轴 unknown 区间重叠，但已确认不是漏归类。
 * 旧分段常使用整场累计时间，边界也比新时间轴粗，不能直接覆盖。
 */
export const REVIEWED_CROSS_CHECKS: ReviewedCrossCheck[] = []
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
    entry: '2019-04-10-live-01',
    game: 'vacation-simulator',
    page: 2,
    at: '00:00:42',
    durationSec: 3254,
    associatedSec: 3254,
    verifiedSec: 0,
    reason: 'P2 28:46–29:04 的 18 秒为同一游戏内的菜单/加载间隙，按规则并入 Vacation Simulator，不再单列 unknown。',
  },
  {
    entry: '2021-03-09-live-01',
    game: 'tiny-lands',
    page: 1,
    at: '00:15:30',
    durationSec: 6713,
    associatedSec: 6713,
    verifiedSec: 0,
    reason: '音频 15:30 主播明确开始玩《Tiny Lands》，16:10 已在描述画面差异；旧边界 P2 0:00 偏晚 194 秒。',
  },
  {
    entry: '2015-02-10-live-01',
    game: 'super-mario-3d-world',
    page: 1,
    at: '00:32:10',
    durationSec: 3530,
    associatedSec: 3530,
    verifiedSec: 0,
    reason: '抽帧 32:30 已出现 3D World 标题，32:10 为标题/存档选择起点；1:28:00–1:31:00 为不足 5 分钟的换游戏间隙，按既有口径并入前款。',
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
    game: 'super-mario-3d-world',
    page: 1,
    at: '00:00:00',
    durationSec: 5985,
    associatedSec: 5985,
    verifiedSec: 0,
    reason: '2026-10-20 定点纠错：0 秒即 SUPER MARIO 3D WORLD 标题、30 秒角色选择，全片约 40 个抽样点均为 3D 世界；上一轮改标的《新超级马里奥兄弟U》系误认。',
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
    game: '1-2-switch',
    page: 2,
    at: '00:20:19',
    durationSec: 2614 - 1219 + 1139,
    associatedSec: 2614 - 1219 + 1139,
    verifiedSec: 0,
    reason: 'P3 0–16:38 仍为 1-2-Switch，16:40–18:58 HOME 菜单、更新设置与卡带拔出报错为不足 5 分钟的切换间隙，并入前款。',
  },
  {
    entry: '2017-06-05-live-01',
    game: 'puyo-puyo-tetris',
    page: 3,
    at: '00:18:59',
    durationSec: 2613 - 1139,
    associatedSec: 2613 - 1139,
    verifiedSec: 0,
    reason: '2026-10-20 定点纠错：P3 18:54 选中ぷよぷよテトリスS、18:59 启动画面、19:16 标题，之后对战直到 P3 结束；全程未见 TumbleSeed（旧 17:50 为 HOME 菜单，18:16 报错是 1-2-Switch 卡带被拔）。P4 水墨苏绣仍为独立 break。',
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
    durationSec: 1908.901 + 599,
    associatedSec: 1908.901 + 599,
    verifiedSec: 0,
    toleranceSec: 0.01,
    reason: 'P5 抽帧为《察言观色》黑白红画面；P6 至 9:58 仍为察言观色章节、总体结果、退出弹窗与桌面切换（2026-10-20 定点纠错，旧 4:50 偏早）。',
  },
  {
    entry: '2020-04-02-live-01',
    game: 'animal-crossing-nh',
    page: 6,
    at: '00:09:59',
    durationSec: 1907.301 - 599,
    associatedSec: 1907.301 - 599,
    verifiedSec: 0,
    toleranceSec: 0.01,
    reason: 'P6 9:59 起为动森「记录完毕」存档/载入画面，10:45 进岛；6:00/8:00 仍为察言观色，9:42 为其总体结果（2026-10-20 定点纠错）。',
  },
  {
    entry: '2020-09-18-live-01',
    game: 'pro-gymnast',
    page: 2,
    at: '00:00:00',
    durationSec: 10513 - 661,
    associatedSec: 10513 - 661,
    verifiedSec: 0,
    reason: 'P4 48:18 后抽帧仍为 Pro Gymnast 结算画面；旧 unknown 已并入游戏环节。P5 1.5 秒起即为 Fall Guys 标志，Pro Gymnast 止于 P5 0:02（2026-10-20 定点纠错）。P1 全程停在主菜单聊天，P2 一分钟内进入比赛，起点改为 P2（2026-10-25 抽帧复核）。',
  },
  {
    entry: '2020-09-18-live-01',
    game: 'fall-guys',
    page: 5,
    at: '00:00:02',
    durationSec: 3873,
    associatedSec: 3873,
    verifiedSec: 0,
    reason: 'P5 1.5 秒起 Fall Guys 黄底标志淡入、随后载入与大厅；旧起点 1:24 偏晚 82 秒，超出 approx 容差。',
  },
  {
    entry: '2026-04-16-live-03',
    game: 'auction-king',
    page: 1,
    at: '00:28:10',
    durationSec: 448,
    associatedSec: 448,
    verifiedSec: 0,
    reason: '34:40–35:05 仍为 Auction King 设置/店铺界面，35:11 退出弹窗，35:14–35:37 黑屏为退出过程，并入前款。',
  },
  {
    entry: '2026-04-16-live-03',
    game: 'bento-blocks',
    page: 1,
    at: '00:35:38',
    durationSec: 5785,
    associatedSec: 5785,
    verifiedSec: 0,
    reason: '35:38 Steam 库 Bento Blocks 显示「停止」（已启动），35:41 起游戏画面；旧 34:40 exact 无依据，偏早 58 秒。',
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
    game: 'tumbleseed',
    reason: '唯一挂载场次 2017-06-05 的 P3 实为《噗哟噗哟vs俄罗斯方块》，全场未见 TumbleSeed；目录项是 task-031 据该误认新建的，已删除。',
  },
  {
    game: 'new-super-mario-bros-u',
    entries: ['2015-01-27-live-01'],
    reason: '基准录像 ac1733926 实为《超级马里奥3D世界》；本场两条来源均无新超级马里奥兄弟U 画面。',
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
