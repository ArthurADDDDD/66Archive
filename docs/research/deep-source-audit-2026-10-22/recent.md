# 2024 年起条目来源与完整性审计（2026-10-22）

## 覆盖与核对层级

基线为部署提交 `e5294a91`。本轮覆盖 `2024-01-10` 至 `2026-10-22` 的正式 `live` / `video` 条目，共 **297 条**（297 live、0 video），共 **791 个来源引用**；平台分布：bilibili 5 条、douyin 292 条。逐条阅读条目标题、游戏标签、`note`、每个 `source.note`、来源种类/状态/URL；并对照已部署版 `game-footage.ts`、`docs/game-time.md` 及仓内相关来源目录与报告。

CSV 为逐条清单，每个正式条目一行，列出来源 URL 和原有来源说明。`metadata_only` 表示本轮仅核对仓内元数据，不能据此断言录像完整或游戏内容准确；`unresolved` 表示有多游戏未拆章节、来源说明未完成核验等待查事项；`problem_confirmed_from_existing_evidence` 仅表示仓内已有说明明确指出的切片、混入或覆盖问题，属于历史记录证据，本轮未重新打开相关视频。没有条目标为 `online_checked`：本轮尝试直接打开 `2026-06-22-live-01` 的主源 `BV1WJ7K6iEXV` 和官方来源 `BV1R9jH6YEfr`，前者此工具无法访问、后者返回 412；没有获得页面元数据、分 P 信息或画面，因而不记作在线核验，也没有播放画面。

## 结果统计

`metadata_only` 247 条；`unresolved` 41 条；`problem_confirmed_from_existing_evidence` 9 条。风险标记用于后续排队，不等同于确认档案错误。所有 297 条均尚未在本轮确认正文画面；因此不能以标题、游戏关键词或搬运者标注替代画面核验。

## 已有证据明确提示的高风险条目

以下只是据条目现有 note 提取的先查队列，具体依据与原始来源地址见 CSV；没有据此改写正式档案。

- `2025-11-28-live-01`：existing_note_risk_or_scope;existing_notes_confirm_clip_or_coverage_issue。同一场直播由 bobi华（3:26:01）、服部平次（弹幕版 3:30:20）、直播回放巴拉蹦吧（弹幕/纯净双版 3:30:55）分别搬运，不懒bot 的投稿为剪辑分 P + 末尾整段完整录像（完整录像 3:30:01），总时长吻合，已合并为一天一条。 不懒bot源“剪辑分P+完整录像页”为同场两版，只按一版计时。 来源备注：replay/alive:  || replay/alive: 
- `2025-12-12-live-01`：existing_note_risk_or_scope;existing_notes_confirm_clip_or_coverage_issue。同一场直播（TGA2025 颁奖典礼）由 不懒bot（剪辑上/下 3:25:42 + 完整 3:25:37）、直播回放巴拉蹦吧（弹幕/纯净双版 3:25:15）、bobi华（3:25:19）与 服部平次（3:25:10）分别搬运，总时长吻合，已合并为一天一条。 不懒bot源“剪辑上/下+完整”为同场两版，只按一版计时。 来源备注：replay/alive:  || replay/alive: 
- `2025-12-17-live-01`：existing_note_risk_or_scope;existing_notes_confirm_clip_or_coverage_issue。同一场直播（18:15 开播聊天→虚实万象 Pragmata→啵点节奏 Bits & Bops→20:47 收尾）由 服部平次（2:31:44）、bobi华（2:32:22）与 直播回放巴拉蹦吧（弹幕/纯净双版 2:32:44）整场分别搬运，不懒bot 拆为两段投稿（PRAGMATA 段 ~1:10、啵点节奏段 ~1:22，均含剪辑分 P + 完整录像页，合 2:32），各来源总时长吻合，已合并为一天一条。 不懒bot源“啵点节奏剪辑+完整页”为同场片段两版；整场以 2:32:44 主源计时。 来源备注：replay/alive:  || replay/alive: 
- `2025-12-27-live-01`：existing_note_risk_or_scope;existing_notes_confirm_clip_or_coverage_issue。同一场直播由 bobi华（BV11HByB8Evv，4:03:58）、直播回放巴拉蹦吧（弹幕/纯净双版，4:04:17）分别搬运，不懒bot 的投稿为剪辑分 P + 完整录像页（剪辑 4:03:49），总时长吻合，已合并为一天一条。 不懒bot源“剪辑分P+完整页”为同场两版，只按一版计时。 来源备注：replay/alive:  || replay/alive: 
- `2025-12-28-live-01`：existing_note_risk_or_scope;existing_notes_confirm_clip_or_coverage_issue。同一场直播由 bobi华（BV1tMvkBDE1D，2:43:40）、直播回放巴拉蹦吧（弹幕/纯净双版，2:43:48）分别搬运，不懒bot 的投稿为剪辑分 P + 完整录像页（剪辑 2:43:04），总时长吻合，已合并为一天一条。 不懒bot源“剪辑分P+完整页”为同场两版，只按一版计时。 来源备注：replay/alive:  || replay/alive: 
- `2026-01-22-live-01`：existing_note_risk_or_scope;existing_notes_confirm_clip_or_coverage_issue。同一场直播由 bobi华（BV1c7BfB8EDD，3:07:38）、直播回放巴拉蹦吧（弹幕/纯净双版，3:06:43）、服部平次（BV1AVBfBAE6g，3:07:01）分别搬运，不懒bot 的投稿为剪辑分 P + 完整录像页（剪辑 3:06:32），总时长吻合，已合并为一天一条。 不懒bot源“剪辑分P+无弹幕页”为同场两版，只按完整一场计时。 来源备注：replay/alive:  || replay/alive: 
- `2026-02-05-live-03`：existing_note_risk_or_scope;existing_notes_confirm_clip_or_coverage_issue。来源为 B 站搬运（女流66 抖音直播回放），非官方账号投稿 5.5min 鸣潮短视频为同日鸣潮直播切片，并入本条，不单独计场次。 来源备注：replay/alive:  || replay/alive: 
- `2026-02-07-live-01`：existing_note_risk_or_scope;existing_notes_confirm_clip_or_coverage_issue。同一场直播由 直播回放巴拉蹦吧（弹幕/纯净双版 3:51:00）与 bobi华（3:51:47）分别搬运，总时长吻合，已合并为一天一条。 两条无时长鸣潮短视频均为同日 18:33 鸣潮2.2直播切片，并入本条，不单独计场次。 来源备注：replay/alive:  || replay/alive:  || replay/alive:  || replay/alive: 
- `2026-08-15-live-01`：existing_note_risk_or_scope;multi_game_no_chapters;existing_notes_confirm_clip_or_coverage_issue。B站搬运（女流66 抖音直播回放）。服部平次/直播回放巴拉蹦吧/bobi华完整源约 185:24-185:56。怪盗基德KID 137:04 与不懒bot 88:37 为该场部分切片，未作为主时长。 来源备注：replay/alive:  || replay/alive:  || replay/alive:  || replay/alive: 

