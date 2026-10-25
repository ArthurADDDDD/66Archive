# AcFun 时长筛查条目的观察记录覆盖

覆盖表：[88 条 CSV](acfun-duration-observation-coverage-2026-10-24.csv)。本地关联使用 `acfun-duration-triage.csv` 的 88 个 entry、`docs/research` 内已有 JSON 中的 `entry_id`，以及 JSON 中登记的 AcFun 源 URL/ID。只记录发现的文件关联，不把 entry 级观察当成逐来源或全片核验。

## 覆盖统计

- 88 条 triage entry 中，26 条至少关联一份已有 observation JSON；62 条没有关联到这类基线观察 JSON。
- 这 26 条是 **entry 级**覆盖数。一个 entry 有观察，不代表其所有 AcFun 页、所有已登记来源或整场都观察过。
- triage 记录 116 个 AcFun 来源引用；其中 30 个 AcFun 来源 ID/URL 能在已有 JSON 中直接匹配，另有 86 个没有直接匹配。这里的“未匹配”只描述本地 JSON 关联，不能推出历史上无人看过、源不可访问或内容缺失。
- 同一 88 条记录另有 107 个非 AcFun 来源引用，entry 级登记来源共 223 个。CSV 将 AcFun 来源数与其他来源数分别列出，避免把来源引用数和观察数混为一项。
- `source-credibility-observations.json`、逐条播放器 follow-up JSON 与其它含 entry/source 键的 JSON 共同用于文件关联。既有 note、catalog 或文字报告可能保存历史线索，即使 CSV 中 observation JSON 关联数为 0；62 条不等于没有任何历史证据。

## 62 条中建议下批复核的三个问题

以下三项都没有在本次基线观察 JSON 中找到 entry 关联，且正式条目备注明确记录了同场多版本关系。它们是可检验问题，不是本轮内容结论。AcFun 与 B 站来源账号属于非官方档案账号；没有新播放、联网或数据写入。

1. **2017-12-06 PUBG《吃鸡佳缘》第一期：两种 AcFun 投稿的分段与内容重叠范围。** [弹幕版 `ac4125032`](https://www.acfun.cn/v/ac4125032) 与 [纯净版 `ac4122087`](https://www.acfun.cn/v/ac4122087)，另有 [B 站 `BV1MW411h7Xy`](https://www.bilibili.com/video/BV1MW411h7Xy)。正式 note 说两种版本来自同一场并已合并；triage 给两帖各约 4.56 小时、各 10 个内页，条目约 273 分钟。可检验的问题是：两种版本的同一可辨对局/聊天事件是否出现在相同内部页附近，近尾范围是否相同或不同？下一次应先用可见分 P 标题选同主题页，再只对齐一个独特事件锚点；总时长接近不能证明完整等价或无重复。

2. **2017-12-15 PUBG《吃鸡佳缘》第二期：弹幕版与纯净版的页面范围。** [弹幕版 `ac4140602`](https://www.acfun.cn/v/ac4140602) 与 [纯净版 `ac4140326`](https://www.acfun.cn/v/ac4140326)，另有 [B 站 `BV1zW411b7fS`](https://www.bilibili.com/video/BV1zW411b7fS)。正式 note 说二者来自同一场，并提醒同日另有独立 GOROGOA 条目；triage 记录两个 AcFun 稿约 6818 秒/5 页与 6843 秒/4 页。可检验的问题是：两种 PUBG 版本是否只是分 P 数不同的同范围稿，或一个稿缺少另一稿中的具体对局/聊天段？只比较可辨内容，不按 5 页/4 页或同日标题推断页码映射。

3. **2019-01-20《乐园》与《心灵砒霜》：一页弹幕稿覆盖的是哪段范围。** [纯净版 `ac4881886`](https://www.acfun.cn/v/ac4881886) 与 [弹幕版 `ac4882221`](https://www.acfun.cn/v/ac4882221)，另有 [B 站 `BV1ht41187cf`](https://www.bilibili.com/video/BV1ht41187cf)。正式 note 说纯净版包括“乐园 & 心灵砒霜”，弹幕版为单页；triage 记录前者 4 页约 193 分钟、后者 1 页约 133 分钟，条目记载两个内容段。可检验的问题是：弹幕版这一页是否与纯净版中某一节目段局部重合，还是仅为部分范围？下一批可先在两帖正常页面核对可见标题/内页时长，再选一个两边都能辨认的来信或《乐园》事件锚点；不要直接把旧 segments 时间当作播放器跳转位置。

三个建议均保持待验证，不应改条目时长、来源范围或完整性判断。其它 59 个无基线观察关联的 entry 本轮不展开；需按实际 notes 和可检验假设另行排序。

## CSV 字段

- `entry_baseline_observation_json_count/files`：entry id 或来源 ID 关联到的 JSON 文件数及名称。它是记录关联数，不是播放次数。
- `acfun_registered_source_refs_n`：triage 登记的 AcFun 来源引用数；`acfun_refs_matched_in_observation_json_n` 与 `acfun_refs_not_matched_in_observation_json_n` 分别表示 URL/ID 在 JSON 中直接匹配与未匹配的数量。
- `entry_other_registered_source_refs_n`：triage 的其他平台来源引用数；`entry_registered_source_refs_total_n` 是两类登记引用数合计。
- 候选专用列 `next_batch_priority` 与 `testable_question_from_existing_note` 仅对上述三个条目填写。
