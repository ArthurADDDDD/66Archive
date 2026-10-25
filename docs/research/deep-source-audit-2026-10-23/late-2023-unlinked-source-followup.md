# 2023年10月来源范围与未挂链接补证

基线d019ca1b。已有时长溯源报告找到公开目录里未挂入entry的四个独立B站投稿；本批只向四个此前未进入全6427基线清单的目标查询公开view元数据，不重跑全库。

| 归属候选 | 未挂URL | 公开API时长秒 | 实际上传账号/UID | 限制 |
|---|---|---|---|---|
| 2023-10-13第一段候选 | [BV1T34y1g7dn](https://www.bilibili.com/video/BV1T34y1g7dn/) | 13781 | 女流录像小屋/29418340 | 总题与单页题均无P号；顺序需内容确认 |
| 2023-10-13第三段候选 | [BV1BH4y1R769](https://www.bilibili.com/video/BV1BH4y1R769/) | 13783 | 同上 | 同题无P号；顺序不能只按目录行次 |
| 2023-10-30 P1 | [BV16Q4y1H78a](https://www.bilibili.com/video/BV16Q4y1H78a/) | 10853 | 同上 | P1为标题自述，尚非连续性认证 |
| 2023-10-30 P3 | [BV11C4y1n7Mu](https://www.bilibili.com/video/BV11C4y1n7Mu/) | 10854 | 同上 | P3为标题自述，尚非连续性认证 |

四页code均为0，页数各1。cid依次1299316382、1299316271、1316238036、1316237983。API元数据成功不是可播放/母场正确/完整认证。四链接均未见于基线逐来源清单或既有成功metadata日志，不扩大6427基线统计，按外部候选单列。

## 10月13日当前所挂P2的实际范围

[B站BV1Nw411C7Mn](https://www.bilibili.com/video/BV1Nw411C7Mn/?t=30)实际duration13782，31.399735秒readyState4、seekingfalse，角色在石砌建筑/铁栅门附近行动。[AcFun ac42654617](https://www.acfun.cn/v/ac42654617)实际duration13781.533620；8.042653秒为游戏加载黑底，非缺失；31秒readyState4、seekingfalse，为同一石砌建筑/铁栅门附近、相同装备/HUD位置。

尾部[B站t13770](https://www.bilibili.com/video/BV1Nw411C7Mn/?t=13770)实测13771.243644秒、AcFun13770.001秒/总13781.624533，均readyState4且seekingfalse，同为洞内木平台/石梯战斗、相同法帽和近旁敌人事件；暂停相差一秒，数值/HUD略不同。开尾两处内容关联支持两平台为同场或相近覆盖版本的候选，未检查中段连续性；不能拿任一页充当689分钟整场，也不因此断言其余460分钟不存在。

未修改正式来源、条目时长、kind或置信度；机器局部观察不标human_watch。

## 第三段候选的开头

[BV1BH4y1R769 t2](https://www.bilibili.com/video/BV1BH4y1R769/?t=2)实际duration13783，2.843892秒readyState4、seekingfalse；同一尖帽人物在洞内木平台/石阶附近行动，右上数值278，前一已挂P2尾部约13771秒为225，AcFun约13770秒为198。相同场景和数值递增与向下一段接续相容，支持第三段候选，未逐帧验证击杀或证明中间无间隔。三投稿不能仅凭相同总题/同封面就确定顺序，仍需保留这个限制。

## 其它新页实际媒体样本

- [10月13第一段候选BV1T34y1g7dn t13770](https://www.bilibili.com/video/BV1T34y1g7dn/?t=13770)：实际13770.859498/总13781秒，readyState4、seekingfalse。紫蓝色游戏场景战斗；与P2开头加载/石砌建筑样本不能直接拼成无缝衔接，顺序仍保留候选。
- [10月30 P1 BV16Q4y1H78a t30](https://www.bilibili.com/video/BV16Q4y1H78a/?t=30)：加载初期time30、readyState1，截图已显示游戏木墙/思念之境界面；后续读取时已自然走到56.882784、readyState4、seekingfalse并暂停，不能写成30秒就readyState4。[近尾t10845](https://www.bilibili.com/video/BV16Q4y1H78a/?t=10845)实际10846.220080/总10853，readyState4，为案件证据板/木墙。证明局部可播，不代表全程。
- [10月30 P3 BV11C4y1n7Mu t30](https://www.bilibili.com/video/BV11C4y1n7Mu/?t=30)：实际30.007875/总10854，readyState4、seekingfalse，海景酒店地图；[t10845](https://www.bilibili.com/video/BV11C4y1n7Mu/?t=10845)实际10851.718940/总10853.933，readyState4，为退出游戏确认界面。近尾可播不等于原直播正常结束，也不证明P1/P2/P3之间无跳段。

四个新增候选现在均取得了至少一个正常播放器局部样本；不能继续统称“仅API成功”。本清单不以局部实际游戏画面覆盖整个投稿，也不把4页直接写回正式sources。

10月30已挂P2 [BV1zG411C7gD t2](https://www.bilibili.com/video/BV1zG411C7gD/?t=2)实际3.513709/总10854秒，readyState4、seekingfalse；木墙案件证据板上相同老者照片/便签布局，与新P1近尾同一案件事件，支持P1→P2的局部接缝关系，未逐帧认证无漏帧/重叠。

P2近尾t10845两次读取均time10845、readyState1、seekingtrue，最后出现“播放遇到问题”提示，未取得对应媒体画面；故P2→P3接缝仍未完成，不能以该次失败判缺失。该页开头此前正常可播，失败只是这个定位的访问缺口。
