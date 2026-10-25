# Research delivery self-check

Date: 2026-10-23. This is a bounded local self-check of Markdown, Python, and JSON files in this research directory; CSV contents were excluded. It is not an independent review and did not inspect formal archive data or media.

## Checks passed

- Scanned the in-scope text files for Unix and Windows local absolute-path patterns: no matches.
- Scanned for operationally sensitive public-boundary terms such as production server/SSH details, deployment commands, database/backup information, internal tables/queues, and staging implementation details: no matches.
- Checked 175 relative Markdown links in the directory: all targets exist.
- Parsed `source-credibility-observations.json`: 56 observation rows with 56 unique `(entry_id, source_index, source_url)` keys; 110 supplementary evidence records with 110 distinct URLs. These counts match `credibility-list.md` and `source-credibility-inventory.md`.

## Stale summary text to reconcile

- `README.md:73` still says 35 observed rows and 6,392 without per-source observations. The current observations JSON and the two current credibility summaries say 56 and 6,371.
- The handoff log (kept outside the repository), lines 8-9, still says 51 observed rows and 6,376 unobserved; line 9 repeats 51 in its validation statement. Update these figures to 56/6,371 after the reviewed CSV rebuild is complete.
- `README.md:67-69,77` retains prior “paused” / pause-basis language while the same README’s opening status and the current handoff say the user resumed the work. Treat those lines as stale task-state text, not the current stop condition.

No files other than this self-check report were changed.

## 根后续收尾复核

观察层后续增至59行，未附逐项6368；外部补证仍110不同URL。主索引/README旧暂停及数字已修正。根逐键CSV/JSON检查通过，所有证据相对路径存在，md/json/py未检出本机绝对路径；脚本语法通过。工作区整体git diff --check仍指出仓库根README既有他人改动的第7行尾随空白，本批未碰它，不能把全工作区该检查称为通过。本批没有正式data/代码或发布。


## 2026-10-25 11/8斗鱼证据合并更新

当前观察仍161/6427，未附逐项观察6266；外部证据URL增至167个。新报告登记作者回放日历、3个斗鱼P1/P2/P3页面与1条新闻排播页。observations JSON与reviewed CSV保持精确source key同步，未新增观察行；其余历史自检计数仅为对应时点快照。


## 2026-10-25 8/20斗鱼回放补证状态

当前观察键仍161/6427，未附逐项观察6266；外部URL从167增至170。新增三条斗鱼回放P1/P2/P1 URL，复用已登记作者日历地址。更新了2019-08-20现有观察的日期/完整性评估及CSV对应行；P4/P5尚待根有界核验。根提供的UI/截图由本报告作者整理，仍为human_watch=false。

## 2026-10-25 8/20后段P4/P5更新

新报告记录B站P4/P5四个稳定点及斗鱼8/20 P2一个稳定点，更新2019-08-20既有来源观察和CSV字段；未新增基线观察或外部URL。当前基线覆盖161观察、6266未附观察、173个外部URL。P5已有两点内容，但来源对应仍未知。所有新证据refs为相对文件且存在，观察保留human_watch=false。


## 2026-10-25 10月斗鱼回放补证

当前观察161/6427、未附逐项6266；外部URL由170增至173。新JSON记录10/2和10/5日历结果，及斗鱼P2/P1稳定播放器样本；只同步两个已存在观察键到CSV，没有新增基线观察。10/2的P1未播放；10/5 P2/P3未查。所有证据refs是相对路径并通过本地存在性检查。


## 2026-10-25 2022年2月斗鱼回放补证

当前观察覆盖161/6427、未附逐项6266；外部URL从173增至177。更新2/27 B站index0及AcFun index1/2既有观察，source CSV已同步；2/25没有新增基线观察。日历URL复用，新增4条斗鱼回放URL。JSON/CSV和source key自检通过；样本均为根提供的机器观察，human_watch=false。


## 2026-10-25 11/8 B站P1与斗鱼P3补证同步

仅更新既有B站来源键`2019-11-08-live-01/index 0`的观察说明及reviewed CSV对应行；未增观察键、外部URL或正式数据。新JSON/MD相互引用，引用均为相对路径。覆盖仍161/6427观察、6266未附观察、外部URL177；`human_watch=false`。478.6秒长度差的试探点记录为不对应，不作offset或缺段结论。


## 2026-10-25 8/18斗鱼P2/P3有限抽样同步

新增两条去重后的公开回放URL；作者日历URL复用。未新增基线观察，未改正式data。观察仍161/6427、未附逐项6266，外部URL从177至179；机器观察为`human_watch=false`。报告未将局部节目样本外推到全页或B站P5日期，且保留未裁来源范围。


## 2026-10-25 2019-12-10 B站默认页范围核验

