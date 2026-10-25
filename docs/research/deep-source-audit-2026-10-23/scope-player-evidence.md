# 共享合集游戏范围：局部播放器证据

2026-10-23，d019ca1b基线。正常公开播放器URL定位，局部画面为机器观察，不是human_watch或整场完整性审核；未修改data。

## 2020-05-09 冒险公社/冬日计划

[BV15t4y117EG P2](https://www.bilibili.com/video/BV15t4y117EG/?p=2) 实际duration3918秒。45.437236秒仍是摄像头和弹幕画面；[P2 t600](https://www.bilibili.com/video/BV15t4y117EG/?p=2&t=600)实际608.875823秒readyState4、无video error，画面为冒险公社卡牌/地图（机关宝藏事件），支持该页有冒险公社，但不能把该页从0秒起全部计作游戏。

[P3](https://www.bilibili.com/video/BV15t4y117EG/?p=3) 实际duration3027.734秒；16.742761秒readyState4但截图为黑场，不能从这个样本确认游戏，更不能黑场=资源缺失。后续定位及其它页见追加记录。

[P3 t600](https://www.bilibili.com/video/BV15t4y117EG/?p=3&t=600)实际617.20649秒，readyState4；画面为冬日计划小木屋储藏箱/生存物资界面，与该页冬日计划标题一致，推翻“开头黑场所以不能播放”的误判。尚未检查P4–P7与该页全段，不据此确认P3–P8全部连续完整。

[P8 t300](https://www.bilibili.com/video/BV15t4y117EG/?p=8&t=300)duration3009秒，338.51334秒readyState4但截图黑场，同时有登录/试看提示。此样本不能确认画面已解码或游戏内容；不将“当前时间前进”单独当成该时点有效游戏画面的证据，不将黑场判成缺录。

## 2021-11-27 / 11-29雀圣标签

[11.27 BV1K34y1R7K1 P3 t300](https://www.bilibili.com/video/BV1K34y1R7K1/?p=3&t=300)实际duration2733秒，301.308374秒readyState4、seekingfalse；画面为雀魂风格角色和四人日麻对局，与总标题“雀魂”及此前logo预览一致，支持`majsoul`游戏候选，不能按分P“雀圣”字面另造游戏。只核此样本，未确认全场边界/时长。

[11.29 BV1CP4y1V7tq P2 t300](https://www.bilibili.com/video/BV1CP4y1V7tq/?p=2&t=300)实际duration2530秒，300.844233秒readyState4、seekingfalse；角色个人资料与四麻/三麻段位界面，与总标题“雀魂”及此前logo样本相符。仍不从这个样本推导全场时长。

## 2020-10-05 Party Animals 投稿含异游戏P4

[BV1yD4y1R7AT P1 t300](https://www.bilibili.com/video/BV1yD4y1R7AT/?p=1&t=300)实际duration4058秒，302.612384秒readyState4、seekingfalse；画面为Party Animals柯基角色与训练室。

同投稿[P4 t300](https://www.bilibili.com/video/BV1yD4y1R7AT/?p=4&t=300)实际duration3380秒，301.490031秒readyState4、seekingfalse；画面为第一人称手电筒照暗室，和该页`P4-2020.10.2-Phasmophobia`标题一致，明显不是Party Animals。因此**整份投稿不能作为10.05单游戏整场的等价来源**；前三P与独立AcFun来源仍须保留。此次实际样本证明异游戏内容，不单凭标题作判决；尚未全段核实P4母场究竟是否10.02，不能自动把它搬到10.02。

缓存前三P分别4058、4064、4059秒，P4为3380秒；B站共15561秒。10.05现有条目271分钟且AcFun为四P，跨平台末P实际内容需单独核对，不按时长差直接删整场。

对照[AcFun ac18398871数组第4P](https://www.acfun.cn/v/ac18398871_4)：页面明确当前第4P，实际duration4062.933333秒，8.253997秒readyState4、seekingfalse，截图为Party Animals动物角色在潜艇甲板对局。**该备选的第4P有对应游戏画面，不能因B站异游戏P4就把整场判缺失。** 仍未检查全P、首尾连续性或证明它与B站前三P无重叠。

### 异游戏P4与10月2日独立投稿的双时点对照

10月2日独立投稿[BV1Xp4y1a7Ni](https://www.bilibili.com/video/BV1Xp4y1a7Ni/)当前公开投稿时刻为2020-10-04 01:30:08，P4实际3380秒；10月5合集P4同为3380秒。两份P4在约300秒都出现手电筒照暗室，约1500秒都出现同样的“理智(SAN)值/魂魄”笔记本页：

- [10.02来源 P4 t300](https://www.bilibili.com/video/BV1Xp4y1a7Ni/?p=4&t=300)：301.780472秒，readyState4、seekingfalse。
- [10.05合集 P4 t300](https://www.bilibili.com/video/BV1yD4y1R7AT/?p=4&t=300)：301.490031秒，readyState4、seekingfalse。
- [10.02来源 P4 t1500](https://www.bilibili.com/video/BV1Xp4y1a7Ni/?p=4&t=1500)：1504.590118秒，readyState4、seekingfalse。
- [10.05合集 P4 t1500](https://www.bilibili.com/video/BV1yD4y1R7AT/?p=4&t=1500)：1501.674605秒，readyState4、seekingfalse。

一致时长、同名页以及两个非相邻位置的相符画面，强烈支持10月5合集误放了已标10月2日的Phasmophobia P4。公开投稿时间早于10月5也支持旧材料重复，但当前页元数据不能独自证明历史上从未换P；本次不是全片哈希/音频比对。**可以明确排除把该P4算作Party Animals；10月2母场是强关联，仍保留证据边界。**
