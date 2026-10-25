# 13 个 A 站时长未决条目的 B 站目录候选

复核对象为 `acfun-duration-triage.csv` 中 `duration_difference_unresolved` 的 13 场。以 d019 基线的条目、所有条目来源、`bilibili-record-house.csv`、`bilibili-search-2024-2026.csv` 和现有 B 站 metadata cache 做只读交叉检查；没有联网、重抓 API、播放视频或修改 data。

后续在线更新：本报告仅为本地筛选快照；12个未挂候选现已全部API成功，其中11个有可辨认局部内容、1个仍有黑底/seek缺口，见[在线接续](unlinked-candidates-player-followup.md)。不再把它们一概称为只有目录证据。

## 结果

按 B 站记录中的直播日期与标题/作品线索筛选，再按 BV 去重，共整理 30 条候选及同日对照行：

- 12 条标题/作品与目标条目相符、但当前没有被任何条目来源引用的候选，涉及 7 场。
- 13 条目标日期目录记录已被目标条目引用，可作为既有引用对照。
- 5 条只因日期相同而出现、标题/作品不符的记录，保留为反例，避免把相邻或同日内容误认为同场。
- 12 个未引用候选都没有出现在现有 B 站 metadata cache 中。现有目录给出的标题/时长可用于排序，但这些候选尚无本地 API metadata 快照。

| 目标场次 | 未引用候选（目录标题原文） | 目录时长 | 当前条目关联情况 |
|---|---|---:|---|
| `2022-02-25-live-01` | [BV1da41187va](https://www.bilibili.com/video/BV1da41187va)「女流-P1-2022.2.25-艾尔登法环」；[BV1Nu411Q79H](https://www.bilibili.com/video/BV1Nu411Q79H)「女流-P2-2022.2.25-艾尔登法环」；[BV1zm4y1R75f](https://www.bilibili.com/video/BV1zm4y1R75f)「女流-P4-2022.2.25-艾尔登法环」 | 169:25；169:26；169:25 | 当前条目引用 P3 `BV1oY411G7nx`。P1/P2/P4 是按各自标题标记列出的候选，不由目录行序推断。 |
| `2023-10-13-live-01` | [BV1T34y1g7dn](https://www.bilibili.com/video/BV1T34y1g7dn)；[BV1BH4y1R769](https://www.bilibili.com/video/BV1BH4y1R769)，目录标题均为「【女流】2023年10月13日录《堕落之主》」 | 229:41；229:43 | 当前条目引用同标题 BV1Nw411C7Mn（229:42）。两条目录候选标题没有 P 号，不据目录次序赋予 P1/P3。 |
| `2023-10-20-live-01` | [BV1BN4y1C7Bp](https://www.bilibili.com/video/BV1BN4y1C7Bp)「【女流】2023年10月20日录播《超级马里奥兄弟 惊奇》P2」 | 257:52 | 当前条目引用标题 P1 的 BV1wj411i72W。 |
| `2023-10-24-live-01` | [BV13Q4y1W7iV](https://www.bilibili.com/video/BV13Q4y1W7iV)「【女流】2023年10月24日录播《超级马里奥兄弟 惊奇》P2」 | 221:59 | 当前条目引用标题 P1 的 BV1cH4y1R7LU。 |
| `2023-10-29-live-01` | [BV1De411971P](https://www.bilibili.com/video/BV1De411971P)「【女流】2023年10月29日录播《心灵杀手2》P1」 | 216:10 | 当前条目引用标题 P2 的 BV1Cc411f7du。 |
| `2023-10-30-live-01` | [BV16Q4y1H78a](https://www.bilibili.com/video/BV16Q4y1H78a)「【女流】2023年10月30日录播《心灵杀手2》P1」；[BV11C4y1n7Mu](https://www.bilibili.com/video/BV11C4y1n7Mu)「【女流】2023年10月30日录播《心灵杀手2》P3」 | 180:53；180:54 | 当前条目引用标题 P2 的 BV1zG411C7gD。 |
| `2023-11-12-live-01` | [BV1fH4y1i7LW](https://www.bilibili.com/video/BV1fH4y1i7LW)「【女流】2023年11月12日录播《心灵砒霜弹幕版》P2」；[BV1Mj411a7YB](https://www.bilibili.com/video/BV1Mj411a7YB)「【女流】2023年11月12日录播《心灵砒霜》」 | 118:07；236:11 | 当前条目系列为心灵砒霜，引用同日 P1 弹幕版 BV1Bg4y1Q7Cp。第二条题名不是同一组 P 标签，列为系列/日期线索而非确证互补页。 |

`2019-04-30-live-01`、`2019-05-08-live-01`、`2021-08-28-live-01`、`2022-04-08-live-01`、`2022-05-04-live-01`、`2022-07-24-live-01` 在按日期和作品/标题查阅的目录中没有新增、未引用的直接候选。它们分别有现存同标题引用；其中 2022-04-08 另有同日《Outer Wilds》目录项，但目标条目的现有说明将其限定为独立的开播前聊天录像，故没有列作该聊天标题的补挂候选。所有同日异题对照 BV、链接归属和目录清单见 CSV。

## 判读边界

“未被引用”只表示 BV 没出现在 d019 全部 entry 的 `sources[].url` 中；“候选”表示目录记录的直播日期和标题/作品与该目标场次相符。它们不证明上传者、实际画面、同场关系、分 P 连续性或录像完整性，也不表示应把来源补挂到这个条目。标题自带 P 号时只抄录标题标记，未以目录行序重建分 P 顺序。无 P 号的 10 月 13 日同标题 BV 尤其不能仅凭列表位置分配 P1/P3。

CSV [unlinked-catalog-candidates.csv](./unlinked-catalog-candidates.csv) 包含每条候选与同日对照行、两个目录的来源标记、标题/时长、是否已被目标条目或其他条目引用、metadata cache 是否存在以及公开视频 URL。候选缓存缺失，所以本轮没有元数据接口字段对照；当前目录结果也不确认播放状态。
