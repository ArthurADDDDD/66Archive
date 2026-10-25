> 2026-10-24状态更新：本页下文保留初次入口检查过程，134页后续已经全部完成；不应从第3页重抓。当前结果2,672目录ID、336未引用、53引用ID未入本账号目录，见[完成报告](acfun-directory-catalog-audit.md)。11月12日5个新候选也已有[元数据与局部补证](nov12-program-scope-followup.md)。

# AcFun unlinked-catalog check: local checkpoint

Date: 2026-10-23. This is a bounded, read-only comparison against the `d019ca1` archive baseline and already collected local AcFun page metadata. No network requests, media playback/downloads, or formal data edits were made.

## Available coverage

The local AcFun cache is page metadata for posts already present in the archive reference set; it is not an uploader/channel directory export. It contains 4,774 fetch-attempt records for 2,389 unique AcFun IDs. The archive reference table has 2,390 source rows covering those same 2,389 unique AcFun IDs. Every unique referenced ID has cached metadata; there are no extra IDs in this cache that could act as unlinked catalog candidates. The extra attempt rows are repeated attempts for existing IDs, not additional posts.

The Bilibili directory comparison described in the other reports cannot be reproduced for AcFun from the files currently available: there is no local AcFun uploader-directory/catalog snapshot to compare against the referenced-ID set. Therefore this pass yields **no enumerable unlinked AcFun IDs**, rather than a finding that no such uploads exist.

## 2023-11-12 check

`ac42944703` is already linked to `2023-11-12-live-01`; it is not an unlinked catalog hit. The cached page metadata identifies it as `【女流】2023年11月12日录播《心灵砒霜弹幕版》P3`, lists uploader UID `4397992`, and gives a page duration of 4,724 seconds. The entry also links the Bilibili P1 `BV1Bg4y1Q7Cp`.

The separately reported Bilibili P2 `BV1fH4y1i7LW` and 236-minute version `BV1Mj411a7YB` are Bilibili posts, not AcFun directory discoveries. The root’s recent 300-second observations describe different local activities in Bilibili P1; those samples do not establish whether AcFun P3 belongs to the same session, supplies another segment, or completes the entry. Page title/date and duration alone cannot answer that. No source additions or completeness conclusion follow from this check.

## What is needed for a true cross-catalog pass

A locally available AcFun uploader directory snapshot (or another complete, dated inventory of public AcFun post IDs) is needed. With that input, a read-only exact-ID difference can be compared against all 2,389 referenced IDs, then same-date/series explicit-P candidates can be listed for review. Current page metadata is insufficient to construct that universe.

## 根追加正常公开目录入口检查

随后正常打开[录像小屋公开空间](https://www.acfun.cn/u/4397992)，页面可读投稿/视频2672，20条每页、共134页，末期可见2023年11月底投稿。此前2389缓存ID只是本站已引用集合，不是此账号目录全集。目录本身目前正常可访问，不能将缺本地快照当成只能等人类材料的阻塞。

公开页面加载的userContributions前端脚本使用type、order、page、pageSize进行quickView分页；下一轮可通过正常翻页观察实际请求并抓取公开目录metadata，建立完整时间戳快照后对照2389已引用ID。只需目录题名/ID/日期，不下视频；成功的已挂页metadata不重抓，目录新增候选单列。134页总目录未在本轮抓完，目前只有入口/分页机制的可行性证据，2672与2389差值不是已确认未挂数量或错误数。

正常点击“下一页”已成功从第1页到第2页，取得40个不同投稿的[小型入口快照](acfun-directory-entry-probe.json)，以及其中9个未出现在基线引用ID集合的[目录候选](acfun-directory-first2-unlinked.csv)。这是两页样本，不是全134页；未挂目录ID不是已确认同日/同系列补档，也未加入110条外部补证观察或自动补挂。下一轮从已有前两页继续，不重复它们。

实际观察到的公开分页路径为`/u/4397992?quickViewId=ac-space-video-list&reqID=2&ajaxpipe=1&type=video&order=newest&page=2&pageSize=20`，来自正常页面翻页，未绕验证。后续应保留逐页成功/失败检查点、控制请求频率，大目录缓存写外接盘，失败不判投稿缺失。
