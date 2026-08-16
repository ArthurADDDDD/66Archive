import type { Dataset, TimelineEntry } from './data'
import { proxyImage } from './platforms'
import { formatDuration } from './ui'

/**
 * 叙事层 · 策展内容（唯一的前端策展源）
 * ====================================
 * 只有这个文件里的文案与时间线选择是「架构/前端」角色写的叙事内容。
 * 两层叙事，共享三幕元数据：
 * - HOMEPAGE_ACTS：首页三幕（精简）。「女流是怎么来的？」→「为什么 156277 后来不只是一个直播间？」
 *   →「直播间之外，她后来怎么样了？」。只放用户提纲里的锚点；【重要】锚点带「重要」小标，
 *   非重要锚点不带任何小标签（手机端不吵）。ACT II 中间用蒙太奇（2016—2022 真实封面 + 派生数字）。
 * - STORY_ACTS：编年史故事模式（详版，32 节）。替代原来的逐年摘要；甘蔗精已撤下（等素材，见注释）。
 * - HIGHLIGHTS：首页高光条（16 个「记得住的时刻」），复用旧策展。
 *
 * 硬规则：
 * - 所有数字在构建期从数据派生（countBetween / tags / games 字段），文案禁止硬编码数字。
 * - 时间线引用真实条目 id / 游戏 id / 系列 id；id 缺失时 resolve 静默降级（条目自动从列表消失），绝不编造。
 * - 不修改 data/**，不动 schema —— 数据层原样保留。
 * - 日期一律用数据里的真实日期（如 变态人生大冒险 是 2010-06-30，不是流传记忆里的 2011）。
 * - 不生成假图；拿不到真实封面的「大事件」用字排大卡，绝不放占位假图。
 */

export type ActId = 'act-i' | 'act-ii' | 'act-iii'

const ACT_ORDER: readonly ActId[] = ['act-i', 'act-ii', 'act-iii']

export function actColor(id: ActId): string {
  return ACT_META[id]?.color ?? '#5A5F73'
}

/** 按日期返回所属幕的颜色；幕与幕之间的留白年份返回 faint。 */
export function actColorForDate(date: string): string {
  for (const id of ACT_ORDER) {
    const a = ACT_META[id]
    if (date >= a.from && (!a.to || date <= a.to)) return a.color
  }
  return '#5A5F73'
}

/** 时间线卡片规格：hero=配图大卡 / type=字排大卡 / small=小卡 / montage=蒙太奇（首页 ACT II 专用） */
export type BeatSize = 'hero' | 'type' | 'small' | 'montage'

/** 卡片点击去向。kind:'none' 为纯文案卡（无链接，不造假链接）。 */
export type BeatTarget =
  | { kind: 'entry'; id: string; href?: string }
  | { kind: 'game'; id: string }
  | { kind: 'series'; id: string }
  | { kind: 'href'; href: string }
  | { kind: 'none' }

/** 隐线 / 冷知识脚注（渲染在词条下方，弱化，不抢戏） */
export type GameWorldFootnote = {
  /** 一句事实 */
  text: string
  /** 相对时间标签（-2 DAYS / SAME DAY / +6 DAYS），来自提纲原文，不做计算 */
  rel?: string
  /** 绝对日期 */
  date?: string
}

export type Beat = {
  id: string
  /** 所属幕；缺省时从所在 Act 继承（首页精简幕省略即可） */
  act?: ActId
  /** 展示日期（自由文本，如 2010.05.08 / 2015—16） */
  date: string
  size: BeatSize
  title: string
  /** 一句话引子 / 介绍 */
  body?: string
  /** 卡片顶部小标签（如 ☠ 受苦记录 #01）。首页精简幕里由 important 接管：重要→「重要」，非重要→无。 */
  kicker?: string
  /** 用户提纲里的【重要】锚点标记。首页幕用它决定小标签：重要显示「重要」，其余不显示。 */
  important?: boolean
  target?: BeatTarget
  /** 强调数字模板，{var} 构建期派生填充 */
  emphasis?: string
  gameWorld?: GameWorldFootnote
  /** 卡片尾部小标签（如 TO BE CONTINUED...） */
  tail?: string
  /** 蒙太奇幕：分类 chips（如 心灵砒霜 / 主机新作 / 壮壮 …） */
  chips?: string[]
}

export type Act = {
  id: ActId
  /** 短标签（统计分布条用） */
  label: string
  /** 展示年份范围（含叙事副标，如「2010 — 2015 · 视频时代」） */
  years: string
  /** 数据起止（含），to 为空表示开放结束。首页分布条用 display 范围，计数另走互斥口径。 */
  from: string
  to: string
  color: string
  kicker: string
  title: string
  body: string[]
  /** 幕尾字排收束（如「娃睡了来突袭。」） */
  closer?: { line: string; tail?: string }
  /** 这一幕内的时间线（策展，不强行按数据日期重排） */
  beats: Beat[]
}

/**
 * 三幕元数据（首页与故事模式共享）。
 * 边界是策展的（历史事实，不是数据分布推导）：
 * - ACT I 至 2015-12-31：视频时代（优酷解说）。
 * - ACT II 2015-01-01 ~ 2023-11-30：156277 直播间那些年。档案里斗鱼直播实际从 2016-04-29 开始
 *   （首条 黑暗之魂3），但 nvliu.me 与 2015-01-24 直播录像旁证 2015-01-21 已在斗鱼首播
 *   （见 data/references.yaml），文案如实说明，不把档案缺口伪装成历史边界。
 * - ACT III 2022-01-01 起：从「双人模式」讲起，与 ACT II 尾段叙事重叠（生活也开了多人模式）。
 */
