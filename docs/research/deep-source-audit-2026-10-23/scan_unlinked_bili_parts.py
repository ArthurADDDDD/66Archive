#!/usr/bin/env python3
"""Rank unreferenced Bilibili catalog pages against existing archive entries.

Read-only inputs: a repository baseline, the two public catalog CSVs, and an
optional JSONL metadata cache. The script emits candidate rows only; it never
edits archive data. Strong matches require an exact normalized catalog title
shared with a BV already linked from that entry and an exact live date.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import yaml


BV_RE = re.compile(r"BV[0-9A-Za-z]{10}")
DATE_RE = re.compile(r"(20\d{2})[年.\-/](\d{1,2})[月.\-/](\d{1,2})日?")
P_RE = re.compile(r"(?:第\s*\d+\s*(?:P|段|部分)|P\s*\d+)", re.I)


def parse_date(text: str) -> str:
    match = DATE_RE.search(text or "")
    if not match:
        return ""
    year, month, day = map(int, match.groups())
    return f"{year:04d}-{month:02d}-{day:02d}"


def normalize_series(title: str) -> str:
    """Remove explicit part numbering and normalize whitespace only."""
    value = P_RE.sub(" ", title or "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def load_entries(root: Path) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for path in sorted((root / "data/entries").glob("*.yaml")):
        with path.open(encoding="utf-8") as stream:
            document = yaml.safe_load(stream)
        if isinstance(document, list):
            entries.extend(item for item in document if isinstance(item, dict))
        elif isinstance(document, dict):
            entries.extend(item for item in document.get("entries", []) if isinstance(item, dict))
    return entries


def load_catalogs(record_house: Path, search_catalog: Path) -> dict[str, dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    for path in (record_house, search_catalog):
        with path.open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                bvid = row.get("bvid", "").strip()
                if not bvid:
                    continue
                item = records.setdefault(
                    bvid,
                    {"titles": set(), "dates": set(), "durations": set(), "catalogs": set(), "pubdates": set()},
                )
                title = row.get("title", "").strip()
                if title:
                    item["titles"].add(title)
                date = (row.get("live_date") or "").strip() or parse_date(title)
                if date:
                    item["dates"].add(date)
                if row.get("duration"):
                    item["durations"].add(row["duration"].strip())
                if row.get("pubdate"):
                    item["pubdates"].add(row["pubdate"].strip())
                item["catalogs"].add(path.name)
    return records


def load_cache(cache_path: Path | None) -> dict[str, dict[str, Any]]:
    cache: dict[str, dict[str, Any]] = {}
    if cache_path is None:
        return cache
    with cache_path.open(encoding="utf-8") as stream:
        for line in stream:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("id"):
                cache[row["id"]] = row
    return cache


def source_bvs(entries: list[dict[str, Any]]) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    by_entry: dict[str, set[str]] = defaultdict(set)
    by_bv: dict[str, set[str]] = defaultdict(set)
    for entry in entries:
        entry_id = str(entry.get("id", ""))
        for source in entry.get("sources") or []:
            for bvid in BV_RE.findall(str(source.get("url", ""))):
                by_entry[entry_id].add(bvid)
                by_bv[bvid].add(entry_id)
    return by_entry, by_bv


def load_known(path: Path | None) -> set[tuple[str, str]]:
    known: set[tuple[str, str]] = set()
    if path is None:
        return known
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            entry_id = row.get("entry_id", "")
            bvid = row.get("catalog_bvid", row.get("bvid", ""))
            status = row.get("target_entry_link_status", "")
            if entry_id and bvid and (not status or status.startswith("unlinked_candidate")):
                known.add((entry_id, bvid))
    return known


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path, help="Repository root for the selected read-only baseline")
    parser.add_argument("--record-house", required=True, type=Path, help="bilibili-record-house.csv")
    parser.add_argument("--search-catalog", required=True, type=Path, help="bilibili-search-2024-2026.csv")
    parser.add_argument("--cache", type=Path, help="Optional Bilibili metadata JSONL cache")
    parser.add_argument("--known-csv", type=Path, help="Optional prior candidate CSV for known-hit marking")
    parser.add_argument("--output-csv", required=True, type=Path)
    args = parser.parse_args()

    root = args.baseline.resolve()
    entries = load_entries(root)
    catalogs = load_catalogs(args.record_house, args.search_catalog)
    cache = load_cache(args.cache)
    linked_by_entry, linked_by_bv = source_bvs(entries)
    known = load_known(args.known_csv)

    # For each entry, use catalog titles of already linked BV sources as series
    # anchors. Exact normalized title and date are required for a strong hit.
    rows: list[dict[str, str]] = []
    for entry in entries:
        entry_id = str(entry.get("id", ""))
        live_date = str(entry.get("date", ""))
        if not entry_id or not live_date or entry.get("type") != "live":
            continue
        linked = linked_by_entry.get(entry_id, set())
        anchor_titles: set[str] = set()
        for bvid in linked:
            meta = catalogs.get(bvid)
            if not meta:
                continue
            for title in meta["titles"]:
                if live_date in meta["dates"]:
                    anchor_titles.add(normalize_series(title))
        if not anchor_titles:
            continue

        entry_terms = [str(entry.get("title", "")).strip()]
        entry_terms.extend(str(game).replace("-", " ") for game in entry.get("games") or [])
        for bvid, meta in catalogs.items():
            if bvid in linked_by_bv or live_date not in meta["dates"]:
                continue
            titles = sorted(meta["titles"])
            for title in titles:
                normalized = normalize_series(title)
                explicit_part = bool(P_RE.search(title))
                if (entry_id, bvid) in known:
                    kind = "known_prior_review_do_not_repeat"
                    reason = "already reviewed in the bounded 13-entry candidate list; retained as known context, not a new discovery"
                elif normalized in anchor_titles and explicit_part:
                    kind = "strong_series_explicit_part"
                    reason = "exact live date; exact normalized title matches a linked BV after removing only part numbering"
                elif normalized in anchor_titles:
                    kind = "weak_same_series_no_explicit_part"
                    reason = "exact live date and normalized title match a linked BV, but candidate title has no explicit part number"
                elif any(term and len(term) > 1 and term.casefold() in title.casefold() for term in entry_terms):
                    kind = "weak_date_title_term"
                    reason = "exact live date and a literal entry title/game term; normalized linked-source series does not match"
                else:
                    continue
                cache_row = cache.get(bvid)
                page_parts = []
                if cache_row:
                    for page in cache_row.get("pages", []):
                        page_parts.append(f"p{page.get('page')}:{page.get('duration')}s:{page.get('part', '')}")
                rows.append({
                    "entry_id": entry_id,
                    "entry_date": live_date,
                    "entry_title": str(entry.get("title", "")),
                    "entry_games": ";".join(map(str, entry.get("games") or [])),
                    "candidate_bvid": bvid,
                    "candidate_title": title,
                    "candidate_title_part_marker": ";".join(sorted(set(P_RE.findall(title)))),
                    "candidate_dates": ";".join(sorted(meta["dates"])),
                    "catalog_duration": ";".join(sorted(meta["durations"])),
                    "catalogs": ";".join(sorted(meta["catalogs"])),
                    "already_linked_entry_ids": ";".join(sorted(linked_by_bv.get(bvid, set()))),
                    "candidate_class": kind,
                    "known_in_previous_13_entry_review": "yes" if (entry_id, bvid) in known else "no",
                    "metadata_cache": "present" if cache_row else ("not_supplied" if args.cache is None else "absent"),
                    "metadata_cache_code": str(cache_row.get("code", "")) if cache_row else "",
                    "cached_pages": "; ".join(page_parts),
                    "basis": reason,
                    "public_url": f"https://www.bilibili.com/video/{bvid}",
                })

    rows.sort(key=lambda row: (row["candidate_class"], row["entry_date"], row["entry_id"], row["candidate_bvid"]))
    args.output_csv.parent.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0]) if rows else ["entry_id", "entry_date", "candidate_bvid", "candidate_class"]
    with args.output_csv.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    counts: dict[str, int] = defaultdict(int)
    for row in rows:
        counts[row["candidate_class"]] += 1
    print(f"entries={len(entries)} referenced_bvs={len(linked_by_bv)} catalog_bvs={len(catalogs)} cache_bvs={len(cache)} candidates={len(rows)}")
    for key in sorted(counts):
        print(f"{key}={counts[key]}")
    print(f"output={args.output_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
