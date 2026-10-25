# AcFun 未挂目录详情审计：本地自检

日期：2026-10-24。本自检只核对固定336个目录投稿的详情审计产物、已存在的公开 metadata 缓存与本轮请求 checkpoint；没有发起网络请求、打开播放器、改主表或正式数据。它是本地结构/计数自检，不是人工内容审阅。

## 覆盖与缓存复用

- `acfun-directory-unlinked.csv` 的输入 ID 集合为336个唯一投稿 ID；JSONL 与 CSV 均为336行、336个唯一 ID，集合相同，无遗漏、无额外 ID，行序一致。
- 最终 `acquisition` 计数为300条 `new_public_page_get`、36条 `reused_local:*`。36条按缓存来源为19条强候选 metadata、5条 weak metadata、5条 unmapped metadata、2条无效日期 metadata、5条 Nov 12 metadata。总数与审计报告所述一致。
- 外接盘目录实际可读；其本批请求 checkpoint 有300条、300个唯一 ID，状态全为 `metadata_ok`。与输出中300条新取记录逐项比较 `status`、来源、HTTP状态、页URL、标题、UID、内页数量及内页序列，均一致。该 checkpoint 不包含额外投稿行。
- 公开 AcFun metadata 汇总日志也可读；固定336候选 ID 未在该日志中出现，不存在一组未纳入此次固定缓存复用计算的成功记录。36条复用来源均由最终 `acquisition` 字段明确标出。

## 字段、规范化与计数复算

- Nov 12 的5条复用记录 ID 为 `42944705`、`42944704`、`42936261`、`42936259`、`42936286`。逐项将原缓存 `id` 与 `url` 对照最终 `ac_id`、`page_url`：ID一致，URL均为规范形式 `https://www.acfun.cn/v/ac{ac_id}`；未将内页 CID 当作投稿 ID，也未把 `/v/ac...` 内链误记为页面主 URL。对应公开 UID 均为 `4397992`，页标题、一个内页的标题和秒数均保留；原缓存的播放器 sample 不被改写成 metadata 字段或完整性结论。
- 所有336条记录的 `page_url` 与 `ac_id` 一一相符；`catalog_public_url` 也对应同一投稿。336条均为 `metadata_ok`、公开 UID `4397992`，均有非空 `video_list`。
- 逐条统计得到内页数合计1,196；零秒内页数为0；至少含一个不超过60秒内页的投稿数为1（ac3017346，11秒）。
- 异常 flags 复算与报告的记录级计数一致：顶层/内页标题日期冲突10条；非单调标题 P 序号3条；同页重复标题 P 标签5条，其中同标题范围重复2条、跨标题/节目重复编号3条；多作品名线索3条。注意底层分类也保留 `multiple_title_dates` 10条，与“顶层/内页日期冲突”描述同属这10条，不应把两类加总成20条独立冲突。
- JSONL 与 CSV 逐行逐字段核对无语义差异。CSV 的 `video_list` 用 JSON 字符串编码，`anomaly_flags` 用分号连接列表；按此格式展开后与 JSONL 一致。此前直接比较原生列表与CSV字符串会产生表面差异，不是字段错位。

## 判断边界

审计报告里的300/300成功仅指普通公开详情页 metadata 请求成功；它不等于300条媒体均可播放。36条复用表示复用了先前取得的公开页面 metadata，不代表本轮重新请求或重新播放。详情标题、UID、内部页标题及秒数均不能单独确认母场日期、游戏内容、跨页连续、是否剪辑或整场完整。

`git diff -- data` 与暂存区 `git diff --cached -- data` 均为空；正式 `data/` 未改。本轮没有修改审计 JSONL、CSV 或主观察 JSON，只新增本自检文件。
