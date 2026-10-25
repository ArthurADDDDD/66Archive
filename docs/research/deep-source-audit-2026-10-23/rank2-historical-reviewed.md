# Historical rank-2 late-upload candidates: local comparison

The candidate file contains 96 rank-2 source references. After the separate four-row 2026 pass, this file covers all **92 non-2026 rows**, one CSV row per exact `(entry_id, source_index, source_url)` key. The rows were checked against the read-only `d019ca1` entries, existing entry/source notes, same-submission and upload-date candidate fields, and cached Bilibili page/part metadata. There are no exact-key overlaps with the rank-1 candidate set. One row overlaps the root's 35-source observation list; it is included only as `prior_root_observation_excluded`, leaving **91 newly compared rows**.

`rank2-historical-reviewed.csv` retains the source URL, archive date and `kind`, cached page title/uploader/post date/duration/page count, reference-level page-part metadata, declared `part_details` count, candidate dates and flags, presence/type of existing notes, and a per-row local classification. The classification describes what the joined record contains; `date_verdict` is `not_decided_by_this_pass` for every row. No metadata title, page date, or upload date is used as a final date verdict.

## Local findings

- 79 references have a cached page/part title date matching the archive day. Most are pages in late-upload multi-day collections with an explicit per-page date, such as the 2015/2016 recordings or dated game chapters. The metadata supports the page-to-entry mapping clue; it does not independently prove playback or live chronology.
- 3 references have existing notes describing date or schedule evidence, but this pass did not reopen that evidence. Another 3 notes describe a supplement or chapter relationship. These remain prior note claims, not new checks.
- 2 video entries are explicitly reaction/edited content rather than live-session replays; their late upload dates do not indicate a live-session date conflict.
- 2 references have a submission title containing the archive day but no scoped page part repeating the day. Existing notes give context for both; they are not additional root follow-up candidates.
- 2 P1/P2 parts of the same **2015-10-20 `A Bird Story`** submission remain the only clear date-evidence follow-up in this subset. The existing note records that the source's part/title date says Oct 20 while a contemporaneous schedule instead places the game on Oct 19, and says the discrepancy remains unresolved. Cached P1/P2 names are generic split labels without their own date. This pass did not re-open the source or resolve the conflict. Root could add one targeted player/date check for the two parts as a single case.
- The remaining 1 row is the exact root-observed reference; this pass does not restate its observation or add a new recommendation.

**Root follow-up priority: 1 case** (`2015-10-20-live-01`, source indexes 0 and 1; one two-part submission). The highest-value evidence would be a date-bearing in-video cue or an independent contemporaneous schedule/recording log that resolves Oct 19 versus Oct 20. No conclusion is recommended from the title date alone.

This was a machine-assisted local comparison, not a new playback or independent human review. It made no network requests, did not change archive data, and did not treat page duration as the live-stream duration or as proof of completeness.
