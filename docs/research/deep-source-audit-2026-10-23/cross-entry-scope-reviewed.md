# 跨条目同源视频范围复核

复核日期：2026-10-23。基准为公开仓当前候选数据快照 `db4b9fa7`。本报告是只读机器复核与提议，不是人工观看结论，也没有修改正式档案。

逐条结果见 [cross-entry-scope-reviewed.csv](./cross-entry-scope-reviewed.csv)：30 个候选条目行，涉及 15 个唯一 B 站投稿。每条都保留了条目、候选页码、当前前台行为、已有时间轴/备注、其他来源以及缓存页标题。候选集来自 [cross-entry-unscoped-submission-candidates.csv](./cross-entry-unscoped-submission-candidates.csv)。

## 方法与边界

- 以候选数据快照中的 entry/source、`source.note`、`part_details`、`data/game-timelines.yaml` 和既有报告交叉核对；逐个读取已缓存投稿的所有分 P 元数据。15 个缓存均返回成功且缓存页数与候选表 API 页数相等；本轮没有网络请求。
- 对每个分 P 只使用当前缓存中的页号、标题和时长。标题可支持“机器候选范围”，不能证明画面实际内容、连续性、该页完整或与直播母场的日期对应。CSV 的 `human_watch` 全为 `false`。
- 检查 `src/lib/data.ts` 中同场合并的显式说明规则。仅日期相同或 URL 相同不会自动把 entry 合并；只有备注明确说明“与某 entry 属同场直播的不同录像”才合并。此 15 个投稿对应的候选 entry 没有命中该规则，所以前台仍按各自 entry 独立处理。
- 检查 `src/lib/game-footage.ts` 的展示逻辑：多游戏 entry 没有章节/时间轴时会被隐藏为未核实来源；单游戏 entry 没有时间轴时仍显示整个来源，不按游戏过滤页面。当前候选均没有 `part_details` 可让来源链接直接跳到明确页，因此默认链接通常从 P1 开始。已有时间轴的 2021-08-04 `live-01` 是例外：它按已记录 P6–P12 的时间轴展示。
- 页面标题的 P 编号不替代 B 站实际 `page` 顺序；建议页范围严格采用缓存里的当前页号。不会仅因“P3”字样把某页归给某个游戏。

## 逐投稿提议