export const ACT_META: Record<ActId, Omit<Act, 'beats'>> = {
  'act-i': {
    id: 'act-i',
    label: '女流',
    years: '2010 — 2015 · 视频时代',
    from: '2010-01-01',
    to: '2015-12-31',
    color: '#E0A244', // token: video
    kicker: 'ACT I · 女流',
    title: '女流',
    body: ['一个人，从录视频，走到坐进直播间。'],
  },
  'act-ii': {
    id: 'act-ii',
    label: '斗鱼156277',
    years: '2015 — 2023 · 大周的那些年',
    from: '2015-01-01',
    to: '2023-11-30',
    color: '#5BC8E8', // token: live
    kicker: 'ACT II · 斗鱼156277',
    title: '斗鱼156277',
    body: ['大周的那些年。直播、游戏、弹幕，很多个晚上。'],
    closer: { line: '一个直播间，后来变成了一群人的共同记忆。' },
  },
  'act-iii': {
    id: 'act-iii',
    label: '余生请与我一起双人成行',
    years: '2022 — 现在 · 生活也开了多人模式',
    from: '2022-01-01',
    to: '',
    color: '#FF6B75', // token: today
    kicker: 'ACT III · 余生',
    title: '余生请与我一起双人成行',
    body: ['斗鱼156277 还没有结束的时候，她人生的下一段已经开始了。'],
    closer: { line: '娃睡了来突袭。', tail: 'TO BE CONTINUED' },
  },
}

/**
 * 首页三幕（精简）。每个锚点对应一处真实 URL（见 .claude/docs/04-首页大事件URL调研.md §7）：
 * 第一次上传→2010-05-08 / 越来越多人→2010-06-30 / 开始直播→2015-01-24；
 * 大周形成→/games/minecraft/（无封面，type）；
 * see you around~→2023-11-30；双人模式→2022-09-09 / 好久不见→2024-08-18 / 娃睡了→2026-08-09；
 * 回冒险岛→/games/maplestory-classic/（无封面，type）。
 * 重要锚点显示「重要」小标；非重要锚点不带任何小标签（用户：手机端 act 小标签太吵，不要「爆款/毕业后/主机区」这类了）。
 */
export const HOMEPAGE_ACTS: Act[] = [
  {
    ...ACT_META['act-i'],
    beats: [
      {
        id: 'first-upload',
        important: true,
        date: '2010',
        size: 'hero',
        title: '第一次上传',
        body: '那时候还叫「女流」。从小游戏解说开始，一期一期录下来。',
        target: { kind: 'entry', id: '2010-05-08-video-01' },
      },
      {
        id: 'known',
        date: '2011—2014',
        size: 'small',
        title: '越来越多人认识她',
        body: '《变态人生大冒险》被更多人看到。毕业之后，也还是没有离开游戏。',
        target: { kind: 'entry', id: '2010-06-30-video-01' },
      },
      {
        id: 'start-live',
        important: true,
        date: '2015',
        size: 'small',
        title: '开始直播',
        body: '从录好的视频，到真正坐进直播间。「女流」也慢慢变成后来大家熟悉的「女流66」。',
        target: { kind: 'entry', id: '2015-01-21-live-01' },
      },
    ],
  },
  {
    ...ACT_META['act-ii'],
    beats: [
      {
        id: 'dazhou-formed',
        important: true,
        date: '2015—16',
        size: 'type',
        title: '这里有了一个名字。——大周',
        body: '《大周MC》之后，水友开始叫自己「大周」。',
        target: { kind: 'game', id: 'minecraft' },
      },
      {
        id: 'days-montage',
        date: '2016 — 2022',
        size: 'montage',
        title: '日子就这么一天天过',
        body: '一场接一场直播，斗鱼156277 也慢慢有了自己的样子。',
        chips: ['心灵砒霜', '主机新作', '壮壮', '朋友', '联机', '户外', '黑屏聊天'],
      },
      {
        id: 'see-you-around',
        important: true,
        date: '2023.11',
        size: 'type',
        title: 'see you around~',
        body: '斗鱼156277 最后一次亮起。',
        target: { kind: 'entry', id: '2023-11-30-live-01' },
      },
    ],
  },
  {
    ...ACT_META['act-iii'],
    beats: [
      {
        id: 'double-mode',
        important: true,
        date: '2022',
        size: 'type',
        title: '双人模式开启。',
        body: '和炮炮领证。「双人模式开启。」',
        target: { kind: 'entry', id: '2022-09-09-live-01' },
      },
      {
        id: 'back-again',
        date: '2024',
        size: 'hero',
        title: '好久不见。',
        body: '斗鱼156277 熄灯以后，过了一段时间。新的直播间又亮起来了。',
        target: { kind: 'entry', id: '2024-08-18-live-01' },
      },
      {
        id: 'cuiwa',
        date: '2025',
        size: 'small',
        title: '催娃有果。',
        body: '从「双人模式」，变成了三个人。',
        target: { kind: 'none' },
      },
      {
        id: 'duoduo',
        important: true,
        date: '2025',
        size: 'type',
        title: '朵朵来了。',
        body: '66姐有了一个新的身份：朵朵妈。',
        target: { kind: 'none' },
      },
      {
        id: 'wawa',
        date: '2026',
        size: 'small',
        title: '娃睡了来突袭。',
        body: '带娃、直播、继续玩游戏。',
        target: { kind: 'entry', id: '2026-08-09-live-01' },
      },
      {
        id: 'back-maple',
        important: true,
        date: '2026',
        size: 'type',
        title: '姐弟俩，又回冒险岛了。',
        body: '小时候和壮壮一起玩过的游戏，这么多年以后，又一起上线了。',
        target: { kind: 'game', id: 'maplestory-classic' },
      },
    ],
  },
]

/**
 * 编年史故事模式（详版，32 节）：替代原来的逐年摘要。
 * 甘蔗精（ganzhe-jing）已按用户要求撤下，等找到正确素材再放回。
 * 规格沿用：hero 配图大卡 / type 字排大卡 / small 小卡。
 * 大周MC 与 回冒险岛 无带封面条目（绝不用假图）→ 字排大卡。见 .claude/docs/04-首页大事件URL调研.md §7/§8。
 */
