# 下一批唯一来源候选：本轮未找到符合条件的新对象

本次仅复核 [remaining-access-gaps-priority.md](remaining-access-gaps-priority.md)、其四行来源表 [remaining-access-gaps-priority.csv](remaining-access-gaps-priority.csv)、正式条目备注，以及既有播放器观察汇总 [youku-unique-live-player-followup.md](youku-unique-live-player-followup.md)。没有联网、打开播放器或改正式数据。

## 筛选结果

当前优先清单中没有剩余候选同时满足“唯一登记来源、低可信、非官方、没有内容观察、也没有已成功播放器核验”。四个清单项都已有逐条成功的局部播放器记录；其中三项是女流本人官方优酷来源，另一项虽由非官方上传者提供，但条目为 high confidence，且已有内容样本与详细备注。因此不把已采样来源重新推荐为“未观察候选”。

| 条目 / 来源 | 条目置信度与来源类型 | 元数据层 | 访问层 | 内容层与排除原因 |
|---|---|---|---|---|
| [2015-01-30-live-01](../../../data/entries/2015-douyu-live.yaml) — [瓦塔诺GO 投稿](https://v.youku.com/v_show/id_XODgzNzgxNzky.html) | 条目 high；登记来源为 other，非官方；来源唯一 | 条目备注有播单标题、约 11353 秒与上传记录 | 既有报告记录先前页面/播单可用；本批挑战页汇总不能覆盖该历史状态 | 已有局部内容观察：主媒体约 11352.933 秒，t=600 秒可见舞蹈类游戏主菜单与玩偶摄像头。仅一处样本，不是完整性核验；因已观察且条目并非 low confidence 而排除 |
| [2015-07-28-live-01](../../../data/entries/2015-douyu-live.yaml) — [官方优酷](https://v.youku.com/v_show/id_XMTI5NzY4MjU4NA==.html) | 条目 high；youku-official | 旧条目记标题、上传时间与约 187 分钟 | 旧记录曾访问成功；近期批次将主机响应列为 challenge/deferred | 已有两处局部播放器样本：600 秒 Minecraft 场景/HUD；11215 秒感谢观看片尾。不是全片或母场日期核验；官方来源且已有内容观察，排除 |
| [2015-10-09-live-01](../../../data/entries/2015-douyu-live.yaml) — [官方优酷](https://v.youku.com/v_show/id_XMTM2NTYxODQ2MA==.html) | 条目 medium；youku-official | 旧条目记标题、上传时间与 205:46 | 近期批次 challenge/deferred；既有定点浏览器核验成功 | 已有两处局部样本：600 秒 Minecraft 服务器场景；12330 秒近尾建筑/服务器画面。不是全片或结尾完整性核验；官方来源且已有内容观察，排除 |
| [2015-12-07-live-01](../../../data/entries/2015-douyu-live.yaml) — [官方优酷](https://v.youku.com/v_show/id_XMTQwNzczOTk2MA==.html) | 条目 high；youku-official | 旧条目记题名、84:41 与简介自述“12月7日” | 近期批次 challenge/deferred；既有定点浏览器核验成功 | 已有一处局部样本：600 秒可见节奏天国青蛙合唱关卡、日文节拍提示和摄像头。不是全片或直播日期独立认证；官方来源且已有内容观察，排除 |

上述播放器结果来自既有报告，不是本轮重新播放。挑战页访问批次状态与后续/先前具体播放器可播观察是不同层级的记录，不能把其中一层抹去另一层。

## 覆盖缺口

- 结论只针对该优先清单中的四个 unique-live leads。它不能说明其余 unique-source 视频条目已审，也不能说明站点所有 Youku 源都可访问。
- 四个已有播放器报告都只做局部样本，没有整片内容审核；具体未核范围分别保留在 [Youku 唯一来源局部接续报告](youku-unique-live-player-followup.md)。
- `2015-01-30-live-01` 虽为非官方单源，但条目置信度为 high 且已经有内容样本；`2015-10-09-live-01` 虽为 medium，但来源为官方且已有内容样本。没有对象符合完整筛选条件。
- 不把挑战页批次中的 deferred 状态解释为资源不存在，也不把页面 metadata、旧播放器观察或 upload date 解释为全片完整或直播日认证。

因此，本批不推荐新的播放器核验 URL；建议先补充别的未观察来源清单或确实仍无内容记录的条目，再做下一批优先级排序。
