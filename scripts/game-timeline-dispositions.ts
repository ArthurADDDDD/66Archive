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

export type ReviewedCrossCheck = {
  entry: string
  segmentAt: string
  game: string
  kind: 'unknown' | 'break'
  page: number
  at: string
  reason: string
}

/**
 * 旧 `segments` 的游戏标签与新时间轴 unknown / break 区间重叠，但已确认不是漏归类。
 * 旧分段常使用整场累计时间，边界也比新时间轴粗，不能直接覆盖。
 * 例外精确到 kind / page / at，防止同一旧分段的新命中被既有结论静默放行。
 * 每条 reason 必须说明确认依据；未确认的新冲突不能登记。
 */
export const REVIEWED_CROSS_CHECKS: ReviewedCrossCheck[] = [
  {
    entry: '2017-08-19-live-01', segmentAt: '00:00:00', game: 'nidhogg',
    kind: 'break', page: 1, at: '00:00:00',
    reason: 'BV1dx411J77f P1 分P标题为「游戏前聊10块钱的」，P1 1/10/20/25 分钟抽帧均为摄像头聊天；旧分段标签是 A 站每个分P统一的「尼德霍格+吃鸡」，不代表 P1 在玩。尼德霍格从 P2 标题画面开始。',
  },
  {
    entry: '2026-08-08-live-03', segmentAt: '00:00:00', game: 'maplestory',
    kind: 'break', page: 1, at: '00:06:55',
    reason: 'BV1rWu36ZELV：P1 06:50 仍游戏，06:55 已黑屏，07:05–11:55 连续摄像头聊天，12:00 淡回同款游戏；约305秒独立休息被旧整分P游戏标签覆盖。两侧同款在展示中仍按契约合并关联时长。',
  },
  {
    entry: '2026-08-03-live-02', segmentAt: '00:00:00', game: 'maplestory',
    kind: 'break', page: 1, at: '00:00:00',
    reason: 'BV1FjM966EjU：P1 每4分钟抽帧及首末帧均为全屏摄像头聊天，未见游戏界面。旧分段以游戏名概括整个分P，但画面支持此段为独立开播聊天。',
  },
  {
    entry: '2026-08-03-live-02', segmentAt: '01:00:01', game: 'maplestory',
    kind: 'break', page: 1, at: '00:00:00',
    reason: 'BV1FjM966EjU：P2 每4分钟抽帧及首末帧均为全屏摄像头、吃东西和聊天，未见游戏界面。旧分段以游戏名概括整个分P，但画面支持此段为独立开播聊天。',
  },
  {
    entry: '2017-06-05-live-01', segmentAt: '00:42:43', game: '1-2-switch',
    kind: 'break', page: 1, at: '00:00:00',
    reason: 'P1 抽帧为摄像头聊天/吃饭，约 40:40 才出现 Switch 主页；P2 前 20 分钟为 eShop、预告与购买流程，1-2-Switch 启动约在 P2 20:00，旧分段起点过早。',
  },
  {
    entry: '2018-09-17-live-01', segmentAt: '02:03:42', game: '39-days-to-mars',
    kind: 'break', page: 3, at: '00:00:00',
    reason: 'P3 0:05–17:20 抽帧为摄像头、39 天到火星菜单及浏览器看视频，未见游戏操作；该段支持独立看视频/聊天，17:30 起点仍只到约一分钟精度。',
  },
  {
    entry: '2019-05-10-live-02', segmentAt: '02:45:02', game: 'rento',
    kind: 'break', page: 4, at: '00:57:16',
    reason: 'P4 57:16–58:06 抽帧显示对局结束/因挂机被移出，随后持续结算面板与聊天；57:16 起点容许数十秒误差，旧分段不能把整段尾声继续算作游戏。',
  },
  {
    entry: '2020-10-20-live-01', segmentAt: '02:32:17', game: 'rolo-to-the-rescue',
    kind: 'break', page: 3, at: '01:10:05',
    reason: '既有关键边界证据记录：P3 01:09:48 仍为 Rolo 的 NO CONTINUE REMAINING 结算画面，01:10:05 已回到游聚游戏平台的游戏列表，旧分段尾部超出已确认游戏边界。',
  },
  {
    entry: "2017-10-26-live-01", segmentAt: "03:17:59", game: "rusty-lake",
    kind: "break", page: 3, at: "00:00:00",
    reason: "BV1tx41177EZ：P3 00:00:05为音乐网页，00:08:05及00:10:05为视频播放器里的影片，其余00:02:05–00:30:05主要是摄像头；16个样本均无实际游戏操作。",
  },
  {
    entry: "2017-10-26-live-01", segmentAt: "03:42:27", game: "rusty-lake",
    kind: "break", page: 3, at: "00:00:00",
    reason: "BV1tx41177EZ：P3 00:00:05为音乐网页，00:08:05及00:10:05为视频播放器里的影片，其余00:02:05–00:30:05主要是摄像头；16个样本均无实际游戏操作。",
  },
  {
    entry: "2020-12-01-live-01", segmentAt: "00:00:00", game: "demons-souls",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1qy4y167rB：P1 00:00:05–00:42:05的15个样本均为PlayStation标志及按PS键提示，未出现角色、关卡或游戏操作画面。",
  },
  {
    entry: "2026-08-15-live-01", segmentAt: "00:00:00", game: "rusty-lake",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1iXbC6oEos：P1 00:00:05–00:16:05共17个样本均为全屏摄像头，中间展示耳机并挂在脖子上，无游戏界面。",
  },
  {
    entry: "2017-08-09-live-01", segmentAt: "00:13:26", game: "pubg",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1vx411n7jt：P1 00:00:05–00:51:05共18个样本全是单人或多人摄像头，包括吃东西、摆弄手机，未见游戏界面。",
  },
  {
    entry: "2017-08-09-live-01", segmentAt: "00:26:53", game: "pubg",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1vx411n7jt：P1 00:00:05–00:51:05共18个样本全是单人或多人摄像头，包括吃东西、摆弄手机，未见游戏界面。",
  },
  {
    entry: "2017-08-09-live-01", segmentAt: "00:40:21", game: "pubg",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1vx411n7jt：P1 00:00:05–00:51:05共18个样本全是单人或多人摄像头，包括吃东西、摆弄手机，未见游戏界面。",
  },
  {
    entry: "2017-08-09-live-01", segmentAt: "01:07:15", game: "pubg",
    kind: "break", page: 1, at: "01:04:00",
    reason: "BV1vx411n7jt：P1 01:04:05–01:13:05共10个样本全为黑底摄像头，镜头前人物变化，未见游戏界面。",
  },
  {
    entry: "2017-08-09-live-01", segmentAt: "01:34:09", game: "pubg",
    kind: "break", page: 1, at: "01:41:35",
    reason: "BV1vx411n7jt：P1 01:41:40–01:46:40为黑底摄像头；P2 00:00:04–00:10:04为摄像头、Windows桌面、照片或应用商店/启动器页面，17个样本未见游戏操作。",
  },
  {
    entry: "2017-08-09-live-01", segmentAt: "01:47:37", game: "pubg",
    kind: "break", page: 1, at: "01:41:35",
    reason: "BV1vx411n7jt：P1 01:41:40–01:46:40为黑底摄像头；P2 00:00:04–00:10:04为摄像头、Windows桌面、照片或应用商店/启动器页面，17个样本未见游戏操作。",
  },
  {
    entry: "2017-12-08-live-01", segmentAt: "04:25:20", game: "pubg",
    kind: "break", page: 3, at: "01:29:24",
    reason: "BV1xW411h7Zg：P3 01:29:29至P4 00:18:00.364前11个样本均为黑底摄像头或看手机；P4 00:19:49才出现PUBG Early Access WARNING启动提示，较现边界00:19:54仅早5秒。",
  },
  {
    entry: "2018-12-07-live-01", segmentAt: "00:00:00", game: "doudizhu",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1qt411S726：P1 00:00:05–00:16:05前17个样本均为摄像头；00:17:05末帧出现欢乐斗地主大厅/模式选择窗口，较现边界00:17:16仅早11秒。",
  },
  {
    entry: "2018-12-11-live-01", segmentAt: "00:00:00", game: "doudizhu",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1dt411q7Mg：P1 00:00:05–00:11:05共12个样本均为摄像头，整理头发、起身或面对镜头，未见游戏界面。",
  },
  {
    entry: "2018-12-17-live-01", segmentAt: "00:00:00", game: "doudizhu",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV16t411e7tq P1 5–365秒每60秒抽帧均为摄像头、说话或整理头发，无游戏界面。",
  },
  {
    entry: "2019-03-01-live-01", segmentAt: "00:00:00", game: "trials-rising",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1Ub411b7op P1 5–905秒每60秒抽帧均为摄像头、看手机；965秒才出现摩托车风格宣传/启动图，未见操作。",
  },
  {
    entry: "2019-05-10-live-02", segmentAt: "01:58:56", game: "mist-detective",
    kind: "break", page: 3, at: "00:35:00",
    reason: "BV1U4411Y7LP P3 35:05–40:05为静止 Palm Pioneer presents 字样，41:05–46:05为黑屏与摄像头，无实机操作。",
  },
  {
    entry: "2020-10-20-live-01", segmentAt: "00:00:00", game: "rolo-to-the-rescue",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1f54y167uY P1 5–425秒每60秒为同一“游戏暂停中”像素地图及固定得分，485秒变为平台房间列表，无实机操作。",
  },
  {
    entry: "2021-04-27-live-01", segmentAt: "00:00:00", game: "world-games-51",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1ey4y1s75L P1 5–665秒为带库列表侧栏的 NARAKA 游戏详情，725–965秒为Steam库封面网格，无实机操作。",
  },
  {
    entry: "2026-02-06-live-01", segmentAt: "00:00:00", game: "nioh-3",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1nrFrziEbD P1 5–785秒每60秒抽帧均为摄像头、看手机、说话或喝水，无游戏界面。",
  },
  {
    entry: "2026-07-04-live-02", segmentAt: "00:00:00", game: "rhythm-heaven",
    kind: "break", page: 1, at: "00:00:00",
    reason: "BV1AkMP6zEPo P1 5–2045秒每120秒抽帧均为摄像头、看手机、说话或揉肩，没有游戏界面。",
  },
  {
    entry: "2026-07-04-live-02", segmentAt: "01:00:01", game: "rhythm-heaven",
    kind: "break", page: 2, at: "00:24:48",
    reason: "BV1AkMP6zEPo P2 24:53、25:53、26:53、27:53、28:53、29:53均显示elgato No Signal和右上摄像头，无游戏操作画面。",
  },
  {
    entry: "2021-03-21-live-01", segmentAt: "03:45:00", game: "forza-horizon-4",
    kind: "break", page: 2, at: "00:00:00",
    reason: "BV1Li4y1P7SR：P6 33:53、36:53、39:53 的抽帧仍为来信文字与摄像头；旧 03:45:00 游戏分段落在此段来信内容内，不是赛车实机。",
  },
]
/**
 * 已按多帧抽检复核、仍保留为 unknown 的长时间未归属段（≥30 分钟）。
 * 键：entry|page|at。新增长时间 unknown 必须先复核并登记，否则测试失败。
 */
export const REVIEWED_LONG_UNKNOWNS: Record<string, string> = {
  '2026-08-10-live-03|2|00:01:45': 'BV1gQuo6TE5V：P2 01:45 标题明确为 The Little Cat and the Sea，随后手册、海面小船与潜水实机持续至39:50，40:05 已是冒险岛怀旧服加载。尚未建立对应游戏条目，暂保留 unknown，不计入冒险岛时长。',
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
// 回归锁：只保证不被意外改动，不证明正确；改数据时要连同证据一起更新。
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
    reason: 'P3 01:09:48 起仍是 Rolo 的 NO CONTINUE REMAINING 结算画面，01:10:05 才回到游聚游戏平台的游戏列表。',
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