export const STORY_ACTS: Act[] = [
  {
    ...ACT_META['act-i'],
    beats: [
      {
        id: 'first-video',
        date: '2010.05.08',
        size: 'hero',
        kicker: '一切从这里开始',
        title: '女流，上传了第一个游戏视频。',
        body: '她最开始想叫「女流之辈」，已经被人注册；后来「女流」也撞了重名。2010 年 5 月 8 日，她以「女流」的名字上传了第一支游戏解说。',
        target: { kind: 'entry', id: '2010-05-08-video-01' },
        gameWorld: { rel: '+10 DAYS', date: '2010.05.18', text: '《荒野大镖客：救赎》十天后发售。' },
      },
      {
        id: 'binge-game',
        date: '2010.06',
        size: 'small',
        kicker: '爆款',
        title: '《变态人生大冒险》',
        body: '越来越多人开始认识这个叫「女流」的人。',
        target: { kind: 'entry', id: '2010-06-30-video-01' },
        gameWorld: { date: '2011.11', text: '《上古卷轴 V：天际》发售。' },
      },
      {
        id: 'graduation',
        date: '2013—14',
        size: 'small',
        kicker: '毕业后',
        title: '毕业以后，还是没离开游戏。',
        body: '读完建筑与城市规划，最后还是进了游戏行业。2014 年前后，她曾在完美世界从事游戏节目相关工作。',
        target: { kind: 'none' },
        gameWorld: { date: '2013.09.17', text: '《GTA V》刚刚发售。' },
      },
      {
        id: 'journey',
        date: '2015',
        size: 'small',
        kicker: '主机区',
        title: '《风之旅人》「你还记得这场吗？」',
        body: '和小桀在随机匹配里反复错过，最后终于一起走完。不是什么事业大事，但特别有当年主机区的味道。',
        target: { kind: 'series', id: 'journey-playthrough' },
      },
      {
        id: 'door-156277',
        date: '2015.01',
        size: 'hero',
        kicker: '从录像到直播',
        title: '斗鱼156277，开门。',
        body: '2015 年，她开始直播。斗鱼时期的名字已经是女流66，直播间是斗鱼156277。以前大家看的是录好的游戏，从这里开始，大家开始一起玩。',
        target: { kind: 'entry', id: '2015-01-21-live-01' },
      },
      {
        id: 'names',
        date: '2015',
        size: 'small',
        kicker: '名字',
        title: '女流 → 女流66 → 66 → 流酱 → 流流',
        body: '用户名历史。老一点的水友会叫她流酱。「流流」也可以算一个，不强行考据诞生日。',
        target: { kind: 'none' },
      },
    ],
  },
  {
    ...ACT_META['act-ii'],
    beats: [
      {
        id: 'dazhou-mc',
        date: '2015—16',
        size: 'type',
        kicker: '大周',
        title: '从这以后，我们叫「大周」。',
        body: '《Minecraft》里的一个存档国家名——女皇、六泽天、大周——慢慢变成了斗鱼156277 整个水友群体的名字。水友还在游戏里给她立过一座小白女皇雕像。',
        target: { kind: 'game', id: 'minecraft' },
      },
      {
        id: 'xinling-pishuang',
        date: '2016.08',
        size: 'hero',
        kicker: '一个星期日',
        title: '心灵砒霜 · 第一期',
        body: '游戏暂停。邮件打开。一个星期日。本来想聊鸡汤，最后聊成了砒霜。',
        emphasis: '{xinlingCount} 个被保存下来的晚上',
        target: { kind: 'entry', id: '2016-08-07-live-01', href: '/series/xinling-pishuang/' },
      },
      {
        id: 'yuanweiji',
        date: '~2016—17',
        size: 'small',
        kicker: '砒霜名场面',
        title: '原味鸡',
        body: '「什么原味鸡？」「草。」',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1vu411U7MZ' },
      },
      {
        id: 'dalishi',
        date: '~2016—17',
        size: 'small',
        kicker: '砒霜名场面',
        title: '大力士',
        body: '一个脑子已经处理不了了。',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1xP4y1J7LB' },
      },
      {
        id: 'three-books',
        date: '2017',
        size: 'type',
        kicker: '大周经典考古',
        title: '三本书 × 4000',
        body: '「老师有什么书推荐吗？」——《百年孤独》《城市发展史》《美国大城市的死与生》。同一条推荐短信被重复发送了大量次数。',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV12Y411F7WZ' },
      },
      {
        id: 'shishizi',
        date: '2017—18',
        size: 'type',
        kicker: '坐镇大周',
        title: '女流的职业规划出现了一些偏差。',
        body: '水友聊天玩《红楼梦》角色分配，本来讨论女流当林黛玉……最后变成了石狮子。大周女皇 → 石狮子。',
        target: { kind: 'entry', id: '2018-03-18-live-01' },
        gameWorld: { date: '2017', text: 'Nintendo Switch 进入市场。' },
      },
      {
        id: 'darksouls-3',
        date: '2016',
        size: 'small',
        kicker: '☠ 受苦记录 #01',
        title: '黑暗之魂3',
        body: '又死了。',
        target: { kind: 'game', id: 'dark-souls-3' },
      },
      {
        id: 'getting-over-it',
        date: '2017',
        size: 'small',
        kicker: '☠ 受苦记录 #02',
        title: '抡大锤',
        body: '爬了半天。掉下去了。',
        target: { kind: 'game', id: 'getting-over-it' },
      },
      {
        id: 'zhushi-ji',
        date: '2018.01',
        size: 'small',
        kicker: '大周年度连续剧',
        title: '壮王爷《结石记》',
        body: '一个本来很普通的「弟弟去医院」，迅速变成大周连续剧。',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1PW411x7Td' },
      },
      // 甘蔗精（ganzhe-jing）已撤下：用户要等找到正确素材再放。
      {
        id: 'celeste',
        date: '2018',
        size: 'small',
        kicker: '☠ 受苦记录 #03',
        title: 'Celeste',
        body: '鬼知道我死了多少次。变态游戏，毁我青春。',
        target: { kind: 'game', id: 'celeste' },
      },
      {
        id: 'sekiro',
        date: '2019',
        size: 'small',
        kicker: '☠ 受苦记录 #04',
        title: '只狼',
        body: '会弹刀了。然后又死了。',
        target: { kind: 'game', id: 'sekiro' },
      },
      {
        id: 'nasdaq',
        date: '2019.07',
        size: 'small',
        kicker: '职业高光',
        title: '斗鱼156277 去了一趟纳斯达克。',
        body: '前一张还在受苦，下一张突然敲钟。这个反差本身就很女流。',
        target: { kind: 'none' },
      },
      {
        id: 'jump-king',
        date: '2019',
        size: 'small',
        kicker: '☠ 受苦记录 #05',
        title: 'Jump King',
        body: '女流在爬。壮壮在笑。',
        target: { kind: 'game', id: 'jump-king' },
      },
      {
        id: 'kemu-2',
        date: '2020.06.13',
        size: 'type',
        kicker: '大周史超长 Boss 战',
        title: '科目二，通过！！！',
        body: '多年连续剧，大周史的主线 Boss。失败、再考、失败、继续考，这一天终于打完了。',
        emphasis: 'ACHIEVEMENT UNLOCKED',
        target: { kind: 'entry', id: '2020-06-14-live-01' },
        gameWorld: { rel: '-2 DAYS', date: '2020.06.11', text: '大家第一次看见 PS5。' },
      },
      {
        id: 'number-723',
        date: '2021.07.23',
        size: 'small',
        kicker: '跨直播间历史遗迹',
        title: '723',
        body: '有些比赛打完就忘了。有些会被水友念几年。女流 × 寅子，《永劫无间》。',
        target: { kind: 'entry', id: '2021-07-23-live-01' },
      },
      {
        id: 'see-you-around',
        date: '2023.11',
        size: 'type',
        kicker: '最后一次亮起',
        title: 'see you around~',
        body: '斗鱼156277 今天没有再亮起来。',
        target: { kind: 'entry', id: '2023-11-30-live-01' },
        gameWorld: { rel: '+6 DAYS', date: '2023.12.05', text: '《GTA VI》首支预告公开。' },
      },
    ],
  },
  {
    ...ACT_META['act-iii'],
    beats: [
      {
        id: 'double-mode',
        date: '2022.09.09',
        size: 'small',
        kicker: '女流 × YJJ',
        title: '双人模式开启。',
        body: '从直播里的老熟人，到真正进入彼此的人生。以后一起玩。',
        target: { kind: 'entry', id: '2022-09-09-live-01' },
        gameWorld: { rel: 'SAME DAY', date: '2022.09.09', text: '《斯普拉遁3》开服。今天现实和游戏都开了多人模式。' },
      },
      {
        id: 'back-again',
        date: '2024.08.18',
        size: 'hero',
        kicker: '第三幕',
        title: '好久不见。',
        body: '停播八个多月后，她回来了。2024 年 8 月 18 日晚，抖音直播首秀。新平台上的名字，仍然是女流66。',
        target: { kind: 'entry', id: '2024-08-18-live-01' },
        gameWorld: { rel: '+2 DAYS', date: '2024.08.20', text: '八十一难开始，《黑神话：悟空》发售。' },
      },
      {
        id: 'black-myth-era',
        date: '2024.12',
        size: 'small',
        kicker: '重新开始',
        title: '黑神话时期',
        body: '重新开始的第一个冬天，她还在打游戏。',
        target: { kind: 'entry', id: '2024-12-10-live-02' },
      },
      {
        id: 'expedition-33',
        date: '2025.04.24',
        size: 'small',
        kicker: 'GAME WORLD',
        title: '《光与影：33号远征队》发售。',
        body: '纯游戏史背景，就一小条——已经走到这个年代了。',
        target: { kind: 'none' },
      },
      {
        id: 'cuiwa-youguo',
        date: '2025.08',
        size: 'small',
        kicker: '有宝宝了',
        title: '催娃有果。',
        body: '用她自己的语气，就这一句。',
        target: { kind: 'none' },
      },
      {
        id: 'duoduo-lail',
        date: '2025.09',
        size: 'small',
        kicker: '朵朵',
        title: '朵朵来了。',
        body: '66 姐升级成朵朵妈。',
        target: { kind: 'none' },
      },
      {
        id: 'postpartum',
        date: '2025.11',
        size: 'small',
        kicker: '回来了',
        title: '产后首播',
        body: '回来直播。内容里自然多了一些以前没有的东西——朵朵、带娃、炮炮，壮壮当舅舅。',
        target: { kind: 'entry', id: '2025-11-14-live-01' },
      },
      {
        id: 'feeding-milk',
        date: '2026.03.02',
        size: 'small',
        kicker: '很普通的一天',
        title: '我去喂个奶。',
        body: '直播《生化危机9》，朵朵哭了。暂停游戏去喂孩子，大约五分钟，回来继续玩。直播间近两万观众还在。',
        target: { kind: 'game', id: 'resident-evil-9' },
      },
      {
        id: 'maplestory-memory',
        date: '2026.05',
        size: 'small',
        kicker: '伏笔',
        title: '小时候的《冒险岛》',
        body: '自己在游戏里被骗，气到全服刷喇叭；壮壮玩女号，在游戏里找过一个「老公」。那时候，他们还是小孩。',
        // 2026-05-20-live-02 被数据侧同场合并折叠进 live-01（互为备选源），
        // beat 锚点必须指向组代表，否则构建期静默降级、卡片消失。
        target: { kind: 'entry', id: '2026-05-20-live-01' },
      },
      {
        id: 'back-maple',
        date: '2026.08',
        size: 'type',
        kicker: '现在',
        title: '姐弟俩，又回冒险岛了。',
        body: '小时候一起玩过。这么多年过去，又一起上线。不过现在，姐姐得等娃睡了。',
        tail: 'TO BE CONTINUED...',
        target: { kind: 'game', id: 'maplestory-classic' },
        gameWorld: { date: '2026', text: '游戏行业自己也开始流行怀旧服。' },
      },
    ],
  },
]