| 投稿 | 条目与机器提议范围 | 判定 |
|---|---|---|
| [BV15t4y117EG](https://www.bilibili.com/video/BV15t4y117EG) | 2020-05-09 `live-01` 冒险公社：P2；`live-02` 冬日计划：P3–P8 | 两个单游戏条目共享完整来源，页标题支持范围候选；另有 AcFun 分段源，需保留为互补来源，不能据此认定 B 站页范围内容完整。 |
| [BV1sz4y117Bb](https://www.bilibili.com/video/BV1sz4y117Bb) | 2021-03-06 `live-01` ALTF4：P1–P3；`live-02` 节奏医生：P4–P7 | 页标题支持范围候选。 |
| [BV1av411a7Tf](https://www.bilibili.com/video/BV1av411a7Tf) | 2021-03-20 `live-01` 战意：P7–P8；`live-02` PUBG：P2–P6 | P1 为聊天，页标题支持两个游戏范围候选。 |
| [BV1fK4y127wn](https://www.bilibili.com/video/BV1fK4y127wn) | 2021-03-25 `live-01` Puyo Puyo Tetris 2：P7；`live-02` 察言观色3部曲：P3–P6 | P1–P2 为聊天；页标题支持范围候选。 |
| [BV1Ty4y1b7TL](https://www.bilibili.com/video/BV1Ty4y1b7TL) | 2021-03-26 `live-01` 怪物猎人：崛起：P1–P7；`live-03` Guardian Tales：P8–P11 | 共享来源的页标题支持候选范围；怪猎另有 AcFun 分段源，作为互补证据，不足以确认 B 站片段完整。 |
| [BV1KV411J7QP](https://www.bilibili.com/video/BV1KV411J7QP) | 2021-04-24 `live-01` 怪物男孩：P2–P5；`live-02` 永劫无间：P6–P8 | P1 为聊天；页标题支持范围候选。 |
| [BV1i54y157hs](https://www.bilibili.com/video/BV1i54y157hs) | 2021-05-01 `live-01` 世界游戏大全51：P6–P9；`live-02` 超级马里欧派对：P2–P5 | P1 为聊天；页标题支持范围候选。 |
| [BV13v411J7Ef](https://www.bilibili.com/video/BV13v411J7Ef) | 2021-08-04 `live-01` 数独/节奏医生/上古之魂：已有时间轴 P6–P12；`live-02` 永劫无间：P1–P5 | `live-01` 已有时间轴，不提重复范围；`live-02` 是独立无时间轴单游戏条目，P1–P5 是机器候选。 |
| [BV1mq4y1S7gX](https://www.bilibili.com/video/BV1mq4y1S7gX) | 2021-08-18 `live-01` GRIME：P5–P11；`live-02` 九十六号公路：P2–P4 | 页标题支持范围候选；GRIME 另有 AcFun 互补录像。 |
| [BV1TL4y1W7Dg](https://www.bilibili.com/video/BV1TL4y1W7Dg) | 2021-11-28 `live-01` 不提出游戏页范围；`live-02` 雀圣：暂不提议 | `live-01` 是节目/系列条目，无 game scope。`live-02` 日期为 11-28，但该投稿 P6–P8 标为 11-27 雀圣；entry 另有标题日期为 11-28 的 AcFun 源。已知该 B 站投稿是跨日期合集，因此把 P6–P8 归入 11-28 属日期/来源关联误报风险，需先核对场次。 |
| [BV1WM4y1A7t9](https://www.bilibili.com/video/BV1WM4y1A7t9) | 2021-12-09 `live-01` ICARUS：P3–P6；`live-02` 雀魂麻将：P1–P2 | 页标题支持范围候选。 |
| [BV1YD4y1c7sb](https://www.bilibili.com/video/BV1YD4y1c7sb) | 2021-12-24 `live-01` Fall Guys：P2–P4；`live-02` 层层恐惧：P5–P9 | P1 为聊天；页标题支持范围候选。 |
| [BV1gw411P79y](https://www.bilibili.com/video/BV1gw411P79y) | 2023-11-20 `live-01` 因果动物园、`live-02` 大侠立志传：不提页范围 | 只有一个 16235 秒的合并标题页，缺少分 P 边界；不能把整 P1 同时映射给两个游戏，也不能按标题拆时长。 |
| [BV1JFuQ6qEtQ](https://www.bilibili.com/video/BV1JFuQ6qEtQ) | 2026-08-09 `live-02` 修仙故事：P1–P2 与现有备注相符；2026-08-10 `live-03` 枫之谷：不提议 | 投稿页为 8 月 9 日 22:29、23:29 两段；8 月 10 日条目备注描述的是 22:04 场次且另一条目备注把此投稿与修仙故事关联。对枫之谷的来源关联冲突，不能将 P1–P2 配给该条目。 |
| [BV1uYhx6vE5L](https://www.bilibili.com/video/BV1uYhx6vE5L) | 2026-09-23 `live-01` Townfall 午场：P1–P4；`live-02` Townfall 晚场：P5–P9 | entry/source 备注已有午场/晚场分段线索，缓存页标题与时间支持这些范围；尚无 `part_details`/时间轴控制跳转，且没有画面核验。 |

## 如何解读

18 行是一般 `scope_gap_candidate`，3 行同时标有互补源，另有 1 行已有时间轴覆盖。它们说明当前单游戏条目可能把同一完整投稿显示在多个游戏页，不能直接等同于缺少录像，也不证明候选范围内每一页都完整包含相应游戏。

其余 8 行是有意保留的不确定或排除项：两个跨日期/来源冲突，一个无分 P 边界的合并页（对应两个条目），一个非游戏条目，以及两个已有备注范围但尚无跳转范围的条目。完整状态和证据细节在 CSV 中逐条记录。

本轮只核对公开元数据、仓库数据和前台映射逻辑。没有确认视频画面、分段开头/结尾、时长实际播放情况、游戏内容切换点，也没有确认候选范围覆盖整场直播。因此这份表只能作为后续人工复核的机器排序和页范围提议，不是批量写档依据。
