# 2020 年以前直播录像完整性清点

> 2026-10-22。只读检查 `data/entries/`、`data/game-timelines.yaml`、现有来源目录与研究报告，并对少数公开页面作在线抽查。本报告不改档案数据，也不表示已逐场观看录像。

## 结论

早期录像缺口主要集中在 2015–2016 年；较新的片段与局部缺失已有明确记录。当前数据可确认至少 3 场只有短片段来源（2015-07-06、2016-07-27、2018-08-10），另有已知“仅有片段/截取内容”的重点案例（2015-09-27、2017-12-17）。更大的限制是完整性未知：有游戏时间轴的 64 场里，只有 11 场标为 `coverage: complete`，另有 14 场为 `partial`、39 场为 `unknown`；`unknown` 表示档案没有确认覆盖范围，不等于已证明录像不全。

本轮没有发现此前未记载、且经一手证据确认的新缺失录像。发现两条值得维护者处理的状态一致性疑点：`2016-12-15-live-01` 与 `2017-01-14-live-01` 的备注都写明公开录像暂未找到，但没有 `no_public_replay: true`；两条仍只有转述来源，不能据此断言录像绝不存在。

### 档案已明确登记的缺失片段

以下两条 `missing_footage` 比普通 `coverage: unknown` 更明确，优先复核与征集；它们没有已登记的游戏时间轴，因此不包含在后面的 14/39 时间轴覆盖统计中。