/** 首页高光条（17 个「记得住的时刻」）。日期与事实全部对过数据。 */
export type Highlight = {
  id: string
  act: ActId
  /** 锚点条目；缺失时该高光静默降级 */
  entryId?: string
  /** 链接目标覆盖；有锚点条目时优先用该条目原平台播放 URL，站外切片可直接写外链 */
  href?: string
  /** 纯文案高光：不渲染链接（纳斯达克档案里没有对应条目，不为做链接而做链接） */
  link?: false
  /** 封面覆盖：默认取锚点条目的 cover；个别时刻用本地截图顶替（用户自截，进 /images/） */
  cover?: string
  date: string
  kicker: string
  title: string
  body: string
  /** 背景纹理数字；含 {var} 占位符时在构建期用派生值填充 */
  emphasis?: string
}

/**
 * 首页高光（17 个，时间序）。日期与事实全部对过数据：
 * - 迷画之塔 / 变态人生大冒险 / 2015.01 过渡 来自 video-era-milestones.yaml（首作/代表作/直播过渡 tags）。
 * - PS4 开箱真实日期 2018-08-27（条目 5亿台纪念限定PS4pro开箱）。
 * - 科目二锚点 2020-06-14-live-01（6.13 考完，次日照常直播）；723 锚点 2021-07-23-live-01（女流 × 寅子）。
 * - Celeste 锚点 2018-03-14-live-02（蔚蓝Celeste，games 字段可证）。
 * - 三本书 / 结石记 / 原味鸡 / 大力士 是站内无对应场次的 B 站切片，卡片直接外链原平台（只索引，不搬运）。
 * - 纳斯达克档案里没有对应条目，做纯文案高光（link: false），不为做链接而做链接。
 * - 甘蔗精锚点 2018-02-22-live-01（大周明线梗，封面为自截本地图，见 cover 覆盖）。
 * - 2024.12 黑神话：悟空大更新（2024-12-10 起连续多场，games 字段可证）。
 */
