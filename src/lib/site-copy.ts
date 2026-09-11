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

/**
 * 页面上的一句固定文字：按钮、引导句、空状态、说明段落……
 *
 * 和区块（SiteCopyBlock）不同，这里一条就是一句话，所以什么形状的文字都能收进来。
 * `group` / `label` 只给后台列表用（它在哪一页、是哪一句），前台只认 `id` 和 `text`。
 * `vars` 列出这句话能用的占位符，比如 `{count}`：数字由页面算出来填进去，写文案的人只管措辞；
 * 把占位符删掉也可以，那句话就不带那个数字。换行 = 分段（只对标明「多段」的条目生效）。
 *
 * id 的前缀决定它随哪些页面一起烤进 HTML（见 `lib/baked-content.ts`）：
 * `site-` 是每一页都会渲染的（页脚、404……），其余按页面分：`home-`、`stats-`、`gallery-`……
 */
export type SiteText = {
  /** 稳定 ID，内容服务按它覆盖 */
  id: string
  /** 在哪一页、哪一块（后台按它分组） */
  group: string
  /** 这是哪一句（后台显示在输入框上方） */
  label: string
  /** 这句话里可以用的占位符名，不带花括号 */
  vars?: string[]
  text: string
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
  /** 各页面上的固定文字（一条一句）；有谁、在哪由这份基线决定，后台只改文字 */
  texts: SiteText[]
}

