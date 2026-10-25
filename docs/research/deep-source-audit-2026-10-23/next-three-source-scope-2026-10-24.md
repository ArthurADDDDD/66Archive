# 三条 AcFun 多稿范围问题：本地证据准备

本轮仅本地读取既有样本JSON并更新12/6、12/15和2019-01-20三项说明；没有新网络请求、额外播放或正式数据/观察JSON修改。其余未挂候选仍按早前 `weak-unlinked-candidates-reviewed.csv` 的未判定状态处理，不把标题、日期或时长相近当作已证同场。

## 1. 2017-12-06《吃鸡佳缘》第一期：A站两版与未挂B站候选均有有限局部样本

- 当前条目：[`2017-12-06-live-01`](../../../data/entries/2017-12-douyu-live.yaml)，PUBG，名义时长 273 分钟。正式 note 明确称弹幕版与纯净版为同一场直播，原先重复建档后已合并。
- 现有 AcFun 页： [弹幕版 `ac4125032`](https://www.acfun.cn/v/ac4125032)，目录题名“女流-12.6-【吃鸡佳缘】第一期弹幕版”；[纯净版 `ac4122087`](https://www.acfun.cn/v/ac4122087)，题名“女流-12.6-吃鸡佳缘第一期”。本地 `acfun-references.csv` 记录两帖各 10 个内页；`acfun-duration-triage.csv` 记录各自metadata总长分别16,423秒与16,393秒。新保存的 `dec6-pubg-two-version-scope-followup.json` 另记录两帖各10项的内页ID、标题与页面metadata毫秒数；这些是页目录信息，不代表逐页内容核验或A/B一一对应。
- 未挂候选： [B 站 `BV1sW411Y7oQ`](https://www.bilibili.com/video/BV1sW411Y7oQ)，目录题名“女流-12.6-吃鸡佳缘第一期”，metadata 总长 273:17；早先本地索引未列出其候选页明细。
- **有限核对结果：** 两A版本既有样本见[七点播放器范围报告](dec6-pubg-two-version-scope-followup.md)；未挂B站候选新增样本见[两点范围报告](dec6-clean-bili-candidate-followup.md)。两A版本抽样涉及聊天摄像头、PUBG与桌面收尾局部；内页3同秒画面不同，晚24秒尝试也不支持固定偏移。B P2 600秒为PUBG草地局部，与A纯净P3 600秒相近；B P3 6900秒为桌面收尾，与A纯净P10 1700秒同类但窗口不同、不是同一事件帧。只解释局部范围类别，不认证两A版/B版全程等价、无缝关系、母场日期或完整性。

## 2. 2017-12-15《吃鸡佳缘》第二期：A站两版与未挂B站候选均有有限核对

- 当前条目：[`2017-12-15-live-02`](../../../data/entries/2017-12-douyu-live.yaml)，PUBG，名义时长 114 分钟。正式 note 记载 AcFun 弹幕版与纯净版同属第二期，并提醒同日另有独立 GOROGOA 条目。
- 现有 AcFun 页：[弹幕版 `ac4140602`](https://www.acfun.cn/v/ac4140602)，题名“女流-12.15-【吃鸡佳缘】第二期 弹幕版”；[纯净版 `ac4140326`](https://www.acfun.cn/v/ac4140326)，题名“女流-【吃鸡佳缘】第二期 2017.12.15”。本地引用记录分别为5个与4个内页；triage metadata总长6,818秒与6,843秒。新保存的 `dec15-pubg-two-version-scope-followup.json` 记录了各内页ID、标题与页面metadata时长；这些目录字段本身不认证内容对应。
- 未挂候选：[B 站 `BV1mW411b73p`](https://www.bilibili.com/video/BV1mW411b73p)，目录题名“女流-12.15-【吃鸡佳缘】第二期”，总长 113:56；新增候选metadata列2个内部页。
- **有限核对结果：** A站两版既有样本见[六点播放器范围报告](dec15-pubg-two-version-scope-followup.md)；未挂B站候选新增样本见[两点范围报告](dec15-clean-bili-candidate-followup.md)。A弹幕内页3约600秒与纯净内页2约1,668秒有31存活、屋顶趴伏及5/1弹药的相近对局场景；视角和血条不同，不是同帧。B P1 3,376秒也见屋顶边、31存活及5/1弹药，与A纯净内页2 1,668秒局部相近但人物动作不同；B P2 3,360秒为大摄像头聊天，与A纯净P4尾部布景相近。样本不证明全场无GOROGOA、完整、无缝、同日或全稿等价。

## 3. 2019-01-20《乐园》与《心灵砒霜》：A站与B站候选有限范围核对完成

- 当前条目：[`2019-01-20-live-01`](../../../data/entries/2019-01-douyu-live.yaml)，登记游戏 Rakuen，正式 note 称纯净版含“乐园 & 心灵砒霜”、弹幕版是同场另一版。
- 现有 AcFun 页：[纯净版 `ac4881886`](https://www.acfun.cn/v/ac4881886)，目录题名“女流-2019.1.20-乐园&心灵砒霜”，4 个内页；本地 `acfun-timeline-basis.csv` 记录的逐页 metadata 为：P1 ID `6598515` / 3638 秒，P2 ID `6598513` / 3303 秒，P3 ID `6598512` / 3305 秒，P4 ID `6598440` / 1344 秒。此前本地`acfun-timeline-basis.csv`只作页列表metadata对照；本批内容样本见[五点播放器范围报告](jan20-rakuen-programme-scope-followup.md)。[弹幕版 `ac4882221`](https://www.acfun.cn/v/ac4882221) 为一个内页、总长 7956 秒；本地未找到该内页 ID 与逐页标题。
- 已挂 B 站稿：[全长候选 `BV1ht41187cf`](https://www.bilibili.com/video/BV1ht41187cf)，本地 metadata 15,913 秒/4 页；另有未挂候选 [Rakuen `BV1bt41187LU`](https://www.bilibili.com/video/BV1bt41187LU)，目录题名“女流-2019.1.20-Rakuen(乐园)”，本地目录快照为UID 29418340、单页P1、3,639秒。最新内容样本见[B站候选范围补证](jan20-rakuen-bili-candidate-followup.md)。
- **有限核对结果：** 纯净版P1约600秒显示Rakuen画面；两封《心灵砒霜》来信分别在纯净版内页2/4与弹幕单页600/7,808秒局部相符。B站候选P1约600秒为同一Rakuen场景附近，约3,500秒已是摄像头聊天，且与A站纯净版P1近尾聊天布景相近。因此只能支持弹幕稿抽样范围对应心灵砒霜部分、纯净版P1确有Rakuen，且B站单页含局部Rakuen与聊天；不能把整场标成游戏录像缺失，也不能把B站约60.6分钟全算成Rakuen实玩。见[五点A站范围报告](jan20-rakuen-programme-scope-followup.md)及[三点B站候选补证](jan20-rakuen-bili-candidate-followup.md)。样本不认证整页/全场完整、无剪接、日期或未观察内容，也不裁定是否应新增正式来源。

## 去重结论与限制

12/6与12/15未挂B站候选均已有有限局部内容样本，但范围、日期、完整性和是否应新增正式来源仍未裁定；12/15候选已有两页 metadata。2019-01-20未挂B站候选已有两个局部内容样本，范围/日期/完整性和是否应新增正式来源仍未裁定。没有用标题/时长相等或旧segments推断任何未观察来源的内容对应、范围完整或日期。