export const HIGHLIGHTS: Highlight[] = [
  {
    id: 'first-video',
    act: 'act-i',
    entryId: '2010-05-08-video-01',
    date: '2010.05.08',
    kicker: '第一支视频',
    title: '迷画之塔',
    body: '大三那年上传的小游戏解说。一切从这里开始。',
    emphasis: '首作 · 13 分钟',
  },
  {
    id: 'binge-game',
    act: 'act-i',
    entryId: '2010-06-30-video-01',
    date: '2010.06.30',
    kicker: '爆款',
    title: '变态人生大冒险',
    body: '第一次，有非常多人听见了她。',
    emphasis: '210 万+ 播放',
  },
  {
    id: 'video-to-live',
    act: 'act-i',
    entryId: '2015-01-21-live-01',
    date: '2015.01',
    kicker: '转身',
    title: '从录像，到直播',
    body: '以前，大家看到的是已经录好的游戏。从这里开始，大家开始一起玩。',
    emphasis: '2015-01-21 首播',
  },
  {
    id: 'geometry-dash',
    act: 'act-ii',
    entryId: '2016-06-04-live-01',
    date: '2016.06',
    kicker: '执念',
    title: '几何冲刺',
    body: '那些反复重来的晚上，加起来十多个小时。',
    emphasis: '{geometryHours} 个小时',
  },
  {
    id: 'yuanweiji',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV1vu411U7MZ',
    date: '2016—17',
    kicker: '砒霜名场面',
    title: '原味鸡',
    body: '「什么原味鸡？」',
    emphasis: '草。',
  },
  {
    id: 'dalishi',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV1xP4y1J7LB',
    date: '2016—17',
    kicker: '砒霜名场面',
    title: '大力士来啦',
    body: '一个脑子已经处理不了了。',
  },
  {
    id: 'xinling-pishuang',
    act: 'act-ii',
    entryId: '2016-08-07-live-01',
    date: '2016.08.07',
    kicker: '一个星期日',
    title: '心灵砒霜 · 第一期',
    body: '游戏暂停。邮件打开。一个星期日。',
    emphasis: '{xinlingCount} 个被保存下来的晚上',
  },
  {
    id: 'three-books',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV12Y411F7WZ',
    date: '2017',
    kicker: '大周经典考古',
    title: '大周导师三本书',
    body: '「老师有什么书推荐吗？」——《百年孤独》《城市发展史》《美国大城市的死与生》。同一条推荐短信，被重复发送了大量次数。',
    emphasis: '×4000',
  },
  {
    id: 'zhushi-ji',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV1PW411x7Td',
    date: '2018.01',
    kicker: '大周年度连续剧',
    title: '壮王爷《结石记》',
    body: '一个本来很普通的「弟弟去医院」，迅速变成大周连续剧。',
    emphasis: '2018',
  },
  {
    id: 'ganzhe-jing',
    act: 'act-ii',
    entryId: '2018-02-22-live-01',
    date: '2018.02.22',
    kicker: '大周明线梗',
    title: '甘蔗精',
    body: '「为什么叫甘蔗精？」——因为她吃了根甘蔗。这个称号一叫就是很多年。',
    emphasis: '一根甘蔗',
    cover: '/images/highlights/ganzhe-jing.jpg',
  },
  {
    id: 'celeste',
    act: 'act-ii',
    entryId: '2018-03-14-live-02',
    date: '2018',
    kicker: '受苦记录',
    title: '《Celeste》：鬼知道我死了多少次',
    body: '变态游戏，毁我青春。',
  },
  {
    id: 'ps4',
    act: 'act-ii',
    entryId: '2018-08-27-live-01',
    date: '2018.08.27',
    kicker: '高光',
    title: '5 亿台纪念限定 PS4 Pro 开箱',
    body: 'PlayStation 全球第 5 亿台纪念机型的开箱之夜。',
    emphasis: '2018',
  },
  {
    id: 'nasdaq',
    act: 'act-ii',
    link: false,
    date: '2019.07',
    kicker: '职业高光',
    title: '斗鱼156277 去了一趟纳斯达克。',
    body: '前一张还在受苦，下一张突然敲钟。这个反差本身就很女流。',
    emphasis: '2019',
  },
  {
    id: 'kemu-2',
    act: 'act-ii',
    entryId: '2020-06-14-live-01',
    date: '2020.06.13',
    kicker: '大周史主线 Boss',
    title: '科目二，通过！！！',
    body: '多年连续剧，大周史的主线 Boss。失败、再考、失败、继续考，这一天终于打完了。',
    emphasis: '2020',
  },
  {
    id: 'number-723',
    act: 'act-ii',
    entryId: '2021-07-23-live-01',
    date: '2021.07.23',
    kicker: '跨直播间历史遗迹',
    title: '723事件',
    body: '有些比赛打完就忘了。有些会被水友念几年。女流 × 寅子，《永劫无间》。',
    emphasis: '2021',
  },
  {
    id: 'back-again',
    act: 'act-iii',
    entryId: '2024-08-18-live-01',
    date: '2024.08.18',
    kicker: '第三幕',
    title: '又见面了。',
    body: '停播八个多月后，她回来了。',
    emphasis: '2024-08-18',
  },
  {
    id: 'douyin-winter',
    act: 'act-iii',
    entryId: '2024-12-10-live-02',
    date: '2024.12',
    kicker: '新阶段',
    title: '黑神话：悟空 · 大更新',
    body: '重新开始的第一个冬天，她还在打游戏。',
    emphasis: '{wukongCount} 场 · 十二月',
  },
]

