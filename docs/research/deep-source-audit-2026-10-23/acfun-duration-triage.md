# AcFun 时长差异候选：跨来源覆盖分级

复核日期：2026-10-23。数据基线为正确 worktree 的 `db4b9fa7`。只读整合本地 AcFun 投稿元数据与 B 站全部分 P 缓存，并回看 88 个 entry 的来源列表；没有网络请求、媒体下载、代码/正式数据改动或发布。

逐条结果见 [acfun-duration-triage.csv](./acfun-duration-triage.csv)。CSV 为 88 个唯一 entry，每条记录其 AcFun 来源、videoList 页数/总时长、B 站逐来源可比时长、主来源和风险分类；CSV 中给出的播放器 URL 是后续人工抽查建议，不代表本轮已打开播放。

## 统计与限制

- 候选集取 `acfun-review-candidates.csv` 中 `entry_duration_vs_sum_of_unique_acfun_posts_candidate` 行，116 行去重后为 88 场；每场来源按唯一 ac ID 去重。AcFun 列表按当前 `videoList` 数组顺序统计，页号即 1 起的数组序。
- 对 B 站来源，若来源 URL 带 `?p=N`，只比较缓存中该页时长；有 `part_details` 则比较登记页集合；否则比较整个投稿分 P 总时长。这样避免把同一 B 站合集里别场/别游戏的页面误当本场时长。
- AcFun 比较的是 `videoList` 分页 duration_sec 合计，并并列保留投稿页 `page_metadata_duration_sec`。API 的零值、短值或总时长差异都只是复核线索。以 ac2434647 为例，已有前序实播记录为 87:38，而缓存 API 列表是 52:49；不能将 API 差值直接解释成缺段。
- 多条 A 站投稿的时长合计只标“可能需合计”，标题/日期匹配和时长接近都不能证明投稿连续、无重叠或覆盖同一整场。其它平台 URL 保留在 CSV；本轮没有其逐段播放时长，所以不据此判断覆盖。88 场中 ac2434647 仍是 `imported_partial_metadata` 旧缓存，未在本轮重抓，需单独保留这一证据限制。

## 分级结果

- `short_AcFun_vs_longer_scoped_Bilibili_alternative`：53 场。分类可重叠，含义见 CSV assessment。
- `multiple_AcFun_posts_check_additivity`：24 场。分类可重叠，含义见 CSV assessment。
- `duration_difference_unresolved`：13 场。分类可重叠，含义见 CSV assessment。
- `AcFun_API_zero_or_near_zero_page`：6 场。分类可重叠，含义见 CSV assessment。
- `AcFun_sum_closer_than_any_single_post_candidate`：4 场。分类可重叠，含义见 CSV assessment。
- `AcFun_metadata_near_entry_duration_not_proof`：1 场。分类可重叠，含义见 CSV assessment。
- `default_AcFun_short_no_confirmed_longer_source`：1 场。分类可重叠，含义见 CSV assessment。
- `only_alive_AcFun_substantially_shorter`：1 场。分类可重叠，含义见 CSV assessment。

这些类别不是完整性判决。时长明显短、投稿可合计、来源主次或 API 异常均需以播放器核对；不把条目时长与单个来源时长的差值称为录像缺失。

## 建议优先播放器核对（最多 10 场）

以下为建议下一轮人工播放器核对的公开 URL 与具体页号；本轮没有播放确认。

