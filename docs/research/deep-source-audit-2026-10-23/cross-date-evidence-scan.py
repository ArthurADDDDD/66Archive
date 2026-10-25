#!/usr/bin/env python3
"""Rank Bilibili source/date cross-attachment leads from local metadata only.

This is a review aid. It does not determine the true stream date or edit data.
"""
import argparse
import csv
import json
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import yaml


CN_TZ = timezone(timedelta(hours=8))
DATE_PATTERNS = [
    re.compile(r"(?<!\d)(20\d{2})[-./年](\d{1,2})[-./月](\d{1,2})日?"),
    re.compile(r"(?<!\d)(\d{1,2})月(\d{1,2})日?"),
]
SCOPE_TERMS = ("合集", "合辑", "跨日", "多日", "回顾", "混剪", "精选", "剪辑")


def load_entries(data_root):
    found = []
    for path in sorted((*data_root.glob("*.yaml"), *data_root.glob("*.yml"))):
        value = yaml.safe_load(path.read_text(encoding="utf-8"))
        if isinstance(value, list):
            found.extend(x for x in value if isinstance(x, dict))
        elif isinstance(value, dict) and isinstance(value.get("entries"), list):
            found.extend(x for x in value["entries"] if isinstance(x, dict))
    return found


def bvid_from_url(url):
    m = re.search(r"(?i)(BV[0-9A-Za-z]{10})", str(url or ""))
    return m.group(1) if m else ""


def parse_dates(text, expected_year=None):
    result = set()
    for match in DATE_PATTERNS[0].finditer(str(text or "")):
        try:
            result.add(datetime(int(match.group(1)), int(match.group(2)), int(match.group(3))).date())
        except ValueError:
            pass
    for match in DATE_PATTERNS[1].finditer(str(text or "")):
        if expected_year is None:
            continue
        try:
            result.add(datetime(expected_year, int(match.group(1)), int(match.group(2))).date())
        except ValueError:
            pass
    return result


def load_metadata(path):
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            obj = json.loads(line)
            if obj.get("id"):
                out[obj["id"]] = obj
        except (json.JSONDecodeError, TypeError):
            continue
    return out