export const SITE_COPY: SiteCopy = {
  version: 1,
  site: {
    title: '女流编年史',
    description: '2010 年至今的视频与直播索引。',
  },
  nav: [
    {
      id: 'home',
      label: '首页',
    },
    {
      id: 'chronicle',
      label: '编年史',
    },
    {
      id: 'games',
      label: '游戏厅',
    },
    {
      id: 'series',
      label: '节目单',
    },
    {
      id: 'stats',
      label: '数据',
    },
    {
      id: 'gallery',
      label: '纪念画廊',
    },
    {
      id: 'contact',
      label: '联系我们',
    },
    {
      id: 'archive',
      label: '录播室',
    },
  ],
  hero: {
    status: '还在继续',
    eyebrow: ' ',
    title: '女流',
    body: [
      '女流，本名石悦。2010 年开始上传游戏解说视频，2015 年起进入直播，从石悦到女流再到66，游戏、分享和直播间里的故事，一直延续至今。',
    ],
    primaryAction: '开始',
    secondaryAction: '关于她',
  },
  homeSections: [
    {
      id: 'home-highlights',
      eyebrow: '直播间梗 · Live Memes',
      title: '一提起来，就知道在说什么。',
      lede: '那些从直播间里留下来、也一直被大家记得的名字、台词和名场面。',
    },
    {
      id: 'home-memory',
      eyebrow: 'Memory · 记忆盒',
      title: '回到过去，只需要一晚。',
      lede: '抽个卡吧！',
    },
    {
      id: 'home-games',
      eyebrow: 'Games · 玩过的游戏',
      title: '陪得最久的几款。',
      lede: '这里只索引场次最多的，所以开黑游戏会比较多一些',
    },
    {
      id: 'home-rooms',
      eyebrow: 'Rooms · 四个房间',
      title: '',
      lede: '',
    },
    // 首页尾声「三段日子」：三幕分布条上方的小标与标题。
    {
      id: 'home-stats',
      eyebrow: 'Eras · 三段日子',
      title: '一路走下来，其实是三段不一样的日子。',
      lede: '',
    },
  ],
  /**
   * 「有谁、谁在前面」由这份基线决定——`mergeSiteCopy` 是按 id 覆盖字段，
   * 加一个房间、去一个房间都要改这里，改后台改不动（见 LiveContentProvider）。
   */
  rooms: [
    {
      id: 'chronicle',
      kicker: 'Chronicle',
      title: '编年史',
      body: '走过的路，一条一条。',
    },
    {
      id: 'games',
      kicker: 'Games',
      title: '游戏厅',
      body: '她玩过的每一款游戏。第一次是哪天，后来又回来过几次。',
    },
    {
      id: 'stats',
      kicker: 'Stats',
      title: '数据',
      body: '哪一年留下的最多，哪款游戏陪得最久，水友们最爱点开哪一场。',
    },
    {
      id: 'gallery',
      kicker: 'Gallery',
      title: '纪念画廊',
      body: '从屏风时代到现在，直播间里那些值得纪念的画面。',
    },
  ],
  pages: [
    // —— 数据页的八个提问 ——
    // 这些原本硬编码在 src/app/stats/page.tsx 里，改一个字要改代码、发一次版。
    // 收进这里之后就和其他页头文案同一条路：后台可改、保存即生效。
    // title 是页面上那一行提问；lede 留空（数据页每节自带图注，不需要引子）。
    { id: 'stats-q-recorded', eyebrow: '', title: '已收录直播有多少？', lede: '' },
    { id: 'stats-q-busiest-year', eyebrow: '', title: '哪一年留下的记录最多？', lede: '' },
    { id: 'stats-q-longest-games', eyebrow: '', title: '哪些游戏陪得最久？', lede: '' },
    { id: 'stats-q-returning-games', eyebrow: '', title: '哪些游戏，隔了几年还会回来？', lede: '' },
    { id: 'stats-q-eras', eyebrow: '', title: '时代如何变化？', lede: '' },
    { id: 'stats-q-longest-series', eyebrow: '', title: '哪些节目坚持得最久？', lede: '' },
    { id: 'stats-q-popular', eyebrow: '', title: '水友们最爱点开哪些记录？', lede: '' },
    // 新 id：`import-snapshot` 是 append-only，新增的会被自动采纳，不需要像 034 那样走迁移。
    { id: 'stats-q-trail', eyebrow: '', title: '你自己翻过哪些？', lede: '' },
    { id: 'stats-q-gaps', eyebrow: '', title: '档案还有多少空白？', lede: '' },
    {
      id: 'series',
      eyebrow: 'Series · 节目单',
      title: '反复出现，也各有自己的名字。',
      lede: '有些是持续多年的直播节目，有些是一段时期里的主题栏目，也有更早的视频连载。它们留下的不只是期数，还有每个时期固定会等到的内容。',
    },
    // —— 节目详情页（/series/<id>/）上的固定文字 ——
    // 每个节目自己的名字与简介是史料，在 `data/series.yaml`（后台「目录维护 · 节目 / 系列」）里改；
    // 下面这些是那一页的版式文字，原本硬编码在 `src/app/series/[id]/page.tsx`
    // 和 `SeriesEpisodes` 里，改一个字要改代码、发一次版。收进来之后和数据页那八个提问
    // 走同一条路：后台可改、保存即生效。
    // 分类小标三选一，按节目的 category 取；只用 title 字段。
    { id: 'series-detail-kind-live', eyebrow: '', title: '长期直播节目', lede: '' },
    { id: 'series-detail-kind-themed', eyebrow: '', title: '主题栏目', lede: '' },
    { id: 'series-detail-kind-video', eyebrow: '', title: '视频系列', lede: '' },
    { id: 'series-detail-years', eyebrow: '活跃年份', title: '', lede: '' },
    { id: 'series-detail-episodes', eyebrow: 'Episodes · 全部记录', title: '', lede: '' },
    // 期数列表上方那行提示。按整场直播归档的节目（一起See）量词是「场」，
    // 两句话分别可改，不做占位符替换——占位符是给程序看的，不是给写文案的人看的。
    { id: 'series-detail-episodes-hint', eyebrow: '', title: '', lede: '点击期数展开原平台来源、分段和标签信息' },
    { id: 'series-detail-sessions-hint', eyebrow: '', title: '', lede: '点击记录展开原平台来源、分段和标签信息' },
    {
      id: 'series-detail-together-see',
      eyebrow: '',
      title: '',
      lede: '这里按整场直播归档；一起 See 有时只是其中一个环节，所以条目仍保留当晚直播的原始标题。展开后可以查看已保存的分段信息。',
    },
    {
      id: 'stats',
      eyebrow: 'Stats · 数据里的发现',
      title: '这些数字背后，是被保存下来的时间。',
      lede: '每一节只回答一个问题。数字全部来自档案本身的逐条记录——先有数据，后有观察。',
    },
    {
      id: 'gallery',
      eyebrow: 'Gallery · 影像档案',
      title: '直播间那些值得纪念的时刻。',
      lede: '纪念版只留下能讲故事的节点；全量版按年份铺开更多直播、活动与偶然入镜。同一场直播只取一张代表帧，但会收录尽可能多的不同直播与视频。',
    },
    {
      id: 'games',
      eyebrow: '',
      title: '她的游戏库',
      lede: '',
    },
    {
      id: 'contact',
      eyebrow: 'Contact & correction',
      title: '缺的、错的，都可以在这儿说一声。',
      lede: '这份档案不是一个人翻出来的。你想起一场没被收录的直播，发现哪一处对不上，或者手里存着一张老图——都可以从下面挑一件告诉我。所有线索都由我逐条核对后再改，不会自动生效。',
    },
    // 建站的来龙去脉，第一人称。放在致谢区而不是页面最上面：这一段说的是
    // 「这份档案是怎么来的」，和下面的维护者、录播来源是同一件事的三个部分。
    // 换行 = 分段（见 LivePageIntro）。
    {
      id: 'contact-credits',
      eyebrow: 'Memory · 关于本站',
      title: '属于66和i6们的回忆',
      lede: '最开始只是想帮忙收集一些老录播——尤其是那些不太好找的场次，然后一场一场打上具体的标签。这样想看录播的时候，直接搜游戏名就能找到当年那一场，这样大家就不用在老录播里一个个翻日期（来源比较散，命名比较不好找，有的只有日期就需要人工来核对）。\n就这样，大概的雏形就有了。后来想着来都来了，不如顺手把这些年发生的大伙儿印象深刻的事情也给捋一捋，于是就动手做了。\n不过个人的能力很有限，好多东西没嘛印象了，而且 15-20 年那几年我在念书，也算听姐姐的话，有好好在学习，所以直播看得不算太多，不过中后期的砒霜应该没落下太多（感恩66劝学，感恩心灵砒霜）。所以站里的内容一定有缺、有错，这是实话。\n现在站里能用的几样东西：节目被拆开单独列了出来，喜欢和主播一起 See 的、喜欢心灵砒霜的、喜欢看主播户外的，都可以直接在节目单里找；新来的水友从首页一路往下滑，能看到我整理的一些关键节点，更全、更细的在编年史里；再往下是给新粉丝准备的梗百科。梗这一块我记得最牢的是砒霜，所以目前砒霜的梗最多，其他的想起来一个写一个。\n所以也想请大家搭把手：发现缺的、错的，或者哪个梗还没收进来，都可以在这个页面提交线索。慢慢把它补齐，新观众就能很快地加入我们，知道她是个什么样的人，这十几年她都做了些什么。（感恩Ai，没有Ai就没有这个站哇咔咔）',
    },
  ],
  // 目前只有一个人，就如实写一个人，不摆一排占位头像。
  maintainers: [
    {
      id: 'maintainer-1',
      name: '哈密瓜逮捕可达鸭',
      role: '建站 · 数据整理 · 校对',
    },
  ],
  // —— 各页面上的固定文字（一条一句）——
  // group 是后台列表里的分组，label 说明是哪一句；带 vars 的句子里，`{名字}` 由页面填数字。
  texts: [
    { id: 'site-footer-disclaimer', group: '全站 · 页脚', label: '免责声明（第一行）', text: '粉丝自建的非官方档案，与女流本人及其所属机构无关 · 只索引，不搬运，所有播放回到原平台' },
    { id: 'site-footer-takedown', group: '全站 · 页脚', label: '免责声明（第二行）', text: '如本人或版权方希望调整任何内容，请从这里联系，会尽快处理。' },
    { id: 'site-footer-contact', group: '全站 · 页脚', label: '右侧链接', text: '资料纠错与联系 →' },
    { id: 'site-404-title', group: '全站 · 404 页', label: '标题', text: '这个地址下面没有东西。' },
    { id: 'site-404-body', group: '全站 · 404 页', label: '说明', text: '可能是链接写错了，也可能是这条记录还没有被收录。从录播室按年份和月份翻找通常最快。' },
    { id: 'site-404-archive', group: '全站 · 404 页', label: '主按钮', text: '去录播室找 →' },
    { id: 'site-404-home', group: '全站 · 404 页', label: '次按钮', text: '回首页' },
    { id: 'site-live-eyebrow', group: '全站 · 直播状态浮窗', label: '小标', text: 'Live monitor · 本站观测' },
    { id: 'site-live-title-live', group: '全站 · 直播状态浮窗', label: '正在直播（拿不到直播间标题时）', text: '她现在正在直播。' },
    { id: 'site-live-title-offline', group: '全站 · 直播状态浮窗', label: '没开播', text: '现在没有开播。' },
    { id: 'site-live-title-stale', group: '全站 · 直播状态浮窗', label: '状态过期', text: '直播状态需要重新确认。' },
    { id: 'site-live-title-unavailable', group: '全站 · 直播状态浮窗', label: '拿不到状态', text: '直播状态暂时不可用。' },
    { id: 'site-live-offline-last', group: '全站 · 直播状态浮窗', label: '没开播 · 上次下播', vars: ['time'], text: '上次下播于 {time}' },
    { id: 'site-live-offline-waiting', group: '全站 · 直播状态浮窗', label: '没开播 · 还没有下播记录', text: '等待下一次开播记录。' },
    { id: 'site-live-stale-checked', group: '全站 · 直播状态浮窗', label: '状态过期 · 上次检查', vars: ['time'], text: '最近一次成功检查在 {time}' },
    { id: 'site-live-unavailable-waiting', group: '全站 · 直播状态浮窗', label: '拿不到状态 · 说明', text: '正在等待本站取得新的观测结果。' },
    { id: 'site-live-last-title', group: '全站 · 直播状态浮窗', label: '没开播 · 最近一场', vars: ['title'], text: '最近一场：{title}' },
    { id: 'site-live-home', group: '全站 · 直播状态浮窗', label: '按钮 · 回首页', text: '回到首页' },
    { id: 'site-live-room', group: '全站 · 直播状态浮窗', label: '按钮 · 正在直播时', text: '去直播间看看' },
    { id: 'site-live-room-confirm', group: '全站 · 直播状态浮窗', label: '按钮 · 状态不确定时', text: '去直播间自行确认' },
    { id: 'site-live-note-unknown', group: '全站 · 直播状态浮窗', label: '底部说明 · 状态不确定时', text: '当前状态不可确认，因此这里不会把旧结果显示成「正在直播」或「未开播」。' },
    { id: 'site-live-note-known', group: '全站 · 直播状态浮窗', label: '底部说明 · 平时', text: '现在在不在播来自本站定时观测，可能与平台实际时间相差一个检查周期。' },
    { id: 'site-live-note-windows', group: '全站 · 直播状态浮窗', label: '底部说明 · 最近 7 / 30 天的口径', text: '最近 7 / 30 天按站内档案已收录的场次统计；档案还没跟上的那几天，用观测补齐。' },
    { id: 'site-live-note-partial', group: '全站 · 直播状态浮窗', label: '底部说明 · 观测期不满时', vars: ['date'], text: '这段时间还没有档案支撑，只统计了 {date} 开始观测到的部分。' },
    { id: 'site-live-note-checked', group: '全站 · 直播状态浮窗', label: '底部说明 · 最近检查', vars: ['time'], text: '最近检查：{time}。' },
    { id: 'home-search-link', group: '首页 · 顶部', label: '右上角链接', text: '搜一场你记得的 →' },
    { id: 'home-highlights-pishuang-title', group: '首页 · 直播间梗', label: '心灵砒霜分类 · 系列卡标题', text: '那些星期日，心灵砒霜准时开场' },
    { id: 'home-highlights-pishuang-desc', group: '首页 · 直播间梗', label: '心灵砒霜分类 · 系列卡说明', text: '从早期节目到后来留下的名场面，沿着档案里的真实录像往回看。' },
    { id: 'home-highlights-pishuang-link', group: '首页 · 直播间梗', label: '心灵砒霜分类 · 系列卡链接', text: '查看心灵砒霜系列' },
    { id: 'home-highlights-minecraft-title', group: '首页 · 直播间梗', label: '游戏梗分类 · 系列卡标题', text: '《我的世界》里的大周记忆' },
    { id: 'home-highlights-minecraft-desc', group: '首页 · 直播间梗', label: '游戏梗分类 · 系列卡说明', text: '大周从这里长出来。看看这个系列里保存下来的直播与视频。' },
    { id: 'home-highlights-minecraft-link', group: '首页 · 直播间梗', label: '游戏梗分类 · 系列卡链接', text: '进入我的世界系列' },
    { id: 'home-highlights-play', group: '首页 · 直播间梗', label: '展开后的播放按钮', text: '打开播放' },
    { id: 'home-highlights-invite-title', group: '首页 · 直播间梗', label: '梗墙末尾 · 邀请标题', text: '你记得的梗，这里还没有？' },
    { id: 'home-highlights-invite-body', group: '首页 · 直播间梗', label: '梗墙末尾 · 邀请说明', text: '这一整面墙是靠大家一起想起来的。记得是哪场、几分几秒最好，只记得个大概也可以先说一声。' },
    { id: 'home-meme-open', group: '首页 · 投稿一个梗', label: '展开按钮', text: '说一个' },
    { id: 'home-meme-name-label', group: '首页 · 投稿一个梗', label: '称呼 · 标签', text: '怎么称呼你' },
    { id: 'home-meme-name-placeholder', group: '首页 · 投稿一个梗', label: '称呼 · 占位提示', text: '留个 ID 就行' },
    { id: 'home-meme-body-label', group: '首页 · 投稿一个梗', label: '正文 · 标签', text: '说说这个梗' },
    { id: 'home-meme-body-placeholder', group: '首页 · 投稿一个梗', label: '正文 · 占位提示', text: '简单说明一下这个梗/名场面是什么。如果知道是哪场直播、几分几秒，写出来最好——越精确越容易核实，比如「2024-05-01 直播，1:23:45 左右」。' },
    { id: 'home-meme-success', group: '首页 · 投稿一个梗', label: '提交成功', text: '收到，谢谢。我会看看能不能收进直播间梗里。' },
    { id: 'home-meme-disabled', group: '首页 · 投稿一个梗', label: '投稿关闭时', text: '投稿功能暂未开放。' },
    { id: 'home-meme-submit', group: '首页 · 投稿一个梗', label: '提交按钮', text: '提交' },
    { id: 'home-meme-again', group: '首页 · 投稿一个梗', label: '提交后再来一条', text: '再投一个' },
    { id: 'home-random-eyebrow', group: '首页 · 记忆盒', label: '随机记忆 · 小标', text: 'Random · 随机记忆' },
    { id: 'home-random-title', group: '首页 · 记忆盒', label: '随机记忆 · 标题', text: '随便回到一个晚上。' },
    { id: 'home-random-body', group: '首页 · 记忆盒', label: '随机记忆 · 说明', vars: ['total'], text: '档案里有 {total} 个「值得回去」的晚上——有画面、有游戏、有栏目。抽一个，回去看看那天发生了什么。' },
    { id: 'home-random-action', group: '首页 · 记忆盒', label: '随机记忆 · 按钮', text: '回到一个晚上' },
    { id: 'home-random-open', group: '首页 · 记忆盒', label: '随机记忆 · 抽中后的链接', text: '打开这一晚 →' },
    { id: 'home-today-eyebrow', group: '首页 · 记忆盒', label: '历史上的今天 · 小标', text: 'Today in history' },
    { id: 'home-today-title', group: '首页 · 记忆盒', label: '历史上的今天 · 标题', vars: ['year'], text: '这一天，最早能回到 {year} 年。' },
    { id: 'home-today-empty', group: '首页 · 记忆盒', label: '历史上的今天 · 这一天没有记录时', text: '这一天，档案里暂时没有记录。' },
    { id: 'home-games-all', group: '首页 · 玩过的游戏', label: '右侧链接', text: '全部游戏 →' },
    { id: 'home-outro-eyebrow', group: '首页 · 故事最后一页', label: '小标', text: 'NEXT · 接着往下看' },
    { id: 'home-outro-chronicle-kicker', group: '首页 · 故事最后一页', label: '编年史卡 · 小标', text: 'Chronicle · 编年史' },
    { id: 'home-outro-chronicle-title', group: '首页 · 故事最后一页', label: '编年史卡 · 标题', text: '一条一条地看下去。' },
    { id: 'home-outro-chronicle-body', group: '首页 · 故事最后一页', label: '编年史卡 · 说明', text: '从第一支视频到最近一场，一年一年排好在那儿。' },
    { id: 'home-outro-chronicle-cta', group: '首页 · 故事最后一页', label: '编年史卡 · 链接', text: '打开编年史 →' },
    { id: 'home-outro-gallery-kicker', group: '首页 · 故事最后一页', label: '画廊卡 · 小标', text: 'Gallery · 画廊' },
    { id: 'home-outro-gallery-title', group: '首页 · 故事最后一页', label: '画廊卡 · 标题', text: '把这些年，一张张摊开。' },
    { id: 'home-outro-gallery-body', group: '首页 · 故事最后一页', label: '画廊卡 · 说明', vars: ['span'], text: '屏风时代到现在，直播间里那些值得纪念的画面，跨 {span}。' },
    { id: 'home-outro-gallery-cta', group: '首页 · 故事最后一页', label: '画廊卡 · 链接', text: '进入画廊 →' },
    { id: 'home-stats-gap', group: '首页 · 三段日子', label: '缺口年份那一句', vars: ['years'], text: '{years} 年在档案里是留白——缺口不是错误，是还没有被找回来的部分。' },
    { id: 'home-stats-archive', group: '首页 · 三段日子', label: '底部按钮', text: '去录播室，找你记得的那一天' },
    { id: 'trail-resume', group: '足迹', label: '「接着上次」浮条的小标', text: '接着上次' },
    { id: 'trail-empty', group: '足迹', label: '数据页 · 还没翻过任何一条时', text: '你还没在这个站点开过什么。随便翻一条，这里就会记下来——只记在你自己的浏览器里。' },
    { id: 'trail-summary', group: '足迹', label: '数据页 · 翻过多少条', vars: ['count'], text: '你在这个站点开过 {count} 条' },
    { id: 'trail-summary-watched', group: '足迹', label: '数据页 · 其中点开看过多少（接在上一句后面）', vars: ['count'], text: '，其中 {count} 条真的点开去看了' },
    { id: 'trail-summary-earliest', group: '足迹', label: '数据页 · 最早一条（接在上一句后面）', vars: ['year'], text: '；最早的一条是 {year} 年那场' },
    { id: 'trail-privacy', group: '足迹', label: '数据页 · 隐私说明', text: '这些只存在你这台设备的浏览器里，不会上传，我也看不到。换个设备或者清了浏览器数据就没了。' },
    { id: 'stats-archive-link', group: '数据页', label: '右上角链接', text: '去录播室逐条查看 →' },
    { id: 'stats-observation-label', group: '数据页', label: '每节末尾「观察」的小标', text: '观察 ·' },
    { id: 'stats-popular-legend', group: '数据页', label: '水友们最爱点开 · 图例说明', text: '站内点开一次算一次，从建站起一路累计到现在 · 同一个人反复点开会重复计入，所以这是「被点开的次数」，不是「多少人看过」' },
    { id: 'stats-popular-empty', group: '数据页', label: '水友们最爱点开 · 还没有点击时', text: '还没有累计到点击。等有人在站内点开条目、游戏、节目或照片之后，这里会按次数排出前十。' },
    { id: 'stats-busiest-summary', group: '数据页', label: '哪一年最多 · 观察', vars: ['year', 'count'], text: '最多的一年是 {year} 年，留下了 {count} 条记录。' },
    { id: 'stats-busiest-gaps', group: '数据页', label: '哪一年最多 · 观察（有空白年份时接在后面）', vars: ['years'], text: '{years} 年目前没有保存下来的站内录像。' },
    { id: 'stats-busiest-full', group: '数据页', label: '哪一年最多 · 观察（每年都有记录时接在后面）', text: '档案覆盖到的每一年都至少留下了一条记录。' },
    { id: 'stats-longest-summary', group: '数据页', label: '陪得最久的游戏 · 观察', vars: ['name', 'hours'], text: '陪伴最久的游戏是「{name}」，已录 {hours}。' },
    { id: 'stats-eras-chart-title', group: '数据页', label: '时代变化 · 柱状图标题', text: '一年一根柱子，颜色就是当时的主场' },
    { id: 'stats-eras-summary', group: '数据页', label: '时代变化 · 观察', vars: ['douyuLast', 'douyinFirst'], text: '视频时期靠录像，斗鱼时期靠直播。斗鱼最后一场停在 {douyuLast}，抖音第一场是 {douyinFirst}；' },
    { id: 'stats-eras-interim', group: '数据页', label: '时代变化 · 观察（过渡期有 B 站场次时接在后面）', vars: ['count'], text: '中间隔了大半年，但那段时间并不是空的——档案里还留着 {count} 场 B 站的夜话和话疗。' },
    { id: 'stats-eras-interim-none', group: '数据页', label: '时代变化 · 观察（过渡期没有记录时接在后面）', text: '中间隔了大半年。' },
    { id: 'stats-gaps-legend', group: '数据页', label: '档案空白 · 图例说明', text: '一格一个月 · 亮起来＝档案里有记录，空格＝还没有找到任何录像。空格不代表那个月没播。' },
    { id: 'stats-gaps-ask', group: '数据页', label: '档案空白 · 观察（{link} 是下一条的链接）', vars: ['link'], text: '手上有对应时间的录播、切片或者原视频链接，可以从{link}告诉我，这张图就会少一块空白。' },
    { id: 'stats-gaps-ask-link', group: '数据页', label: '档案空白 · 观察里的链接文字', text: '联系页' },
    { id: 'stats-coverage-blank-label', group: '数据页 · 档案空白图', label: '左格 · 小标', text: '空白月份' },
    { id: 'stats-coverage-blank-unit', group: '数据页 · 档案空白图', label: '左格 · 数字后面', text: '个月没有任何记录' },
    { id: 'stats-coverage-explained-label', group: '数据页 · 档案空白图', label: '右格 · 小标', text: '已经查清原因' },
    { id: 'stats-coverage-explained-unit', group: '数据页 · 档案空白图', label: '右格 · 数字后面', vars: ['pending'], text: '个有说明 · {pending} 个待查' },
    { id: 'stats-coverage-grid-title', group: '数据页 · 档案空白图', label: '展开后的标题', vars: ['from', 'to'], text: '{from} — {to}，一格一个月' },
    { id: 'stats-coverage-legend-less', group: '数据页 · 档案空白图', label: '图例 · 少', text: '少' },
    { id: 'stats-coverage-legend-more', group: '数据页 · 档案空白图', label: '图例 · 多', text: '多' },
    { id: 'stats-coverage-legend-blank', group: '数据页 · 档案空白图', label: '图例 · 空白待查', text: '空白待查' },
    { id: 'stats-coverage-legend-known', group: '数据页 · 档案空白图', label: '图例 · 空白已知原因', text: '空白已知原因' },
    { id: 'stats-coverage-legend-color', group: '数据页 · 档案空白图', label: '图例 · 颜色说明', text: '颜色＝当时的平台时期' },
    { id: 'stats-coverage-missing-lead', group: '数据页 · 档案空白图', label: '另外还缺 · 开头', text: '另外还缺：' },
    { id: 'stats-coverage-missing-duration', group: '数据页 · 档案空白图', label: '另外还缺 · 没有时长', vars: ['count'], text: '{count} 条没有可核对时长' },
    { id: 'stats-coverage-missing-dead', group: '数据页 · 档案空白图', label: '另外还缺 · 来源全失效', vars: ['count'], text: '{count} 条来源已全部失效' },
    { id: 'stats-coverage-missing-nosource', group: '数据页 · 档案空白图', label: '另外还缺 · 没有来源', vars: ['count'], text: '{count} 条没有来源链接' },
    { id: 'stats-coverage-notes-title', group: '数据页 · 档案空白图', label: '缺口说明 · 标题', text: '这些空白是怎么回事' },
    { id: 'stats-coverage-notes-sub', group: '数据页 · 档案空白图', label: '缺口说明 · 右侧小字', text: '事实与推测分开写' },
    { id: 'stats-coverage-badge-gap', group: '数据页 · 档案空白图', label: '缺口说明 · 「还在找」标签', text: '还在找' },
    { id: 'stats-coverage-badge-known', group: '数据页 · 档案空白图', label: '缺口说明 · 「已知原因」标签', text: '已知原因' },
    { id: 'stats-coverage-guess-toggle', group: '数据页 · 档案空白图', label: '缺口说明 · 展开推测的按钮', text: '推测与所需证据' },
    { id: 'stats-coverage-guess-label', group: '数据页 · 档案空白图', label: '缺口说明 · 「推测」小标', text: '推测 ·' },
    { id: 'stats-coverage-wanted', group: '数据页 · 档案空白图', label: '缺口说明 · 所需证据', vars: ['wanted'], text: '最有用的证据：{wanted}' },
    { id: 'stats-coverage-worst-title', group: '数据页 · 档案空白图', label: '空得最多的年份 · 标题', text: '空得最多的年份' },
    { id: 'stats-coverage-hover-hint', group: '数据页 · 档案空白图', label: '悬停读数 · 还没指到格子时', text: '移到格子上看这个月的数字' },
    { id: 'gallery-chronicle-link', group: '画廊', label: '右上角链接', text: '去编年史 →' },
    { id: 'gallery-summary', group: '画廊', label: '页头下方的一句', vars: ['featured', 'all', 'from', 'to'], text: '{featured} 张纪念节点，{all} 张全量影像，跨 {from}–{to} 年。' },
    { id: 'gallery-tab-featured', group: '画廊', label: '切换 · 纪念版', vars: ['count'], text: '纪念版 · {count}' },
    { id: 'gallery-tab-all', group: '画廊', label: '切换 · 全量版', vars: ['count'], text: '全量版 · {count}' },
    { id: 'gallery-search-placeholder', group: '画廊', label: '搜索框里的提示', vars: ['count'], text: '搜索标题、日期或备注 · 共 {count} 张' },
    { id: 'gallery-random', group: '画廊', label: '随机按钮', text: '随便翻一张 ↯' },
    { id: 'gallery-year-undated', group: '画廊', label: '年份还没核实的那一组', text: '还没核实出拍摄年份' },
    { id: 'gallery-year-link', group: '画廊', label: '每一年右侧的链接', text: '这一年的编年史 →' },
    { id: 'gallery-empty', group: '画廊', label: '筛不出结果时', text: '没有符合的画面。' },
    { id: 'gallery-untitled', group: '画廊', label: '照片还没有标题时', text: '标题待命名' },
    { id: 'gallery-source-link', group: '画廊', label: '打开照片来源的链接', text: '查看公开来源' },
    { id: 'gallery-wanted-title', group: '画廊', label: '底部征集 · 标题', text: '还在找这些' },
    { id: 'gallery-wanted-body', group: '画廊', label: '底部征集 · 正文（一行一段）', text: '这些年留下过很多周年贺图、生日作品、水友创作和直播间里的纪念画面。其中一些如今只剩预览图、转发记录，或者已经失效的原始链接。\n如果你手里还保存着这些年的周年图片、各部祝福、生日作品、老截图，或者知道它们最早的出处，欢迎把线索发给我。' },
    { id: 'gallery-wanted-note', group: '画廊', label: '底部征集 · 强调的一句', text: '如果能同时提供年份、作者、原图或原始链接，会特别有帮助。' },
    { id: 'gallery-wanted-cta', group: '画廊', label: '底部征集 · 链接', text: '提供线索 →' },
    { id: 'games-archive-link', group: '游戏厅', label: '右上角链接', text: '去录播室搜一场 →' },
    { id: 'games-summary', group: '游戏厅', label: '页头下方 · 一共多少游戏', vars: ['count'], text: '{count} 个游戏。' },
    { id: 'games-summary-longest', group: '游戏厅', label: '页头下方 · 跨度最长的一款（接在上一句后面）', vars: ['name', 'from', 'to', 'days'], text: '跨得最长的是《{name}》，从 {from} 到 {to}，{days} 天。' },
    { id: 'games-search-placeholder', group: '游戏厅', label: '搜索框里的提示', text: '搜索游戏名或别名…' },
    { id: 'games-search-empty', group: '游戏厅', label: '搜不到时', vars: ['q'], text: '没有匹配「{q}」的游戏。' },
    { id: 'game-back', group: '游戏详情页', label: '右上角返回链接', text: '← 游戏收藏架' },
    { id: 'game-eyebrow', group: '游戏详情页', label: '标题上方的小标', vars: ['name'], text: '{name} · 游戏收藏架' },
    { id: 'game-question', group: '游戏详情页', label: '大标题', text: '这款游戏和女流之间，发生过什么？' },
    { id: 'game-summary', group: '游戏详情页', label: '标题下方的一句（没写专属介绍时）', vars: ['first', 'last', 'sessions', 'hours'], text: '从 {first} 到 {last}，档案里记下了 {sessions} 场，加起来 {hours}。' },
    { id: 'game-summary-empty', group: '游戏详情页', label: '还没有标记过场次时', vars: ['name'], text: '档案里还没有标记过《{name}》的场次。' },
    { id: 'game-single-summary', group: '游戏详情页', label: '只有一场时 · 标题下方的一句', vars: ['date', 'hours'], text: '只留下一个晚上。{date}，{hours}。' },
    { id: 'game-single-note', group: '游戏详情页', label: '只有一场时 · 右侧说明', text: '首次就是最后一场——档案里只此一次。' },
    { id: 'game-clip-link', group: '游戏详情页', label: '封面角标（手机上）', text: '观看切片' },
    { id: 'game-together-title', group: '游戏详情页', label: '数据区 · 小标', text: '一起走过的时间' },
    { id: 'game-stat-hours', group: '游戏详情页', label: '数据区 · 总时间', text: '总时间' },
    { id: 'game-stat-sessions', group: '游戏详情页', label: '数据区 · 场次', text: '场次' },
    { id: 'game-stat-first', group: '游戏详情页', label: '数据区 · 首次', text: '首次' },
    { id: 'game-stat-last', group: '游戏详情页', label: '数据区 · 最后', text: '最后' },
    { id: 'game-years-title', group: '游戏详情页', label: '数据区 · 年份分布的小标', text: '年份分布 · 点某一年只看那一年' },
    { id: 'game-sessions-eyebrow', group: '游戏详情页', label: '场次列表 · 小标', text: 'Sessions · 这些晚上' },
    { id: 'game-sessions-title', group: '游戏详情页', label: '场次列表 · 标题', text: '档案里的相关场次' },
    { id: 'game-chronicle-cta', group: '游戏详情页', label: '场次列表下方的按钮', text: '在编年史里查看全部相关记录' },
    { id: 'series-archive-link', group: '节目单', label: '右上角链接', text: '在录播室搜索全部记录 →' },
    { id: 'series-pishuang-eyebrow', group: '节目单 · 心灵砒霜特写', label: '小标', text: '周日情感电台 · 斗鱼时期 · 心灵砒霜' },
    { id: 'series-pishuang-title', group: '节目单 · 心灵砒霜特写', label: '大标题', text: '心灵砒霜' },
    { id: 'series-pishuang-span', group: '节目单 · 心灵砒霜特写', label: '年份旁的跨度', vars: ['years'], text: '横跨 {years} 年' },
    { id: 'series-pishuang-first', group: '节目单 · 心灵砒霜特写', label: '右侧引语 · 第一期', vars: ['title'], text: '第一期是「{title}」。' },
    { id: 'series-pishuang-body', group: '节目单 · 心灵砒霜特写', label: '右侧正文', vars: ['count'], text: '游戏暂停，邮件打开，一个星期日。后来，它陆续留下了 {count} 期——有的很长，有的很短，很多个星期日，直播间都会等到这档节目。' },
    { id: 'series-pishuang-cta', group: '节目单 · 心灵砒霜特写', label: '按钮', vars: ['count'], text: '打开心灵砒霜的全部 {count} 期' },
    { id: 'series-group-themed-label', group: '节目单', label: '主题栏目 · 分组名', text: '主题栏目' },
    { id: 'series-group-themed-desc', group: '节目单', label: '主题栏目 · 分组说明', text: '围绕一个故事、玩法或共同主题，在一段时间里连续出现。' },
    { id: 'series-group-video-label', group: '节目单', label: '视频系列 · 分组名', text: '视频系列' },
    { id: 'series-group-video-desc', group: '节目单', label: '视频系列 · 分组说明', text: '直播之前留下的连载解说与完整流程。' },
    { id: 'series-detail-back', group: '节目详情页', label: '右上角返回链接', text: '← 全部节目' },
    { id: 'series-detail-longest', group: '节目详情页', label: '标题下 · 最长一期（场）', vars: ['unit', 'duration'], text: '最长一{unit} {duration}' },
    { id: 'series-detail-first', group: '节目详情页', label: '引语 · 第一期（场）', vars: ['unit', 'title'], text: '第一{unit}：「{title}」' },
    { id: 'series-detail-first-together', group: '节目详情页', label: '引语 · 一起 See（按整场直播归档）', vars: ['title'], text: '目前最早确认的一场：「{title}」' },
    { id: 'series-detail-archive-count', group: '节目详情页', label: '全部记录 · 标题', vars: ['name', 'count', 'unit'], text: '{name} · 档案里的 {count} {unit}' },
    { id: 'chronicle-eyebrow', group: '编年史', label: '小标', text: 'Chronicle · 编年史' },
    { id: 'chronicle-title', group: '编年史', label: '标题', text: '时间不是一条列表，是一路走过来的。' },
    { id: 'chronicle-lede', group: '编年史', label: '标题下的说明', text: '这里把视频、直播和能确认的重要节点串在一起。想找具体某一天，再去录播室里翻。' },
    { id: 'chronicle-still-going', group: '编年史', label: '最新一年末尾', text: '这一年还在继续。' },
    { id: 'chronicle-year-empty', group: '编年史', label: '这一年一条记录都没有时', text: '这一年暂时还没找到能确认的记录。' },
    { id: 'chronicle-year-count', group: '编年史', label: '这一年没有节点、但有录像时', vars: ['count'], text: '这一年留下了 {count} 条记录。' },
    { id: 'chronicle-year-archive', group: '编年史', label: '上一句后面的链接', text: '去录播室看看 →' },
    { id: 'chronicle-open-archive', group: '编年史', label: '每一年末尾的按钮', vars: ['count'], text: '看这一年的全部 {count} 条记录' },
    { id: 'chronicle-milestone', group: '编年史', label: '重要节点的标记', text: '关键节点' },
    { id: 'chronicle-activity-note', group: '编年史', label: '期数小图右上角的说明', text: '按当前档案收录期数' },
    { id: 'chronicle-footer-hint', group: '编年史', label: '页尾提示（{link} 是下一条的链接）', vars: ['link'], text: '想找具体日期、游戏或来源，可以去 {link}。' },
    { id: 'chronicle-footer-link', group: '编年史', label: '页尾提示里的链接文字', text: '录播室' },
    { id: 'archive-title', group: '录播室', label: '标题', text: '从记得的内容，找到那段时间。' },
    { id: 'archive-lede', group: '录播室', label: '标题下的说明', text: '每个年份和月份都列出真实标题作为线索，不需要先记住准确日期；知道关键词时，也可以直接搜索全部公开记录。' },
    { id: 'archive-search-placeholder', group: '录播室', label: '搜索框里的提示', text: '搜标题、游戏、日期…' },
    { id: 'archive-year-clues', group: '录播室', label: '年份区 · 小标', text: '年度线索' },
    { id: 'archive-year-pick', group: '录播室', label: '年份区 · 右侧提示', vars: ['era'], text: '{era} · 选一年看看' },
    { id: 'archive-year-searching', group: '录播室', label: '年份区 · 正在搜索时的提示', text: '正在搜索全部年份' },
    { id: 'archive-month-pick', group: '录播室', label: '月份区 · 说明', text: '选一个月，看看那段时间都在播什么。' },
    { id: 'archive-tags-title-month', group: '录播室', label: '标签筛选 · 标题（按月看时）', text: '这个月都在播什么' },
    { id: 'archive-tags-title-search', group: '录播室', label: '标签筛选 · 标题（搜索结果）', text: '这批结果里都有什么' },
    { id: 'archive-tags-hint', group: '录播室', label: '标签筛选 · 操作提示', text: '点一下只看它，再点一下取消，可以多选' },
    { id: 'archive-empty', group: '录播室', label: '没有符合条件的条目时', text: '这里暂时没有符合条件的条目。' },
    { id: 'archive-tags-empty', group: '录播室', label: '标签筛完一条不剩时', text: '这一批里没有同时满足所选标签的记录。' },
    { id: 'archive-search-limit', group: '录播室', label: '搜索结果太多时', vars: ['count'], text: '仅显示前 {count} 条，请增加关键词继续缩小范围。' },
    { id: 'archive-load-failed-title', group: '录播室', label: '档案加载失败 · 标题', text: '档案数据暂时没有加载成功' },
    { id: 'archive-load-failed-body', group: '录播室', label: '档案加载失败 · 说明', text: '页面已经打开，可以直接重试；其他栏目和背景音乐不会被这次失败卡住。' },
    { id: 'archive-load-retry', group: '录播室', label: '档案加载失败 · 按钮', text: '重新加载档案' },
    { id: 'entry-back', group: '条目页', label: '返回链接', vars: ['year', 'month'], text: '回到 {year} 年 {month} 月' },
    { id: 'entry-same-session', group: '条目页', label: '有同场录像时的说明', vars: ['count'], text: '档案里另有 {count} 条被标为同场的录像，它们的链接已并入下面的来源列表。' },
    { id: 'entry-segments-title', group: '条目页 · 观看台', label: '分段 · 标题', text: '这场里在打什么' },
    { id: 'entry-segments-hint-bar', group: '条目页 · 观看台', label: '分段 · 说明（有时长时）', text: '把指针放到色带上可以预读某一段；点一下定位到下面的列表。' },
    { id: 'entry-segments-hint-even', group: '条目页 · 观看台', label: '分段 · 说明（时长未知时）', text: '这场时长未知，色带按段数等分，宽度不代表真实时长。' },
    { id: 'entry-segments-empty', group: '条目页 · 观看台', label: '分段 · 还没录入时', text: '尚未录入分段信息。' },
    { id: 'entry-segments-games', group: '条目页 · 观看台', label: '分段 · 还没录入、但知道游戏时（接在上一句后面）', vars: ['games'], text: '已知涉及：{games}。' },
    { id: 'entry-sources-title', group: '条目页 · 观看台', label: '来源 · 标题', text: '在哪儿看' },
    { id: 'entry-sources-hint', group: '条目页 · 观看台', label: '来源 · 说明（多个来源时）', vars: ['count'], text: '{count} 个来源，选中的那个决定所有跳转与上面的封面。' },
    { id: 'entry-sources-empty', group: '条目页 · 观看台', label: '来源 · 一个链接都没有时', text: '还没有可用链接。如果你手上有，欢迎补录。' },
    { id: 'entry-source-open', group: '条目页 · 观看台', label: '来源 · 大按钮', vars: ['source'], text: '在 {source} 打开' },
    { id: 'entry-source-dead', group: '条目页 · 观看台', label: '来源 · 已失效时', text: '这条来源上次检查时已失效，打开可能是 404。' },
    { id: 'entry-source-unchecked', group: '条目页 · 观看台', label: '来源 · 还没核验时', text: '这条来源尚未核验，不保证还能打开。' },
    { id: 'entry-calib-title', group: '条目页 · 标签纠错', label: '小标', text: '这场的游戏与内容' },
    { id: 'entry-calib-none', group: '条目页 · 标签纠错', label: '还没有任何标签时', text: '这场还没有标游戏或内容标签' },
    { id: 'entry-calib-open-fix', group: '条目页 · 标签纠错', label: '按钮（已经有标签时）', text: '标错了？帮忙纠错' },
    { id: 'entry-calib-open-new', group: '条目页 · 标签纠错', label: '按钮（还没有标签时）', text: '知道这场是什么内容？' },
    { id: 'entry-calib-intro', group: '条目页 · 标签纠错', label: '说明', text: '打开上面的录像看一眼，如果游戏、聊天、户外或节目标签标错了，都可以从同一个入口纠正。拿不准可以选「无法判断」。' },
    { id: 'entry-calib-footnote', group: '条目页 · 标签纠错', label: '提交按钮旁的小字', text: '无需注册；结果只作为人工复核线索。' },
    { id: 'entry-calib-thanks', group: '条目页 · 标签纠错', label: '第一次提交后', text: '收到。你的判断会交给管理员复核，不会自动改写档案。' },
    { id: 'entry-calib-updated', group: '条目页 · 标签纠错', label: '再次提交（改判断）后', text: '你的判断已更新。' },
    { id: 'entry-detail-parts-title', group: '录播室 · 展开的一条', label: '分 P · 小标', text: '当前来源的分 P' },
    { id: 'entry-detail-parts-hint', group: '录播室 · 展开的一条', label: '分 P · 说明', text: '随上方来源切换；点击任意一段直接打开对应页面。' },
    { id: 'entry-detail-parts-unverified', group: '录播室 · 展开的一条', label: '分 P 还没核实时', vars: ['parts'], text: '当前来源共 {parts}P，具体标题和跳转页尚未核实。' },
    { id: 'entry-detail-segments-empty', group: '录播室 · 展开的一条', label: '还没录入分段时', text: '尚未录入分段信息' },
    { id: 'contact-submit-kicker', group: '联系页 · 提交线索', label: '小标', text: '提交线索' },
    { id: 'contact-submit-title', group: '联系页 · 提交线索', label: '标题', text: '这份档案是大家一起补出来的' },
    { id: 'contact-submit-intro', group: '联系页 · 提交线索', label: '说明', text: '下面三件事，随便哪一件都欢迎。所有线索都进人工队列，由我逐条核对后再决定怎么改，不会自动生效。' },
    { id: 'contact-intent-footage-label', group: '联系页 · 提交线索', label: '补一场 · 按钮', text: '我有一场站里没有的' },
    { id: 'contact-intent-footage-hint', group: '联系页 · 提交线索', label: '补一场 · 按钮下的小字', text: '录像、切片、或者只是记得有这么一场' },
    { id: 'contact-intent-footage-lede', group: '联系页 · 提交线索', label: '补一场 · 展开后的第一句', text: '不用先找到链接。记得大概是哪一年、播的是什么，就已经够我去找了。' },
    { id: 'contact-intent-footage-body-label', group: '联系页 · 提交线索', label: '补一场 · 正文标签', text: '这一场大概是什么样的' },
    { id: 'contact-intent-footage-template', group: '联系页 · 提交线索', label: '补一场 · 填空模板（换行照原样进输入框）', text: '【补一场】\n· 大概什么时候：\n· 播的是什么（游戏 / 节目 / 事件）：\n· 在哪儿见过（有链接最好，没有也行）：\n' },
    { id: 'contact-intent-correction-label', group: '联系页 · 提交线索', label: '纠错 · 按钮', text: '这里写错了' },
    { id: 'contact-intent-correction-hint', group: '联系页 · 提交线索', label: '纠错 · 按钮下的小字', text: '日期、标题、时长、链接、游戏标签' },
    { id: 'contact-intent-correction-lede', group: '联系页 · 提交线索', label: '纠错 · 展开后的第一句', text: '说清三件事就够：是哪条记录（贴页面地址最快）、哪里不对、正确的应该是什么。' },
    { id: 'contact-intent-correction-body-label', group: '联系页 · 提交线索', label: '纠错 · 正文标签', text: '发现了什么问题' },
    { id: 'contact-intent-correction-template', group: '联系页 · 提交线索', label: '纠错 · 填空模板（换行照原样进输入框）', text: '【纠错】\n· 哪条记录（贴页面地址最快）：\n· 哪里不对：\n· 正确的应该是：\n' },
    { id: 'contact-intent-photo-label', group: '联系页 · 提交线索', label: '老图 · 按钮', text: '我存着老图' },
    { id: 'contact-intent-photo-hint', group: '联系页 · 提交线索', label: '老图 · 按钮下的小字', text: '周年图、生日贺图、直播间截图、粉丝作品' },
    { id: 'contact-intent-photo-lede', group: '联系页 · 提交线索', label: '老图 · 展开后的第一句', text: '画廊一直在收。有图就一起传上来；哪怕只记得「那年有一张什么图」，也可以先说一声。' },
    { id: 'contact-intent-photo-body-label', group: '联系页 · 提交线索', label: '老图 · 正文标签', text: '这张图是什么' },
    { id: 'contact-intent-photo-template', group: '联系页 · 提交线索', label: '老图 · 填空模板（换行照原样进输入框）', text: '【画廊线索】\n· 大概是哪一年：\n· 是什么画面：\n· 在哪儿能找到原图：\n' },
    { id: 'contact-form-note', group: '联系页 · 提交线索', label: '展开后的第二句', text: '下面的空按提示填就行，不用讲究格式。拿不准也可以提，我会去核对。' },
    { id: 'contact-form-name-label', group: '联系页 · 提交线索', label: '称呼 · 标签', text: '怎么称呼你' },
    { id: 'contact-form-name-placeholder', group: '联系页 · 提交线索', label: '称呼 · 占位提示', text: '留个 ID 就行，方便我知道是谁发现的' },
    { id: 'contact-form-success', group: '联系页 · 提交线索', label: '提交成功', text: '收到，谢谢。我会逐条看过再决定怎么改。' },
    { id: 'contact-form-disabled', group: '联系页 · 提交线索', label: '提交关闭时', text: '提交功能暂未开放。你仍然可以从下面的项目仓库找到我。' },
    { id: 'contact-form-submit', group: '联系页 · 提交线索', label: '提交按钮', text: '提交' },
    { id: 'contact-form-again', group: '联系页 · 提交线索', label: '提交后再来一条', text: '再提交一条' },
    { id: 'contact-review-kicker', group: '联系页', label: '一起校对 · 小标', text: '一起校对' },
    { id: 'contact-review-title', group: '联系页', label: '一起校对 · 标题', text: '在对应条目里帮忙判断' },
    { id: 'contact-review-body', group: '联系页', label: '一起校对 · 说明', text: '打开对应录像，看过原片以后，再帮忙补标签或者纠错。' },
    { id: 'contact-review-cta', group: '联系页', label: '一起校对 · 链接', text: '打开录播室' },
    { id: 'contact-repo-kicker', group: '联系页', label: '项目仓库 · 小标', text: '项目仓库' },
    { id: 'contact-repo-body', group: '联系页', label: '项目仓库 · 说明', text: '查看项目源码、数据更新和版本记录。' },
    { id: 'contact-repo-cta', group: '联系页', label: '项目仓库 · 链接', text: '打开仓库' },
    { id: 'contact-maintainers-kicker', group: '联系页', label: '维护 · 小标', text: '维护' },
    { id: 'contact-maintainers-note', group: '联系页', label: '维护 · 底部说明', text: '想一起补档或校对，可以从上面的 GitHub 仓库找到我。' },
    { id: 'contact-sources-kicker', group: '联系页', label: '录播来源 · 小标', text: '录播 · 切片来源' },
    { id: 'contact-sources-count', group: '联系页', label: '录播来源 · 右侧计数', vars: ['count'], text: '{count} 位 UP 主的录像被本站索引' },
    { id: 'contact-sources-note', group: '联系页', label: '录播来源 · 底部说明', text: '名单会随着补档继续增加。如果漏了谁，欢迎告诉我。' },
    { id: 'contact-chronicle-link', group: '联系页', label: '底部按钮 · 编年史', text: '前往编年史' },
    { id: 'contact-home-link', group: '联系页', label: '底部按钮 · 首页', text: '返回首页' },
    { id: 'form-photo-lead', group: '投稿表单（首页投梗 / 联系页共用）', label: '附图 · 小标', text: '有图的话可以一起传' },
    { id: 'form-photo-notice', group: '投稿表单（首页投梗 / 联系页共用）', label: '附图 · 说明（{emphasis} 是加重的那半句）', vars: ['emphasis'], text: '你传上来的图我会一张张看过再决定收不收，{emphasis}。图片会先压小一点再上传，省你的流量。' },
    { id: 'form-photo-notice-emphasis', group: '投稿表单（首页投梗 / 联系页共用）', label: '附图 · 说明里加重的半句', text: '上传不等于会出现在画廊里' },
    { id: 'form-footnote', group: '投稿表单（首页投梗 / 联系页共用）', label: '提交按钮旁的小字', text: '无需注册。提交的内容只作为人工核对的线索，不会自动生效。' },
    { id: 'form-success-title', group: '投稿表单（首页投梗 / 联系页共用）', label: '提交成功 · 标题', text: '收到了 ✓' },
    { id: 'form-photo-received', group: '投稿表单（首页投梗 / 联系页共用）', label: '提交成功 · 图片也收到时', vars: ['count'], text: '图片也收到了，一共 {count} 张。它们现在只存在后台的待审队列里，我看过之后才会决定要不要放进画廊。' },
  ],
}

