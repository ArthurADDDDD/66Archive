#!/usr/bin/env python3
"""Build review-only AcFun anomaly candidates from saved metadata and baseline data."""
import argparse, csv, json, re
from collections import defaultdict
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--baseline", type=Path, required=True, help="Read-only archive checkout to inspect")
parser.add_argument("--journal", type=Path, required=True, help="Compact metadata journal from the approved cache location")
args = parser.parse_args()

latest = {}
for line in args.journal.read_text(encoding="utf-8").splitlines():
    row = json.loads(line)
    latest[row["ac_id"]] = row

entry_rows = []
all_refs = []
for path in sorted((args.baseline / "data/entries").glob("*.yaml")):
    entries = yaml.safe_load(path.read_text(encoding="utf-8")) or []
    for entry in entries:
        refs = []
        for index, source in enumerate(entry.get("sources") or []):
            url = str(source.get("url") or "")
            m = re.search(r"/v/ac(\d+)", url)
            if not m or "acfun.cn" not in url.lower():
                continue
            ac_id = m.group(1)
            metadata = latest.get(ac_id, {})
            ref = {"entry": entry, "source": source, "index": index, "ac_id": ac_id, "url": url, "metadata": metadata}
            refs.append(ref)
            all_refs.append(ref)
        if not refs:
            continue
        unique_post_ids = sorted({r["ac_id"] for r in refs})
        totals = [sum(v.get("duration_sec") or 0 for v in latest.get(a, {}).get("video_list", []))
                  for a in unique_post_ids if latest.get(a, {}).get("status") == "metadata_ok"]
        observed_total = sum(totals)
        duration_min = entry.get("duration_min")
        duration_candidate = (isinstance(duration_min, (int, float)) and observed_total > 0
                              and abs(duration_min - observed_total / 60) > max(30, duration_min * .5))
        if duration_candidate:
            entry_rows.append((entry, refs, observed_total, duration_min))

fields = ["category", "entry", "ac_id", "url", "source_account", "entry_duration_min", "source_parts_count",
          "page_video_count", "page_total_seconds", "page_part_zero_count", "zero_title_candidates", "page_title_sequence",
          "duration_delta_min_vs_entry", "basis", "note"]
out = HERE / "acfun-review-candidates.csv"
with out.open("w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields); w.writeheader()
    # Source `parts` scalar compared with the current AcFun page videoList count.
    for r in all_refs:
        s, m, e = r["source"], r["metadata"], r["entry"]
        actual = len(m.get("video_list") or [])
        if s.get("parts") is not None and m.get("status") == "metadata_ok" and s.get("parts") != actual:
            w.writerow({"category": "source_parts_vs_videoList_count", "entry": e.get("id"), "ac_id": r["ac_id"],
                        "url": r["url"], "source_account": s.get("account", ""), "entry_duration_min": e.get("duration_min", ""),
                        "source_parts_count": s.get("parts"), "page_video_count": actual,
                        "page_total_seconds": sum(v.get("duration_sec") or 0 for v in m.get("video_list") or []),
                        "page_part_zero_count": sum((v.get("duration_sec") or 0) == 0 for v in m.get("video_list") or []),
                        "zero_title_candidates": "", "duration_delta_min_vs_entry": "", "basis": "",
                        "note": "Count mismatch candidate; page metadata count is not proof of content completeness."})
    # Candidate only: visible part labels may be out of page-array order. Playback navigation still follows array order.
    order_seen = set()
    for r in all_refs:
        m = r["metadata"]
        if m.get("status") != "metadata_ok" or r["ac_id"] in order_seen:
            continue
        videos = m.get("video_list") or []
        labels = []
        for page, video in enumerate(videos, 1):
            title = video.get("title", "")
            match = re.search(r"(?:^|[^A-Za-z])(?:P|Part)\s*[-_. ]?\s*(\d+)", title, re.I)
            if match:
                labels.append((page, int(match.group(1)), title))
        numbers = [x[1] for x in labels]
        if len(numbers) >= 2 and numbers != sorted(numbers):
            order_seen.add(r["ac_id"])
            w.writerow({"category": "non_monotonic_part_title_sequence_candidate", "entry": r["entry"].get("id"),
                        "ac_id": r["ac_id"], "url": r["url"], "source_account": r["source"].get("account", ""),
                        "entry_duration_min": r["entry"].get("duration_min", ""), "source_parts_count": r["source"].get("parts", ""),
                        "page_video_count": len(videos), "page_total_seconds": sum(v.get("duration_sec") or 0 for v in videos),
                        "page_part_zero_count": sum((v.get("duration_sec") or 0) == 0 for v in videos),
                        "zero_title_candidates": "", "page_title_sequence": " | ".join(f"page {p}: P{n} {t}" for p,n,t in labels),
                        "duration_delta_min_vs_entry": "", "basis": "",
                        "note": "Title numbering does not increase with current videoList array order. Candidate only; do not reorder pages or assume a missing part."})
    # Current page-list parts with zero reported duration.
    zero_seen = set()
    for r in all_refs:
        m, e = r["metadata"], r["entry"]
        zero = [v for v in m.get("video_list") or [] if (v.get("duration_sec") or 0) == 0]
        if zero and r["ac_id"] not in zero_seen and m.get("status") == "metadata_ok":
            zero_seen.add(r["ac_id"])
            w.writerow({"category": "zero_duration_part_metadata", "entry": e.get("id"), "ac_id": r["ac_id"],
                        "url": r["url"], "source_account": r["source"].get("account", ""), "entry_duration_min": e.get("duration_min", ""),
                        "source_parts_count": r["source"].get("parts", ""), "page_video_count": len(m.get("video_list") or []),
                        "page_total_seconds": sum(v.get("duration_sec") or 0 for v in m.get("video_list") or []),
                        "page_part_zero_count": len(zero), "zero_title_candidates": " | ".join(v.get("title", "") for v in zero),
                        "page_title_sequence": "",
                        "duration_delta_min_vs_entry": "", "basis": "",
                        "note": "Zero duration in public page metadata only; may be placeholder/API issue and does not prove zero footage."})
    # Broad entry-duration candidates, deduplicated by entry rather than comparing each source separately.
    for e, refs, total_sec, duration_min in entry_rows:
        unique = {}
        for r in refs:
            unique[r["ac_id"]] = r
        for r in unique.values():
            m = r["metadata"]
            w.writerow({"category": "entry_duration_vs_sum_of_unique_acfun_posts_candidate", "entry": e.get("id"),
                        "ac_id": r["ac_id"], "url": r["url"], "source_account": r["source"].get("account", ""),
                        "entry_duration_min": duration_min, "source_parts_count": r["source"].get("parts", ""),
                        "page_video_count": m.get("video_count", ""),
                        "page_total_seconds": sum(v.get("duration_sec") or 0 for v in m.get("video_list") or []),
                        "page_part_zero_count": sum((v.get("duration_sec") or 0) == 0 for v in m.get("video_list") or []),
                        "zero_title_candidates": "", "page_title_sequence": "", "duration_delta_min_vs_entry": round(total_sec / 60 - duration_min, 1),
                        "basis": "", "note": "Screening candidate only: entry duration and summed archive-post duration may use different semantics, overlap, or represent partial sources."})
print(f"wrote {out.name}; duration_candidate_entries={len(entry_rows)}; zero_duration_posts={len(zero_seen)}")
