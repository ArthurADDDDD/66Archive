# 档案安全编辑 CLI

该工具让维护者在亲自授权的环境里直接修正已核验的单条档案，同时不让后台应用、数据库获得公开仓写凭据。

## 一次性准备

1. 为 main 开启轻量规则（GitHub Settings → Rules → Rulesets，目标分支 `main`）：线性历史、禁止 force-push、禁止删除。
   **不要求签名提交**——维护者授权即推送，云端 Agent 的正常 commit+push 不受影响。
2. 签名**可选**：本机若想留 `Verified` 痕迹，配置 `user.signingkey` + `gpg.format`（SSH 签名另加
   `gpg.ssh.allowedSignersFile`）；不配置也能正常跑，提交只是不带签名。

CLI 检测规则：两项都没配置 → 不签名照常走；只配了一半 → 报错拒绝猜测；配置完整 → `git commit -S` +
`git verify-commit`，没有未签名回退。

## 使用

```bash
npm run archive:edit -- <entryId>
```

- CLI 从最新 `origin/main` 创建一次性 worktree，不修改当前开发工作树。
- 编辑器取 `ARCHIVE_EDITOR`、`VISUAL`、`EDITOR`，最后回退到 `vi`；命令会解析为参数数组，不通过 shell 执行。
- 一次只允许目标 entry 发生语义变化，且只能修改它所在的一个 `data/entries/**` 文件。
- 依据必填；公开仓真实 `npm run validate` 通过后完整显示 diff。
- 已配置签名则执行 `git commit -S` 与 `git verify-commit`；未配置则普通提交。随后以普通 fast-forward push main。
- main 并发修改了目标文件时停止；只有无关变化时才基于最新 main 重建并重新提交。

## 本机配置

推送后的远程更新与数据库备份钩子**不硬编码在公开仓**。CLI 从本机 gitignored 配置读取：

- 配置文件优先级：
  1. `ARCHIVE_CONFIG` 指定的路径
  2. `<仓库根>/.local/archive-edit.json`（gitignored，适合本机开发环境）
  3. `~/.config/66Archive/archive-edit.json`
  4. `~/Library/Application Support/66Archive/archive-edit.json`
- 也可以使用完整环境变量：`ARCHIVE_SSH_HOST`、`ARCHIVE_REMOTE_UPDATE_COMMAND`、
  `ARCHIVE_LOCAL_BACKUP_ROOT`、`ARCHIVE_REMOTE_BACKUP_PATTERN`、`ARCHIVE_BACKUP_FILE_PATTERN`。
- 未找到配置、配置字段缺失或配置不完整时，CLI **拒绝继续**，不会猜测或使用任何默认生产参数。

可参考 [`archive-edit.config.example.json`](archive-edit.config.example.json)，但必须把示例值替换为本机实际值，
且不要把该本机配置提交到公开仓。

## 部署与备份钩子

push 成功后，CLI 按本机配置执行远程更新命令；远端脚本不接受参数、ref 或 SHA，只部署公开仓最新 main。
部署成功后创建新的数据库备份；CLI 下载备份与校验文件，在本地重新计算校验和，并按本机配置保留最近 7 份。
远端长期备份不会被删除。

## 失败语义

- push 前失败：main 不变，不产生稍后自动执行的数据库队列。
- push 成功、部署失败：不要重复提交；从现有发布页或本机配置的远程更新命令重试部署。
- 部署成功、备份下载失败：远端备份已存在；修复本机连接后手工拉取，不删除现有本机备份。
- 凭据丢失/机器更换：在对应服务中吊销并换发新的凭据；main 的轻量规则保证历史不被冲掉。
