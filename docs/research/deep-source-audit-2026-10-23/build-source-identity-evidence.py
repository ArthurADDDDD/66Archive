#!/usr/bin/env python3
"""Join public uploader UID evidence to exact source references.

This is a read-only research join. It does not request pages, infer UID from
names, change the metadata inventory, or write formal archive data. The only
output is the caller-selected CSV.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
DEFAULT_LEDGER = HERE / "source-credibility-reviewed.csv"
DEFAULT_REUSE = HERE / "reused-owner-uid-evidence-2026-10-25.csv"
DEFAULT_OUTPUT = HERE / "source-identity-evidence-2026-10-25.csv"
BILI_RE = re.compile(r"(?i)(BV[0-9A-Za-z]{10}|av\d+)")
ACFUN_RE = re.compile(r"(?i)(?:https?://(?:www\.)?acfun\.cn)?/v/ac(\d+)(?:_\d+)?(?:[/?#]|$)")
REFRESH_FIELDS = {
    "platform", "id", "page_url", "uid", "name", "fetched_at",
    "status", "http_status", "field",
}


def parse_platform_post(platform: str, url: str) -> tuple[str, str] | None:
    platform = (platform or "").strip().lower()
    if platform in {"bilibili", "bili"}:
        match = BILI_RE.search(url or "")
        if not match:
            return None
        raw = match.group(1)
        post_id = "av" + str(int(raw[2:])) if raw.lower().startswith("av") else "BV" + raw[2:]
        return "bilibili", post_id
    if platform in {"acfun", "ac"}:
        match = ACFUN_RE.search(url or "")
        return ("acfun", str(int(match.group(1)))) if match else None
    host = re.search(r"https?://([^/]+)", url or "", re.I)
    hostname = host.group(1).lower() if host else ""
    if "bilibili.com" in hostname or hostname == "b23.tv":
        return parse_platform_post("bilibili", url)
    if "acfun.cn" in hostname:
        return parse_platform_post("acfun", url)
    return None


def uid_value(raw: Any) -> str:
    value = str(raw or "").strip()
    return value if value.isdigit() else ""


def read_ledger(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"entry_id", "source_index", "source_url", "platform",
                    "platform_metadata_owner_uid", "expected_account_uid"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("reviewed ledger lacks required exact-key/UID columns")
        return list(reader.fieldnames), list(reader)


def load_reuse(path: Path | None, ledger: list[dict[str, str]]) -> dict[tuple[str, str], dict[str, Any]]:
    if path is None:
        return {}
    by_ref = {(r["entry_id"], r["source_index"]): r for r in ledger}
    result: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {"uids": set(), "refs": [], "provenance": [], "rows": 0})
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"platform", "post_id", "uid", "evidence_file", "evidence_json_pointer"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("reuse CSV lacks expected exact-post UID evidence columns")
        for line, row in enumerate(reader, 2):
            platform_post = parse_platform_post(row["platform"], row.get("evidence_source_url") or row.get("baseline_source_url") or "")
            if platform_post is None:
                raise ValueError(f"reuse CSV line {line} has no parseable evidence URL")
            platform, post_id = platform_post
            if (platform, post_id) != (row["platform"].strip().lower(), row["post_id"].strip()):
                # AcFun and Bilibili platform labels in this CSV are canonical.
                raise ValueError(f"reuse CSV line {line} URL and post_id disagree")
            uid = uid_value(row.get("uid"))
            if not uid:
                raise ValueError(f"reuse CSV line {line} has no numeric UID")
            ref_key = (row.get("entry_id", ""), row.get("source_index", ""))
            if ref_key not in by_ref:
                raise ValueError(f"reuse CSV line {line} does not match a baseline reference key")
            ref_row = by_ref[ref_key]
            baseline_post = parse_platform_post(ref_row.get("platform", ""), ref_row.get("source_url", ""))
            if baseline_post != (platform, post_id):
                raise ValueError(f"reuse CSV line {line} exact reference key points to a different post")
            key = (platform, post_id)
            item = result[key]
            item["uids"].add(uid)
            item["rows"] += 1
            item["refs"].append(f"{row['evidence_file']}#{row['evidence_json_pointer']}")
            item["provenance"].append(f"reuse_csv_line_{line}:{row.get('match_basis','exact_post_id')}")
    return result


def load_refresh(path: Path | None) -> dict[tuple[str, str], dict[str, Any]]:
    if path is None:
        return {}
    result: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {"uids": set(), "refs": [], "provenance": [], "statuses": [],
                 "latest_status": "", "rows": 0})
    with path.open(encoding="utf-8") as handle:
        for line, text in enumerate(handle, 1):
            if not text.strip():
                continue
            record = json.loads(text)
            if not isinstance(record, dict) or set(record) != REFRESH_FIELDS:
                raise ValueError(f"refresh JSONL line {line} violates the documented record schema")
            platform = record["platform"]
            post_id = str(record["id"])
            if platform not in {"bilibili", "acfun"} or not post_id:
                raise ValueError(f"refresh JSONL line {line} has an invalid post key")
            parsed = parse_platform_post(platform, record.get("page_url", ""))
            if parsed != (platform, post_id):
                raise ValueError(f"refresh JSONL line {line} page_url and platform/id disagree")
            item = result[(platform, post_id)]
            item["rows"] += 1
            item["statuses"].append(str(record.get("status", "")))
            item["latest_status"] = str(record.get("status", ""))
            uid = uid_value(record.get("uid"))
            if uid:
                item["uids"].add(uid)
                item["refs"].append(f"refresh_jsonl_line_{line}:{record.get('field','uid')}")
            item["provenance"].append(
                f"refresh_jsonl_line_{line}:{record.get('status','')}:{record.get('field','')}")
    return result


def joined_row(row: dict[str, str], reuse: dict[tuple[str, str], dict[str, Any]],
               refresh: dict[tuple[str, str], dict[str, Any]]) -> dict[str, str]:
    platform_post = parse_platform_post(row.get("platform", ""), row.get("source_url", ""))
    baseline_uid = uid_value(row.get("platform_metadata_owner_uid"))
    expected = uid_value(row.get("expected_account_uid"))
    if not platform_post:
        platform, post_id = row.get("platform", ""), ""
        identity_status = "unsupported_platform_or_unparseable_post"
        new_uids: set[str] = set()
        evidence, provenance = [], []
        refresh_status = ""
    else:
        platform, post_id = platform_post
        key = (platform, post_id)
        reused = reuse.get(key, {})
        refreshed = refresh.get(key, {})
        new_uids = set(reused.get("uids", set())) | set(refreshed.get("uids", set()))
        all_uids = set(new_uids)
        if baseline_uid:
            all_uids.add(baseline_uid)
        evidence = list(reused.get("refs", [])) + list(refreshed.get("refs", []))
        provenance = list(reused.get("provenance", [])) + list(refreshed.get("provenance", []))
        statuses = refreshed.get("statuses", [])
        latest_status = refreshed.get("latest_status", "")
        refresh_status = ";".join(dict.fromkeys(statuses))
        if len(all_uids) > 1:
            identity_status = "uid_conflict_manual_resolution_required"
        elif baseline_uid and new_uids:
            if "reused_uid" in statuses:
                identity_status = "baseline_and_reused_uid_agree"
            else:
                identity_status = "baseline_and_refresh_uid_agree"
        elif baseline_uid:
            identity_status = "baseline_uid_present"
        elif new_uids:
            if reused.get("uids") and refreshed.get("uids"):
                identity_status = "reused_and_refresh_uid_agree"
            elif reused.get("uids"):
                identity_status = "reused_exact_post_uid"
            else:
                identity_status = "refreshed_exact_post_uid"
        elif statuses:
            if latest_status == "metadata_ok_uid_absent":
                identity_status = "refresh_metadata_has_no_uid"
            elif latest_status in {"error", "challenge", "attempted"}:
                identity_status = "refresh_no_numeric_uid_result"
            elif latest_status == "unavailable":
                # The submission page/API is not publicly shown now; this says
                # nothing about whether the footage exists elsewhere.
                identity_status = "refresh_post_not_publicly_shown"
            else:
                identity_status = "refresh_metadata_has_no_uid"
        else:
            identity_status = "no_numeric_uid_evidence"
    all_uids = set(new_uids)
    if baseline_uid:
        all_uids.add(baseline_uid)
    effective_uid = next(iter(all_uids)) if len(all_uids) == 1 else ""
    new_uid = ";".join(sorted(new_uids, key=lambda value: (len(value), value)))
    if len(all_uids) > 1:
        match = "conflict"
    elif not effective_uid:
        match = "no_uid_evidence"
    elif not expected:
        match = "no_expected_account_uid"
    else:
        match = "match" if effective_uid == expected else "mismatch"
    if baseline_uid:
        evidence = ["source-credibility-reviewed.csv#platform_metadata_owner_uid", *evidence]
        provenance = ["baseline_public_metadata_uid", *provenance]
    return {
        "entry_id": row["entry_id"], "source_index": row["source_index"],
        "source_url": row["source_url"], "platform": platform, "post_id": post_id,
        "baseline_uid": baseline_uid, "new_uid": new_uid,
        "effective_uid": effective_uid, "identity_status": identity_status,
        "expected_account_uid": expected, "uid_match_status": match,
        "refresh_statuses": refresh_status,
        "evidence_refs": "; ".join(dict.fromkeys(evidence)),
        "provenance": "; ".join(dict.fromkeys(provenance)),
        "human_watch": "false",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    parser.add_argument("--reuse-csv", type=Path, default=DEFAULT_REUSE)
    parser.add_argument("--refresh-jsonl", type=Path, required=True,
                        help="separate allowlisted identity refresh journal")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    _, ledger = read_ledger(args.ledger.resolve(strict=True))
    reuse_path = args.reuse_csv.resolve(strict=True) if args.reuse_csv else None
    reuse = load_reuse(reuse_path, ledger)
    refresh = load_refresh(args.refresh_jsonl.resolve(strict=True))
    fields = ["entry_id", "source_index", "source_url", "platform", "post_id",
              "baseline_uid", "new_uid", "effective_uid", "identity_status",
              "expected_account_uid", "uid_match_status", "refresh_statuses",
              "evidence_refs", "provenance", "human_watch"]
    output = args.output
    if not output.parent.exists():
        raise ValueError("output directory does not exist")
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for row in ledger:
            writer.writerow(joined_row(row, reuse, refresh))
    print(f"rows={len(ledger)} reuse_post_ids={len(reuse)} refresh_post_ids={len(refresh)} output_written=true human_watch=false")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise SystemExit(f"identity join failed: {exc}")