def load_reference_pages(path):
    out = defaultdict(list)
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            key = (row.get("entry_id", ""), row.get("id", ""))
            if key[0] and key[1]:
                out[key].append(row)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", required=True, type=Path, help="directory containing archive entry YAML files")
    ap.add_argument("--metadata-jsonl", required=True, type=Path, help="existing Bilibili metadata cache")
    ap.add_argument("--reference-csv", required=True, type=Path, help="existing per-reference page audit CSV")
    ap.add_argument("--output-csv", required=True, type=Path)
    args = ap.parse_args()

    entries = load_entries(args.data_root)
    metadata = load_metadata(args.metadata_jsonl)
    ref_pages = load_reference_pages(args.reference_csv)
    by_date = defaultdict(list)
    for entry in entries:
        by_date[str(entry.get("date", ""))].append(entry)
    bvid_uses = defaultdict(list)
    for entry in entries:
        for idx, source in enumerate(entry.get("sources") or []):
            bvid = bvid_from_url(source.get("url", ""))
            if bvid:
                bvid_uses[bvid].append((entry, idx, source))

    out_rows = []
    for entry in entries:
        entry_date = str(entry.get("date", ""))
        if not re.fullmatch(r"20\d\d-\d\d-\d\d", entry_date):
            continue
        try:
            entry_day = datetime.strptime(entry_date, "%Y-%m-%d").date()
        except ValueError:
            continue
        for source_index, source in enumerate(entry.get("sources") or []):
            bvid = bvid_from_url(source.get("url", ""))
            if not bvid:
                continue
            meta = metadata.get(bvid, {})
            pages = meta.get("pages") if isinstance(meta.get("pages"), list) else []
            page_rows = ref_pages.get((entry.get("id", ""), bvid), [])
            selected_pages = set()
            if source.get("part_details") and isinstance(source["part_details"], list):
                selected_pages = {str(x.get("page")) for x in source["part_details"] if isinstance(x, dict) and x.get("page") is not None}
            else:
                parsed_p = parse_qs(urlparse(str(source.get("url", ""))).query).get("p", [""])[0]
                if parsed_p.isdigit():
                    selected_pages = {parsed_p}
            relevant = [p for p in pages if not selected_pages or str(p.get("page", "")) in selected_pages]
            if not relevant and page_rows:
                selected_pages = {r.get("declared_page") or r.get("url_p") for r in page_rows if r.get("declared_page") or r.get("url_p")}
                selected_pages.discard("")
                relevant = [p for p in pages if not selected_pages or str(p.get("page", "")) in selected_pages]
            page_title_text = " | ".join(str(p.get("part", "")) for p in relevant)
            page_dates = sorted(parse_dates(page_title_text, entry_day.year))
            full_title_dates = sorted(parse_dates(meta.get("title", ""), entry_day.year))
            page_conflicts = [d for d in page_dates if abs((d - entry_day).days) > 1]
            title_conflicts = [d for d in full_title_dates if abs((d - entry_day).days) > 1]
            declared_title_text = " | ".join(r.get("declared_title", "") for r in page_rows if r.get("declared_title"))
            declared_dates = sorted(parse_dates(declared_title_text, entry_day.year))
            declared_conflicts = [d for d in declared_dates if abs((d - entry_day).days) > 1]
            post_day = ""
            post_delta = ""
            try:
                post_day_obj = datetime.fromtimestamp(int(meta.get("postdate")), CN_TZ).date()
                post_day = post_day_obj.isoformat()
                post_delta = (post_day_obj - entry_day).days
            except (TypeError, ValueError, OSError, OverflowError):
                post_day_obj = None
            crossdate_peers = []
            if post_day_obj:
                for peer in by_date.get(post_day_obj.isoformat(), []):
                    if peer.get("id") == entry.get("id"):
                        continue
                    same_game = bool(set(entry.get("games") or []) & set(peer.get("games") or []))
                    crossdate_peers.append(f"{peer.get('id')}:{peer.get('title','')}:{'shared-game' if same_game else 'different-game'}")
            uses = bvid_uses[bvid]
            shared_dates = sorted({str(e.get("date", "")) for e, _, _ in uses if e.get("date") != entry_date})
            duration = int(meta.get("duration", 0) or 0)
            entry_minutes = entry.get("duration_min", "")
            source_count = len(entry.get("sources") or [])
            notes = str(entry.get("note", ""))
            source_note = str(source.get("note", ""))
            scope_terms = sorted(set(term for term in SCOPE_TERMS if term in (str(meta.get("title", "")) + page_title_text + notes + source_note)))

            flags = []
            if page_conflicts:
                flags.append("explicit_page_title_date_conflict_over_1_day")
            if declared_conflicts:
                flags.append("declared_part_title_date_conflict_over_1_day_candidate")
            if title_conflicts:
                flags.append("submission_title_date_conflict_over_1_day_candidate")
            if shared_dates:
                flags.append("same_submission_attached_to_other_entry_date")
            if post_delta != "" and abs(post_delta) > 14:
                flags.append("upload_date_far_from_entry_date")
            if crossdate_peers and post_delta != "" and abs(post_delta) > 14:
                flags.append("entry_exists_on_upload_date")
            if source_count == 1 and post_delta != "" and post_delta > 30:
                flags.append("only_source_uploaded_over_30_days_after_entry")
            if scope_terms:
                flags.append("possible_collection_or_clip_scope_review")
            # Ordinary backfill and multi-date collections are context, not standalone
            # evidence of a wrong attachment. Only emit a row when a date mismatch,
            # a long upload-date gap, or cross-entry reuse gives a concrete lead.
            if not (page_conflicts or declared_conflicts or title_conflicts or shared_dates or (post_delta != "" and abs(post_delta) > 14)):
                continue

            # Ranking is a review queue only. Explicit page-date conflict is the strongest metadata cue;
            # a far-later upload linked to a same-game entry on its upload date is next.
            if page_conflicts or declared_conflicts:
                rank = 1
            elif crossdate_peers and post_delta != "" and abs(post_delta) > 14:
                rank = 2
            elif source_count == 1 and post_delta != "" and post_delta > 30:
                rank = 3
            else:
                rank = 4
            out_rows.append({
                "rank": rank,
                "entry_id": entry.get("id", ""),
                "entry_type": entry.get("type", ""),
                "entry_date": entry_date,
                "entry_title": entry.get("title", ""),
                "entry_games": ";".join(entry.get("games") or []),
                "entry_duration_min": entry_minutes,
                "source_index": source_index,
                "source_count": source_count,
                "source_kind": source.get("kind", ""),
                "source_url": source.get("url", ""),
                "source_status": source.get("status", ""),
                "bvid": bvid,
                "api_title": meta.get("title", ""),
                "api_owner": meta.get("owner", ""),
                "postdate_local": post_day,
                "postdate_delta_days": post_delta,
                "api_submission_duration_sec": duration,
                "api_page_count": len(pages),
                "referenced_pages": ";".join(sorted(selected_pages, key=lambda x: int(x) if str(x).isdigit() else 0)) if selected_pages else "all_pages_or_unscoped",
                "relevant_page_titles": page_title_text,
                "declared_part_titles": declared_title_text,
                "relevant_page_durations_sec": ";".join(str(p.get("duration", "")) for p in relevant),
                "explicit_page_dates_found": ";".join(d.isoformat() for d in page_dates),
                "page_date_conflicts_over_1_day": ";".join(d.isoformat() for d in page_conflicts),
                "declared_part_dates_found": ";".join(d.isoformat() for d in declared_dates),
                "declared_part_date_conflicts_over_1_day": ";".join(d.isoformat() for d in declared_conflicts),
                "submission_title_dates_found": ";".join(d.isoformat() for d in full_title_dates),
                "submission_title_date_conflicts_over_1_day": ";".join(d.isoformat() for d in title_conflicts),
                "other_entry_dates_same_submission": ";".join(shared_dates),
                "entries_on_upload_date": ";".join(crossdate_peers),
                "possible_scope_terms": ";".join(scope_terms),
                "source_note": source_note,
                "entry_note": notes,
                "flags": ";".join(flags),
                "evidence_level": "metadata_only_candidate",
            })
    out_rows.sort(key=lambda r: (r["rank"], -abs(int(r["postdate_delta_days"] or 0)), r["entry_date"], r["entry_id"], r["bvid"]))
    args.output_csv.parent.mkdir(parents=True, exist_ok=True)
    with args.output_csv.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(out_rows[0]) if out_rows else ["rank", "entry_id", "flags"])
        writer.writeheader()
        writer.writerows(out_rows)
    print(json.dumps({"entries": len(entries), "metadata_submissions": len(metadata), "reference_page_rows": sum(map(len, ref_pages.values())), "candidate_source_rows": len(out_rows), "output": str(args.output_csv)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
