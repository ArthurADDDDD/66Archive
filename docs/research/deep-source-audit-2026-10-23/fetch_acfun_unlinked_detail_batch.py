#!/usr/bin/env python3
"""Fetch one bounded batch of public AcFun detail metadata for a fixed CSV set.

Only selected page title, public UID, and videoList title/duration fields are
written. Raw HTML is held in memory by audit_acfun.selected_page_metadata and
discarded. This utility does not access media URLs or retry failed IDs.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.error
from pathlib import Path
from typing import Any

from audit_acfun import BLOCK_CODES, selected_page_metadata


def normalize(row: dict[str, Any], *, acquisition: str) -> dict[str, Any]:
    """Normalize prior compact metadata to the report's safe schema."""
    ac_id = str(row.get("ac_id") or row.get("id") or "")
    url = str(row.get("page_url") or row.get("url") or f"https://www.acfun.cn/v/ac{ac_id}")
    title = str(row.get("title") or row.get("page_title") or "")
    source_parts = row.get("video_list") or row.get("parts") or []
    parts = []
    for i, part in enumerate(source_parts, 1):
        parts.append({
            "video_list_index": int(part.get("video_list_index") or i),
            "title": str(part.get("title") or ""),
            "duration_sec": part.get("duration_sec", ""),
        })
    return {
        "ac_id": ac_id,
        "status": str(row.get("status") or "metadata_ok"),
        "acquisition": acquisition,
        "http_status": row.get("http_status", ""),
        "page_url": url,
        "page_title": title,
        "public_user_id": str(row.get("public_user_id") or row.get("owner_uid") or ""),
        "user_id_field": str(row.get("user_id_field") or ""),
        "video_list_count": len(parts),
        "video_list": parts,
        "note": "Selected public page metadata only; playback/content/completeness not verified.",
    }


def iter_records(value: Any):
    if isinstance(value, dict):
        if isinstance(value.get("pages"), list):
            for item in value["pages"]:
                yield item
        elif value.get("ac_id") or value.get("id"):
            yield value
        else:
            for child in value.values():
                yield from iter_records(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_records(child)


def load_local_success(paths: list[Path], target_ids: set[str]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for path in paths:
        value = json.loads(path.read_text(encoding="utf-8"))
        for row in iter_records(value):
            aid = str(row.get("ac_id") or row.get("id") or "")
            if not aid or aid not in target_ids:
                continue
            status = str(row.get("status") or "metadata_ok")
            if status not in {"metadata_ok", "success", "ok"} and "pages" not in value:
                continue
            result[aid] = normalize(row, acquisition=f"reused:{path.name}")
            result[aid]["status"] = "metadata_ok"
    return result


def load_journal(path: Path) -> dict[str, dict[str, Any]]:
    latest = {}
    if not path.exists():
        return latest
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        aid = str(row.get("ac_id") or "")
        if aid:
            latest[aid] = row
    return latest


def append_jsonl(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
        stream.flush()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate-csv", required=True, type=Path)
    parser.add_argument("--reuse-json", action="append", default=[], type=Path)
    parser.add_argument("--existing-journal", required=True, type=Path)
    parser.add_argument("--checkpoint-journal", required=True, type=Path)
    parser.add_argument("--batch-size", type=int, default=15)
    args = parser.parse_args()

    ordered_ids = []
    with args.candidate_csv.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            aid = str(row.get("ac_id") or "").strip()
            if aid and aid not in ordered_ids:
                ordered_ids.append(aid)
    target_ids = set(ordered_ids)
    reused = load_local_success(args.reuse_json, target_ids)
    existing = load_journal(args.existing_journal)
    # Reuse any prior public success for an ID in this exact fixed set.
    for aid, row in existing.items():
        if aid in target_ids and row.get("status") in {"metadata_ok", "success", "ok"}:
            reused[aid] = normalize(row, acquisition="reused:external_journal")
            reused[aid]["status"] = "metadata_ok"
    checkpoint = load_journal(args.checkpoint_journal)
    for aid, row in checkpoint.items():
        if aid in target_ids and row.get("status") in {"metadata_ok", "blocked", "error"}:
            reused[aid] = row

    pending = [aid for aid in ordered_ids if aid not in reused]
    batch = pending[: max(0, args.batch_size)]
    last = None
    blocked_streak = 0
    results = []
    for aid in batch:
        if last is not None:
            pause = 1.0 - (time.monotonic() - last)
            if pause > 0:
                time.sleep(pause)
        last = time.monotonic()
        try:
            row = selected_page_metadata(aid)
            row.pop("final_url", None)
            row.pop("post_date", None)
            row.pop("view_count", None)
            parts = [{
                "video_list_index": i,
                "title": str(part.get("title") or ""),
                "duration_sec": part.get("duration_sec", ""),
            } for i, part in enumerate(row.get("video_list") or [], 1)]
            row = {
                "ac_id": aid,
                "status": "metadata_ok",
                "acquisition": "new_public_page_get",
                "http_status": row.get("http_status", ""),
                "page_url": f"https://www.acfun.cn/v/ac{aid}",
                "page_title": str(row.get("title") or ""),
                "public_user_id": str(row.get("public_user_id") or ""),
                "user_id_field": str(row.get("user_id_field") or ""),
                "video_list_count": len(parts),
                "video_list": parts,
                "note": "Selected public page metadata only; playback/content/completeness not verified.",
            }
            blocked_streak = 0
        except urllib.error.HTTPError as exc:
            blocked = exc.code in BLOCK_CODES
            row = {
                "ac_id": aid,
                "status": "blocked" if blocked else "error",
                "acquisition": "new_public_page_get",
                "http_status": exc.code,
                "page_url": f"https://www.acfun.cn/v/ac{aid}",
                "page_title": "",
                "public_user_id": "",
                "user_id_field": "",
                "video_list_count": 0,
                "video_list": [],
                "note": f"HTTP {exc.code}; no retry or verification bypass.",
            }
            blocked_streak = blocked_streak + 1 if blocked else 0
        except Exception as exc:
            row = {
                "ac_id": aid,
                "status": "error",
                "acquisition": "new_public_page_get",
                "http_status": "",
                "page_url": f"https://www.acfun.cn/v/ac{aid}",
                "page_title": "",
                "public_user_id": "",
                "user_id_field": "",
                "video_list_count": 0,
                "video_list": [],
                "note": f"{type(exc).__name__}: {str(exc)[:180]}; no retry or verification bypass.",
            }
            blocked_streak = 0
        append_jsonl(args.checkpoint_journal, row)
        results.append(row)
        if blocked_streak >= 2:
            break

    latest = load_journal(args.checkpoint_journal)
    print(
        f"fixed_ids={len(ordered_ids)} reused_local_or_existing={len(reused)} "
        f"newly_attempted_this_batch={len(results)} pending_after_batch={max(0, len(pending)-len(results))} "
        f"statuses={{{', '.join(f'{s}:{sum(1 for x in results if x.get(chr(115)+chr(116)+chr(97)+chr(116)+chr(117)+chr(115))==s)}' for s in sorted({str(x.get('status')) for x in results}))}}} "
        f"checkpoint_rows={len(latest)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
