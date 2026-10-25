# AcFun directory-catalog scan: local self-check

Date: 2026-10-24. This bounded independent subtask re-ran and checked the local directory scan against the `d019ca1b` baseline, the saved AcFun page-directory JSONL, and the existing reference CSV. No network or media access occurred; no script, source data, root summary, or observation JSON was changed. This is a local output/method check, not a full-content review.

## Reproduction and key checks

The scan was rerun with outputs in a temporary directory and the same local inputs. All three generated CSVs matched the checked-in snapshots row-for-row: `acfun-directory-catalog.csv` has 2,672 unique AcFun IDs, `acfun-directory-unlinked.csv` has 336 unique unreferenced directory IDs, and `acfun-unlinked-part-candidates.csv` has 336 relation rows with 336 unique candidate IDs. The relation output contains 21 `strong_explicit_date_and_linked_series_part`, 92 `weak_explicit_date_and_entry_term`, and 223 `unmapped_candidate` rows. No candidate ID maps to more than one entry in this snapshot.

The set arithmetic also recomputed exactly: 2,389 unique baseline reference IDs; 2,336 shared with the directory; 53 baseline IDs absent from that uploader directory; and 336 directory IDs absent from the baseline. The JSONL has 134 successful pages and one failed/parse-error row. Each successful page number occurs once, so the script’s file-order choice among successful snapshots cannot change the current output.

## Date and part rules

The date parser accepts only a valid full calendar date containing a four-digit year in the title. It does not use `upload_date`. Across the 223 unmapped candidates, 164 have a valid explicit title date but no safe exact-date series/entry-term relation; 59 have no valid full title date. Of those 59, 55 titles contain no four-digit year token, three contain the impossible date `2021.11.31`, and one has only a standalone year with no month/day. All 223 leave `entry_id` and `entry_date` blank. No title year was guessed from upload date or directory position.

One concrete example is [ac2729717](https://www.acfun.cn/v/ac2729717), titled `5-9黑暗之魂3第九天-完结-高清`, uploaded 2016-05-10. It remains unmapped because its title has no year; the upload date is not substituted as the live date. This preserves uncertainty rather than assigning a likely-looking day.

The 21 strong output rows all carry literal `P1`–`P4` markers, and their same-day linked anchors also contain explicit P markers. There is no observed P-marker false positive among those rows. A general heuristic caveat remains: `PART_RE` treats a numeric `n/n` string as a possible part marker, so a future title containing an ordinary fraction could be treated as a part without contextual confirmation. That did not affect the current strong rows.

## Findings and limits

No current output-count, key-uniqueness, date-inference, or CSV-reproduction defect was found. The classifier remains title/metadata triage only; even the strong label does not establish that the page is playable, belongs to the dated stream, is a missing segment, or completes it. The 53 references missing from the 4397992 directory remain directory-membership gaps and are not treated as dead or invalid sources.

For future directory files with multiple successful snapshots per page, `load_directory` keeps the last successful row by JSONL order rather than comparing `observed_at`. The current input has exactly one success per page, so this does not change the current result; the assumption should be revisited if a future input contains multiple successful snapshots in non-chronological order.
