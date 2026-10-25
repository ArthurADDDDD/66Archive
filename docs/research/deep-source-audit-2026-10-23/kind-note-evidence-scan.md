# Replay/Original 备注与标题语义命中筛查

## 方法与范围

按当前归档快照逐条读取 `data/entries/*.yaml`：共 2960 条记录、6427 个来源引用；其中 kind 为 replay/original 的来源 6392 条。对条目备注、来源备注及可用的缓存投稿标题/分P标题扫描：切片, 精剪, 剪辑, 集锦, 片段, 删减, 不完整, 直播时刻, 部分录像。本次没有网络请求，也没有按时长阈值筛选。缓存未收录的来源依然会检查档案备注。

共命中 106 个来源引用，涉及 53 条entry。按命中位置分桶：{'source_note_semantic_candidate': 8, 'entry_note_context_only': 81, 'platform_title_semantic_candidate': 3, 'source_note_already_explicitly_limited': 14}。其中 2 个命中来源所在entry没有其他来源；29 个命中来源未在本地投稿元数据缓存中找到。命中可来自entry级备注，不能自动视为具体来源本身被剪辑。

页面分P数、part_details数量与缓存页数只用于识别已有结构性覆盖线索；数字相符不证明逐秒完整，数字不符也不单独证明缺段。报告中的分类和优先级是候选排序，不是人工确认或缺档结论。

## 最值得人工回看的候选（最多10条）

1. **2015-10-30 2015-10-30-live-01** — 心灵砒霜；replay https://v.youku.com/v_show/id_XMTM3NjY1MDc3Mg==.html。命中 `剪辑`（source_note）。 原文摘录：2026-09-21 从互联网档案馆抓取的本人优酷空间（i.youku.com/u/UMjQyOTM1MzA4）补上官方优酷来源：官方号 2015-11-03 上传的《女流【心灵砒霜】10.30直播录像》（c_time 2015-11-03 19:49:26），标题直接写明直播日 10.30。优酷那一份时长 179:32（180 分钟），比本条记录的 188 分钟短约 8 分钟，属不同剪辑，未据此改动 duration_min。。 排除/核验线索：同条另有来源，可作互补核查；是否全场仍未由备注词命中裁决；entry时长及来源结构列于CSV。
2. **2016-04-10 2016-04-10-live-01** — 心灵砒霜；replay https://www.acfun.cn/v/ac2662778。命中 `片段`（source_note）。 原文摘录：A站「斗鱼录像厅」（UID 974915）《【心灵砒霜】久违的心灵砒霜 第20160810期》，发布 2016-04-11 18:38，时长 1:11:00。标题期号「20160810」晚于发布日 4 个月，不可能成立，按月份错写还原为 0410：发布滞后 1 天符合该号规律；本条前一场心灵砒霜是 2016-03-27，间隔两周，与标题「久违的」相合。时长 71 分钟短于本条 169 分钟，应为当日部分片段。。 排除/核验线索：同条另有来源，可作互补核查；是否全场仍未由备注词命中裁决；entry时长及来源结构列于CSV。
3. **2016-04-17 2016-04-17-live-01** — 心灵砒霜；replay https://www.acfun.cn/v/ac2678564。命中 `片段`（source_note）。 原文摘录：A站「斗鱼录像厅」（UID 974915）《【心灵砒霜】女朋友和游戏哪个更重要？ DC老师你学到了吗？》，发布 2016-04-18 13:14，时长 1:18:00。标题无期号，按发布滞后 1 天归入 2016-04-17（当日档案已有心灵砒霜一场）。时长 78 分钟短于本条 158 分钟，应为当日部分片段。。 排除/核验线索：同条另有来源，可作互补核查；是否全场仍未由备注词命中裁决；entry时长及来源结构列于CSV。
4. **2016-05-08 2016-05-08-live-01** — 心灵砒霜；replay https://v.youku.com/v_show/id_XMTU4MDA1MjQ2MA==.html。命中 `片段`（source_note）。 原文摘录：她本人优酷号《【心灵砒霜】5月8日“片段1”直播生放送》，上传 2016-05-23 00:57，时长 104:37（2026-09-23 频道页实测）。归属依据：标题自带直播日期。。 排除/核验线索：同条另有来源，可作互补核查；是否全场仍未由备注词命中裁决；entry时长及来源结构列于CSV。
5. **2016-05-08 2016-05-08-live-01** — 心灵砒霜；replay https://v.youku.com/v_show/id_XMTU3OTg5MTMzMg==.html。命中 `片段`（source_note）。 原文摘录：她本人优酷号《【心灵砒霜】5月8日片段2直播生放送》，上传 2016-05-22 18:36，时长 48:21（2026-09-23 频道页实测）。归属依据：标题自带直播日期。。 排除/核验线索：同条另有来源，可作互补核查；是否全场仍未由备注词命中裁决；entry时长及来源结构列于CSV。
6. **2017-08-01 2017-08-01-live-01** — 大周MC第六天：有没有邻居？；replay https://v.douyu.com/show/x0zZVvPKRx4WO4E2。命中 `剪辑|直播时刻`（entry_note|cache_title|cache_description）。 原文摘录：【直播时刻】 大周MC第六天：有没有邻居？ 20170801 15点场-斗鱼视频。 排除/核验线索：同条另有来源，可作互补核查；是否全场仍未由备注词命中裁决；entry时长及来源结构列于CSV。
7. **2018-01-24 2018-01-24-video-02** — 相声专场《看病；replay https://www.bilibili.com/video/BV1PW411x7Td。命中 `切片|剪辑`（entry_note|cache_title）。 原文摘录：（剪辑版）你永远也不知道我到底经历了什么之渣哥结石病。 排除/核验线索：同条另有来源，可作互补核查；是否全场仍未由备注词命中裁决；entry时长及来源结构列于CSV。

## 已有解释/排除注意

`source_note_already_explicitly_limited` 表示来源备注已经写明局部片段、缺口或补充来源；这些仍留在完整命中CSV，供核查“现有说明是否够用”，但不重复包装为新发现。`entry_note_context_only` 只说明同场、剪辑或版本关系可能存在，不能推断该行每个source都不完整。含有完整页、双版本或同条互补来源的候选，应先按来源逐一核对，不能因短版本单独较短而判缺。正常短尾P不会只因时长短而命中。

## 复现

运行脚本需 Python 3、PyYAML；可选的平台 JSONL 元数据仅从本地缓存读取（可重复传入多个缓存文件）：

```bash
python3 docs/research/deep-source-audit-2026-10-23/kind-note-evidence-scan.py \
  --entries data/entries \
  --metadata-jsonl /path/to/bilibili-metadata.jsonl   --metadata-jsonl /path/to/other-metadata.jsonl \
  --csv docs/research/deep-source-audit-2026-10-23/kind-note-evidence-scan.csv \
  --summary docs/research/deep-source-audit-2026-10-23/kind-note-evidence-scan.md
```

本轮仅生成审计候选；未修改正式数据、链接或条目类型。没有检查任何录像画面；缓存未覆盖的平台/来源标题、已删除内容及关键词以外的表达不在本扫描的确证范围内。