/** 未登记入 games.yaml 的策展游戏（几何冲刺等）。仅这里的 id 允许标题匹配，禁止全库猜标题。 */
export type CuratedGame = {
  id: string
  name: string
  aliases: string[]
  /** 一句话，占位符 {hours} 在构建期填充为派生总时长 */
  oneLiner: string
  /** 标题匹配规则（仅策展 id 可用） */
  entryTitlePattern: RegExp
  /** 覆盖现实说明，展示在详情页数据说明处 */
  note: string
}

export const CURATED_GAMES: Record<string, CuratedGame> = {
  'geometry-dash': {
    id: 'geometry-dash',
    name: '几何冲刺',
    aliases: ['Geometry Dash'],
    oneLiner: '从 2016 到 2017，几个晚上，加起来 {hours} 个小时。',
    entryTitlePattern: /几何冲刺/,
    note: '《几何冲刺》尚未登记入 data/games.yaml（待数据角色补录）；本站以标题匹配归档相关场次。',
  },
}

// ---------------------------------------------------------------------------
// 解析层（仅服务端组件调用，构建期执行）
// ---------------------------------------------------------------------------

export type ResolvedBeat = {
  id: string
  act: ActId
  date: string
  size: BeatSize
  kicker?: string
  title: string
  body?: string
  /** null = 纯文案卡（无链接） */
  href: string | null
  /** 外链（B 站切片）→ 新开标签页 */
  external: boolean
  cover: string | null
  emphasis?: string
  /** 首页高光「默认展开」：只由后台 live 覆盖写入，基线无此概念（缺省即折叠）。 */
  expanded?: boolean
  gameWorld?: GameWorldFootnote
  tail?: string
  /** 蒙太奇幕的分类 chips */
  chips?: string[]
  /** 蒙太奇幕的构建期素材（首页 ACT II 专用） */
  montage?: { samples: MontageSample[]; stats: MontageStats }
}

export type MontageSample = {
  id: string
  date: string
  title: string
  cover: string
}

export type MontageStats = {
  /** 心灵砒霜期数 */
  xinling: string
  /** 总时长（小时，四舍五入） */
  hoursLabel: string
  /** 直播场次 */
  liveSessions: string
}

export type ResolvedAct = {
  act: Act
  /** display 范围计数（幕头「N 条记录」用；故事模式展示） */
  count: number
  /** 互斥口径计数（首页统计分布条用）：ACT I <2015 / ACT II 2015-2021 / ACT III ≥2022，三幕相加 = 全部记录 */
  exclusiveCount?: number
  /** 这一幕内的时间线（已解析，锚点缺失自动剔除） */
  beats: ResolvedBeat[]
}

export type NowNode = {
  year: string
  label: string
  count: number
}

export type HomepageData = {
  acts: ResolvedAct[]
  highlights: ResolvedBeat[]
  now: NowNode
  totals: { entries: number; years: number; series: number }
  /** 实际有数据的年份（升序，用于留白年份推导） */
  years: string[]
  /** 互斥口径计数，与 acts 顺序一致 */
  exclusiveCounts: number[]
  /**
   * emphasis 里 `{var}` 占位符的构建期取值。
   *
   * 送到浏览器是为了让后台改写 emphasis 时仍能保留占位符：覆盖发生在浏览器里，
   * 而这些数字只有构建期算得出。不给的话，管理员要么看到字面的 `{xinlingCount}`，
   * 要么只能手打一个当时的数字——后者会把「文案禁止硬编码数字」这条规矩破掉，
   * 数据长了之后那个数字就永远停在写下的那一刻。
   */
  emphasisVars: Record<string, string>
}

