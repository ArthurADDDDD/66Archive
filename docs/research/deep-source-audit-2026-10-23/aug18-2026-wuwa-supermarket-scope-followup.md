# 2026-08-18鸣潮/超市整理模拟器来源范围有限核验

本报告整理根Agent提供的公开页面元数据和正常播放器样本；作者未独立操作播放器，`human_watch=false`。没有下载媒体或听取音频，也没有修改正式数据或主观察记录。

该项是`2026-08-18-live-02` source_index 0。基线CSV中的精确来源URL为[BV1re836CEKH（保留原查询参数）](https://www.bilibili.com/video/BV1re836CEKH/?spm_id_from=333.1007.top_right_bar_window_history.content.click)；本次播放器从[B站P1](https://www.bilibili.com/video/BV1re836CEKH/?p=1)打开。投稿标题为“【女流66】《鸣潮》最后一天抽穗穗，玩超市货架整理模拟器《Supermarket Chaos》，08.18直播录像弹幕版~”，公开投稿UID 169965283，显示名服部平次，共5个分P。P1为“鸣潮抽穗穗 20:51”（CID 41035039109，metadata 1233秒）；P2–P5为超市货架整理模拟器页（CID及metadata见[结构化记录](aug18-2026-wuwa-supermarket-scope-followup.json)）。

P1 t=600.677751的稳定静音样本（media 1233秒，readyState 4、非seeking、paused）显示录像画面中的《鸣潮》客户端下载安装进度。它不是播放器本身的下载或卡顿状态，也不是游戏画面。t=1100首试readyState 1/seeking，排除；稳定重试t=1101.088714显示《鸣潮》“忆旅赠礼”累计唤取数30及20–80奖励菜单，media 仍为1233秒、readyState 4、非seeking、paused。这个菜单支持P1该点有《鸣潮》内容，但未验证标题提到的具体角色或实际游玩环节。

P2在t=600.537369的稳定静音样本（media 2368秒，readyState 4、非seeking、paused）显示第一人称超市货架整理画面：摆放商品、书本周围的绿色选中框及任务4/5，没有主播摄像头。该点与《Supermarket Chaos》页名相符，不独立认证游戏版本或主播身份。

当前条目只标《Supermarket Chaos》。P1的稳定奖励菜单提供了可供人工审阅的《鸣潮》内容关联；P2则支持超市游戏局部。不能把P1整个分P认定为非游戏内容（客户端下载安装画面只是该P1另一时间点），也不能将整份投稿全部算作任一游戏。P3–P5未核；没有日期、完整分段边界、连续性或整场完整性证据。来源状态仍由正式档案维护流程处理，不因本次机器样本自动改成`alive`。

基线现有来源键增加1条机器观察后预计为178/6427，6,249条仍未附本层逐项观察；该URL已在基线中，不新增外部URL。后续由recent统一合并观察记录。
