# 来源身份UID证据精确合并方法（2026-10-25）

本工具把现有来源引用与数值UID证据按平台和公开投稿ID关联，输出单独的身份补充表。它不重新请求页面，不读取或改写元数据台账，不更改内容观察，也不修改正式`data/**`。姓名、昵称、标题、`source.account`和预期账号均不用于推导UID。

## 已确认的输入格式

- `source-credibility-reviewed.csv`：每行一个基线引用，使用精确`entry_id`、`source_index`、原始`source_url`；含基线`platform_metadata_owner_uid`和`expected_account_uid`。
- `reused-owner-uid-evidence-2026-10-25.csv`：已确认的结构化复用字段为`platform, post_id, entry_id, source_index, baseline_source_url, evidence_source_url, uid, evidence_file, evidence_json_pointer`等。每条必须同时精确命中一个基线引用及其平台/投稿ID；不使用显示名。
- 刷新脚本的JSONL每行严格为`platform,id,page_url,uid,name,fetched_at,status,http_status,field`。`attempted`、挑战、错误或无UID的成功元数据状态不构成新数字UID。若一条投稿的记录中有不同数值UID，工具将并列保留为冲突，不选取一个覆盖其它值。

## 输出字段和判断

运行[`build-source-identity-evidence.py`](build-source-identity-evidence.py)可生成单独的`source-identity-evidence-2026-10-25.csv`。每条基线引用独立保留`entry_id, source_index, source_url, platform, post_id`，并列出`baseline_uid, new_uid, effective_uid, identity_status, expected_account_uid, uid_match_status, refresh_statuses, evidence_refs, provenance, human_watch`。只有所有可用数值UID一致时才产生`effective_uid`；发生冲突时留空并标为`uid_conflict_manual_resolution_required`。没有UID时保留空值及相应状态，不从名字补值。

命令行参数均由运行者提供或使用仓库内默认CSV；刷新JSONL必须显式提供。输出目录必须已存在。示例：

```bash
python3 build-source-identity-evidence.py \
  --refresh-jsonl <refresh-journal.jsonl> \
  --output <source-identity-evidence-2026-10-25.csv>
```

## 当前范围与限制

已确认可复用CSV目前只有一条AcFun精确投稿UID记录，B站为零；这只是现有结构化研究证据与缺UID队列的精确交集，不代表旧缓存曾有该UID。刷新JSONL尚未作为可用输入提供，因此本轮只准备了工具并用临时合成记录测试解析流程，没有生成正式来源身份输出表。等JSONL可用后再运行，检查输出行数、引用唯一键、有效UID冲突和预期账号匹配；所有字段仍是机器拼接身份线索，`human_watch=false`，不把`metadata_ok`写成“已审核”。

## 2026-10-25 实际运行

真实刷新记录已生成并用本工具合并为[source-identity-evidence-2026-10-25.csv](source-identity-evidence-2026-10-25.csv)：6,427行、引用键唯一、B站与AcFun引用均有`effective_uid`、无冲突、`human_watch=false`。刷新记录新增的`unavailable`状态（平台当前不公开展示该投稿）映射为`refresh_post_not_publicly_shown`，本次运行中未出现。注意：复用证据在刷新记录里也写成一行`reused_uid`，因此那1条显示为`reused_and_refresh_uid_agree`，实际只有复用证据，没有再次请求。
