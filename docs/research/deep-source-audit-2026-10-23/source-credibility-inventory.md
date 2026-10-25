# Per-source credibility inventory

[`source-credibility-inventory.csv`](source-credibility-inventory.csv) contains one row for every source reference in the read-only `d019ca1` baseline. The join key is `(entry_id, source_index)` and the script also requires an exact source URL match in the corresponding platform reference table.

Coverage assertions passed: **6,427 rows and 6,427 unique reference keys**, across 3,440 Bilibili, 2,390 AcFun, and 597 other-platform references; these references belong to 2,846 distinct archive entries. Every Bilibili, AcFun, and other-platform baseline reference matched exactly one corresponding source-level key. Repeated Bilibili page-audit rows are collapsed into `platform_metadata_page_checks_json` while preserving the declared/page metadata checks. The joined platform states are 3,440 Bilibili `metadata_ok`; 2,388 AcFun `metadata_ok` plus 2 `imported_partial_metadata`; and the other-host states described below.

The inventory preserves the source `kind`, status, declared account, cached platform metadata state/title, and available uploader UID/account-match fields. AcFun retains all 2,390 source rows, including **1,227 rows with observed UID and matching registered UID**, and 1,163 rows still marked unverified by the joined AcFun reference table. Bilibili UID match states are carried from the existing per-reference audit; its 202 `uid_mismatch_confirmed` labels remain machine review flags, not independent human findings in this inventory. Bilibili scope/review flags are retained in `page_scope_or_review_flags` for later focused review.

Four evidence dimensions are deliberately separate. `platform_metadata_confidence` describes only the existence/state of cached public page metadata. `game_attribution_evidence`, `mother_session_date_evidence`, and `completeness_evidence` default to explicitly unverified values for every source; titles, upload times, durations, and successful metadata responses do not upgrade them. `machine_review_suggestion` is generated mechanically and `review_provenance` is always `machine_join_only_not_human_watch`.

The other-host metadata states are preserved as collected: 331 `metadata_ok`, 264 `host_deferred_due_challenge`, 1 `login_or_challenge`, and 1 `resume_pending`. These status values do not assert that a video is playable. No network request was made to build this inventory, and no media was requested. Source URLs are ordinary archive page URLs; redirect destinations and media streams are not included.

Rebuild with the selected baseline and existing metadata tables supplied as arguments:

```sh
python3 build-source-credibility-inventory.py \
  --data-dir <baseline-data-entries> \
  --bilibili-audit <bilibili-per-reference-audit.csv> \
  --acfun-references <acfun-references.csv> \
  --other-sources <other-host-sources.csv> \
  --output <source-credibility-inventory.csv>
```

The generator asserts the 6,427 total, platform counts, key uniqueness, exact URLs, and complete per-platform joins before writing output. It does not read or modify data outside the supplied baseline directory and output path.

## Optional source observations

[`source-credibility-reviewed.csv`](source-credibility-reviewed.csv) is a separate output generated with the optional `--observations` input. It adds `audit_*` columns by exact `(entry_id, source_index, source_url)` match. Current status (2026-10-25): **176 source references are marked `observed`; 6,251 are `not_observed` / `not_individually_observed`**, out of 6,427. This count is carried by the review-only `audit_observation_status` and related `audit_*` fields. It does not change the metadata-only `source-credibility-inventory.csv`: that file's game/date/completeness evidence columns remain at their explicitly unverified defaults for all rows. The input records set `human_watch=false`, retained per observed row; none of these machine or prior-local checks is described as human viewing.

Before joining, the generator rejects duplicate observation keys, unknown references, URL mismatches, or evidence references that are not relative files present beside the observations JSON. All evidence references in the current 176 keyed observation records passed that existence check. The observations JSON has 184 `supplementary_external_evidence` items without an entry/source-index key; they are not counted as source-reference observations or attached to a source row because no exact source-reference key is supplied. The current top-level count is also recorded in [`current-evidence-status.json`](current-evidence-status.json).

The original `source-credibility-inventory.csv` remains the metadata-only snapshot. Reproduce the separate reviewed output by adding `--observations <source-credibility-observations.json>` and setting `--output <source-credibility-reviewed.csv>` in the command above.
