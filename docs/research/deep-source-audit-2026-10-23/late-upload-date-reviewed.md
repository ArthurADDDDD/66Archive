# Rank-2 late-upload date cross-check (local-only)

The candidate table contains **96 rank-2 rows**. This pass screened those rows for 2026 entry or upload dates, selected **four** February 5/7 rows, and compared only those four against the read-only `d019ca1` entry data, same-submission and upload-date candidate columns, existing entry/source notes, and cached Bilibili page/P metadata. It made no network requests and did not inspect video playback.

Four rows have a 2026 entry date or a 2026 upload date: two sources on `2026-02-05-live-03` and two on `2026-02-07-live-01`. All four are the February 5/7 Wuthering Waves source group that root had already reviewed, so they are recorded in [`late-upload-date-reviewed.csv`](late-upload-date-reviewed.csv) as excluded from new adjudication. The other 92 rank-2 rows do not have 2026 entry or upload dates and are outside this focused pass. After the requested exclusions, **0 newly open 2026 rank-2 references remain**; there are **0 additional cases** for root to prioritize from this subset.

The local cross-check preserves these distinctions:

- Feb 5 source `BV18eNGzjEgk` was posted on Mar 8 and has five cached pages titled with times from 18:45 through 21:45, totaling 12,990 seconds, close to the entry's 216-minute label. The same-submission candidate table points to the Mar 8 entry with the same game. The entry note calls this a Douyin replay repost and says the 330-second clip was merged as a same-day cut. The page metadata and note alone do not independently establish the Feb 5 mother-session date.
- Feb 5 source `BV1kNNgztEc2` is one 330-second page, also posted Mar 8 and associated by the candidate table with the Mar 8 same-game entry. It has no declared `part_details`; this is a short-page concern, not date proof.
- The Feb 7 entry has two other long cached sources whose titles explicitly include Feb 7 and whose page names include 18:33. Its two short sources were posted Mar 19 and Mar 20. The candidate table maps those upload dates to different-game entries on those days. Upload-date coincidence does not identify their mother session, and the entry note's “same day” claim is not independently proved by the cached titles alone.

None of the four rows has `part_details` declared in the baseline. The cached page metadata shows the Bilibili page structure for the sources, including the five-page Feb 5 item and one-page short cuts, but does not prove what is visible in every page. No item was newly classified as a late supplement, official re-upload, or cross-midnight collection from this metadata-only pass. Existing date/player work for the Feb 5/7 group remains root's prior review and is not repeated here.

The CSV contains **4 examined/excluded source rows** from the rank-2 2026 subset. It preserves the public source URLs and cached metadata, states the local cross-check for each row, and explicitly says no additional root follow-up is recommended by this pass. No archive data or code was changed.
