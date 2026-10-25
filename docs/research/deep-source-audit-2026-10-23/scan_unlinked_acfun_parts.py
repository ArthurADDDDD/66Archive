#!/usr/bin/env python3
"""Compare a captured AcFun uploader directory with an archive baseline.

Inputs are local snapshots only. Candidate relations are triage rows, not source
additions or completeness claims. AcFun post IDs are treated as independent posts;
videoList part labels belong to a post and are not confused with post IDs.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import yaml


AC_RE = re.compile(r"(?:ac|/v/)(\d{5,})", re.I)
DATE_RE = re.compile(
    r"(?<!\d)(20\d{2})\s*(?:年|[./-])\s*(\d{1,2})\s*(?:月|[./-])\s*(\d{1,2})\s*日?"
)
PART_RE = re.compile(
    r"(?:第\s*\d+\s*(?:P|段|部分)|(?<![A-Za-z])P\s*\d+(?:\.\d+)?(?!\d)|(?<!\d)\d+\s*/\s*\d+(?!\d))",
    re.I,
)


def explicit_title_date(title: str) -> str:
    """Return a valid explicit YYYY-MM-DD in the title; never use upload date."""
    match = DATE_RE.search(title or "")
    if not match:
        return ""
    year, month, day = map(int, match.groups())
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return ""


def title_part_marker(title: str) -> str:
    markers = []
    for match in PART_RE.finditer(title or ""):
        value = re.sub(r"\s+", "", match.group(0)).upper()
        if value not in markers:
            markers.append(value)
    return ";".join(markers)


def normalize_series(title: str) -> str:
    value = PART_RE.sub(" ", title or "")
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


def load_refs(path: Path) -> tuple[dict[str, set[str]], dict[str, set[str]], dict[str, list[dict[str, str]]]]:
    ids_by_entry: dict[str, set[str]] = defaultdict(set)
    entries_by_id: dict[str, set[str]] = defaultdict(set)
    rows_by_id: dict[str, list[dict[str, str]]] = defaultdict(list)
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            ac_id = (row.get("ac_id") or "").strip()
            if not ac_id:
                for key in ("url", "source_url"):
                    match = AC_RE.search(row.get(key, ""))
                    if match:
                        ac_id = match.group(1)
                        break
            entry_id = (row.get("entry_id") or row.get("entry") or "").strip()
            if not ac_id or not entry_id:
                continue
            ids_by_entry[entry_id].add(ac_id)
            entries_by_id[ac_id].add(entry_id)
            rows_by_id[ac_id].append({str(k): str(v or "") for k, v in row.items()})
    return ids_by_entry, entries_by_id, rows_by_id


def load_directory(path: Path) -> tuple[dict[str, dict[str, str]], dict[int, dict[str, Any]], list[dict[str, str]]]:
    """Keep last successful snapshot per page, then deduplicate by AcFun post ID."""
    successes_by_page: dict[int, dict[str, Any]] = {}
    errors: list[dict[str, str]] = []
    with path.open(encoding="utf-8") as stream:
        for line_no, line in enumerate(stream, 1):
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append({"line": str(line_no), "page": "", "error": str(exc)})
                continue
            page_num = row.get("page")
            try:
                page_num = int(page_num)
            except (TypeError, ValueError):
                errors.append({"line": str(line_no), "page": "", "error": "invalid page number"})
                continue
            if row.get("status") == 200 and isinstance(row.get("items"), list):
                successes_by_page[page_num] = row
            elif row.get("error"):
                errors.append({"line": str(line_no), "page": str(page_num), "error": str(row["error"])})

    posts: dict[str, dict[str, str]] = {}
    for page_num in sorted(successes_by_page):
        page = successes_by_page[page_num]
        for item_index, item in enumerate(page.get("items", []), 1):
            ac_id = str(item.get("ac_id", "")).strip()
            if not ac_id:
                continue
            row = {
                "ac_id": ac_id,
                "title": str(item.get("title", "") or "").strip(),
                "upload_date": str(item.get("upload_date", "") or "").strip(),
                "title_date": explicit_title_date(str(item.get("title", "") or "")),
                "title_part_marker": title_part_marker(str(item.get("title", "") or "")),
                "normalized_series_title": normalize_series(str(item.get("title", "") or "")),
                "directory_page": str(page_num),
                "directory_item_index": str(item_index),
                "page_observed_at": str(page.get("observed_at", "") or ""),
                "catalog_public_url": f"https://www.acfun.cn/v/ac{ac_id}",
            }
            # If a duplicate ID occurs, preserve the earliest directory position
            # and keep the last nonempty title/upload metadata seen.
            existing = posts.get(ac_id)
            if existing:
                existing["duplicate_directory_occurrences"] = str(
                    int(existing.get("duplicate_directory_occurrences", "1")) + 1
                )
                for key in ("title", "upload_date", "title_date", "title_part_marker", "normalized_series_title"):
                    if row[key]:
                        existing[key] = row[key]
            else:
                row["duplicate_directory_occurrences"] = "1"
                posts[ac_id] = row
    return posts, successes_by_page, errors


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path, help="Repository root for the selected read-only baseline")
    parser.add_argument("--directory-jsonl", required=True, type=Path, help="AcFun uploader-directory page snapshots JSONL")
    parser.add_argument("--references-csv", required=True, type=Path, help="Existing archive AcFun references CSV")
    parser.add_argument("--output-dir", required=True, type=Path, help="Folder for the three generated CSV files")
    args = parser.parse_args()

    root = args.baseline.resolve()
    entries = load_entries(root)
    entry_by_id = {str(row.get("id", "")): row for row in entries if row.get("id")}
    ids_by_entry, entries_by_id, refs_by_id = load_refs(args.references_csv)
    posts, page_rows, errors = load_directory(args.directory_jsonl)
    catalog_ids = set(posts)
    referenced_ids = set(entries_by_id)
    unlinked_ids = catalog_ids - referenced_ids
    linked_ids_missing_from_catalog = referenced_ids - catalog_ids

    # Entry-scoped anchors come only from already-linked AcFun posts whose own
    # explicit title date equals that entry's date. Upload dates are never used.
    anchors_by_entry: dict[str, list[dict[str, str]]] = defaultdict(list)
    for ac_id, ref_rows in refs_by_id.items():
        for ref_row in ref_rows:
            entry_id = (ref_row.get("entry_id") or ref_row.get("entry") or "").strip()
            entry = entry_by_id.get(entry_id, {})
            live_date = str(entry.get("date", "") or "")
            linked_title = ref_row.get("metadata_title", "").strip()
            linked_date = explicit_title_date(linked_title)
            linked_part = title_part_marker(linked_title)
            if linked_date and linked_date == live_date and linked_part:
                anchors_by_entry[entry_id].append({
                    "ac_id": ac_id,
                    "title": linked_title,
                    "series": normalize_series(linked_title),
                    "part": linked_part,
                })

    catalog_rows: list[dict[str, Any]] = []
    unlinked_rows: list[dict[str, Any]] = []
    relation_rows: list[dict[str, Any]] = []
    for ac_id in sorted(catalog_ids, key=lambda value: (int(value) if value.isdigit() else 0, value)):
        post = posts[ac_id]
        linked_entries = sorted(entries_by_id.get(ac_id, set()))
        catalog_rows.append({
            **post,
            "directory_status": "last_successful_page_snapshot",
            "is_referenced_in_baseline": "yes" if ac_id in referenced_ids else "no",
            "referenced_entry_ids": ";".join(linked_entries),
            "reference_count": sum(1 for row in refs_by_id.get(ac_id, []) if row.get("entry_id")),
            "candidate_relation_class": "",
        })
        if ac_id not in unlinked_ids:
            continue

        title = post["title"]
        title_date = post["title_date"]
        candidate_matches: list[dict[str, str]] = []
        if title_date:
            for entry in entries:
                entry_id = str(entry.get("id", ""))
                if not entry_id or entry.get("type") != "live" or str(entry.get("date", "")) != title_date:
                    continue
                anchors = anchors_by_entry.get(entry_id, [])
                normalized = post["normalized_series_title"]
                same_series = [a for a in anchors if normalized and a["series"] == normalized]
                has_part = bool(post["title_part_marker"])
                if same_series and has_part:
                    match_class = "strong_explicit_date_and_linked_series_part"
                    basis = "candidate title has a valid explicit calendar date equal to entry date; normalized full title matches an already-linked same-entry AcFun title with explicit P marker"
                    matched_anchors = same_series
                elif same_series:
                    match_class = "weak_explicit_date_and_linked_series_no_candidate_part"
                    basis = "candidate title date equals entry date and normalized title matches a linked AcFun series anchor, but candidate has no explicit part marker"
                    matched_anchors = same_series
                else:
                    terms = [str(entry.get("title", "") or "").strip()]
                    terms.extend(str(game).replace("-", " ") for game in entry.get("games") or [])
                    literal_terms = sorted({term for term in terms if len(term) > 1 and term.casefold() in title.casefold()})
                    if literal_terms:
                        match_class = "weak_explicit_date_and_entry_term"
                        basis = "candidate title date equals entry date and contains literal entry title/game term, but no exact linked-series anchor matched"
                        matched_anchors = []
                    else:
                        continue
                candidate_matches.append({
                    "entry_id": entry_id,
                    "entry_date": title_date,
                    "entry_title": str(entry.get("title", "") or ""),
                    "entry_games": ";".join(map(str, entry.get("games") or [])),
                    "candidate_ac_id": ac_id,
                    "candidate_title": title,
                    "candidate_title_date": title_date,
                    "candidate_title_part_marker": post["title_part_marker"],
                    "candidate_series_title": post["normalized_series_title"],
                    "candidate_upload_date": post["upload_date"],
                    "candidate_class": match_class,
                    "matching_linked_anchor_ac_ids": ";".join(sorted({a["ac_id"] for a in matched_anchors})),
                    "matching_linked_anchor_titles": " || ".join(sorted({a["title"] for a in matched_anchors})),
                    "matched_literal_terms": ";".join(literal_terms) if not same_series else "",
                    "candidate_directory_position": post["directory_page"] + ":" + post["directory_item_index"],
                    "catalog_public_url": post["catalog_public_url"],
                    "basis": basis,
                    "interpretation_limit": "catalog/title relation only; not proof of same session, playable content, missing footage, continuity, or completeness",
                })

        if candidate_matches:
            relation_rows.extend(candidate_matches)
        else:
            relation_rows.append({
                "entry_id": "",
                "entry_date": "",
                "entry_title": "",
                "entry_games": "",
                "candidate_ac_id": ac_id,
                "candidate_title": title,
                "candidate_title_date": title_date,
                "candidate_title_part_marker": post["title_part_marker"],
                "candidate_series_title": post["normalized_series_title"],
                "candidate_upload_date": post["upload_date"],
                "candidate_class": "unmapped_candidate",
                "matching_linked_anchor_ac_ids": "",
                "matching_linked_anchor_titles": "",
                "matched_literal_terms": "",
                "candidate_directory_position": post["directory_page"] + ":" + post["directory_item_index"],
                "catalog_public_url": post["catalog_public_url"],
                "basis": "no safe entry relation: title has no valid explicit year-date, or no exact-date linked-series/entry-term anchor; title date is blank when absent or invalid",
                "interpretation_limit": "unmapped directory post; do not infer date, target entry, or missing footage from upload date/order",
            })

    # Propagate each candidate's best class back into the complete catalog view.
    rank = {"strong_explicit_date_and_linked_series_part": 0,
            "weak_explicit_date_and_linked_series_no_candidate_part": 1,
            "weak_explicit_date_and_entry_term": 2,
            "unmapped_candidate": 3}
    best_class: dict[str, str] = {}
    for row in relation_rows:
        ac_id = str(row.get("candidate_ac_id", ""))
        klass = str(row.get("candidate_class", ""))
        if ac_id and (ac_id not in best_class or rank.get(klass, 9) < rank.get(best_class[ac_id], 9)):
            best_class[ac_id] = klass
    for row in catalog_rows:
        row["candidate_relation_class"] = best_class.get(str(row["ac_id"]), "")

    all_fields = ["ac_id", "title", "upload_date", "title_date", "title_part_marker", "normalized_series_title",
                  "directory_page", "directory_item_index", "page_observed_at", "duplicate_directory_occurrences",
                  "directory_status", "is_referenced_in_baseline", "referenced_entry_ids", "reference_count",
                  "candidate_relation_class", "catalog_public_url"]
    unlinked_fields = ["ac_id", "title", "upload_date", "title_date", "title_part_marker", "normalized_series_title",
                       "directory_page", "directory_item_index", "duplicate_directory_occurrences",
                       "candidate_relation_class", "catalog_public_url"]
    relation_fields = ["entry_id", "entry_date", "entry_title", "entry_games", "candidate_ac_id", "candidate_title",
                       "candidate_title_date", "candidate_title_part_marker", "candidate_series_title", "candidate_upload_date",
                       "candidate_class", "matching_linked_anchor_ac_ids", "matching_linked_anchor_titles", "matched_literal_terms",
                       "candidate_directory_position", "catalog_public_url", "basis", "interpretation_limit"]

    unlinked_rows = [row for row in catalog_rows if row["ac_id"] in unlinked_ids]
    sort_key = lambda row: (rank.get(row.get("candidate_class", ""), 9), row.get("entry_date", ""), row.get("entry_id", ""), row.get("candidate_ac_id", ""))
    relation_rows.sort(key=sort_key)
    write_csv(args.output_dir / "acfun-directory-catalog.csv", catalog_rows, all_fields)
    write_csv(args.output_dir / "acfun-directory-unlinked.csv", unlinked_rows, unlinked_fields)
    write_csv(args.output_dir / "acfun-unlinked-part-candidates.csv", relation_rows, relation_fields)

    # Assertions are part of the reproducible audit; failures abort after writing
    # only these derived CSVs and never touch baseline data.
    if len(posts) != len(catalog_ids):
        raise AssertionError("deduplicated AcFun post count mismatch")
    if len(unlinked_ids) != 336:
        raise AssertionError(f"expected 336 unlinked directory IDs, got {len(unlinked_ids)}")
    if len(linked_ids_missing_from_catalog) != 53:
        raise AssertionError(f"expected 53 referenced IDs absent from directory, got {len(linked_ids_missing_from_catalog)}")
    if len(referenced_ids & catalog_ids) != 2336:
        raise AssertionError(f"expected 2336 referenced IDs in directory, got {len(referenced_ids & catalog_ids)}")
    if sum(len(row.get("items", [])) for row in page_rows.values()) < len(posts):
        raise AssertionError("unique post count exceeds successful page item total")

    class_counts: dict[str, int] = defaultdict(int)
    for row in relation_rows:
        class_counts[row["candidate_class"]] += 1
    print(
        f"successful_pages={len(page_rows)} unique_directory_acids={len(posts)} "
        f"unique_referenced_acids={len(referenced_ids)} referenced_and_catalog={len(referenced_ids & catalog_ids)} "
        f"unlinked_catalog_acids={len(unlinked_ids)} referenced_not_in_directory={len(linked_ids_missing_from_catalog)} "
        f"candidate_relations={len(relation_rows)} parse_or_page_errors={len(errors)}"
    )
    for key in sorted(class_counts):
        print(f"{key}={class_counts[key]}")
    print(f"page_errors={len(errors)}; errors are not treated as missing posts")
    print(f"output_dir={args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
