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

/** 站点维护者：显示在联系页「维护」那一栏，数组顺序就是页面上的先后顺序。 */
export type SiteMaintainer = {
  /** 稳定 ID，内容服务按它对齐；不显示给访客 */
  id: string
  /** 展示名 */
  name: string
  /** 一句话职责，空串表示不显示这一行 */
  role: string
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
  /** 联系页的维护者名单，可增删与排序 */
  maintainers: SiteMaintainer[]
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
    {
      id: 'contact',
      eyebrow: 'Contact & correction',
      title: '让这份索引更准确。',
      lede: '日期、标题、时长、链接、游戏标签——任何一处对不上都可以直接在下面告诉我。你手上有档案里缺的录像，也从这里说。所有线索都由我逐条核对后再改，不会自动生效。',
    },
    {
      // 建站的来龙去脉，第一人称。放在致谢区而不是页面最上面：这一段说的是
      // 「这份档案是怎么来的」，和下面的维护者、录播来源是同一件事的三个部分。
      // 换行 = 分段（见 LivePageIntro）。
      id: 'contact-credits',
      eyebrow: 'Credits · 谁把这些留了下来',
      title: '这份档案不是一个人攒出来的。',
      lede: [
        '最开始只是想帮忙收集一些老录播——尤其是那些不太好找的场次，然后一场一场打上具体的标签。这样想看录播的时候，直接搜游戏名就能找到当年那一场，不用在几十个合集里翻。',
        '一开始想做的其实就是个搜索引擎。后来想着来都来了，不如顺手把这些年的大事件也捋一捋，于是就动手做了。',
        '不过个人的能力很有限。15 到 20 年那几年我在念书，也算听六六的话，有好好在学习，所以直播看得不算太多——但砒霜是期期没落下的。所以站里的内容一定有缺、有错，这是实话。',
        '现在站里能用的几样东西：节目被拆开单独列了出来，喜欢封神、一起 See 或者心灵砒霜的，可以直接在节目单里找；新来的水友从首页一路往下滑，能看到我整理的一些关键节点，更全、更细的在编年史里；再往下是给新粉丝准备的梗百科。梗这一块我记得最牢的是砒霜，所以目前砒霜的梗最多，其他的想起来一个写一个。',
        '所以也想请大家搭把手：发现缺的、错的，或者哪个梗还没收进来，都可以在这个页面提交线索。慢慢把它补齐，新观众就能很快地知道女流是个什么样的人，这十几年她都做了些什么。',
      ].join('\n'),
    },
  ],
  // 目前只有一个人，就如实写一个人，不摆一排占位头像。
  maintainers: [{ id: 'maintainer-1', name: '哈密瓜逮捕可达鸭', role: '建站 · 数据整理 · 校对' }],
}

export function siteCopyBlock(blocks: SiteCopyBlock[], id: string): SiteCopyBlock {
  return blocks.find((block) => block.id === id) ?? { id, eyebrow: '', title: '', lede: '' }
}
