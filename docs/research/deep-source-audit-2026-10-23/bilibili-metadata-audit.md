# Bilibili source metadata sweep (2026-10-23)

This audit covers the selected archive baseline at `34b35960`. It read public Bilibili submission/page metadata only; it did not fetch or play video or request playback URLs. The full scan ended with metadata for all 3,440 source-reference rows across 3,261 normalized BV/av submissions. Eleven ordinary TLS/network failures received exactly one retry each, and all eleven retries succeeded. No HTTP 403/412 or API -412 circuit breaker response occurred.

## Inventory and method

- 2,960 archive entries and 3,440 Bilibili source references.
- 3,261 unique submission identifiers; each received a successful metadata record.
- 157 source references had explicit `p=` values. Per-reference page, URL `p`, and `source.part_details` mapping are retained separately; a submission aggregate duration is never treated as a referenced part duration.
- The request pass was serial with about one second between submissions. The initial scan recorded 11 transient TLS/connection failures; each submission was retried once, all returned API success, and the original failure is preserved in the retry log/checkpoint. No anti-bot workaround was used.
- Newly requested metadata stores the public uploader `owner.mid`. Some previously cached successful records predate that field and were not refetched just to acquire UID; these remain `uid_not_retained_name_only` in the analysis.

## Account attribution

The final comparison uses numeric `owner.mid` and the registered Bilibili space UID in `accounts.yaml`. There are 202 distinct source-reference rows with a confirmed numeric UID mismatch. Of these, 182 point to exactly one existing registered account by UID; 20 rows across seven actual uploader UIDs have no exact registered account match and remain blank. Display-name differences alone were not treated as identity mismatches. All proposed changes remain unconfirmed and do not imply that any video should be removed. See `account-attribution-reviewed.csv` and `account-attribution-reviewed.md`.

## Game-timeline snapshot comparison

The prioritized basis pass covers 186 game-timeline records and 854 stored parts, 821 of which have Bilibili bases. No CID mismatch or duration difference greater than two seconds was found in the available Bilibili page snapshots. This checks stored metadata snapshots, not the accuracy of the game label or the completeness of any recording.

## Limits

Public metadata can identify unavailable submissions, page-reference problems, title/date conflicts, page ordering changes, and candidate duration discrepancies. It cannot establish what appears in the video, who is speaking, whether a recording is complete, or whether unreferenced footage exists. A successful metadata response is not proof that playback works. Text/date/game comparisons are review leads, not data corrections. The cache and detailed checkpoint were retained on the user-authorized external volume; no media was downloaded.
