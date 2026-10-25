# 全站 92 条未引用 B 站强候选 metadata 对照

复核范围是 [全站候选 CSV](./all-site-unlinked-part-candidates.csv) 中 92 条新增 `strong_series_explicit_part` 关系。逐键读取根保存的 92 条公开 B 站 API metadata journal，并对照 d019 的 entry 来源、被引用 BV 的既有 metadata 缓存、现有 A 站来源 metadata 和公开账号目录。未发出网络请求、未播放视频、未下载媒体，也没有修改 `data/`。

**每一条新候选都只得到 metadata 核验，不能称为可播、同一场画面已证、日期正确或完整录像。** 页面标题、分 P、日期和时长都是元数据。CSV 为完整逐行证据表：含 API 顶层与页面标题、标题日期和 P 标记、上传时间、owner UID、已挂 B 站来源及其 P/页 metadata、当前 A 站 posting metadata、可复算的页面时长合计。

## 全量结果

- 92 个候选 BV 全部有 API `code=0`，均只含 1 个 API 页面；顶层标题均与触发目录标题完全一致，标题内日期均与对应 entry 日期一致，标题内 P 标记均与目录标记一致。
- 所有 92 个 API `owner_uid` 都是 `29418340`，与公开账号目录中女流录像小屋 [B 站账号](https://space.bilibili.com/29418340) 匹配。owner 显示名也是女流录像小屋。
- 顶层 metadata 时长与唯一页面时长相等，92/92；目录时长经过分钟取整后也均与对应 API 页时长相容。相容只说明字段数值互相一致，不说明连续性或覆盖。
- 页面级标题有 4 条与顶层标题不一致：2 条页面标题日期与 entry 日期冲突，4 条页面标题 P 标记与顶层标记不同。它们列在 CSV 的 `api_page_title_*` 字段中，需作为页面元数据内部冲突保留。
- 82/92 个候选的页号在当前 A 站页面标题中也有相同 P 标记；当前已引用 B 站 metadata 里出现同一个 P 标记的只有 2/92。因此多数候选有一个“相同 P 标签的 A 站页面 + 未被条目引用的 B 站同 P 候选”结构，适合作为来源接缝假设。匹配的是标题字段，未证明两份录像内容相同。

### 页面级字段冲突

| entry | 候选 B 站 | API 顶层 title | API 页面 title | 冲突 |
|---|---|---|---|---|
| `2022-02-27-live-01` | [BV1Aq4y147ZT](https://www.bilibili.com/video/BV1Aq4y147ZT) | `女流-2022.2.27-艾尔登法环 P3` | `女流-2022.2.25-艾尔登法环 P4` | 页面标题日期与 entry 不同，P3/P4 不同 |
| `2022-02-27-live-01` | [BV1FL411N7tm](https://www.bilibili.com/video/BV1FL411N7tm) | `女流-2022.2.27-艾尔登法环 P2` | `女流-2022.2.25-艾尔登法环 P3` | 页面标题日期与 entry 不同，P2/P3 不同 |
| `2022-03-02-live-01` | [BV1AL411N72A](https://www.bilibili.com/video/BV1AL411N72A) | `女流-2022.3.2-艾尔登法环 P3` | `女流-2022.3.2-艾尔登法环 P4` | 页面标题 P3/P4 不同 |
| `2022-03-02-live-01` | [BV1h3411j7i1](https://www.bilibili.com/video/BV1h3411j7i1) | `女流-2022.3.2-艾尔登法环 P2` | `女流-2022.3.2-艾尔登法环 P3` | 页面标题 P2/P3 不同 |

这些是 metadata 内部不一致，不据此判断错挂、错日期、页面播放内容或真实分 P 顺序。需保留与单独人工核验。

### 2 月 27 日与 3 月 2 日：重分段也是可检验解释

不能把上表的顶层 P / API 页面标题不一致直接叫作错 P。已有 A 站来源 metadata 与当前 B 站引用时长呈现一种可能的重新分段对应关系：

| entry | 现挂 B 站 | 候选 B 站顶层标题 / 实际 API 页标题 | A 站标题页 | 纯数值关系（秒） |
|---|---|---|---|---|
| `2022-02-27-live-01` | [BV1yF411t75n](https://www.bilibili.com/video/BV1yF411t75n) 顶层 P1、页时长 16,834；既有播放器抽查见[既有复核记录](./rank1-player-followup.md) | [BV1FL411N7tm](https://www.bilibili.com/video/BV1FL411N7tm) 顶层 P2 / 页标题 P3，10,446；[BV1Aq4y147ZT](https://www.bilibili.com/video/BV1Aq4y147ZT) 顶层 P3 / 页标题 P4，10,449 | A 站 P1 8,417、P2 8,420、P3 10,446、P4 10,449 | B 站现有 P1 16,834 与 A 站 P1+P2 16,837 相近；两个候选页时长分别与 A 站 P3/P4 相同。 |
| `2022-03-02-live-01` | [BV1mr4y1z7dj](https://www.bilibili.com/video/BV1mr4y1z7dj) 顶层 P1、页时长 14,420 | [BV1h3411j7i1](https://www.bilibili.com/video/BV1h3411j7i1) 顶层 P2 / 页标题 P3，11,355；[BV1AL411N72A](https://www.bilibili.com/video/BV1AL411N72A) 顶层 P3 / 页标题 P4，11,359 | A 站 P1 7,210、P2 7,210、P3 11,355、P4 11,359 | B 站现有 P1 14,420 与 A 站 P1+P2 数值相同；两个候选页时长与 A 站 P3/P4 相同。 |

这些对应使“B 站对前两段合并/重新编号、后续页沿用另一套 P 标签”成为可检验解释；它比直接把 3 月 2 日两条定为错挂更符合当前 metadata 数字。不过，页时长相同或相加不证明同一内容、无重复或连续，也不能解决 2 月 27 日 metadata 页标题仍标 2 月 25 日的日期冲突。根此前对 2 月 27 日 A 站接缝做过局部播放器核验，本轮不重复；这些 B 站候选没有因此获得播放器或完整性认证。CSV 保留这些记录的 API 顶层标题、页面标题、分段时长和日期字段，供单独验证。

## 优先检查的五个来源接缝假设

以下五项来自候选标题、当前 B 站源和 A 站 videoList 标题都能找到对应 P 标签的条目。它们更容易设计下一步的逐页内容对照，不代表该候选应自动加入 entry。

| entry | 当前已挂 B 站 metadata | 未挂 B 站候选 API | 已有 A 站相同 P metadata | 可检验假设 |
|---|---|---|---|---|
| `2022-06-04-live-01` | [BV1eL4y1K7Hq](https://www.bilibili.com/video/BV1eL4y1K7Hq) 标 P1，9531 秒 | [BV1xA4y1o7Rz](https://www.bilibili.com/video/BV1xA4y1o7Rz) 标 P2，9312 秒 | [ac35149959](https://www.acfun.cn/v/ac35149959) 标 P2，9320 秒 | 可核对 B 站 P2 候选与 A 站 P2 是否是相同/相近范围，并检查其与已挂 B 站 P1 的交接。 |
| `2022-07-21-live-01` | [BV1jd4y1S7bk](https://www.bilibili.com/video/BV1jd4y1S7bk) 标 P1，5682 秒 | [BV1qe4y19741](https://www.bilibili.com/video/BV1qe4y19741) 标 P2，5848 秒 | [ac35852477](https://www.acfun.cn/v/ac35852477) 标 P2，5847 秒 | 对照两平台 P2 的开尾及 B 站 P1/P2 交接；时长相近本身不是内容一致证据。 |
| `2023-09-22-live-01` | [BV1ap4y1w7Dy](https://www.bilibili.com/video/BV1ap4y1w7Dy) 标 P2，13480 秒 | [BV19w41127Bk](https://www.bilibili.com/video/BV19w41127Bk) 标 P1，13479 秒 | [ac42436272](https://www.acfun.cn/v/ac42436272) 标 P1，13478 秒 | 先比 B 站候选与 A 站 P1 起止，再核对与已挂 B 站 P2 是否连续或存在重复。 |
| `2023-09-26-live-01` | [BV1Vm4y1V7hB](https://www.bilibili.com/video/BV1Vm4y1V7hB) 标 P2，14065 秒 | [BV1vj41187KE](https://www.bilibili.com/video/BV1vj41187KE) 标 P1，14064 秒 | [ac42493917](https://www.acfun.cn/v/ac42493917) 标 P1，14064 秒 | 同样以 P1 的两平台开尾和 P1/P2 交界为检验点。 |
| `2023-11-19-live-01` | [BV1mH4y1q7WR](https://www.bilibili.com/video/BV1mH4y1q7WR) 标 P2，12955 秒 | [BV1n94y1H7yA](https://www.bilibili.com/video/BV1n94y1H7yA) 标 P1，12954 秒 | [ac43013631](https://www.acfun.cn/v/ac43013631) 标 P1，12954 秒 | 核 P1 候选与 A 站 P1 对应，再检查与 B 站 P2 的边界。 |

上述五组 A 站 P1/P2、时长与 B 站候选信息来自现有公开 metadata journal；没有逐段播放核对。实际内容、平台是否仍可播放、录播是否完整以及跨 P 是否无重叠都尚未确认。

## 时长解释与复算边界

CSV 中 `api_page_duration_sum_sec` 是候选 API page duration 的数值合计，`existing_bili_api_page_duration_sum_sec` 汇总当前引用 B 站来源各自 API pages 的数值，`candidate_plus_existing_bili_numeric_sum_sec` 仅为两数相加。若现有整篇投稿含多页、未定位来源或不同游戏，该和数不是目标游戏/直播时长；也不代表不同来源可以相加来证明完整。A 站 `video_list` 标题和时长也只按页面 metadata 抄录，数组序按源数据保留。

逐条数据以 [all-site-unlinked-strong-reviewed.csv](./all-site-unlinked-strong-reviewed.csv) 为准，其中 92 条每行均写明 `metadata_evidence_level` 与 `interpretation_limit`。本报告不建议自动补挂、重排分 P 或改完整性状态；下一步若做播放器核验，应优先从上面的五组接缝逐项比对，并独立处理四条内部 metadata 冲突。