export function siteCopyBlock(blocks: SiteCopyBlock[], id: string): SiteCopyBlock {
  return blocks.find((block) => block.id === id) ?? { id, eyebrow: '', title: '', lede: '' }
}

const TOKEN_SPLIT = /(\{[A-Za-z0-9_]+\})/
const TOKEN_ONLY = /^\{([A-Za-z0-9_]+)\}$/

/** 把占位符换成值。句子里没写的占位符不会出现；没给值的占位符原样保留，方便一眼看出漏传。 */
export function fillSiteText(text: string, vars: Record<string, string | number> = {}): string {
  return text
    .split(TOKEN_SPLIT)
    .map((part) => {
      const name = TOKEN_ONLY.exec(part)?.[1]
      return name !== undefined && name in vars ? String(vars[name]) : part
    })
    .join('')
}

/** 拆成「文字 / 占位符」交替的片段，给需要把数字包进样式的地方用。 */
export function splitSiteText(text: string): Array<{ kind: 'text'; value: string } | { kind: 'var'; name: string }> {
  return text
    .split(TOKEN_SPLIT)
    .filter((part) => part !== '')
    .map((part) => {
      const name = TOKEN_ONLY.exec(part)?.[1]
      return name !== undefined ? { kind: 'var' as const, name } : { kind: 'text' as const, value: part }
    })
}
