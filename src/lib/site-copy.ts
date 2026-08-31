/**
 * 站点文案基线（唯一真源在这里，不在组件里散着写）
 * ================================================
 * 这些是页面框架上的固定文案：站点标题、导航名、首屏、首页各区块小标与标题、
 * 四个房间、各子页页头。它们**不是史料**——史料在 `data/**`，叙事策展在 `narrative.ts`。
 *
 * 为什么单独抽出来：内容服务可以按下面这些稳定 ID 覆盖这里的每一条文案，
 * 前台运行时通过只读接口 `/api/content/site-copy` 拉取当前值。抽出来之后：
 * - 内容服务第一次初始化时，直接把这里的值导入为「网站当前文案」，不需要有人重新誊一遍；
 * - 接口挂了、超时了、结构不对，前台原样用这份基线渲染，页面不会空白。
 *
 * 改这里的任何一条，都要保持 id 不变——id 是内容服务与前台之间唯一的对齐键。
 */

export type SiteCopyBlock = {
  /** 稳定 ID，内容服务按它覆盖 */
  id: string
  /** 区块上方的小标（如 `Highlights · 高光`），空串表示不显示 */
  eyebrow: string
  /** 区块标题，空串表示不显示 */
  title: string
  /** 区块引子，空串表示不显示 */
  lede: string
}

export type SiteCopy = {
  version: 1
  site: { title: string; description: string }
  nav: { id: string; label: string }[]
  hero: {
    /** 状态胶囊里年份后面那半句（前面的「2010 — 今年」是派生的，不可改） */
    status: string
    eyebrow: string
    title: string
    /** 逐行，渲染时在行间断行 */
    body: string[]
    primaryAction: string
    secondaryAction: string
  }
  /** 首页各区块的小标 / 标题 / 引子 */
  homeSections: SiteCopyBlock[]
  /** 「四个房间」入口卡；href 与配色属于版式，不在后台可改范围内 */
  rooms: { id: string; kicker: string; title: string; body: string }[]
  /** 子页页头 */
  pages: SiteCopyBlock[]
}

export const SITE_COPY: SiteCopy = {
  version: 1,
  site: {
    title: '女流编年史',
    description: '2010 年至今的视频与直播索引。只收录链接，不搬运资源——每一次播放都回到原平台。',
  },
  nav: [
    { id: 'home', label: '首页' },
    { id: 'chronicle', label: '编年史' },
    { id: 'archive', label: '录播室' },
    { id: 'games', label: '游戏' },
    { id: 'series', label: '节目' },
    { id: 'stats', label: '数据' },
    { id: 'gallery', label: '画廊' },
    { id: 'contact', label: '联系我们' },
  ],
  hero: {
    status: '还在继续',
    eyebrow: '女流 66 · 石悦',
    title: '女流',
    body: ['{archiveYears}年的游戏、直播和那些晚上，', '重新连成一条路。'],
    primaryAction: '开始',
    secondaryAction: '关于女流',
  },
  homeSections: [
    {
      id: 'home-highlights',
      eyebrow: '直播间梗 · Live Memes',
      title: '一提起来，就知道在说什么。',
      lede: '那些从直播间里留下来、也一直被大家记得的名字、台词和名场面。',
    },
    { id: 'home-memory', eyebrow: 'Memory · 记忆盒', title: '回到过去，只需要一晚。', lede: '' },
    { id: 'home-games', eyebrow: 'Games · 玩过的游戏', title: '陪得最久的几款。', lede: '' },
    { id: 'home-rooms', eyebrow: 'Rooms · 四个房间', title: '', lede: '' },
  ],
  rooms: [
    { id: 'chronicle', kicker: 'Chronicle', title: '编年史', body: '走过的路，一条一条地看下去。逐条查记录，去录播室。' },
    { id: 'series', kicker: 'Series', title: '节目', body: '从心灵砒霜、一起 See，到更早的视频连载。' },
    { id: 'stats', kicker: 'Stats', title: '数据', body: '把这些年放到一起，看看数字会说什么。' },
    { id: 'gallery', kicker: 'Gallery', title: '影像档案', body: '从能讲故事的关键节点，到按年份铺开的完整影像，用两种尺度回看同一段历史。' },
  ],
  pages: [
    {
      id: 'series',
      eyebrow: 'Series · 节目',
      title: '反复出现，也各有自己的名字。',
      lede: '有些是持续多年的直播节目，有些是一段时期里的主题栏目，也有更早的视频连载。它们留下的不只是期数，还有每个时期固定会等到的内容。',
    },
    {
      id: 'stats',
      eyebrow: 'Stats · 数据里的发现',
      title: '这些数字背后，是被保存下来的时间。',
      lede: '这些数字都来自目前保存下来的记录。先看看发生了什么，再看看它们连起来是什么样。',
    },
    {
      id: 'gallery',
      eyebrow: 'Gallery · 影像档案',
      title: '直播间那些值得纪念的时刻。',
      lede: '纪念版只留下能讲故事的节点；全量版按年份铺开更多直播、活动与偶然入镜。同一场直播只取一张代表帧，但会收录尽可能多的不同直播与视频。',
    },
    { id: 'games', eyebrow: '', title: '她的游戏库', lede: '' },
  ],
}

export function siteCopyBlock(blocks: SiteCopyBlock[], id: string): SiteCopyBlock {
  return blocks.find((block) => block.id === id) ?? { id, eyebrow: '', title: '', lede: '' }
}
