# Legacy

被替换掉的旧实现，留着备查/备用，不接入任何路由（`src/legacy/` 在 `src/app/` 之外，Next.js 不会把它当页面）。

- `games-page.legacy.tsx` + `GamesGrid.legacy.tsx`：`/games/` 最初版本，大卡片网格。2026-08-12 因"信息密度太低、逐条扫描太费力"改成轻量列表（`src/app/games/page.tsx` + `src/components/GamesList.tsx`）。
- `series-page.legacy.tsx`：`/series/` 最初版本，卡片网格。2026-08-12 改成按时间跨度呈现的甘特图（`src/app/series/page.tsx` + `src/components/SeriesTimeline.tsx`）。
- `GamesList.legacy.tsx`：轻量列表版 `/games/`（搜索 + 三种排序 + 时长横条）。2026-08-12 重构第二阶段改成封面墙（`src/components/GamesLibrary.tsx`），理由见 `docs/redesign/02-implementation.md`。**它的搜索与排序能力在新版里是原样保住的**，如果哪天发现新版丢了某个筛选，对着这个文件比。

删掉而不是留档的：

- `RotatingAvatar.tsx`（首页那个自动轮播的头像装饰）。三张头像是她十六年里换过的三张脸，必须和年份一起出现；做成会动的装饰是 `docs/redesign/01-vision.md` 第七节明确否掉的方向，留着只会诱导下一个人把它装回去。要看实现去翻 git 历史。
