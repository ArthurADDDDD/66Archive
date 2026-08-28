# Task 031：全量标签校准与缺口回收

> 日期：2026-08-28
> 角色：数据采集
> 范围：`data/**`；不修改 Schema、前端或工具代码

## 结论

本轮对当前 **2699 条正式条目**做了结构化全量扫描，并对“无游戏、标签疑似误判、标题/分段与游戏字段矛盾、回放疑似缺 P”的高风险条目做了页面、画面、标题和评论区人工复核。

- 新建 **34 个有直接证据的游戏目录项**；合并既有目录补标后，共为 **58 条条目补入 68 个游戏关联**。
- 新增 **5 个内容标签关联**，删除 **4 个被误标为“聊天”的标签**。
- 从 A站找回 **17 条仍可访问的互补回放链接**，覆盖 2023-11 的 **14 场直播**。
- 修正 2 条已经人工确认保留为直播、但备注仍写成“非直播/切片”的历史矛盾说明。
- 校准《戏说封神》的系列说明：2019 年 19 条，加 2023-07-14 回访条目，共 20 条；本轮没有擅自改动条目的系列归属。
- 校准后游戏库由 717 项增至 **751 项**；`confidence: high` 2568 条、`medium` 131 条、`low` **0 条**，没有无来源条目。

## 已补入的游戏标签

第一阶段先复用了 `data/games.yaml` 已有 ID：

| 时段 | 补入的已有游戏 |
|---|---|
| 2010 / 2015 视频 | `guess-my-drawing`、`my-teacher-is-a-bear`、`your-love-and-real-love`、`never-look-at-it` |
| 2017 | `league-of-legends`、`wonder-boy`、`1-2-switch`、`doudizhu`（3 场） |
| 2018 | `ice-lakes`、`no-mans-sky`、`starbound`、`doudizhu`（4 场） |
| 2019 | `human-fall-flat`、`monopoly-plus` |
| 2020 | `astro-bot`、`world-of-warcraft` |
| 2021 / 2022 | `metroid-dread`、`subnautica` |
| 2023 | `wo-long`、`party-animals`、`rhythm-royale`、`pummel-party`、`goose-goose-duck`、`fall-guys`、`remnant-2` |

同时给能精确定位的分段补了 `segment.game`，避免总条目有游戏、分段仍无法按游戏检索。

经人类明确授权后，第二阶段把下列 34 个有标题、分段、简介或画面直接证据的游戏建入目录并回填：

`tumbleseed`、`dont-cut-your-hand`、`tiny-toon-busters-hidden-treasure`、`murder-mystery`、`mr-blackface`、`cave-story`、`the-lives`、`beat-saber`、`in-death`、`comedy-night`、`justice-online`、`one-hand-clapping`、`39-days-to-mars`、`old-school-musical`、`bloody-spell`、`vacation-simulator`、`derail-valley`、`sishen-duijue`、`feel-the-snow`、`reading-people`、`superliminal`、`grounded`、`art-of-rally`、`f1-2020`、`wudao-micang`、`rolo-to-the-rescue`、`circus-charlie`、`mitsume-ga-tooru`、`sackboy-big-adventure`、`yimeng-jianghu`、`sudoku`、`neon-white`、`bread-and-fred`、`dont-scream`。