## 仍未确认的主要风险

对 `unresolved` 条目，按 CSV 的 `flags` 与 `source_notes` 逐项核对；其中多游戏且没有 `chapters` 的条目尤其不能由单游戏回放默认代表所有游戏。`2026-06-22-live-01` 的本地历史审计明确提醒官方号来源未经核对，虽条目自身记载多份来源时长吻合，本轮仍将其保持未决。`2024-10-03-live-02` 的游戏时间轴报告记录了《节奏天国》→《七日世界》，但正式条目没有 `chapters`，所以也不能据此视为完整拆分。297 条范围内还包括没有时间轴的单游戏直播录像——依据规则它们可以作为“相关录像”，但仅凭单一游戏标签和 `duration_min` 仍不足以确认来源确属该日、无缺段或时长等于完整单份录像时长。

## 研究材料对照

- `docs/game-time.md`
- `src/lib/game-footage.ts`
- `docs/research/game-timeline-review-2026-10-20.md`
- `docs/research/game-timeline-complementary-sources-2026-10-20.md`
- `docs/research/game-timeline-multi-tag-backfill-2026-10-21.md`
- `data/reports/task-055-final-round.md`

## 未能确认与覆盖缺口

- 未能确认任何条目的本轮线上可播放状态、最新分 P 列表/时长、分 P 内实际内容、剪辑接缝或整场完整性；清单中 `status` 不代表本轮人工看片。对 `BV1WJ7K6iEXV` 的直接页面请求不可访问，对 `BV1R9jH6YEfr` 返回 412，未得到可引用的页面证据。
- 本轮没有系统比较所有平台上所有公开版本，没有逐场对照直播日期、跨投稿拆分、多人主播身份或游戏内容。CSV 列出的 791 个来源 URL 只是正式档案的引用清单，不等于 791 个已打开页面或已观看来源。
- 历史报告记载的内容以其原有核验者和日期为限；近期时间轴报告的缩略图抽查与模型辅助信号不等同人工逐段看片。
- 数据未修改；`confidence: low` 条目不适用。
