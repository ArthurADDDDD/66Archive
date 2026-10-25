# 可复用的公开投稿者 UID 证据（2026-10-25）

本次只读检查 `source-credibility-reviewed.csv` 的当前缺UID队列、`account-attribution-reviewed.csv` 与 `docs/research/**/*.json` 中有结构化字段的记录；没有网络请求，也没有修改正式档案或主观察表。

## 结果

当前 `refresh-missing-owner-uids.py` 的精确投稿去重队列为 B站 **923** 个、AcFun **1,162** 个。可由现存结构化研究证据精确复用的只有 **1** 个投稿：AcFun 1 个，B站 0 个。该条已列在同目录的 [CSV 明细](reused-owner-uid-evidence-2026-10-25.csv)。

| 平台 / 投稿 | 对应基线引用 | 公开数值 UID | 精确证据 | 作者公开名 |
|---|---|---:|---|---|
| AcFun `ac12384734` | `2020-01-12-live-01`, source index `1` | `4397992` | [jan12-2020-bili-acfun-first-danmaku-page-followup.json](jan12-2020-bili-acfun-first-danmaku-page-followup.json)，`$.acfun_submission.url` 与 `$.acfun_submission.owner_uid` | 该记录没有同投稿的显示名字段；台账 `platform_metadata_owner_name` 也为空，故留空 |

这是一条**近期专项结构化证据**与当前缺UID投稿键的精确匹配，不是旧成功缓存曾包含 UID 的证明。该 JSON 把完整投稿 URL 与 `owner_uid` 放在同一 `acfun_submission` 对象内；按公开URL解析出的投稿ID与缺UID队列中的 AcFun ID 完全一致。没有从昵称、标题、`source.account` 或预期账号推断身份。

B站的近期观察JSON确实含有若干明确 `owner_uid` / `owner_mid` 字段，但对应BV在当前逐来源台账已带有 `platform_metadata_owner_uid`，按刷新脚本的规则会从缺UID队列跳过。例如BV1W4411o7R3和BV1wx411E7An目前已不是待刷新项，故不列入复用结果。`account-attribution-reviewed.csv` 的精确投稿URL与数字 `actual_uid` 没有命中当前缺UID队列。

## 复算与边界

复算使用 `refresh-missing-owner-uids.py` 的 `load_missing_refs()` 逻辑：先按平台与BV/av/AcFun ID归并，再只保留同一投稿所有引用均没有 `platform_metadata_owner_uid` 的项目。因此队列数是923/1,162，而不是逐行简单计数时会重复的引用数。

搜索仅接受结构化 JSON 对象或 CSV 行中可核对的公开数字UID字段，并要求同一对象或明确的投稿上下文具有精确URL/投稿ID。采集器、账号目录、显示名相同、文本叙述或标题中的账号名称均不视作同投稿UID证据。冲突UID须并列保留、不裁定；当前唯一匹配未发现冲突。未命中的项目仍需新的公开页面元数据，不能据本次离线扫描说其页面没有UID。