function countBetween(entries: TimelineEntry[], from: string, to: string): number {
  if (!to) return entries.filter((e) => e.date >= from).length
  return entries.filter((e) => e.date >= from && e.date <= to).length
}

/** ISO 日期（YYYY-MM-DD）之间差的天数；任意端非法按 0 处理 */
function daysBetween(a: string, b: string): number {
  const da = Date.parse(a)
  const db = Date.parse(b)
  if (Number.isNaN(da) || Number.isNaN(db)) return 0
  return Math.abs(Math.round((db - da) / 86_400_000))
}

/** 互斥口径：ACT I <2015 / ACT II 2015-2021 / ACT III ≥2022（三幕无重叠、无缺口） */
function exclusiveActCount(timeline: TimelineEntry[], id: ActId): number {
  if (id === 'act-i') return timeline.filter((e) => e.date < '2015-01-01').length
  if (id === 'act-ii') return timeline.filter((e) => e.date >= '2015-01-01' && e.date <= '2021-12-31').length
  return timeline.filter((e) => e.date >= '2022-01-01').length
}

export function fillEmphasis(template: string | undefined, vars: Record<string, string>): string | undefined {
  if (!template) return undefined
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

/** 高光 / 时间线的强调数字派生变量（全部来自数据） */
function emphasisVars(timeline: TimelineEntry[]): Record<string, string> {
  const xinlingCount = timeline.filter((e) => e.tags.includes('心灵砒霜')).length
  const wukongCount = timeline.filter((e) => e.games.some((g) => g.id === 'black-myth-wukong')).length
  const geometryMinutes = timeline.filter((e) => e.title.includes('几何冲刺')).reduce((s, e) => s + (e.duration_min ?? 0), 0)
  return {
    geometryHours: Math.round(geometryMinutes / 60).toString(),
    xinlingCount: xinlingCount.toLocaleString(),
    wukongCount: wukongCount.toString(),
  }
}

/**
 * 蒙太奇素材：2016—2022 年带封面的条目等距采样（升序，约 15 张真实封面）；
 * 派生数字（心灵砒霜期数 / 总小时数 / 直播场次）全部从数据算，文案不硬编码。
 */
function buildMontage(timeline: TimelineEntry[]): ResolvedBeat['montage'] {
  const pool = timeline.filter((e) => e.cover && e.date >= '2016-01-01' && e.date <= '2022-12-31').reverse()
  const step = Math.max(1, Math.floor(pool.length / 15))
  const samples: MontageSample[] = pool
    .filter((_, i) => i % step === 0)
    .slice(0, 15)
    .map((e) => ({ id: e.id, date: e.date, title: e.title, cover: e.cover ? proxyImage(e.cover, 480) : null }))
    .filter((s): s is MontageSample => s.cover !== null)
  // 首页只展示对外口径：实际累计直播时长按外部硬锚点（2017《环球人物》2000+h、
  // 2020 斗鱼年度 1350h、2022「8 年近万小时」）取保守值 10,000+；场次同理只写 2,300+。
  // 精确的「已收录 / 已确认」数字在统计页展示，不在这里混用。
  return {
    samples,
    stats: {
      xinling: timeline.filter((e) => e.tags.includes('心灵砒霜')).length.toLocaleString(),
      hoursLabel: '10,000+',
      liveSessions: '2,300+',
    },
  }
}

/** 解析一幕里的所有 beat；home=true 时按「重要」口径接管 kicker（非重要锚点不带小标签）。 */
function resolveActs(ds: Dataset, timeline: TimelineEntry[], acts: Act[], home = false): ResolvedAct[] {
  const entryById = new Map(timeline.map((e) => [e.id, e]))
  const vars = emphasisVars(timeline)

  const resolveBeat = (b: Beat, inheritAct: ActId): ResolvedBeat | null => {
    const actId = b.act ?? inheritAct
    if (b.size === 'montage') {
      return {
        id: b.id,
        act: actId,
        date: b.date,
        size: 'montage',
        kicker: b.kicker,
        title: b.title,
        body: b.body,
        chips: b.chips,
        href: null,
        external: false,
        cover: null,
        montage: buildMontage(timeline),
      }
    }

    let href: string | null = null
    let external = false
    let cover: string | null = null
    const t = b.target

    if (t?.kind === 'entry') {
      const entry = entryById.get(t.id)
      if (!entry) {
        if (process.env.NODE_ENV !== 'production') console.warn(`[narrative] beat ${b.id} 锚点条目缺失: ${t.id}`)
        return null
      }
      href = t.href ?? `/e/${entry.id}/`
      if (entry.cover) cover = proxyImage(entry.cover, b.size === 'hero' ? 900 : 640)
    } else if (t?.kind === 'game') {
      href = `/games/${t.id}/`
      const coverEntry = timeline.find((e) => e.games.some((g) => g.id === t.id) && e.cover)
      if (coverEntry?.cover) cover = proxyImage(coverEntry.cover, 900)
    } else if (t?.kind === 'series') {
      href = `/series/${t.id}/`
    } else if (t?.kind === 'href') {
      href = t.href
      external = true
    }

    return {
      id: b.id,
      act: actId,
      date: b.date,
      size: b.size,
      // 首页精简幕：重要锚点显示「重要」，非重要不带任何小标签（用户明确要求）。
      kicker: home ? (b.important ? '重要' : undefined) : b.kicker,
      title: b.title,
      body: b.body,
      href,
      external,
      cover,
      emphasis: fillEmphasis(b.emphasis, vars),
      gameWorld: b.gameWorld,
      tail: b.tail,
    }
  }

  return acts.map((act) => ({
    act,
    count: countBetween(timeline, act.from, act.to),
    exclusiveCount: home ? exclusiveActCount(timeline, act.id) : undefined,
    beats: act.beats.map((b) => resolveBeat(b, act.id)).filter((x): x is ResolvedBeat => x !== null),
  }))
}

export function resolveHomepage(ds: Dataset, timeline: TimelineEntry[]): HomepageData {
  const latestYear = timeline[0]?.date.slice(0, 4) ?? new Date().getFullYear().toString()
  const entryById = new Map(timeline.map((e) => [e.id, e]))
  const vars = emphasisVars(timeline)

  const highlights: ResolvedBeat[] = HIGHLIGHTS.flatMap((h) => {
    const entry = h.entryId ? entryById.get(h.entryId) ?? null : null
    if (h.entryId && !entry) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[narrative] 高光 ${h.id} 锚点条目缺失: ${h.entryId}`)
      return []
    }
    const href = h.link === false
      ? null
      : entry?.primaryUrl ?? h.href ?? (entry ? `/e/${entry.id}/` : '/chronicle/')
    const external = href ? href.startsWith('http') || href.startsWith('//') : false
    return [
      {
        id: h.id,
        act: h.act,
        date: h.date,
        size: 'type',
        kicker: h.kicker,
        title: h.title,
        body: h.body,
        href,
        external,
        cover: h.cover ?? (entry?.cover ? proxyImage(entry.cover, 640) : null),
        emphasis: fillEmphasis(h.emphasis, vars),
      },
    ]
  })

  return {
    acts: resolveActs(ds, timeline, HOMEPAGE_ACTS, true),
    highlights,
    emphasisVars: vars,
    now: {
      year: latestYear,
      label: '还在继续。',
      count: countBetween(timeline, '2024-08-18', ''),
    },
    totals: { entries: timeline.length, years: new Set(timeline.map((e) => e.date.slice(0, 4))).size, series: ds.series.size },
    years: [...new Set(timeline.map((e) => e.date.slice(0, 4)))].sort(),
    exclusiveCounts: HOMEPAGE_ACTS.map((a) => exclusiveActCount(timeline, a.id)),
  }
}

/** 编年史故事模式：32 节详版三幕（甘蔗精已撤）。 */
export function resolveStoryActs(ds: Dataset, timeline: TimelineEntry[]): ResolvedAct[] {
  return resolveActs(ds, timeline, STORY_ACTS)
}

/** 首页时间线外的小工具：几何冲刺总时长（games/[id] 详情页用） */
export function geometryDashTotalHours(timeline: TimelineEntry[]): number {
  const minutes = timeline.filter((e) => e.title.includes('几何冲刺')).reduce((s, e) => s + (e.duration_min ?? 0), 0)
  return Math.round(minutes / 60)
}

/** 游戏详情页数据（games/[id] 用）：字段匹配 ∪ 策展标题匹配 */
export type GameProfile = {
  id: string
  name: string
  aliases: string[]
  curated?: CuratedGame
  entries: TimelineEntry[]
  firstDate: string | null
  lastDate: string | null
  sessions: number
  totalMinutes: number
  /** 有明确时长（duration_min）的场次数；< sessions 时长统计就是部分已知 */
  knownDurationCount: number
  hoursLabel: string
  /** 最近一次场次的封面（详情页用） */
  cover: string | null
  /** 首播那天的封面（游戏库墙用——默认按「最近玩过」排，往下滚封面年代跟着首播年份往回退） */
  face: string | null
  /** 相邻场次间最长中断天数（≥180 天才算「又打开了」）；没有长中断为 0 */
  comebackDays: number
  /** 首播 → 最近一次 跨的天数（页头「跨得最长」统计用） */
  spanDays: number
  /** 策展一句话（{hours} 已填充）；注册游戏为 null，页面上用数据行替代 */
  oneLiner: string | null
}

export function getGameProfile(ds: Dataset, timeline: TimelineEntry[], gameId: string): GameProfile | null {
  const registered = ds.games.get(gameId)
  const curated = CURATED_GAMES[gameId]
  if (!registered && !curated) return null

  const matches = timeline.filter((e) => {
    if (e.games.some((g) => g.id === gameId)) return true
    if (curated && curated.entryTitlePattern.test(e.title)) return true
    return false
  })

  const totalMinutes = matches.reduce((sum, e) => sum + (e.duration_min ?? 0), 0)
  const latestCover = matches.find((e) => e.cover)?.cover ?? null
  const name = curated?.name ?? registered?.name ?? gameId
  const oneLiner = curated
    ? curated.oneLiner.replace('{hours}', Math.round(totalMinutes / 60).toString())
    : null

  // timeline 降序：第一个是最近一次，最后一个是首次
  const first = matches.length ? matches[matches.length - 1] : null
  const last = matches[0] ?? null
  // 首播封面 = 最早一条带封面的场次（不是商店页宣传图，是她第一次播它那天的截图）
  const firstCover = [...matches].reverse().find((e) => e.cover)?.cover ?? null
  // 相邻场次最长中断（≥180 天才算「隔了 N 天又打开」）
  const ascending = [...matches].reverse()
  let comebackDays = 0
  for (let i = 1; i < ascending.length; i++) {
    const gap = daysBetween(ascending[i - 1].date, ascending[i].date)
    if (gap >= 180 && gap > comebackDays) comebackDays = gap
  }

  return {
    id: gameId,
    name,
    aliases: curated?.aliases ?? registered?.aliases ?? [],
    curated,
    entries: matches,
    firstDate: first?.date ?? null,
    lastDate: last?.date ?? null,
    sessions: matches.length,
    totalMinutes,
    knownDurationCount: matches.filter((e) => typeof e.duration_min === 'number').length,
    hoursLabel: formatDuration(totalMinutes),
    cover: latestCover ? proxyImage(latestCover ?? undefined, 900) : null,
    face: firstCover ? proxyImage(firstCover ?? undefined, 480) : null,
    comebackDays,
    spanDays: first && last ? daysBetween(first.date, last.date) : 0,
    oneLiner,
  }
}
