/**
 * 游戏时间轴的已复核风险清单（2026-10-20）。
 *
 * 这些条目不会因为「看起来像缺口」而被自动归类；每一条都在这里留下处置结论。
 * `test-game-timeline-gaps.ts` 用它区分：
 *   - 已登记、已复核的缺口 → 汇总输出，不再每次刷屏；
 *   - 新出现、未登记的缺口 → 直接让测试失败。
 * 已经修复的缺口必须从清单移除，避免某天复发时被旧记录静默放行。
 */

export type GapStatus = 'complementary_source' | 'evidence_insufficient' | 'mixed_content'

export type ReviewedGap = {
  entry: string
  games: string[]
  status: GapStatus
  reason: string
}

/** partial / unknown 覆盖下，条目标了游戏但基准录像没有对应环节。 */
export const REVIEWED_GAPS: ReviewedGap[] = [
  {
    entry: '2015-01-27-live-01',
    games: ['i-wanna-be-the-xylem', 'super-mario-3d-world'],
    status: 'complementary_source',
    reason: 'A站投稿说明与抽帧确认基准 ac1733926 是《新超级马里奥兄弟U》（已改标）；I Wanna 在 ac1708393 片头即可确认，3D 世界在两条来源中均未找到画面。',
  },
  {
    entry: '2015-01-29-live-01',
    games: ['im-scared', 'super-mario-3d-world', 'rhythm-heaven', 'just-dance'],
    status: 'complementary_source',
    reason: '基准 B 站单 P 仅 19:36；两条优酷来源只返回反爬/跳转页，未能确认可播放与分 P，标签保留。',
  },
  {
    entry: '2015-07-06-live-01',
    games: ['minecraft'],
    status: 'complementary_source',
    reason: '唯一来源是 198 秒片段，只含 Besiege；Minecraft 不在该片段内。',
  },
  {
    entry: '2016-01-04-live-02',
    games: ['banished', 'papers-please'],
    status: 'complementary_source',
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
    status: 'complementary_source',
    reason: '基准 B 站 P1 只含难死塔；A站 ac3029701 的 P1/P2 为星界边境、ac3029731 的 P1/P2 为守望先锋，均从各自视频片头开始。',
  },
  {
    entry: '2017-01-18-live-01',
    games: ['reigns-classic'],
    status: 'complementary_source',
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
    status: 'complementary_source',
    reason: '基准只有 P1（12Switch）；A站 ac3601511 片头为超级炸弹人R，ac3601510 的 P1/P2 为塞尔达，均从视频片头开始。',
  },
  {
    entry: '2022-11-02-live-01',
    games: ['the-past-within'],
    status: 'complementary_source',
    reason: 'A站 ac39540914（23395s）含 Endoparasitic → The Past Within；The Past Within 约 17180s（4:46:20）开始，可播放。A站无秒级 URL 参数，精确跳转需来源覆盖/结构方案。',
  },
  {
    entry: '2023-09-17-live-01',
    games: ['party-animals'],
    status: 'complementary_source',
    reason: 'A站 ac42398567（P2，19499s）约 250s–2550s 为猛兽派对，随后切回匹诺曹的谎言；它是一条独立视频，A站只能跳到分P开头。',
  },
  {
    entry: '2023-11-09-live-01',
    games: ['magicraft'],
    status: 'complementary_source',
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
    entry: '2017-06-05-live-01',
    segmentAt: '00:42:43',
    game: '1-2-switch',
    reason: '旧 P2 标签写 1-2-Switch，但前段是 eShop/宣传片：ARMS 只出现在预告画面，1-2-Switch 实玩从 20:19 开始；混合段保留 unknown。',
  },
  {
    entry: '2018-09-17-live-01',
    segmentAt: '02:03:42',
    game: '39-days-to-mars',
    reason: '旧分段从 P3 起点累计；抽帧 17:20 才出现《39 天到火星》标题，17:30 前为浏览器/聊天。',
  },
  {
    entry: '2018-12-07-live-01',
    segmentAt: '00:00:00',
    game: 'doudizhu',
    reason: '旧分段把聊天与斗地主并成一段；抽帧显示斗地主约在 17:16 开始，之前为聊天。',
  },
  {
    entry: '2018-12-11-live-01',
    segmentAt: '00:00:00',
    game: 'doudizhu',
    reason: '抽帧显示 11:55 仍为聊天，斗地主约在 12:00 开始。',
  },
  {
    entry: '2018-12-17-live-01',
    segmentAt: '00:00:00',
    game: 'doudizhu',
    reason: '抽帧显示 6:50 仍为聊天，斗地主约在 6:53 开始。',
  },
  {
    entry: '2019-03-01-live-01',
    segmentAt: '00:00:00',
    game: 'trials-rising',
    reason: '旧分段标签同时含「游戏前聊」；抽帧 17:20 才进入特技摩托菜单，17:24 前为聊天。',
  },
  {
    entry: '2019-05-10-live-02',
    segmentAt: '01:58:56',
    game: 'mist-detective',
    reason: 'P3 35:00 起为迷雾侦探片尾字幕与聊天，不是可玩的游戏环节。',
  },
  {
    entry: '2019-05-10-live-02',
    segmentAt: '02:45:02',
    game: 'rento',
    reason: 'P4 57:16 后画面仍是 RENTO，但出现 Because of inactivity，主播已转去聊天；按独立聊天保留。',
  },
  {
    entry: '2020-10-20-live-01',
    segmentAt: '00:00:00',
    game: 'rolo-to-the-rescue',
    reason: '前 8:30 为主机菜单/游戏选择界面，尚未进入具体作品。',
  },
  {
    entry: '2020-10-20-live-01',
    segmentAt: '02:32:17',
    game: 'rolo-to-the-rescue',
    reason: 'P3 01:09:48–01:10:05 仍是 Rolo 的 NO CONTINUE REMAINING 结算画面，已并入 Rolo；01:10:05 后为主机菜单/游戏列表，保留 unknown。',
  },
  {
    entry: '2021-04-27-live-01',
    segmentAt: '00:00:00',
    game: 'world-games-51',
    reason: '既有复核抽帧显示世界游戏大全 51 约在 16:15 开始；此前为聊天。',
  },
  {
    entry: '2026-02-06-live-01',
    segmentAt: '00:00:00',
    game: 'nioh-3',
    reason: '前 13:36 为开播聊天，仁王 3 从 13:36 开始。',
  },
  {
    entry: '2026-07-04-live-02',
    segmentAt: '00:00:00',
    game: 'rhythm-heaven',
    reason: '抽帧 0–35:35 均为聊天/浏览，节奏天国从 35:36 开始。',
  },
  {
    entry: '2026-07-04-live-02',
    segmentAt: '01:00:01',
    game: 'rhythm-heaven',
    reason: 'P2 24:48 起的 5.4 分钟为游戏间休息/切换，下一款从 30:12 开始。',
  },
]

