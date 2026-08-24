import type { Dataset, TimelineEntry } from './data'
import { proxyImage } from './platforms'
import { isXinlingPishuangEntry } from './series'
import { formatDuration } from './ui'

/**
 * 叙事层 · 策展内容（唯一的前端策展源）
 * ====================================
 * 只有这个文件里的文案与时间线选择是「架构/前端」角色写的叙事内容。
 * 两层叙事，共享三幕元数据：
 * - HOMEPAGE_ACTS：首页三幕（精简）。「女流是怎么来的？」→「为什么 156277 后来不只是一个直播间？」
 *   →「直播间之外，她后来怎么样了？」。只放用户提纲里的锚点；【重要】锚点带「重要」小标，
 *   非重要锚点不带任何小标签（手机端不吵）。ACT II 中间用蒙太奇（2016—2022 真实封面 + 派生数字）。
 * - STORY_ACTS：编年史故事模式（详版）。替代原来的逐年摘要；甘蔗精已撤下（等素材，见注释）。
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

/** 首页「直播间梗」的固定一级分类。没有分类的保留 Highlight 不在新版模块展示。 */
export const MEME_CATEGORIES = [
  { id: 'daily-meme', label: '日常梗', description: '游戏和固定节目之外，在长期直播与生活中留下来的经典梗。' },
  { id: 'xinling-pishuang', label: '心灵砒霜', description: '从水友故事和聊天里长出来的一系列经典人物、台词与名场面。' },
  { id: 'game-meme', label: '游戏梗', description: '从游戏操作、受苦和节目效果里留下来的经典梗。' },
  { id: 'peiqi', label: '佩奇', description: '女流唱歌、Rap、Dance 等表演留下来的直播间梗与名场面。' },
] as const

export type MemeCategory = (typeof MEME_CATEGORIES)[number]['id']

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
  /** 展示日期（自由文本，如 2010.05.08 / 2015—16）——只负责给人看，不负责定位年份 */
  date: string
  /**
   * 故事模式里这张卡归到哪一年。
   *
   * 以前是从 date 里抓第一个四位数字，于是「2013—14 · 毕业以后」被归到 2013、
   * 「~2016—17」被归到 2016——展示日期同时承担了数据定位，写得越像人话就越容易错位。
   * 现在定位只看这个字段；date 想怎么写都行。首页幕不参与归年，可以省略。
   */
  storyYear?: number
  /**
   * 跨年份节点的结束年份（如 2007—2009 清华本科阶段）。
   * 声明之后，storyYear..storyEndYear 之间「自己没有故事节点」的年份会并进这一段，
   * 不再各自留下一个空段落。
   */
  storyEndYear?: number
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
  /** 封面覆盖：默认取锚点条目封面；个别外部事件可直接给图床 URL */
  cover?: string
  /** 蒙太奇幕：分类 chips（如 心灵砒霜 / 主机新作 / 壮壮 …） */
  chips?: string[]
  /** 需要从档案实时派生活跃年份图的栏目；不在文案里手写期数。 */
  activitySeries?: 'xinling-pishuang'
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
/**
 * 编年史故事模式。
 *
 * 这一版把产品定义写清楚了：
 * - **档案模式**记录「我们保存了什么」——某一天留下了哪些录像、来自哪个来源。
 * - **故事模式**记录「我们知道她走过什么」——把视频、直播，和可以可靠确认的人生节点
 *   串起来。所以这里允许出现档案里没有对应录像的节点（高考、升学、交换、毕业、婚育），
 *   但**绝不为了故事好看去伪造 archive entry**：没有录像就用外部来源，没有来源就不写。
 *
 * 归年只看 `storyYear`，不再从 `date` 里抓四位数字（见 Beat.storyYear 注释）。
 *
 * 2006—2014 前史的事实来源（2026-08-19 复核）：
 * - 百度百科「石悦」词条：2006 原始分 702.5 内蒙古理科第一 → 清华大学建筑学院建筑系；
 *   2011-06 清华本科综合论文训练；2011 推免入北京大学深圳研究生院城市规划与设计学院；
 *   2013-02 赴台湾交通大学建筑研究所交换一学期；
 *   2014-07-02 获城市规划与设计硕士学位，毕业后入职完美世界媒体中心；
 *   2015-01-21 在斗鱼开设房间；2015-07-05 起每周日直播《心灵砒霜》。
 * - 中文维基百科「女流」词条：台湾新竹国立交通大学交换、2014 完美世界（编导 / 主持）。
 * - 《环球人物》2017-03 专访（本人口述）：2010 年借麦克风录第一个视频；
 *   「2015 年 1 月，石悦在直播平台斗鱼做了第一次游戏直播」；
 *   2017-02-21 法斯宾德走进她的直播间接受采访。
 * 站内档案交叉印证：2015-01-21 / 2015-01-22 两条早期直播录像；2015-07-05 起心灵砒霜连续期数。
 *
 * 视频时代（2010—2014）策展修订（2026-08-19）：档案里的实际投稿密度证明她没有真的
 * 「消失几年后转做直播」——2012 年 5 月 / 8 月、2013 年 8 月起、2014 年全年都有确认投稿。
 * 读研 / 交换 / 毕业只是更新节奏变慢的生活背景，不能替代这几年的内容节点，也不能被
 * 笼统地当作停更的唯一原因（各年具体停更原因不全部可考，不做过度归因）。
 */
