# 来源提议证据就绪度复核（2026-10-23）

后续更新：跨月播放器报告已补具体事件位置关联，不再仅有服装/片头相似；两条2月7短源分别至少两个点对应3月19长源约20–22分钟。下表为当时的7项就绪检查，日期关联须结合该报告最新对照表。仍未构成整P认证或写入批准。

只读复核 `source-review-proposals.json` 的全部 7 项。该 JSON 自述基线为 `34b35960`；该提交是 `d019ca1b` 的祖先。本报告按公开仓库基线 `d019ca1b` 核对正式条目和来源，逐项查阅本目录已有的平台元数据、局部播放器观察和来源备注。没有发新网络请求、没有下载媒体、没有改 JSON 或正式数据。

这里的“直接内容证据”仅指报告已记录的局部画面/实播样本，不代表人工完整观看。所有机器观察都不是 `human_watch`。短页面时长是单项页面元数据，不能单独证明整场不完整。提议 JSON 本身仍为 `review_only`、`execution_allowed: false`，以下结论不构成数据写入批准。

## 已有直接内容反例，可供人工审阅具体修正（3 项）

| 提议 | 新证据与位置 | 就绪度与边界 |
|---|---|---|
| `2017-11-24-live-01`，B站 [BV12Y411F7WZ](https://www.bilibili.com/video/BV12Y411F7WZ/)：`kind: replay → clip` | [`visual-review.md`](visual-review.md) 记录普通浏览器前约 14 秒实际播放，开头为摄像头聊天；单P公开时长 456 秒（7:36），投稿说明称从旧录像中找出。直接画面与条目所标“超级马里奥”游戏内容不符，来源长度也远小于条目 410 分钟。 | 可作为“短片类型”修正候选供人复核；局部开头不能证明全 7:36 都是聊天，也不能确定母场是否为 11-24。另有 B站/AcFun 长来源，不应删除或据此判整场缺失。机器观察非 `human_watch`。 |
| `2021-11-27-live-01`，B站 [BV1K34y1R7K1 P3](https://www.bilibili.com/video/BV1K34y1R7K1/?p=3&t=300)：`games: quesheng → majsoul` | [`scope-player-evidence.md`](scope-player-evidence.md) 记录 P3 约 300 秒处播放器实际位置 301.308 秒，画面为雀魂风格角色及四人麻将对局；[`visual-review.md`](visual-review.md) 另记同P公开缩略图中有雀魂标志和角色界面。条目现标“雀圣”。 | 有明确游戏画面支持具体作品为雀魂，可作为游戏字段候选供人工审阅。离散点样本不证明整场只玩该游戏，也不提供全场边界或时长；不能仅凭该样本改标题或时间轴。观察为机器局部样本，非 `human_watch`。 |
| `2021-11-29-live-01`，B站 [BV1CP4y1V7tq P2](https://www.bilibili.com/video/BV1CP4y1V7tq/?p=2&t=300)：`games: quesheng → majsoul` | [`scope-player-evidence.md`](scope-player-evidence.md) 记录 P2 约 300 秒处播放器实际位置 300.844 秒，画面为雀魂角色资料与麻将段位界面；[`visual-review.md`](visual-review.md) 另记该稿缩略图有雀魂标志和麻将对局。条目现标“雀圣”。 | 有具体界面内容支持雀魂修正候选。单点画面不能证明整场范围或游戏时长，仍需人工确认字段语义后才可写入；非 `human_watch`。 |

## 仅有元数据/短时长或尚缺直接反例，不能裁决（1 项）

| 提议 | 现有证据 | 就绪度与下一步 |
|---|---|---|
| `2017-08-01-live-01`，斗鱼 [x0zZVvPKRx4WO4E2](https://v.douyu.com/show/x0zZVvPKRx4WO4E2)：`kind: replay → clip` | [`visual-review.md`](visual-review.md) 与 [`recent-source-evidence-followup.md`](recent-source-evidence-followup.md) 记录公开页面标题为“直播时刻”且页面时长 182.04 秒；本轮之前的浏览器访问只取得标题/导航，没有播放器画面。条目长 240 分钟。该场另有约 184 分钟的官方 MC 剪辑版及其他平台来源，但这些不能证明这条斗鱼来源具体是什么内容。 | 目前只是很强的短片风险线索，页面时长不是直播实播时长，标题类别也不是该视频内容的直接证明。保持 `replay → clip` 为待核提议；需正常播放器画面或平台可见的内容说明后才能审定。没有依据判整场缺失。 |

## 后续证据改变了旧提议的优先解释（3 项）

这三条旧提议都把 `kind: replay → clip` 作为唯一改动方向。新的局部画面/日期关联证据没有证明它们不是短片，却使“先改kind、仍视作原条目日期来源”的解释不足；复核应先解决来源归日，再讨论正式来源字段。

| 提议 | 新证据与位置 | 对旧提议的影响与边界 |
|---|---|---|
| `2026-02-05-live-03`，B站 [BV1kNNgztEc2](https://www.bilibili.com/video/BV1kNNgztEc2/)：`kind: replay → clip` | [`dated-clip-player-evidence.md`](dated-clip-player-evidence.md) 记录该单P实际长 330 秒，约 9.218 秒处为摄像头聊天；同报告对候选 2026-03-08 长源 [BV1VHNgz2Ej5 P1](https://www.bilibili.com/video/BV1VHNgz2Ej5/?p=1&t=11) 记录约 11.132 秒的相似服装、发型和场景，并列出其他03-08长版的标题/分P时刻。[`date-association-provenance.md`](date-association-provenance.md) 说明短片并入2月5日条目的公开提交记录没有附日期或母场定位证据。 | “短片”仍是合理类型候选，但旧提议没有覆盖来源可能与03-08母场关联的风险。现有已增加长短源及3月8版本的多个局部动作事件关联，仍非全片逐帧/音频对齐；不能把日期直接改为03-08，也不能断言上传者误标。下一次审议应同时处理日期关联，暂不单独批准 kind 修改。 |
| `2026-02-07-live-01`，B站 [BV186AVz5EgM](https://www.bilibili.com/video/BV186AVz5EgM/)：`kind: replay → clip` | [`dated-clip-player-evidence.md`](dated-clip-player-evidence.md) 记录该P实际 264 秒，约 13.378 秒为摄像头聊天；与候选 2026-03-19 长源 [BV1PSAVzMEfC P1](https://www.bilibili.com/video/BV1PSAVzMEfC/?p=1&t=36) 约 36.152 秒处的粉白条纹上衣、浅色侧发夹及相同布景相似。与02-07长源 BV1CbFxzbEGP 开头穿着不同。 | 画面样本支持重新核对“同日18:33切片”的旧备注，新补多点动作/弹幕事件支持03-19候选，仍不是原始直播日期认证。短时长与聊天开头不足以验证整P内容。将“可能短片”与“日期归属有疑”分开审，不能照旧备注自动归02-07，也不能改日期。 |
| `2026-02-07-live-01`，B站 [BV11QALzCEck](https://www.bilibili.com/video/BV11QALzCEck/)：`kind: replay → clip` | [`dated-clip-player-evidence.md`](dated-clip-player-evidence.md) 记录该P实际 190 秒，约 20.015 秒为摄像头聊天，着装/布景与上条短源及候选03-19长源开头相似。[`date-association-provenance.md`](date-association-provenance.md) 记录公开合并变更将其并入02-07，并称同日18:33，但检查过的公开记录没有给出独立日期/母场定位证据。 | 与上一短源相同，旧 kind 提议应暂停在人工复核层；需先查清其与03-19或其他母场的关系。最新t10/25与长源t1245/1262事件位置已有局部对应，仍非连续全片/音频匹配，不支持自动搬日。 |

## 复核建议

7 项中，3 项已有可供人工复核的直接内容样本，1 项仍主要是页面metadata/短时长，3 项受新日期关联证据影响，应先重查来源归日。每项的正式字段仍是 `d019ca1b` 中原值；本报告未改数据，也没有把任何机器观察写为人工观看或完整性结论。正式写入前仍需人工确认具体字段与证据，按单独的数据批次处理。
