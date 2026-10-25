# 2017-08-19《尼德霍格》与 PUBG 投稿的有限页级核对

日期：2026-10-24。整理 `aug19-nidhogg-pubg-scope-followup.json` 中4个普通公开播放器样本；观察标为 `human_watch=false`。只说明所列内页及时点，不作全片审看。

| 来源/内页 | 定位秒数 | 实际播放器时长与状态 | 局部画面 |
|---|---:|---|---|
| [BV1dx411J77f P2](https://www.bilibili.com/video/BV1dx411J77f/?p=2) | 600 | 4,333秒；ready=4，seeking=false，paused=true | 《尼德霍格》风格城堡彩虹选关地图，显示返回/开始比赛按钮及女流摄像头；属于菜单，不是实战 |
| [BV1dx411J77f P3](https://www.bilibili.com/video/BV1dx411J77f/?p=3) | 600 | 4,216.837秒；ready=4，seeking=false，paused=true | PUBG READY/WAITING大厅双角色与女流摄像头；大厅画面，不是实际对局 |
| 同一 P2 | 1,800 | 4,333秒；ready=4，seeking=false，paused=true | 《尼德霍格》风格横向关卡，有进度方块、绿色发光背景、角色与投射物；不是PUBG |
| 同一 P3 | 1,800 | 4,216.837秒；ready=4，seeking=false，paused=true | PUBG Erangel地图，可见 Georgopol、Rozhok、Pochinki 地名、航线和标记；地图界面，不计作射击实玩时长 |

## 有界结论

这条 B 站投稿有4个内部页，metadata页时长合计14,334秒；这不是单页时长。P2在抽查点显示《尼德霍格》菜单及关卡画面，P3在抽查点显示PUBG大厅和地图。样本支持对档案 `games` 仅列 `pubg` 增加《尼德霍格》关联审阅候选，但不确定其具体代数或准确范围，也不自动修改正式数据。

菜单、大厅和地图都不能直接当成相应游戏的实际对局时长。P1、P4未播放；没有验证全片中的游戏切换边界、母场日期或完整性。对应A站来源 `ac3929159` 本批未访问，不能将B站的局部观察继承给A站来源。
