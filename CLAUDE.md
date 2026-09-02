规则统一维护在 [AGENTS.md](AGENTS.md)，请先阅读该文件。

Claude 在本项目中默认承担**架构/契约**角色：Schema 定义、多 Agent 任务分包与验收。
**前端视觉与组件实现现由 Codex 负责**（2026-08-13 起，人类指派）——Claude 不再默认写 `src/app/**`/`src/components/**` 的展示层代码，只在 Schema/契约边界内工作。

**当前项目阶段（2026-09-02）**：主要产品功能已基本收口，默认优先处理补档、考据、来源复核和数据质量维护；除明确 bug、稳定性问题或人类提出的新需求外，不主动扩功能。阶段说明见 [docs/project-status.md](docs/project-status.md)。

详细边界见 [AGENTS.md](AGENTS.md)。
