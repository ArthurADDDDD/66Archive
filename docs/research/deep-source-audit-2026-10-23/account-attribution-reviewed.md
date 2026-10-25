# Bilibili account-attribution review

This is a self-check of the 2026-10-23 metadata sweep, not independent human review. It compares each proposed row with the selected archive baseline, its source entry and index, the registered Bilibili space UID in `accounts.yaml`, and the cached public page metadata `owner.mid`. No network requests were made during this review. Formal archive data was not changed. Every row remains `needs_human_confirmation`.

## Validation results

- Validated 202 distinct source-reference rows against the latest `data/entries` and `data/accounts.yaml` baseline; each URL, source index, old account, expected registered UID, and cached actual UID matched the row.
- The 202 rows represent 189 normalized Bilibili submissions. All identifiers are BV IDs; no `av` identifiers occur in this candidate set. Multiple entry references to one BV remain distinct source references, not duplicate errors.
- `2` normalized IDs occur more than once: `BV1ZN411o7VN` is referenced by 13 different dated entries with explicit `p=1,2,3,5–14`; `BV1NSKRzFEK9` is referenced by two entries on 2025-06-26. These are distinct source references and are not collapsed.
- Unique UID matching is unambiguous across registered accounts in this review; 0 duplicate registered Bilibili space UIDs were found. New-account proposals are filled only for an exact UID match to one registered account ID.
- 20 rows have no exact registered account match, across 7 actual uploader UIDs. These remain blank; uploader names are listed as observed public metadata and were not used to guess an account mapping. The registry has no Bilibili account with these UIDs.

## Unregistered uploader UID groups

| Actual UID | Public uploader name | Source-reference rows |
| --- | --- | ---: |
| 23259019 | 列支敦士登驻通辽大使 | 1 |
| 2406709 | 白陆゜ | 5 |
| 285355169 | 比赛帮电竞小报 | 1 |
| 3546795474946437 | 安乐冈花火w | 8 |
| 370311431 | 星星在那远方 | 1 |
| 406777725 | 没被处理过 | 1 |
| 500604364 | N瓜冰冰 | 3 |

## Proposed exact UID mappings

| Proposed registered account ID | Rows |
| --- | ---: |
| bili-fan-bobi-replay | 16 |
| bili-fan-bulanbot | 14 |
| bili-fan-clean-replay | 70 |
| bili-fan-heiji | 20 |
| bili-fan-kid-replay | 32 |
| bili-fan-record-house | 1 |
| bili-fan-secret-house | 3 |
| bili-fan-single-yiyi | 13 |
| bilibili-official | 13 |

These mappings are review suggestions, not approved account or archive changes. A UID mismatch identifies an attribution discrepancy in the source record; it does not establish that the referenced video is wrong, incomplete, or should be removed. No display-name-only mismatch was promoted to a confirmed mismatch.