《面包和年糕》与 Bread & Fred 的映射另由 [Steam 商店官方页](https://store.steampowered.com/app/1607680/_/_/?l=schinese)交叉确认。对于“谋杀之谜、黑脸先生、死神对决、舞蹈迷藏、数独、察言观色”，官方账号简介与独立分 P 已足以确认对应游戏；按回放标题文字直接注册，其中《察言观色》与既有《察言观色三部曲》分开建档。

## 人工深挖的关键证据

| 条目 | 复核结果 | 处理 |
|---|---|---|
| `2017-01-21-live-01` | A站 [ac3422592](https://www.acfun.cn/v/ac3422592) 与 [ac3422739](https://www.acfun.cn/v/ac3422739) 标题分别明确为《英雄联盟》part1/part2 | 补 `league-of-legends`，将首个来源改为 `alive` |
| `2017-06-05-live-01` | B站 [BV17x411a7n9](https://www.bilibili.com/video/BV17x411a7n9) P2 画面确认《1-2-Switch》，P3 确认《TumbleSeed》；后者的玩法和平台也与[任天堂商店页](https://www.nintendo.com/us/store/products/tumbleseed-switch/)一致 | 建 `tumbleseed` 并与已有 `1-2-switch` 一起回填 |
| `2017-11-22-live-01` | B站 [BV1zx411V7UA](https://www.bilibili.com/video/BV1zx411V7UA?p=2) P2 的 KONAMI 开场与世界地图确认是《Tiny Toon Adventures: Buster's Hidden Treasure》，不是同名 NES 前作 | 建目录项并回填 P2 分段 |
| `2018-05-10-live-01` | B站 [BV1fp411f7eU](https://www.bilibili.com/video/BV1fp411f7eU) 画面及评论可交叉确认《Beat Saber》《Ice Lakes》《In Death》 | 三款全部回填，删除错误“聊天”标签 |
| `2019-04-10-live-01` | B站 [BV1Eb411M78s](https://www.bilibili.com/video/BV1Eb411M78s) 分 P 画面确认《Vacation Simulator》《Derail Valley》《Beat Saber》 | 三款全部建档或复用并回填，删除错误“聊天”标签 |
| `2020-10-19-live-01` / `2020-10-20-live-01` | B站 [BV175411L7ML](https://www.bilibili.com/video/BV175411L7ML) 与 [BV1f54y167uY](https://www.bilibili.com/video/BV1f54y167uY) 确认为《Rolo to the Rescue》，后者 P4 另有《Circus Charlie》 | 建目录项并逐 P 回填，删除错误“聊天”标签 |
| `2020-10-23-live-01` | B站 [BV1VZ4y1V7xZ](https://www.bilibili.com/video/BV1VZ4y1V7xZ) 标题画面及实机确认《三目童子》（Mitsume ga Tooru） | 建目录项并回填全部游戏分段 |
| `2023-11-08-live-01` | A站分 P 标题明确《节奏鸽子》《DON'T SCREAM》《揍击派对》 | 三款全部回填 |

## 找回的回放缺口

以下 A站页面均已实际请求并确认 HTTP 200，作为原条目已有 P1/P2/P3 的互补回放补入；没有把标题相同、时长相同的重复稿件再挂一次。

| 日期 | 新增互补回放 |
|---|---|
| 11-01 | [ac42821015](https://www.acfun.cn/v/ac42821015) |
| 11-08 | [ac42898972](https://www.acfun.cn/v/ac42898972) |
| 11-09 | [ac42909912](https://www.acfun.cn/v/ac42909912)、[ac42909914](https://www.acfun.cn/v/ac42909914) |
| 11-10 | [ac42927658](https://www.acfun.cn/v/ac42927658) |
| 11-11 | [ac42928065](https://www.acfun.cn/v/ac42928065) |
| 11-16 | [ac42981802](https://www.acfun.cn/v/ac42981802) |
| 11-18 | [ac42995236](https://www.acfun.cn/v/ac42995236) |
| 11-19 | [ac43013631](https://www.acfun.cn/v/ac43013631) |
| 11-21 | [ac43023986](https://www.acfun.cn/v/ac43023986)、[ac43023984](https://www.acfun.cn/v/ac43023984) |
| 11-22 | [ac43033661](https://www.acfun.cn/v/ac43033661) |
| 11-25 | [ac43062952](https://www.acfun.cn/v/ac43062952) |
| 11-27 | [ac43081533](https://www.acfun.cn/v/ac43081533)、[ac43081535](https://www.acfun.cn/v/ac43081535) |
| 11-28 | [ac43090635](https://www.acfun.cn/v/ac43090635) |
| 11-29 | [ac43111500](https://www.acfun.cn/v/ac43111500) |

部分分 P 时长相加与现有场次总时长有轻微差异，也存在分段重叠或起止空档。本轮只补确认存在的来源，不以简单求和覆盖 `duration_min`。

## 明确排除的误命中

这些候选看似能靠关键词自动补标签，但人工复核后没有落盘：

- `2016-11-14-live-01` 的 “Things change, roll with it” 是文字投稿/展示环节，不是游戏《CHANGE: A Homeless Survival Experience》。
- 《Finding Paradise》标题中的语义不能反推为同时游玩《To the Moon》。
- 续作标题不自动补前作：如《逆转裁判6》不补《逆转裁判1》、《马力欧派对 超级巨星》不补普通《马力欧派对》。
- 《马力欧与索尼克 AT 东京2020奥运》不补独立的《东京2020奥运》。
- 联动、观看或讨论标题不等于游玩：《鸣潮》联动内容不补《赛博朋克2077》。
- 《Subnautica 2》不自动补第一代 `subnautica`。
- `2021-04-24-live-02` 的“怪物男孩”属于相邻分 P 标题，当前条实际证据只支持《永劫无间》。
- `2021-03-20-live-02` 当前来源只支持《绝地求生》，不按旧备注补《战意》。
- `2018-12-03-live-01` 当前标题/分段不支持斗地主；没有因为相邻日期常玩斗地主而补入。
- 本轮删除“聊天”标签的 4 条都有完整游戏画面；机器仍会因标题宽泛而建议“聊天”，该建议已人工否决。

## 已确认、按回放标题注册的目录项

以下 6 项此前因正式英文名/具体版本不明而暂缓，本轮按你确认的规则，以官方账号标题和分 P 文字直接注册：

- `murder-mystery`：按官方回放 P3/P4 的“谋杀之谜”注册。
- `mr-blackface`：按官方回放 P2 的“黑脸先生”注册。
- `sishen-duijue`：按官方回放 P5/P6 的“死神对决”注册。
- `wudao-micang`：按官方回放 P2 的“舞蹈迷藏”注册。
- `reading-people`：按官方回放的“察言观色”注册，独立于“察言观色三部曲”。
- `sudoku`：按官方回放前四个分段的“数独”注册。

## 覆盖缺口与未确认项

- “全量扫描”是对 2699 条的字段、标题、分段、来源与目录映射做机器检查；人工深挖集中在空标签、矛盾和高风险候选，**并不等于逐秒看完 2699 条视频**。
- 当前仍有 619 条没有游戏、1810 条没有标签、2358 条没有系列；其中大量本来就是非游戏内容或不属于任何系列，空值本身不等于错误。
- 校准工具当前报告“既无 `games`、`tags`、`series`”的条目为 **0 条**，“分段/备注命中已有游戏但未回填”的条目也为 **0 条**。
- 就本轮已挖出的明确游戏候选而言，当前仍有 **0 个**“已经确认在玩、但还没有注册”的游戏；全量审计剩下的 107 个标题候选均为前作/续作、泛别名、相邻分 P 或其他已复核的误命中，没有直接改动。
- 既有 131 条 `confidence: medium` 本轮没有凭推测升级；所有 `confidence: low` 条目为 0，因此没有低置信度原因清单。
- 早年失效优酷链接、2015-01 首播日期冲突、2015-04 仅知月份的候选、2015-05 空档、2015 年日期未定的 Escape Cube / Rusty Lake Hotel，以及 2020-03-05、2020-08-18、2020-09-21 等缺失场次，本轮仍未找到足以落盘的新证据；后者部分已知“确认直播过但无回放”。详见 [`missing-resources.md`](./missing-resources.md)。
