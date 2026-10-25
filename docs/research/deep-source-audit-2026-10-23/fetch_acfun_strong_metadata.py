#!/usr/bin/env python3
"""Fetch one selected public AcFun metadata page per uncached candidate ID.

This bounded helper stores selected public page metadata only. It never stores
raw HTML, media URLs, tokens, or stream payloads and does not retry failures.
"""

from __future__ import annotations

import argparse
import csv
import json
import time
import urllib.error
from pathlib import Path

from audit_acfun import BLOCK_CODES, load_journal, selected_page_metadata, now


ALREADY_REVIEWED = {"42944704", "42944705"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate-csv", required=True, type=Path)
    parser.add_argument("--existing-journal", required=True, type=Path)
    parser.add_argument("--output-json", required=True, type=Path)
    args = parser.parse_args()

    candidate_ids: list[str] = []
    with args.candidate_csv.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            ac_id = str(row.get("candidate_ac_id", "")).strip()
            if ac_id and ac_id not in ALREADY_REVIEWED and ac_id not in candidate_ids:
                candidate_ids.append(ac_id)

    existing = load_journal(args.existing_journal)
    queue = [ac_id for ac_id in candidate_ids if ac_id not in existing]
    output_rows: list[dict[str, object]] = []
    blocked_streak = 0
    last_request_at: float | None = None
    for ac_id in queue:
        if last_request_at is not None:
            pause = 1.0 - (time.monotonic() - last_request_at)
            if pause > 0:
                time.sleep(pause)
        last_request_at = time.monotonic()
        try:
            row = selected_page_metadata(ac_id)
            row.pop("final_url", None)
            row["status"] = "metadata_ok"
            output_rows.append(row)
            blocked_streak = 0
        except urllib.error.HTTPError as exc:
            blocked = exc.code in BLOCK_CODES
            output_rows.append({
                "ac_id": ac_id,
                "status": "blocked" if blocked else "error",
                "fetched_at": now(),
                "http_status": exc.code,
                "page_url": f"https://www.acfun.cn/v/ac{ac_id}",
                "title": "",
                "owner": "",
                "public_user_id": "",
                "user_id_field": "",
                "post_date": "",
                "page_metadata_duration_sec": "",
                "video_list": [],
                "video_count": "",
                "note": f"HTTP {exc.code}; no retry; no playback or content inference.",
            })
            blocked_streak = blocked_streak + 1 if blocked else 0
        except Exception as exc:
            output_rows.append({
                "ac_id": ac_id,
                "status": "error",
                "fetched_at": now(),
                "http_status": "",
                "page_url": f"https://www.acfun.cn/v/ac{ac_id}",
                "title": "",
                "owner": "",
                "public_user_id": "",
                "user_id_field": "",
                "post_date": "",
                "page_metadata_duration_sec": "",
                "video_list": [],
                "video_count": "",
                "note": f"{type(exc).__name__}: {str(exc)[:180]}; no retry; no playback or content inference.",
            })
            blocked_streak = 0
        if blocked_streak >= 2:
            break

    args.output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with args.output_json.open("w", encoding="utf-8") as stream:
        json.dump(output_rows, stream, ensure_ascii=False, indent=2)
        stream.write("\n")

    counts: dict[str, int] = {}
    for row in output_rows:
        state = str(row.get("status", "unknown"))
        counts[state] = counts.get(state, 0) + 1
    print(f"candidate_ids={len(candidate_ids)} already_successful_or_reviewed={len(candidate_ids)-len(queue)} requested={len(output_rows)} statuses={counts}")
    print(f"remaining_unrequested={max(0, len(queue)-len(output_rows))}; no retries; output={args.output_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