新增既有来源键`2019-12-10-live-01/index 0`观察，并同步审核CSV的同一键；未增补充外部URL或修改正式data。观察JSON增至162条、唯一键162；reviewed CSV维持6,427行。当前覆盖162观察、6,265未附逐项观察、外部URL179；两页稳定样本按静音截图记录，未作音频核验，`human_watch=false`。


## 2026-10-25 6/22与3/22 P1样本并入

按exact `(entry_id, source_index, source_url)`新增两条基线观察并同步CSV；两来源键此前不存在。当前观察164/6427、未附逐项6263、外部URL179，未改正式data；样本human_watch=false。


## 2026-10-25 2/25 P2/P3外部证据合并

新增两条去重斗鱼回放URL至补充外部层，并将其报告引用/局限同步到2/27 B站与AcFun index1/2的既有观察日期字段及CSV对应行。没有新增基线观察；当前仍165/6427、6262未逐项，外部URL181。JSON/CSV准确键保持一致，样本human_watch=false。


## 2026-10-25 2026-05-23默认页范围观察

新增source key `2026-05-23-live-02/index 0`一条观察并精确同步reviewed CSV；无新外部URL、无正式data改动。主观察JSON共166个唯一键，审核CSV仍6,427行；当前未附逐项观察6,261，外部URL181。样本静音、P3-P5未看，`human_watch=false`。


## 2026-10-25 current snapshot synchronization

The latest keyed observation is `2026-10-21-live-01` / source index `0`. Its exact source URL and evidence references were joined to one reviewed-CSV row. Current counts are 167 observations, 6,260 unobserved references, and 181 supplementary external URLs; the 6,427-row CSV remains unchanged in row count. The new report uses public page metadata and two root-supplied muted stable samples, without local paths or media URLs. `human_watch=false`; no formal data was changed.


## 2026-10-25 final current snapshot

Three new baseline keys are synchronized for this batch: 2026-05-23, 2026-10-21, and 2019-08-18, each with `human_watch=false`. The current observations JSON has 168 unique exact keys; the reviewed CSV has 6,427 rows with 168 observed keys and 6,259 not observed; the supplementary URL list has 181 unique URLs. Oct21 report and Aug18 report evidence references exist. No formal data changed.


## Final current count after Nov 24 bounded review

The keyed observation layer now has 169 unique exact keys. The reviewed CSV remains at 6,427 rows, with 169 `observed` and 6,258 unobserved; supplementary external evidence remains 181 unique URLs because the calendar page was already represented. The Nov24 report files exist and its source key joins to the canonical baseline URL without a page query. It retains `human_watch=false`; no formal data changed.


## Current totals after Jan12 bounded comparison

The Jan12 report adds two exact baseline keys: Bilibili source index 0 and AcFun source index 1. Current observations JSON has 171 unique keys; the reviewed CSV remains 6,427 rows with 171 observed and 6,256 unobserved; supplementary external URLs remain 181. Both source URLs match canonical baseline values, not page-navigation URLs. References point to existing report files, `human_watch=false`, and no formal data was changed.


## Current totals after Mar 26 shared-submission samples

The Mar26 report adds two exact baseline keys for two entries citing the same Bilibili URL. The observations JSON has 173 unique keys; the reviewed CSV remains 6,427 rows with 173 observed and 6,254 unobserved; the external list contains 183 unique URLs. The report references exist, `human_watch=false`, and no formal data was changed.


## Final Nov20 shared-source merge

Three baseline keys were added for the two Nov20 entries: Bilibili P1 and AcFun for the KarmaZoo entry, plus the shared Bilibili P1 for Daxia. One unlinked Bilibili P2 URL was added as supplementary evidence only. Current status is 176 unique observation keys, 6,427 reviewed rows with 176 observed and 6,251 unobserved, plus 184 unique external URLs. Evidence stays entry-specific; no formal data or automatic source attachment was made.

## Oct 29, 2017 and Aug 18, 2026 merge

Two exact existing baseline source keys were added to the observation layer: `2017-10-29-live-01` index 0 and `2026-08-18-live-02` index 0. The latter matched the baseline URL including its existing `spm_id_from` query parameter; the player URL used for opening was not substituted as the baseline key. The observations JSON contains 178 unique keys; the reviewed CSV remains 6,427 unique `(entry_id, source_index)` rows with 178 observed and 6,249 unobserved. The supplementary external URL set remains 184. Both reports exist and are referenced by the exact observation rows. `human_watch=false`; no formal data or metadata inventory was changed. The PUBG map is only a content-association candidate, not active-play authentication; the Aug 18 Wuthering Waves reward menu supports a page-level content review, while the client-install screen is not gameplay or player loading. Dates, full-page scope and completeness remain unresolved.