export const STORY_ACTS: Act[] = [
  {
    ...ACT_META['act-i'],
    beats: [
      {
        id: 'mainstream-2006',
        date: '2006.06',
        storyYear: 2006,
        size: 'small',
        kicker: '第一次被媒体认识',
        title: '那时候，大家认识的是石悦。',
        body: '这一年，她以 702.5 分成为内蒙古理科高考第一名，九月进入清华大学建筑学院。「女流」还没有出现。',
        target: { kind: 'href', href: 'https://news.cctv.com/education/20060627/105243.shtml' },
      },
      {
        // 跨年段：2007—2009 三年在档案里没有任何录像，但这三年不是「不知道」，
        // 只是没有可写成单独事件的公开记录。合成一段，避免连着三个空年份。
        id: 'tsinghua-arch',
        date: '2007.01',
        storyYear: 2007,
        storyEndYear: 2009,
        size: 'small',
        kicker: '本科',
        title: '清华建筑学院',
        body: '建筑学本科的中间几年。关于这几年的公开记录不多，能确认的是：上课、画图、做模型，游戏也一直在她的生活里。',
        target: { kind: 'none' },
      },
      {
        // 后台旧内容把早期 `first-video` 标成删除；这里用新的策展 stable id 恢复这张主卡，
        // 史料锚点仍是同一条 2010-05-08 Archive 记录，不复制或改写数据。
        id: 'first-video-chronicle',
        date: '2010.05.08',
        storyYear: 2010,
        size: 'hero',
        kicker: '一切从这里开始',
        title: '女流，上传了第一个游戏视频。',
        body: '清华建筑学院本科期间，她借来麦克风，上传了自己的第一支游戏解说——《小型单机游戏之迷画之塔》。最初想叫「女流之辈」，名字已经被注册，于是用了「女流」。从这里开始，互联网上多了一个叫女流的人。',
        target: { kind: 'entry', id: '2010-05-08-video-01' },
        gameWorld: { rel: '+10 DAYS', date: '2010.05.18', text: '《荒野大镖客：救赎》十天后发售。' },
      },
      {
        id: 'binge-game',
        date: '2010.06',
        storyYear: 2010,
        size: 'small',
        kicker: '爆款',
        title: '《变态人生大冒险》',
        body: '越来越多人开始认识这个叫「女流」的人。',
        target: { kind: 'entry', id: '2010-06-30-video-01' },
        gameWorld: { date: '2011.11', text: '《上古卷轴 V：天际》发售。' },
      },
      {
        id: 'pku-2011',
        date: '2011.09',
        storyYear: 2011,
        size: 'small',
        kicker: '升学',
        title: '从清华到北大。',
        body: '五年的建筑学本科结束，她以推免生身份进入北京大学深圳研究生院，读城市规划与设计。这一年的视频记录目前很少——不是「女流」停下了，只是还没有找到更多确认的投稿。',
        target: { kind: 'none' },
      },
      {
        id: 'pause-2012',
        date: '2012.05',
        storyYear: 2012,
        size: 'small',
        kicker: '读研',
        title: '更新慢了下来。',
        body: '读研以后，做视频的时间明显少了。更新间隔越来越长，但「女流」并没有完全停下来。',
        target: { kind: 'none' },
        gameWorld: { date: '2012.10', text: '这一年十月，她拿到了国家奖学金。' },
      },
      {
        id: 'anqila-part3-4-2012',
        date: '2012.05',
        storyYear: 2012,
        size: 'small',
        kicker: '回来填坑',
        title: '又回来填《安琪拉之歌》的坑。',
        body: '两年前开的坑，到了研究生阶段还在继续填。',
        target: { kind: 'entry', id: '2012-05-20-video-01' },
      },
      {
        id: 'huanxing-hezi4-2012',
        date: '2012.08',
        storyYear: 2012,
        size: 'small',
        kicker: '偶尔更新',
        title: '《唤醒盒子4》',
        body: '更新已经变得很慢，但偶尔还是会有一支新视频冒出来。',
        target: { kind: 'entry', id: '2012-08-26-video-01' },
      },
      {
        id: 'taiwan-2013',
        date: '2013.02',
        storyYear: 2013,
        size: 'small',
        kicker: '交换',
        title: '去台湾交换的那一学期。',
        body: '研究生阶段，她前往台湾交通大学建筑研究所交换一学期。',
        target: { kind: 'none' },
        gameWorld: { date: '2013.09.17', text: '《GTA V》发售。' },
      },
      {
        id: 'video-return-2013',
        date: '2013.08',
        storyYear: 2013,
        size: 'small',
        kicker: '重新更新',
        title: '回来了。',
        body: '2013 年 8 月，停了一段时间以后，女流重新开始上传视频。',
        target: { kind: 'entry', id: '2013-08-29-video-01' },
      },
      {
        id: 'journey-video-2013',
        date: '2013.09',
        storyYear: 2013,
        size: 'small',
        kicker: '代表作',
        title: '《风之旅人》',
        body: '恢复更新以后，她用三期视频走完了《风之旅人》。',
        target: { kind: 'series', id: 'journey-playthrough' },
      },
      {
        id: 'graduation',
        date: '2014.07',
        storyYear: 2014,
        size: 'small',
        kicker: '毕业',
        title: '把游戏变成工作。',
        body: '她获得北京大学城市规划与设计专业硕士学位。毕业之后没有走向建筑与规划，而是进了游戏行业——入职完美世界媒体中心，参与游戏节目的编导与主持。视频没有因此停下。',
        target: { kind: 'none' },
      },
      {
        id: 'anqila-part5-2014',
        date: '2014.09',
        storyYear: 2014,
        size: 'small',
        kicker: '填坑',
        title: '《安琪拉之歌》，终于填到 Part 5。',
        body: '2010 年开的坑，2012 年补过 Part 3、4，2014 年工作以后，Part 5 还是来了。',
        target: { kind: 'entry', id: '2014-09-10-video-01' },
      },
      {
        id: 'child-of-light-2014',
        date: '2014.11',
        storyYear: 2014,
        size: 'small',
        kicker: '系列解说',
        title: '《光之子》',
        body: '2014 年最后一个多月，她连续更新了整套《光之子》。工作以后，视频还在继续。',
        target: { kind: 'series', id: 'child-of-light' },
      },
      {
        id: 'door-156277',
        date: '2015.01',
        storyYear: 2015,
        size: 'hero',
        kicker: '从录像到直播',
        title: '斗鱼156277，开门。',
        body: '2015 年初，她开始在斗鱼直播，房间号 156277。以前大家看到的是录好的游戏，从这里开始，越来越多的时间变成了大家一起经历的直播。',
        // 现存证据指向 2015 年 1 月，但不是同一件事：1/21 是目前可确认的最早直播录像
        // （B 站官方「[1.21直播录像]」，百度百科与 nvliu.me 也记这一天开设房间）；
        // 1/22 的 AcFun 录像标题写「斗鱼首秀」；1/24 是 1/21 那场优酷版本的上传日。
        // 三种口径不能压成一个「唯一首播日」，所以主卡只写到月。
        target: { kind: 'entry', id: '2015-01-21-live-01' },
      },
      {
        id: 'names',
        date: '2015.01',
        storyYear: 2015,
        size: 'small',
        kicker: '名字',
        title: '她有很多名字。',
        body: '从视频时期的「女流」，到直播间里的「女流66」；66、流酱、流流，也都是水友在这些年里留下的称呼。',
        target: { kind: 'none' },
      },
    ],
  },
  {
    ...ACT_META['act-ii'],
    beats: [
      {
        id: 'xinling-first',
        date: '2015.07.05',
        storyYear: 2015,
        size: 'hero',
        kicker: '一个星期日',
        title: '心灵砒霜开始了。',
        body: '游戏暂停，邮件打开，一个星期日。本来想聊鸡汤，最后聊成了砒霜。后来，这档节目陪着直播间走了很多年。',
        emphasis: '{xinlingCount} 期被保存下来',
        activitySeries: 'xinling-pishuang',
        target: { kind: 'entry', id: '2015-07-05-live-01', href: '/series/xinling-pishuang/' },
      },
      {
        id: 'dazhou-mc',
        date: '2017.07',
        storyYear: 2017,
        size: 'type',
        kicker: '大周',
        title: '到这时，大家已经叫「大周」。',
        body: '目前保存下来的《大周 MC》记录从 2017 年 7 月开始。《Minecraft》里的国家名——女皇、六泽天、大周——已经变成斗鱼156277 水友群体共同使用的名字。',
        target: { kind: 'game', id: 'minecraft' },
      },
      {
        id: 'anniversary-2016-live',
        date: '2016.01.24',
        storyYear: 2016,
        size: 'hero',
        kicker: '直播一周年',
        title: '第一年，大家已经开始一起过周年。',
        body: '直播一周年纪念留下了完整录像。周年从一场直播开始，也很快变成水友共同创作的日子。',
        cover: '/gallery/anniv_01_1st_2016_bilibili.jpg',
        target: { kind: 'entry', id: '2016-01-24-live-01' },
      },
      {
        id: 'anniversary-2016-to-nvliu',
        date: '2016.01',
        storyYear: 2016,
        size: 'hero',
        kicker: '一周年作品',
        title: '《致女流》',
        body: '水友为直播一周年留下的作品。它记录的不只是一位主播，也记录了第一批共同记忆已经怎样聚起来。',
        cover: '/gallery/anniv_02_1st_2016_fanmade.jpg',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1zs411R7nJ' },
      },
      {
        id: 'anniversary-2016-empress',
        date: '2016.08',
        storyYear: 2016,
        size: 'small',
        kicker: '水友作品',
        title: '《一代女皇六则天》',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1vs411C7w2' },
      },
      {
        id: 'birthday-2016-fanwork',
        date: '2016.10',
        storyYear: 2016,
        size: 'small',
        kicker: '生日作品',
        title: '生日这天，水友也留下了一支作品。',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1xx411n7jQ' },
      },
      {
        // 不再叫「第一期」：站内 2015-07-05 起已有连续期数（见 xinling-first）。
        // 这一场是目前保存得最完整的早期一期，按代表录像处理。
        id: 'xinling-pishuang',
        date: '2016.08.07',
        storyYear: 2016,
        size: 'small',
        kicker: '心灵砒霜',
        title: '完整保存下来的一期。',
        body: '2016 年 8 月 7 日那期的完整录音留了下来，是早期心灵砒霜里保存得最完整的一场之一。',
        target: { kind: 'entry', id: '2016-08-07-live-01', href: '/series/xinling-pishuang/' },
      },
      {
        id: 'mainstream-2016-cctv',
        date: '2016.09',
        storyYear: 2016,
        size: 'small',
        kicker: '从直播间走上 CCTV',
        title: '《加油！向未来》',
        body: '十年前，媒体报道的是高考状元石悦；这一次出现在央视镜头里，她的身份已经是游戏主播女流。',
        target: { kind: 'href', href: 'https://tv.cctv.com/2021/07/19/VIDEnPEGm2dUqZmKLYnp3Rsv210719.shtml' },
      },
      {
        // 原「~2016—17」是误判：B 站官方号（女流66）自己发布，用 bilibili API 核实
        // pubdate=2022-01-05，不是第三方多年后的考古重剪，日期按发布时间即代表切片本身的年份。
        id: 'yuanweiji',
        date: '2022.01',
        storyYear: 2022,
        size: 'small',
        kicker: '砒霜名场面',
        title: '原味鸡',
        body: '「什么原味鸡？」「草。」',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1vu411U7MZ' },
      },
      {
        // 同上：B 站官方号自己发布，核实 pubdate=2021-12-24。
        id: 'dalishi',
        date: '2021.12',
        storyYear: 2021,
        size: 'small',
        kicker: '砒霜名场面',
        title: '大力士',
        body: '一个脑子已经处理不了了。',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1xP4y1J7LB' },
      },
      {
        id: 'three-books',
        date: '2017.11',
        storyYear: 2017,
        size: 'type',
        kicker: '大周经典考古',
        title: '三本书 × 4000',
        body: '「老师有什么书推荐吗？」——《百年孤独》《城市发展史》《美国大城市的死与生》。同一条推荐短信被重复发送了大量次数。',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV12Y411F7WZ' },
      },
      {
        id: 'anniversary-2017-live',
        date: '2017.01.21',
        storyYear: 2017,
        size: 'hero',
        kicker: '直播二周年',
        title: '两周年，正式开场。',
        body: '前一天的彩排和当天的周年直播都保存了下来。到第二年，周年已经是一场需要提前准备的共同活动。',
        target: { kind: 'entry', id: '2017-01-21-live-01' },
      },
      {
        id: 'anniversary-2017-rehearsal',
        date: '2017.01.20',
        storyYear: 2017,
        size: 'small',
        kicker: '周年彩排',
        title: '两周年彩排',
        target: { kind: 'entry', id: '2017-01-20-live-01' },
      },
      {
        id: 'anniversary-2017-fan-video',
        date: '2017.02.07',
        storyYear: 2017,
        size: 'hero',
        kicker: '粉丝制作',
        title: '《直播两周年快乐！》',
        body: '周年结束以后，粉丝制作的祝福视频又把那一年的人和画面留了一遍。',
        cover: 'http://i1.hdslb.com/bfs/archive/d666ac2a6769bb3ad4cce1b4bead83bd6677d1f5.jpg',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1Ux41117zW' },
      },
      {
        id: 'birthday-2017-dazhou-song',
        date: '2017.10.03',
        storyYear: 2017,
        size: 'small',
        kicker: '生日会',
        title: '生日这天的大周歌会。',
        body: '这场生日直播保存了下来；公开流传的生日会片段里，二哥也出现在镜头中。',
        target: { kind: 'entry', id: '2017-10-03-live-01' },
      },
      {
        id: 'mainstream-2017-outbreak',
        date: '2017.02',
        storyYear: 2017,
        size: 'type',
        kicker: '2017 · 她后来这样形容',
        title: '「主流社会突然知道了这件事。」',
        body: '高考状元、清华本科、北大硕士和游戏主播这几个标签，被一轮集中报道重新放到了一起。央视网、澎湃、中国青年网等都在说这件事。',
        target: { kind: 'href', href: 'https://news.cctv.com/2017/02/07/ARTIPmCjwvnHQdN3922VgI2S170207.shtml' },
      },
      {
        id: 'mainstream-2017-paper',
        date: '2017.02.12',
        storyYear: 2017,
        size: 'small',
        kicker: '本人视频专访',
        title: '澎湃新闻专访石悦',
        body: '视频里她自己聊父亲、聊游戏、聊职业选择，也第一次正面解释：「石悦」和「女流」从来不是两个矛盾的身份。',
        target: { kind: 'href', href: 'https://www.thepaper.cn/newsDetail_forward_1616878' },
      },
      {
        id: 'mainstream-2017-fassbender',
        date: '2017.02.21',
        storyYear: 2017,
        size: 'small',
        kicker: '直播间来了个演员',
        title: '法斯宾德走进了直播间。',
        body: '《刺客信条》来华宣传时，迈克尔·法斯宾德第一次走进直播间，接受她的采访。那天直播间涌进了几十万人。',
        // 《环球人物》那篇专访里直接写了这件事（「他第一次『走进』直播间，接受了中国当红
        // 游戏主播『女流』的采访」），所以两张卡共用同一来源不是偷懒复用——它就是这件事的出处。
        target: { kind: 'href', href: 'https://paper.people.com.cn/hqrw/html/2017-03/01/content_1761506.htm' },
      },
      {
        id: 'mainstream-2017-hqrw',
        date: '2017.03',
        storyYear: 2017,
        size: 'type',
        kicker: '她自己讲自己的故事',
        title: '《环球人物》专访',
        body: '这一次，她从自己的角度讲起了做视频、职业选择，以及后来为什么坐进直播间。',
        target: { kind: 'href', href: 'https://paper.people.com.cn/hqrw/html/2017-03/01/content_1761506.htm' },
      },
      {
        id: 'shishizi',
        date: '2018.03',
        storyYear: 2018,
        size: 'type',
        kicker: '坐镇大周',
        title: '女流的职业规划出现了一些偏差。',
        body: '水友聊天玩《红楼梦》角色分配，本来讨论女流当林黛玉……最后变成了石狮子。大周女皇 → 石狮子。',
        target: { kind: 'entry', id: '2018-03-18-live-01' },
        gameWorld: { date: '2017', text: 'Nintendo Switch 进入市场。' },
      },
      {
        id: 'anniversary-2018-gala',
        date: '2018.01.21',
        storyYear: 2018,
        size: 'hero',
        kicker: '直播三周年',
        title: '三周年盛典',
        body: '到了第三年，周年已经有了盛典的规模。直播画面与水友作品一起留下了这一晚。',
        cover: '/gallery/anniv_06_3rd_2018_gala.png',
        target: { kind: 'entry', id: '2018-01-21-live-03' },
      },
      {
        id: 'anniversary-2018-muyouye-boyingbin',
        date: '2018.01',
        storyYear: 2018,
        size: 'hero',
        kicker: '周年作品',
        title: '木由叶、播音彬的三周年祝福',
        body: '一支明确署名的三周年水友作品，和盛典一起构成了这一年的周年画面。',
        cover: '/gallery/anniv_07_3rd_2018_blessing.png',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1PW411i7G8' },
      },
      {
        id: 'anniversary-2018-010',
        date: '2018.01',
        storyYear: 2018,
        size: 'small',
        kicker: '周年作品',
        title: '010陈周年作品',
        target: { kind: 'href', href: 'https://www.acfun.cn/v/ac4204297' },
      },
      {
        id: 'carnival-2018',
        date: '2018.05',
        storyYear: 2018,
        size: 'hero',
        kicker: '嘉年华',
        title: '镜头走出了直播间。',
        body: '嘉年华留下了那一年线下相见的真实画面。',
        cover: '/gallery/anniv_08_carnival_2018.jpg',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1tW4113783' },
      },
      {
        id: 'ideal-song-2018',
        date: '2018.04.06',
        storyYear: 2018,
        size: 'hero',
        kicker: '女流 × 豆豆',
        title: '《理想之歌》',
        body: '豆6组合的合唱留在了这一年的直播里。',
        cover: '/gallery/anniv_09_duet_2018.png',
        target: { kind: 'entry', id: '2018-04-06-live-01' },
      },
      {
        id: 'darksouls-3',
        date: '2016.04',
        storyYear: 2016,
        size: 'small',
        kicker: '☠ 受苦记录 #01',
        title: '黑暗之魂3',
        body: '又死了。',
        target: { kind: 'game', id: 'dark-souls-3' },
      },
      {
        id: 'getting-over-it',
        date: '2017.11',
        storyYear: 2017,
        size: 'small',
        kicker: '☠ 受苦记录 #02',
        title: '抡大锤',
        body: '爬了半天。掉下去了。',
        target: { kind: 'game', id: 'getting-over-it' },
      },
      {
        // 第三方剪辑号「bc狼」的相声改编版，bilibili API 核实 pubdate=2018-03-01；
        // 原始事件更早，但没有比这更可靠的锚点，日期只写到月、不假装知道具体哪天。
        id: 'zhushi-ji',
        date: '2018.03',
        storyYear: 2018,
        size: 'small',
        kicker: '大周年度连续剧',
        title: '壮王爷《结石记》',
        body: '一个本来很普通的「弟弟去医院」，迅速变成大周连续剧。',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1PW411x7Td' },
      },
      {
        id: 'mainstream-2018-cyol',
        date: '2018.08',
        storyYear: 2018,
        size: 'small',
        kicker: '媒体回访',
        title: '多年以后，再搜索「石悦」。',
        body: '中国青年报再次采访。媒体眼里的她，已经从当年的高考状元，变成了游戏主播女流66。',
        target: { kind: 'href', href: 'http://media.people.com.cn/n1/2018/0828/c40606-30254502.html' },
      },
      // 甘蔗精（ganzhe-jing）已撤下：等找到正确素材再放。
      {
        id: 'celeste',
        date: '2018.03',
        storyYear: 2018,
        size: 'small',
        kicker: '☠ 受苦记录 #03',
        title: 'Celeste',
        body: '鬼知道我死了多少次。变态游戏，毁我青春。',
        target: { kind: 'game', id: 'celeste' },
      },
      {
        id: 'sekiro',
        date: '2019.03',
        storyYear: 2019,
        size: 'small',
        kicker: '☠ 受苦记录 #04',
        title: '只狼',
        body: '会弹刀了。然后又死了。',
        target: { kind: 'game', id: 'sekiro' },
      },
      {
        id: 'anniversary-2019-four-years',
        date: '2019.01.21',
        storyYear: 2019,
        size: 'hero',
        kicker: '直播四周年',
        title: '四年了，感谢有你。',
        body: '四周年直播保存了下来。它和第二天整理发布的各部合集放在一起，才看得见当年的大周已经有多大。',
        target: { kind: 'entry', id: '2019-01-21-live-02' },
      },
      {
        id: 'anniversary-2019-departments',
        date: '2019.01.22',
        storyYear: 2019,
        size: 'hero',
        kicker: '四周年 · 7P 合集',
        title: '《四周年各部视频合集》',
        body: '完整合集实际分为 7P：北京部、搞事部、海外部（2P）、010、女皇密令、众人眼中的石66。搞事部公开祝福画面里能确认赛文柒Seven、YJJ、PIGFF、钱小佳、菠萝赛东、刘飞儿、小缘、PC冷冷、纳豆；010 单元是《达拉崩吧 Live 四周年版》。',
        cover: 'https://tx-free-imgs.acfun.cn/Fp_PxgXItrwOToTDstcp1f-V72hT?imageslim',
        target: { kind: 'href', href: 'https://www.acfun.cn/v/ac4885083' },
      },
      {
        id: 'nasdaq',
        date: '2019.07',
        storyYear: 2019,
        size: 'type',
        kicker: '职业高光',
        title: '斗鱼156277 去了一趟纳斯达克。',
        body: '前些日子还在直播间里打游戏，转眼跟着斗鱼去了纳斯达克敲钟。',
        cover: 'https://pics3.baidu.com/feed/95eef01f3a292df50265fa3d970d7b6534a87331.png@f_auto?token=1a85aaece0bd0eeba03e388010f0bb3c&s=F78069A54CCC84DC50706D92030000C3',
        target: { kind: 'href', href: 'http://hb.china.com.cn/2019-07/18/content_40831784.htm' },
      },
      {
        id: 'jump-king',
        date: '2019.08',
        storyYear: 2019,
        size: 'small',
        kicker: '☠ 受苦记录 #05',
        title: 'Jump King',
        body: '女流在爬。壮壮在笑。',
        target: { kind: 'game', id: 'jump-king' },
      },
      {
        id: 'kemu-2',
        date: '2020.06',
        storyYear: 2020,
        size: 'type',
        kicker: '大周史超长 Boss 战',
        title: '科目二，通过！！！',
        body: '多年连续剧，大周史的主线 Boss。失败、再考、失败、继续考，这一次终于打完了。第二天的心灵砒霜标题是：每天醒来都要确认下是不是真的过了科目二。',
        emphasis: 'ACHIEVEMENT UNLOCKED',
        // 站内没有「通过当天」的录像；能直接佐证的是第二天那场心灵砒霜的标题，
        // 所以正文明说这是第二天的节目，不让访客点进去发现日期对不上。
        target: { kind: 'entry', id: '2020-06-14-live-01' },
        gameWorld: { rel: '-2 DAYS', date: '2020.06.11', text: '大家第一次看见 PS5。' },
      },
      {
        id: 'anniversary-2020-reaction',
        date: '2020.01',
        storyYear: 2020,
        size: 'hero',
        kicker: '直播五周年',
        title: '女流与 YJJ 一起看五周年祝福。',
        body: '周年祝福被放回直播间里一起看；画面里不只留下作品，也留下了当时坐在身边的人。',
        cover: '/gallery/anniv_10_5th_2020.jpg?v=20260823',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1sq4y1L7sa' },
      },
      {
        id: 'birthday-2020-yumi',
        date: '2020.10.04',
        storyYear: 2020,
        size: 'hero',
        kicker: '生日作品',
        title: '《鱼米》',
        body: '生日这天，她把一首《鱼米》送给大家。',
        cover: 'http://i0.hdslb.com/bfs/archive/020829a788787a266629fe1b100d55c5ec9a247b.jpg',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1QT4y1c73C' },
      },
      {
        id: 'anniversary-2021-six-years',
        date: '2021.01',
        storyYear: 2021,
        size: 'hero',
        kicker: '直播六周年',
        title: '转眼已六年，满满的回忆和爱。',
        body: '六周年直播留下了真实录像；《爸爸妈妈》、二哥和小涡也都出现在这场共同记忆里。',
        target: { kind: 'entry', id: '2021-01-21-live-02' },
      },
      {
        id: 'number-723',
        date: '2021.07.23',
        storyYear: 2021,
        size: 'hero',
        kicker: '直播合作',
        title: '723 · 女流 × 寅子',
        body: '《永劫无间》全明星里的经典合作场次。配合、失误和互相拱火，后来都成了反复被提起的直播记忆。',
        target: { kind: 'entry', id: '2021-07-23-live-01' },
      },
      {
        id: 'anniversary-2022-warm-wind',
        date: '2022.01.21',
        storyYear: 2022,
        size: 'hero',
        kicker: '直播七周年',
        title: '《暖风》',
        body: '直播七周年，她重新填词演唱《暖风》，把七年的时间写进一首歌里。',
        cover: 'http://i1.hdslb.com/bfs/archive/bba056cdc641acff1913793baa854523461f7e12.jpg',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1tu411m7im' },
      },
      {
        id: 'anniversary-2022-coast',
        date: '2022.01',
        storyYear: 2022,
        size: 'hero',
        kicker: '七周年回望',
        title: '「沿海见证了我的直播生涯。」',
        body: '七周年的回望里，她把这些年与沿海重新连在了一起。',
        cover: '/gallery/anniv_11_7th_2022.jpg',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1Xq4y1k7AU' },
      },
      {
        id: 'birthday-2022-pikachu',
        date: '2022.10.05',
        storyYear: 2022,
        size: 'hero',
        kicker: '生日直播',
        title: '生日 cos 皮卡丘',
        body: '这一年的生日画面，是一只坐在直播间里的皮卡丘。',
        cover: 'http://i2.hdslb.com/bfs/archive/2b03f3ebd3d2a6bcca56ca8fbaad9e102098323a.jpg',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1Lt4y1c7yn' },
      },
      {
        id: 'anniversary-2023-eight-years',
        date: '2023.01.21',
        storyYear: 2023,
        size: 'hero',
        kicker: '直播八周年',
        title: '8 周年在除夕。',
        body: '八周年和除夕落在了同一天。这场正式周年直播留下了真实录像和当晚的画面。',
        target: { kind: 'entry', id: '2023-01-21-live-01' },
      },
      {
        id: 'review-2023-live-career',
        date: '2023.01.07',
        storyYear: 2023,
        size: 'hero',
        kicker: '回顾直播生涯',
        title: '「那次我是真哭了。」',
        body: '回看早年的直播画面时，那些已经过去的阶段重新回到了屏幕上。',
        cover: 'http://i1.hdslb.com/bfs/archive/1dd60164683febc6e48ceafec8f5da429a7a4e39.jpg',
        target: { kind: 'href', href: 'https://www.bilibili.com/video/BV1C14y1g7xi' },
      },
      {
        id: 'see-you-around',
        date: '2023.11.30',
        storyYear: 2023,
        size: 'type',
        kicker: '最后一次亮起',
        title: 'see you around~',
        body: '2023 年 11 月 30 日，斗鱼156277 最后一次开播。',
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
        storyYear: 2022,
        size: 'small',
        kicker: '公开确认',
        title: '女流与 YJJ 公开了人生的新阶段。',
        body: '编年史从公开确认的这个时间点开始记录，不用后来的结果倒推更早的直播关系。',
        target: { kind: 'entry', id: '2022-09-09-live-01' },
        gameWorld: { rel: 'SAME DAY', date: '2022.09.09', text: '《斯普拉遁3》开服。今天现实和游戏都开了多人模式。' },
      },
      {
        id: 'back-again',
        date: '2024.08.18',
        storyYear: 2024,
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
        storyYear: 2024,
        size: 'small',
        kicker: '重新开始',
        title: '黑神话时期',
        body: '重新开始的第一个冬天，她还在打游戏。',
        target: { kind: 'entry', id: '2024-12-10-live-02' },
      },
      {
        id: 'cuiwa-youguo',
        date: '2025.08',
        storyYear: 2025,
        size: 'small',
        kicker: '有宝宝了',
        title: '催娃有果。',
        target: { kind: 'none' },
      },
      {
        id: 'duoduo-lail',
        date: '2025.09',
        storyYear: 2025,
        size: 'small',
        kicker: '朵朵',
        title: '朵朵来了。',
        body: '66 姐升级成朵朵妈。',
        target: { kind: 'none' },
      },
      {
        id: 'postpartum',
        date: '2025.11',
        storyYear: 2025,
        size: 'small',
        kicker: '回来了',
        title: '产后首播',
        body: '回来直播。内容里自然多了一些以前没有的东西——朵朵、带娃、炮炮，壮壮当舅舅。',
        target: { kind: 'entry', id: '2025-11-14-live-01' },
      },
      {
        // 原「2026.03.02」查无此日：站内《生化危机9》只有 02-26/27/28 三场直播，
        // 没有 03-02。具体是哪一天无法从现有记录确认，日期只写到月。
        id: 'feeding-milk',
        date: '2026.02',
        storyYear: 2026,
        size: 'small',
        kicker: '很普通的一天',
        title: '我去喂个奶。',
        body: '直播《生化危机9》，朵朵哭了。她暂停游戏去喂孩子，回来以后继续玩。',
        target: { kind: 'game', id: 'resident-evil-9' },
      },
      {
        id: 'maplestory-memory',
        date: '2026.05',
        storyYear: 2026,
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
        storyYear: 2026,
        size: 'type',
        kicker: '现在',
        title: '姐弟俩，又回冒险岛了。',
        body: '小时候一起玩过的游戏，这么多年以后，又一起上线。不过现在，姐姐得等娃睡了。',
        tail: 'TO BE CONTINUED...',
        target: { kind: 'game', id: 'maplestory-classic' },
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
  /** null 表示保留旧数据，但不进入首页「直播间梗」分组。 */
  category: MemeCategory | null
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
    body: '清华建筑学院本科期间上传的小游戏解说。一切从这里开始。',
    emphasis: '首作 · 13 分钟',
    category: null,
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
    category: null,
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
    category: null,
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
    category: null,
  },
  {
    // bilibili API 核实 pubdate=2022-01-05（官方号自己发布，非多年后考古重剪）。
    id: 'yuanweiji',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV1vu411U7MZ',
    date: '2022.01',
    kicker: '砒霜名场面',
    title: '原味鸡',
    body: '「什么原味鸡？」',
    emphasis: '草。',
    category: 'xinling-pishuang',
  },
  {
    // bilibili API 核实 pubdate=2021-12-24（官方号自己发布）。
    id: 'dalishi',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV1xP4y1J7LB',
    date: '2021.12',
    kicker: '砒霜名场面',
    title: '大力士来啦',
    body: '一个脑子已经处理不了了。',
    category: 'xinling-pishuang',
  },
  {
    id: 'xinling-pishuang',
    act: 'act-ii',
    // 站内最早的一期是 2015-07-05（百度百科亦记 2015-07-05 起每周日直播），
    // 2016-08-07 只是保存得最完整的早期一期，不是第一期。
    entryId: '2015-07-05-live-01',
    date: '2015.07.05',
    kicker: '一个星期日',
    title: '心灵砒霜开始了。',
    body: '游戏暂停。邮件打开。一个星期日。',
    emphasis: '{xinlingCount} 期被保存下来',
    category: null,
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
    category: 'xinling-pishuang',
  },
  {
    // bilibili API 核实 pubdate=2018-03-01（第三方剪辑号），只写到月。
    id: 'zhushi-ji',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV1PW411x7Td',
    date: '2018.03',
    kicker: '大周年度连续剧',
    title: '壮王爷《结石记》',
    body: '一个本来很普通的「弟弟去医院」，迅速变成大周连续剧。',
    emphasis: '2018',
    category: 'daily-meme',
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
    category: 'daily-meme',
  },
  {
    id: 'celeste',
    act: 'act-ii',
    entryId: '2018-03-14-live-02',
    date: '2018',
    kicker: '受苦记录',
    title: '《Celeste》：鬼知道我死了多少次',
    body: '变态游戏，毁我青春。',
    category: null,
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
    category: null,
  },
  {
    id: 'nasdaq',
    act: 'act-ii',
    link: false,
    date: '2019.07',
    kicker: '职业高光',
    title: '斗鱼156277 去了一趟纳斯达克。',
    body: '前些日子还在直播间里打游戏，转眼跟着斗鱼去了纳斯达克敲钟。',
    emphasis: '2019',
    category: null,
  },
  {
    id: 'kemu-2',
    act: 'act-ii',
    entryId: '2020-06-14-live-01',
    date: '2020.06',
    kicker: '大周史主线 Boss',
    title: '科目二，通过！！！',
    body: '多年连续剧，大周史的主线 Boss。第二天的心灵砒霜标题是：每天醒来都要确认下是不是真的过了科目二。',
    emphasis: '2020',
    category: 'daily-meme',
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
    category: 'daily-meme',
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
    category: null,
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
    category: null,
  },
  {
    id: 'meme-dazhou',
    act: 'act-ii',
    href: '/games/minecraft/',
    date: '2017.07',
    kicker: '大周 · 我的世界',
    title: '大周',
    body: '从《我的世界》里长出来的共同故事，后来也成了直播间一直在用的名字。',
    category: 'game-meme',
  },
  {
    id: 'meme-pig-brain-overload',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV1xP4y1J7LB',
    date: '2021.12.24',
    kicker: '心灵砒霜',
    title: '猪脑过载',
    body: '和《大力士来啦》一起被保存下来的心灵砒霜经典标题。',
    category: 'xinling-pishuang',
  },
  {
    id: 'meme-peiqi',
    act: 'act-ii',
    entryId: '2019-12-09-live-01',
    date: '2019.12.09',
    kicker: '佩奇',
    title: '佩奇',
    body: '唱歌歌友会里留下来的直播间经典称呼。',
    category: 'peiqi',
  },
  {
    id: 'meme-66rap',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV19W411u7A9/',
    cover: 'https://i0.hdslb.com/bfs/archive/b33af1f769f8db801c16931c807a3e2873909a9e.jpg',
    date: '2018.03.20',
    kicker: '佩奇',
    title: '66rap',
    body: '女流的 Rap 名场面。',
    category: 'peiqi',
  },
  {
    id: 'meme-66dance',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV1o4411M7Sw/',
    cover: 'https://i2.hdslb.com/bfs/archive/cfcfd24df6c992c6dd7bd404d893aff47d0b53c1.jpg',
    date: '2019.06.06',
    kicker: '佩奇',
    title: '66dance',
    body: '女流跳舞的代表名场面：《泉水叮咚》。',
    category: 'peiqi',
  },
  {
    id: 'meme-hammer',
    act: 'act-ii',
    href: 'https://www.bilibili.com/video/BV1yg41167yr/',
    cover: 'https://i0.hdslb.com/bfs/archive/f52fb461ea561ee63e0822c9e59c321ab177faf3.jpg',
    date: '2022.08.17',
    kicker: '游戏梗',
    title: '抡大锤',
    body: '《谁不爱看锤呢》留下的受苦名场面。',
    category: 'game-meme',
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
  /** 故事模式归年（来自基线策展；后台实时文案不覆盖它，所以位置不会被改乱） */
  storyYear?: number
  storyEndYear?: number
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
  /** 首页「直播间梗」分类；null 表示不进入该模块。 */
  category?: MemeCategory | null
  gameWorld?: GameWorldFootnote
  tail?: string
  /** 蒙太奇幕的分类 chips */
  chips?: string[]
  /** 蒙太奇幕的构建期素材（首页 ACT II 专用） */
  montage?: { samples: MontageSample[]; stats: MontageStats }
  /** 栏目在当前档案中的逐年收录量；只用于展示活跃纹理，不声称是完整播出统计。 */
  activity?: YearActivity
}

export type YearActivity = {
  label: string
  unit: string
  points: { year: number; count: number }[]
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
  /** 首页直播间梗的栏目蒙太奇；只从已收录且有真实封面的条目派生。 */
  memeMontages: {
    xinlingPishuang: MontageSample[]
    minecraft: MontageSample[]
  }
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
  const xinlingCount = timeline.filter(isXinlingPishuangEntry).length
  const wukongCount = timeline.filter((e) => e.games.some((g) => g.id === 'black-myth-wukong')).length
  const geometryMinutes = timeline.filter((e) => e.title.includes('几何冲刺')).reduce((s, e) => s + (e.duration_min ?? 0), 0)
  return {
    geometryHours: Math.round(geometryMinutes / 60).toString(),
    xinlingCount: xinlingCount.toLocaleString(),
    wukongCount: wukongCount.toString(),
  }
}

/** 心灵砒霜活跃纹理：跟随当前档案自动增减，不把逐年期数写死在策展文案里。 */
function buildXinlingActivity(timeline: TimelineEntry[]): YearActivity {
  const counts = new Map<number, number>()
  for (const entry of timeline.filter(isXinlingPishuangEntry)) {
    const year = Number(entry.date.slice(0, 4))
    if (year) counts.set(year, (counts.get(year) ?? 0) + 1)
  }
  return {
    label: '心灵砒霜 · 活跃年份',
    unit: '期',
    points: [...counts].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year),
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
  const liveEntries = timeline.filter((e) => e.type === 'live')
  const liveKnownMinutes = liveEntries.reduce((sum, e) => sum + (e.duration_min ?? 0), 0)
  return {
    samples,
    stats: {
      xinling: timeline.filter(isXinlingPishuangEntry).length.toLocaleString(),
      hoursLabel: liveKnownMinutes ? Math.round(liveKnownMinutes / 60).toLocaleString() : '—',
      liveSessions: liveEntries.length.toLocaleString(),
    },
  }
}

/** 等距保留一个栏目横跨不同年份的真实封面，避免列表只挤在最近一年。 */
function buildMemeMontage(entries: TimelineEntry[], limit = 10): MontageSample[] {
  const covered = entries
    .filter((entry) => entry.cover)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  if (covered.length === 0) return []
  const indexes = covered.length <= limit
    ? covered.map((_, index) => index)
    : Array.from({ length: limit }, (_, index) => Math.round(index * (covered.length - 1) / (limit - 1)))
  return [...new Set(indexes)].flatMap((index) => {
    const entry = covered[index]
    const cover = proxyImage(entry.cover ?? undefined, 480)
    if (!cover) return []
    return [{
      id: entry.id,
      date: entry.date,
      title: entry.title,
      cover,
    }]
  })
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
        storyYear: b.storyYear,
        storyEndYear: b.storyEndYear,
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
      storyYear: b.storyYear,
      storyEndYear: b.storyEndYear,
      size: b.size,
      // 首页精简幕：重要锚点显示「重要」，非重要不带任何小标签（用户明确要求）。
      kicker: home ? (b.important ? '重要' : undefined) : b.kicker,
      title: b.title,
      body: b.body,
      href,
      external,
      cover: b.cover ? proxyImage(b.cover, b.size === 'hero' ? 900 : 640) : cover,
      emphasis: fillEmphasis(b.emphasis, vars),
      activity: b.activitySeries === 'xinling-pishuang' ? buildXinlingActivity(timeline) : undefined,
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
        category: h.category,
      },
    ]
  })

  return {
    acts: resolveActs(ds, timeline, HOMEPAGE_ACTS, true),
    highlights,
    emphasisVars: vars,
    memeMontages: {
      xinlingPishuang: buildMemeMontage(timeline.filter(isXinlingPishuangEntry)),
      minecraft: buildMemeMontage(timeline.filter((entry) => entry.games.some((game) => game.id === 'minecraft'))),
    },
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
