# B 站/AcFun 之外来源公开元数据清查（2026-10-23）

基线 `34b35960`。按 `data/entries/**` 逐 source 引用生成明细，并把每个已规范化 URL 的结果映射回所有引用。核对范围不含 B 站和 AcFun。

本轮通过普通只读 HTTP GET 请求 HTML 页面，单页读取上限 2 MiB，每 host 约 1 秒间隔；不请求媒体流、播放清单或签名媒体 URL，不登录，不绕验证。短链只记录最终公开落地页面（query 参数中疑似 credential/signature 字段会移除）。状态 `metadata_ok` 只表示取得了可用页面标题等 metadata，不代表视频当前能播放、画面内容准确或整场完整；`login_or_challenge` 表示登录/访客验证或 challenge；`blocked` 表示 HTTP 403/412/429；`error` 表示其它失败或无可用 metadata；`host_deferred_due_challenge` 表示某 host 抽样出现 challenge 迹象后暂停，包含未请求 URL；`resume_pending` 是 host 停止后的未请求 URL。

引用数 597，去重 URL 数 597，checkpoint 中实际请求的去重 URL 数 443；结果状态：`host_deferred_due_challenge` 264；`metadata_ok` 331；`login_or_challenge` 1；`resume_pending` 1。另有 1 次不入 checkpoint 的 Youku 抽样响应检查，已观察到 captcha 标记。

- `v.youku.com`：本轮请求 111/264 个；host_deferred_due_challenge 264。
- `v.douyu.com`：本轮请求 326/326 个；metadata_ok 326。
- `tv.sohu.com`：本轮请求 5/5 个；metadata_ok 5。
- `t.cn`：本轮请求 1/2 个；login_or_challenge 1，resume_pending 1。

Youku 的 264 条 source 引用中，111 个 URL 本轮收到约 1.5 KB、无可用标题 metadata 的 HTTP 200 小页面；额外一次公开 HTML 抽样含 `captcha` 字符串。其余 153 个 URL 未请求，统一标为 challenge 风险待复核。Douyu 的 326 个页面均取得具体视频标题和时长 metadata；Sohu 的 5 个页面取得标题，但本轮未提取到时长。t.cn 的首个短链跳转至 passport/visitor 页面后停止，另一条未请求。所有 `metadata_ok` 行的 `playback_status` 均为 `unverified`；本轮没有播放或查看录像画面。

逐条 URL 与来源引用、原档案 status/kind、公开页面 title/date/duration、请求状态见 [`other-host-sources.csv`](other-host-sources.csv)。

## 未确认事项

- 独立普通 Chrome 访问[原始 Youku 视频页](https://v.youku.com/v_show/id_XMTI1NzkyMTE3Mg==.html)时出现“请验证后继续”；未尝试绕过验证，也未保存挑战落地 URL。该来源当前能否播放仍未核实。
- 页面 metadata 不能证明录像画面对应条目游戏、属于日期或覆盖整场；本清查没有观看或下载媒体。
- 本报告不把档案 `alive` 状态改写为本轮已播放，也不改动正式数据。
- 公开页面拒绝访问、要求验证或没有可用 metadata 的来源需由后续人工浏览器核对；本轮在相应 host 出现挑战时停止，不继续重试。
- `confidence: low` 不适用；未修改 `data/**` 或功能代码。
