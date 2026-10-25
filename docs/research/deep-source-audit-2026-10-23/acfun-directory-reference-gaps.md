# AcFun uploader-directory reference gaps

Date: 2026-10-24. This read-only pass compares the `d019ca1` baseline’s AcFun references to the locally cached public directory pages for uploader UID 4397992. It joins page details from the existing AcFun metadata cache; no network, player, or formal-data operation was performed. Per-ID details are in [acfun-directory-reference-gaps.csv](acfun-directory-reference-gaps.csv).

## Coverage and result

The directory snapshot contains 134 successful page responses across 134 page numbers, with 2,672 unique AcFun IDs. A separate failed response row for one page was ignored because that page also has a successful response. The successful snapshot’s displayed upload-date span is 2016-05-07 through 2023-12-02.

The baseline reference table has 2,390 source rows and 2,389 unique AcFun IDs. The directory contains 2,336 of those IDs; 53 IDs (53 source rows) are absent. All 53 have existing successful page metadata. This is an uploader-directory membership difference only: it does not establish that a URL is dead, its content is invalid, or that a source should be removed.

Of the 53 gaps, 51 page metadata upload dates predate the directory snapshot’s oldest displayed date. The other two are within the snapshot date span but list a different cached owner label, “斗鱼录像厅”:

- [ac2728343](https://www.acfun.cn/v/ac2728343), metadata upload date 2016-05-09, linked to `2016-05-08-live-01`.
- [ac3013788](https://www.acfun.cn/v/ac3013788), metadata upload date 2016-08-11, linked to `2016-08-07-live-01`.

The remaining 49 gap pages also show “斗鱼录像厅” as the cached owner label. Three show “萌得激死”; one has an opaque non-display owner identifier, omitted from the CSV. None of the 53 page-detail records retained a public numeric uploader UID, so owner labels cannot verify account identity. In particular, an absent ID from the UID 4397992 directory is expected for a page attributed to another displayed uploader and is not evidence of invalid footage.

## Review priority

The directory comparison itself does not produce a new content or removal candidate. If a person chooses a small independent content/scope follow-up, two already-noted cases within this gap set stand out:

- [ac2010055](https://www.acfun.cn/v/ac2010055): the existing archive note, cited in `acfun-report.md`, describes a roughly three-minute live clip whose date assignment was inferred. The cached page shows an opaque owner identifier, and the source has no declared account or retained UID. Recheck its date and scope before relying on it as date-specific coverage.
- [ac1736364](https://www.acfun.cn/v/ac1736364): the existing archive note describes it as “直播部分.” The cached owner label is “斗鱼录像厅”; the page details retain no numeric UID. This supports a focused scope review if the entry depends on this source for specific coverage, not a conclusion that the source is invalid.

These are pre-existing note-based concerns surfaced for attention, not findings that the directory scan independently established. The other three “萌得激死” entries and the two in-range “斗鱼录像厅” pages remain identity/scope context only; no content conclusion is made for them.

## Limits

The scan compared against one uploader’s directory snapshot. It did not establish a complete AcFun-wide upload catalog, and it did not inspect video playback. The 2,672 directory IDs absent from the baseline, if any, were outside this assigned pass. All 53 baseline references remain as-is; no deletion or replacement recommendation follows from directory absence.