| 档案 | 已确认缺段 | 现存来源及证据 |
|---|---|---|
| [2016-03-09-live-01](../../data/entries/2016-early-douyu-live.yaml)《星露谷物语》 | 《逆袭之星途闪耀》那一段 | [B站 BV1Xx411V7mT](https://www.bilibili.com/video/BV1Xx411V7mT) P1–P2 与 [A站 ac2592025](https://www.acfun.cn/v/ac2592025) 是同一份约 132 分钟《星露谷物语》录像，片头从建角色开始，整段内容没有《逆袭》。档案备注记录：当日直播间标题、贴吧游戏记录与节目单支持当天也播过《逆袭》；B站检索及女流优酷自频道未找到该段。这里是“已有游戏录像，但缺另一游戏段”的确认缺口。 |
| [2019-07-04-live-01](../../data/entries/2019-07-douyu-live.yaml)《唱歌 & 人类一败涂地 MOD & 辐射：避难所 Online》 | 唱歌与《人类：一败涂地》MOD 两段 | [B站 BV1Pt411n7qY](https://www.bilibili.com/video/BV1Pt411n7qY) 官方游戏账号上传的两 P 录像只含《辐射：避难所 Online》约 44+41 分钟；条目备注说录像全程为该游戏画面。日期与内容日志见[贴吧逐日记录](https://tieba.baidu.com/p/5995167560)，第 151 楼。档案明确保留两段 `missing_footage`；其他来源未证实它们已被补齐。 |

## 统计范围与可复算方法

统计单位是 `data/entries/` 中 `date < 2020-01-01` 且 `type: live` 的档案条目，日期界限含 2010–2019 全部直播条目，不把官方预录视频（`type: video`）算作直播录像。当前共 **1,267 条**：2015 年 138、2016 年 251、2017 年 287、2018 年 298、2019 年 293。

以下计数可用仓库依赖 `js-yaml` 复算：加载 `data/entries/*.yaml` 的条目数组后按 `type` 与 `date` 筛选；`no_public_replay` 按条目布尔字段计数；来源空白按缺少或空的 `sources` 计数；clip-only 按至少有一个来源、且所有来源 `kind: clip` 计数；时间轴按 `data/game-timelines.yaml` 的 `entry` 与档案 id 连接。时间轴“未完全确认”口径为 `coverage != complete` 或任一 span 为 `kind: unknown`。备注文本和目录清单不参与这些结构字段计数。

| 指标 | 条数 | 年份分布（2015 / 2016 / 2017 / 2018 / 2019） | 说明 |
|---|---:|---|---|
| 直播条目总量 | 1,267 | 138 / 251 / 287 / 298 / 293 | 本统计范围 |
| `no_public_replay: true` | 106 | 66 / 29 / 2 / 4 / 5 | 表示已记录检索结论，不代表未来不会找到录像 |
| 无来源 | 108 | 66 / 30 / 3 / 4 / 5 | 包含上项 106 条；另两条是下文的状态疑点 |
| 有游戏时间轴 | 64 | 7 / 3 / 18 / 19 / 17 | 仅覆盖少数条目，不是全库录像完整性审计 |
| 时间轴 `coverage: complete` | 11 | — | 仍可能有 `kind: unknown` 的未归属活动 |
| 时间轴 `coverage: partial` | 14 | — | 有明确的局部覆盖声明 |
| 时间轴 `coverage: unknown` | 39 | — | 覆盖状态未确认，不应计为“已证实不完整” |
| 时间轴未完全确认（上述派生口径） | 55 | — | 53 条非 complete，加 2 条 complete 但含 unknown span；与各 coverage 档位有重叠定义，不能相加到其他指标 |
| 来源全为 `kind: clip` | 4 | 2 / 1 / 0 / 1 / 0 | 与备注里“节选/片段”同义但 `kind` 不同的来源另作说明；含任一 replay 的条目不算 clip-only |

### 仅有片段的明确个案

| 档案 | 已知材料 | 判断与证据 |
|---|---|---|
| [2015-07-06-live-01](../../data/entries/2015-douyu-live.yaml)《造完飞机去找狗》 | [A站片段 ac2010055](https://www.acfun.cn/v/ac2010055)，约 3 分钟 | 该来源明确标为 `clip`。档案备注说明片段开头字幕介绍 Besiege，场次归属依据次日录像页快照，内容对应判断为 medium；完整录像未找到。历史已知，见 [失落录像清单 T05](../../data/catalogs/lost-recordings-inventory.csv) 与 [task-048](../../data/reports/task-048-lost-recordings.md)。 |
| [2015-09-27-live-01](../../data/entries/2015-douyu-live.yaml)《心灵砒霜》 | [优酷节选 XMTM1MDQ1NDE4OA](https://v.youku.com/v_show/id_XMTM1MDQ1NDE4OA==.html)，1:53:30 | 条目明确标为 `clip`，页面已删除，当前不能播放。原标题含“节选”，时长 6,810 秒；来源备注没有声明这段覆盖整场。属于历史已知失效片段，不是当前可用回放。 |
| [2016-07-27-live-01](../../data/entries/2016-early-douyu-live.yaml)《上海户外》 | [B站 BV1cs411C7QV](https://www.bilibili.com/video/BV1cs411C7QV)，2P 共 4:13 | 来源备注明确说明只是片段；完整录像未找到。历史已知，见 [失落录像清单](../../data/catalogs/lost-recordings-inventory.csv)。 |
| [2018-08-10-live-01](../../data/entries/2018-08-douyu-live.yaml)《大周MC第四目：第一天》 | [B站 BV1ps411T77E](https://www.bilibili.com/video/BV1ps411T77E) 与 [BV1dW41197kd](https://www.bilibili.com/video/BV1dW41197kd)，各约 2–3 分钟 | 两条来源均明确标为片段；同期录像曾被删除的说法见 [task-048](../../data/reports/task-048-lost-recordings.md) T06。2026-09 报告已记录本轮找回片段、整场仍未找到。日期与游戏内容来源主要来自后补的逐日整理，不能把它算作独立同期证明。 |

`2017-12-17-live-01` 原先只有 15 分钟滑雪片段，后挂入“戏说红楼”第六至十章剪辑，共 178 分钟；档案时长调整为现存片段合计 193 分钟，完整直播录像仍未找到。现有剪辑证明当天有这些内容，不能替代整场回放。结论来自 [task-054](../../data/reports/task-054-multishow-duration-anomalies.md) 与 [task-053](../../data/reports/task-053-surviving-recordings-and-source-risk.md)。

## 已知无录像与高价值未解决缺口

- **有意不公开**：[2018-04-14-live-01](../../data/entries/2018-04-douyu-live.yaml)《逃出生天 A Way Out》标记 `no_public_replay: true`，档案记录两处公开讨论称录像因内容原因撤下或未上传。属于历史结论，不是普通漏找；没有发现可替代的完整公开回放。
- **2015 年夏季大周 MC**：失落录像清单 T05 指出日常场次“几乎全无录像”，保留下来的只有 07-06 的 3 分钟片段；建筑比赛与官方剪辑是单独来源，不能填补这些日常场次。已知线索集中在 [task-038](../../data/reports/task-038-wuzetian-mc.md)、[task-045](../../data/reports/task-045-2015-visual-archaeology.md)、[task-048](../../data/reports/task-048-lost-recordings.md)。
- **2018-08-10 大周 MC 第四目第一天**：仅两段片段；010陈 的 2018 年补档说明和导航帖缺档讨论已在 task-048 汇总。**08-11 的第二天日期仍未定**，08-13 第三天只有日志条目、无录像来源；暂不能把任何相邻场次当作缺失片段的替代。
- **2015 录播整体缺口**：`no_public_replay` 有 66 条，另有大量仅存单一来源的条目。较多条目的依据来自直播间快照、节目单或贴吧记录，而不是录像画面。完整性结论应限于“已发现的公开来源”，不等于知道每场完整内容。
- **年代与证据性质**：早期逐日记录常依赖转述。`task-051` 已更正多份 2018–2019 逐日帖的编者与资料来源性质；同一整理者的目录与其转贴不能重复计算成独立佐证。参考 [2016–2019 节目单复核](../../data/reports/task-051-schedule-reconciliation-2016-2019.md)。

## 时间轴覆盖的含义

64 条已有时间轴中，`coverage: partial` 的 14 场表示基准录像覆盖声明为部分；39 场标 `unknown`，表示没有确认录像是否覆盖整场。文档规则要求分 P 缺号时不能标 `complete`，但不能从 P 数量连续或标题完整推断整场已覆盖。多游戏场次里出现 `kind: unknown`，表示片段内容尚未归属游戏；即便 `coverage: complete`，也不代表游戏归属已全部核清。

有时间轴但包含未确定覆盖/内容的早期例子包括：

- `2015-01-23-live-01`、`2015-01-27-live-01`：`coverage: partial`，各有 1 个 unknown span。
- `2015-01-29-live-01`：`coverage: unknown`，有 2 个 unknown span。
- `2015-02-09-live-01`：`coverage: partial`，有 2 个 unknown span。
- `2015-07-06-live-01`：`coverage: partial`，有 2 个 unknown span；但已知短片只涵盖一小段。
- `2016-08-17-live-03`：`coverage: partial`，有 1 个 unknown span。
- `2016-02-20-live-01`：`coverage: partial`，有 1 个 unknown span。

这些状态支持的是“录像/游戏覆盖尚未完全确认”，不自动证明源站还有可追回的整场录像。游戏环节时间轴规范见 [docs/game-time.md](../game-time.md)。

### 全部非 complete 基准源场次

下表覆盖本范围内全部 **14 条 `coverage: partial`** 与 **39 条 `coverage: unknown`**，逐场字段和来源链接见 [early-timeline-coverage-entries.csv](early-timeline-coverage-entries.csv)。该表列出时间轴选定的**基准源**状态；`partial` 或 `unknown` 是基准源覆盖声明，不代表同场所有其他来源也缺失或未覆盖。`other_linked_sources` 仅抄录档案中挂接的其他来源链接，不能自动视为已核实的补全。只有 `known_gap_dispositions` 明示 `playable_complement` 时，当前审阅清单才把对应游戏缺口记为有可播放补源；其他情形需人工检查来源实际内容。

## 在线抽查

2026-10-22 在 B 站网页直接打开并查看了可见页面与播放器画面；未下载或保存媒体文件：

1. [BV1rs411b7od](https://www.bilibili.com/video/BV1rs411b7od/) 页面显示 5 个分 P：P1「2周年」1:30:58；P2–P5 分别为英雄联盟第一至第四局，1:00:42、43:56、36:44、53:44。P1 开头约 00:32 可见主播在摄像头前讲话；接近 P1 尾端（页面播放器约 1:30:20）仍在讲话。这个样本展示了相邻分 P 可以完整对应若干游戏局，却无法单凭分 P 标题判断开场聊天或整场覆盖；本次抽查没有逐秒核完 P5 结尾。
2. [BV1ps411T77E](https://www.bilibili.com/video/BV1ps411T77E/) 页面标题为「女流66大周MC：钓鱼大赛」，上传于 2018-08-12；播放器显示总长 2:43，在约 1:32 的抽查画面可见 MC 游戏画面与摄像头小窗。页面没有 multipart 列表。它证实存在该内容片段，不能证明直播全程。

页内公开可见的分 P 名和时长是页面元数据证据；播放画面抽查只是局部画面证据，未逐条核实首尾，也未用时长短本身判定录像不完整。

## 新发现、历史已知与未确认

**本轮新发现**：`2016-12-15-live-01` 与 `2017-01-14-live-01` 的备注均写“公开录像暂未找到”，但条目没有 `no_public_replay: true`。两条来源字段为空；当前只看到逐日帖的转述，证据为 medium。建议后续在证据复核时决定是否补状态标记，本轮不改数据。

**历史已知**：2015 夏季大周 MC 录像零散、2016-07-27 户外仅片段、2018-08-10 第四目只有片段且整场曾被删除、2018-04-14 有意不发布、2015-09-27 只有节选，以及 2017-12-17 由若干游戏/说书片段构成的部分记录；见上述报告链接与条目备注。

**尚未确认**：绝大多数 `coverage: unknown` 场次的实际录像边界；2018-08-11 第四目第二天日期；片段外是否存在未索引的公开镜像；以及任何未按当前已有目录检索的平台或私人存档。报告中的计数描述当前仓库字段和已有清单，不是对全网录像的穷尽性结论。