| entry | 原因 | 建议打开的页 |
|---|---|---|
| `2020-03-16-live-01` | default_AcFun_short_no_confirmed_longer_source; only_alive_AcFun_substantially_shorter | [https://www.acfun.cn/v/ac13922064_1](https://www.acfun.cn/v/ac13922064_1); [https://www.acfun.cn/v/ac13922064_2](https://www.acfun.cn/v/ac13922064_2); [https://www.acfun.cn/v/ac13922064_3](https://www.acfun.cn/v/ac13922064_3) |
| `2017-01-21-live-01` | multiple_AcFun_posts_check_additivity; AcFun_sum_closer_than_any_single_post_candidate; AcFun_API_zero_or_near_zero_page; short_AcFun_vs_longer_scoped_Bilibili_alternative | [https://www.bilibili.com/video/BV1rs411b7od](https://www.bilibili.com/video/BV1rs411b7od); [https://www.acfun.cn/v/ac3422592_1](https://www.acfun.cn/v/ac3422592_1); [https://www.acfun.cn/v/ac3422592_2](https://www.acfun.cn/v/ac3422592_2); [https://www.acfun.cn/v/ac3422739_1](https://www.acfun.cn/v/ac3422739_1) |
| `2023-09-29-live-02` | multiple_AcFun_posts_check_additivity; AcFun_API_zero_or_near_zero_page; short_AcFun_vs_longer_scoped_Bilibili_alternative | [https://www.bilibili.com/video/BV1P94y1Y7Ps](https://www.bilibili.com/video/BV1P94y1Y7Ps); [https://www.bilibili.com/video/BV1K84y1S7Np](https://www.bilibili.com/video/BV1K84y1S7Np); [https://www.acfun.cn/v/ac42512128_1](https://www.acfun.cn/v/ac42512128_1); [https://www.acfun.cn/v/ac42511949_1](https://www.acfun.cn/v/ac42511949_1) |
| `2016-08-09-live-02` | AcFun_API_zero_or_near_zero_page; short_AcFun_vs_longer_scoped_Bilibili_alternative | [https://www.bilibili.com/video/BV1Ms411y7VU](https://www.bilibili.com/video/BV1Ms411y7VU); [https://www.acfun.cn/v/ac3009606_1](https://www.acfun.cn/v/ac3009606_1); [https://www.acfun.cn/v/ac3009606_3](https://www.acfun.cn/v/ac3009606_3) |
| `2016-09-16-live-02` | AcFun_API_zero_or_near_zero_page; short_AcFun_vs_longer_scoped_Bilibili_alternative | [https://www.bilibili.com/video/BV1Ks411t7g6](https://www.bilibili.com/video/BV1Ks411t7g6); [https://www.acfun.cn/v/ac3110151_3](https://www.acfun.cn/v/ac3110151_3) |
| `2017-01-22-live-01` | AcFun_API_zero_or_near_zero_page; short_AcFun_vs_longer_scoped_Bilibili_alternative | [https://www.bilibili.com/video/BV1Rs411b7sn](https://www.bilibili.com/video/BV1Rs411b7sn); [https://www.acfun.cn/v/ac3429201_1](https://www.acfun.cn/v/ac3429201_1) |
| `2017-01-29-live-01` | AcFun_API_zero_or_near_zero_page; short_AcFun_vs_longer_scoped_Bilibili_alternative | [https://www.bilibili.com/video/BV13s41187js](https://www.bilibili.com/video/BV13s41187js); [https://www.acfun.cn/v/ac3437161_2](https://www.acfun.cn/v/ac3437161_2) |
| `2021-07-21-live-01` | multiple_AcFun_posts_check_additivity; AcFun_sum_closer_than_any_single_post_candidate; short_AcFun_vs_longer_scoped_Bilibili_alternative | [https://www.bilibili.com/video/BV1Bw41197E4](https://www.bilibili.com/video/BV1Bw41197E4); [https://www.acfun.cn/v/ac30344411_1](https://www.acfun.cn/v/ac30344411_1); [https://www.acfun.cn/v/ac30343760_1](https://www.acfun.cn/v/ac30343760_1) |
| `2023-09-06-live-01` | multiple_AcFun_posts_check_additivity; AcFun_sum_closer_than_any_single_post_candidate; short_AcFun_vs_longer_scoped_Bilibili_alternative | [https://www.bilibili.com/video/BV1ej41117wj](https://www.bilibili.com/video/BV1ej41117wj); [https://www.acfun.cn/v/ac42278014_1](https://www.acfun.cn/v/ac42278014_1); [https://www.acfun.cn/v/ac42278013_1](https://www.acfun.cn/v/ac42278013_1) |
| `2016-01-03-live-01` | multiple_AcFun_posts_check_additivity; AcFun_sum_closer_than_any_single_post_candidate | [https://www.acfun.cn/v/ac2434647_1](https://www.acfun.cn/v/ac2434647_1); [https://www.acfun.cn/v/ac2434644_1](https://www.acfun.cn/v/ac2434644_1) |

## 结论边界

本表只回答“现有来源元数据是否提供较长替代、可能需要多投稿合计、或存在 API 异常”等排序问题。未逐段播放 88 场的录像，未验证直播时长字段语义，也未确认不同投稿间没有重复/缺段。因此不据此改 `source.kind`、`duration_min`、来源主次或 `missing_footage`。