/**
 * 已按多帧抽检复核、仍保留为 unknown 的长时间聊天段（≥30 分钟）。
 * 键：entry|page|at。新增长时间 unknown 必须先复核并登记，否则测试失败。
 */
export const REVIEWED_LONG_UNKNOWNS: Record<string, string> = {
  '2017-06-05-live-01|1|00:00:00': '开播聊天；P2 前段混有 eShop/ARMS，无法切成可靠游戏环节。',
  '2017-09-20-live-01|1|00:00:00': '抽帧 5 个位置均为摄像头聊天。',
  '2017-11-17-live-01|1|00:00:00': '抽帧 5 个位置均为摄像头聊天。',
  '2017-12-13-live-01|1|00:00:00': '抽帧 5 个位置均为摄像头聊天（喝茶/闲聊）。',
  '2018-03-31-live-01|1|00:00:00': '抽帧 5 个位置均为摄像头聊天。',
  '2018-08-21-live-01|1|00:00:00': '抽帧 5 个位置均为摄像头聊天。',
  '2018-09-17-live-01|1|00:00:00': '开播聊天；P3 前段为浏览器/聊天，17:30 才进入 39 天到火星。',
  '2019-03-29-live-01|1|00:00:00': '抽帧 5 个位置均为摄像头聊天。',
  '2019-04-06-live-01|1|00:00:00': '抽帧 5 个位置均为摄像头聊天。',
  '2019-05-10-live-02|1|00:00:00': 'P1/P2 开播聊天；P3 迷雾侦探从 0 开始。',
  '2019-06-10-live-01|1|00:00:00': '抽帧 5 个位置均为摄像头聊天。',
  '2019-08-29-live-01|1|00:00:00': '前 43:55 为聊天；结尾出现 Switch 新闻页，不是游玩。',
  '2019-11-22-live-01|1|00:00:00': 'P1 抽帧 5 个位置均为摄像头聊天。',
  '2019-12-20-live-01|1|00:00:00': '抽帧 5 个位置均为摄像头聊天。',
  '2020-10-13-live-01|1|00:00:00': 'P1/P2 为开播聊天与网页浏览；中世纪王朝从 P3 开始。',
  '2020-11-02-live-01|1|00:00:00': '抽帧为 B 站/网页浏览与 Steam 下载界面，不是游玩。',
  '2021-02-05-live-01|1|00:00:00': '抽帧为《戴森球计划》商店页浏览，不是游玩。',
  '2021-04-17-live-02|1|00:00:00': 'P1/P2 抽帧均为《鬼谷八荒》标题/菜单，主播在聊天；P3 才进入游玩。',
  '2021-05-04-live-01|1|00:00:00': '抽帧为直播/剪辑软件的游戏封面列表，不是游玩。',
  '2024-12-06-live-02|1|00:00:00': '抽帧为美团 App 页面浏览；该场游戏为 Out of Bounds。',
  '2024-12-09-live-02|1|00:00:00': '抽帧为聊天/美团 App；Out of Bounds 从 P2 2:44 开始。',
  '2024-12-22-live-02|1|00:00:00': '抽帧为聊天/美团 App；mizi-no 从 P2 6:13 开始。',
  '2026-07-04-live-02|1|00:00:00': '开播聊天与浏览；节奏天国从 35:36 开始。',
  '2026-09-17-live-01|1|00:00:00': '抽帧 5 个位置均为摄像头聊天与弹幕。',
  '2026-09-22-live-02|1|00:00:00': '抽帧 5 个位置均为摄像头聊天；控制：共振从 P2 开始。',
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
    entry: '2018-11-02-live-01',
    game: 'lifeafter',
    page: 2,
    at: '00:00:36',
    durationSec: 4586,
    associatedSec: 4586,
    verifiedSec: 0,
    reason: '旧 unknown 42:38–1:17:02 抽帧仍为《明日之后》，与 RDR2 的边界在 1:17:02。',
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
