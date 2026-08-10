# 六六编年史 · chronicle-66

女流66 的作品编年史。**只索引，不搬运**——服务器上没有任何视频文件，所有链接都指向原平台、原 UP 主。

时间轴上竖条的高度是那场直播的真实时长，条内的色带是当时在打的游戏。

## 跑起来

```bash
npm install
npm run dev
```

其他命令：

```bash
npm run validate     # 数据校验闸门，任何数据 PR 都要先过它
npm run build        # 校验 + 静态导出到 out/
npx tsx scripts/gen-demo.ts   # 重新生成演示数据
```

## 数据在哪

```
data/
├─ accounts.yaml     # 平台账号盘点（含网友录播搬运号）
├─ games.yaml        # 游戏库
├─ series.yaml       # 系列
├─ entries/          # ★ 真实条目，按年份分文件
└─ _demo/            # 演示数据，entries/ 一有内容就自动失效
```

现在 `entries/` 是空的，站点跑在演示数据上并会显著标注。数据格式的唯一权威定义在 [src/lib/schema.ts](src/lib/schema.ts)。

## 多 Agent 协作

本项目由多个 Agent 分工完成。**动手前先读 [AGENTS.md](AGENTS.md)**，再读 [docs/03-多Agent协作规范.md](docs/03-多Agent协作规范.md) 里你所属角色那一行。

- [策划](docs/01-策划.md) — 做什么、为什么、路线图
- [功能设计](docs/02-功能设计.md) — 数据模型与页面设计
- [多 Agent 协作规范](docs/03-多Agent协作规范.md) — 角色边界、交接契约、任务包模板
- [采集任务 #001](docs/tasks/001-数据源盘点.md) — 第一个可派发的任务

## 三条硬约束

1. 不存放视频文件，只存元数据与外链
2. 不编造数据：没核实的一律留空或标 `confidence: low`
3. Schema 只由架构角色修改，其他角色走 `docs/rfc/`
