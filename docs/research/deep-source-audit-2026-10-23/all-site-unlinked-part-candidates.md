# 全站 B 站目录未引用分段候选

本地只读筛查基线为公开仓库 d019。脚本读取全部条目、两份现有 B 站目录和既有 metadata JSONL 缓存；没有联网、补抓 metadata、播放视频或修改 `data/`。逐条候选在 [all-site-unlinked-part-candidates.csv](./all-site-unlinked-part-candidates.csv)，复算脚本在 [scan_unlinked_bili_parts.py](./scan_unlinked_bili_parts.py)。此前 13 场限定审阅中的 12 个候选保留在表内并标成 `known_prior_review_do_not_repeat`，不会被当作新发现。

## 覆盖和计数

- 扫描了 2,960 条 archive entries。条目来源共引用 3,261 个唯一 BV；缓存中这 3,261 个 BV 均有对应 metadata 记录（3,261/3,261）。
- 两份目录共有 2,376 个 `bilibili-record-house.csv` BV 和 5,705 个 `bilibili-search-2024-2026.csv` BV；跨目录去重后 7,358 个唯一 BV。目录收录比被 entry 引用的来源更广，metadata 缓存只覆盖当前被引用的 BV 键。
- 生成 480 个 entry–BV 候选关系，涉及 479 个唯一 BV、275 个 entry。分级为：92 条强“同系列且候选标题明示分 P”、21 条弱“同系列但候选标题无明确分 P”、355 条弱日期与条目标题/游戏词面相符、12 条此前已知候选。
- 新候选 BV 的 metadata cache 覆盖为 0/479。也就是说，候选来自目录标题/日期/目录时长，尚没有缓存中的 API 页面级字段；它们的可播放状态也未确认。

## 机器筛选规则

脚本先从每条 entry 的全部 `sources[].url` 提取 BV，并将任一 entry 已引用的 BV 从未引用候选集中排除。两个目录按 BV 合并，日期取 record-house 的 `live_date`，或从搜索目录标题中抽取明确日期。

“强”需同时满足：候选目录日期与 entry 日期完全一致；候选 BV 未被任何 entry 引用；候选标题去掉 `P1/P2`、`第N段` 等分段标记后，与该 entry 已引用 BV 的目录标题完全相同；候选标题本身明确标注分 P。它只说明目录元数据中存在一个相同标题系列的未引用分 P 候选。

“弱同系列”要求日期和去分 P 后的标题也完全一致，但候选标题本身没有显式分 P；“弱词面”只要求日期一致且候选标题含 entry 标题或游戏字段的字面文本。弱项尤其容易包含不同发布、独立剪辑、同日不同内容或错误日期标题。CSV 保留原文、目录名、标记、缓存有无和精确公开 URL，方便逐条排除。

脚本不会按目录行顺序或标题中 P 号重排平台分 P；页序语义仅保留候选标题原文中的标签。此前已知 12 条来自既有审阅 CSV，保留其精确 BV 和 entry 关系，但不会因此变成新的独立证据。

## 可以和不可以得出的结论

强候选适合优先检查，尤其当 entry 只有同系列的另一个分 P；但相同日期、去号后标题一致，仍不足以证明视频属于同一场直播、分 P 连续、画面可播或覆盖完整。若 entry 当前关联的是全站共享投稿或目录标题模糊，规范化也可能把语义相似的剪辑系列误聚合。弱候选是机器排序线索，不能据此声称同场。

目录本身有收录范围限制，缓存也只覆盖当前引用键，因此“没有候选”不等于无其它来源，“缓存不存在”也不等于平台无视频。此批不对任何 entry 提议自动补源或改写完整性状态。

## 复算命令

从原仓库根目录执行；参数应指向同一只读基线的仓库根目录、两份目录和已有 JSONL 缓存。可通过 `--known-csv` 传入此前 13 场审阅清单，以免重复排序。路径由调用者提供，脚本不含本机绝对路径、不联网，也不写入基线：

```bash
python3 docs/research/deep-source-audit-2026-10-23/scan_unlinked_bili_parts.py \
  --baseline /path/to/read-only-baseline \
  --record-house /path/to/read-only-baseline/data/catalogs/bilibili-record-house.csv \
  --search-catalog /path/to/read-only-baseline/data/catalogs/bilibili-search-2024-2026.csv \
  --cache /path/to/existing/metadata.jsonl \
  --known-csv docs/research/deep-source-audit-2026-10-23/unlinked-catalog-candidates.csv \
  --output-csv docs/research/deep-source-audit-2026-10-23/all-site-unlinked-part-candidates.csv
```
