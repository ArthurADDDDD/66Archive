#!/usr/bin/env python3
"""Build a mechanical, per-reference evidence inventory from an immutable baseline.

This script does not request network resources and does not infer game, session-date,
or completeness correctness from page titles or durations. Input paths are explicit
CLI arguments so this public repository does not encode local workspace locations.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import yaml


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as stream:
        return list(csv.DictReader(stream))


def read_entries(data_dir: Path) -> list[dict]:
    entries: list[dict] = []
    for path in sorted([*data_dir.glob("*.yaml"), *data_dir.glob("*.yml")]):
        payload = yaml.safe_load(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            entries.extend(row for row in payload if isinstance(row, dict))
        elif isinstance(payload, dict) and isinstance(payload.get("entries"), list):
            entries.extend(row for row in payload["entries"] if isinstance(row, dict))
    return entries


def platform_of(url: str) -> str:
    host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    if host.endswith("bilibili.com") or host.endswith("bilibili.tv") or host == "b23.tv":
        return "bilibili"
    if host.endswith("acfun.cn") or host.endswith("acfun.com"):
        return "acfun"
    return "other"


def key_from(row: dict[str, str], entry_field: str) -> tuple[str, int]:
    return str(row[entry_field]), int(row["source_index"])


def compact_pages(rows: list[dict[str, str]]) -> str:
    page_rows = []
    seen = set()
    for row in rows:
        item = {
            "declared_page": row.get("declared_page", ""),
            "declared_title": row.get("declared_title", ""),
            "declared_duration_sec": row.get("declared_duration_sec", ""),
            "page_part": row.get("page_part", ""),
            "page_duration_sec": row.get("page_duration_sec", ""),
            "page_check": row.get("page_check", ""),
        }
        marker = json.dumps(item, ensure_ascii=False, sort_keys=True)
        if marker not in seen:
            seen.add(marker)
            page_rows.append(item)
    return json.dumps(page_rows, ensure_ascii=False, separators=(",", ":"))


def load_observations(path: Path | None, refs: dict[tuple[str, int], dict]) -> dict[tuple[str, int], dict]:
    if path is None:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("observations"), list):
        raise ValueError("Observations JSON must contain an observations list")
    observations: dict[tuple[str, int], dict] = {}
    for item in payload["observations"]:
        if not isinstance(item, dict):
            raise ValueError("Observation row is not an object")
        key = (str(item.get("entry_id", "")), int(item.get("source_index", "")))
        if key in observations:
            raise ValueError(f"Duplicate observation reference key: {key}")
        if key not in refs:
            raise ValueError(f"Observation has no matching baseline reference: {key}")
        if item.get("source_url") != refs[key]["source_url"]:
            raise ValueError(f"Observation source_url mismatch for {key}")
        if item.get("human_watch") is not False:
            raise ValueError(f"Expected human_watch=false for machine audit observation {key}")
        evidence_refs = str(item.get("audit_evidence_refs", ""))
        for evidence_ref in (part.strip() for part in evidence_refs.split(";") if part.strip()):
            ref_path = Path(evidence_ref)
            if ref_path.is_absolute():
                raise ValueError(f"Evidence reference must be relative: {evidence_ref}")
            if not (path.parent / ref_path).is_file():
                raise ValueError(f"Evidence reference does not exist relative to observations JSON: {evidence_ref}")
        observations[key] = item
    return observations


def build(args: argparse.Namespace) -> tuple[list[dict[str, str]], Counter[str]]:
    entries = read_entries(args.data_dir)
    refs: dict[tuple[str, int], dict] = {}
    counts: Counter[str] = Counter()
    for entry in entries:
        entry_id = str(entry.get("id", ""))
        if not entry_id:
            raise ValueError("Baseline contains an entry without id")
        for index, source in enumerate(entry.get("sources") or []):
            url = str(source.get("url", ""))
            key = (entry_id, index)
            if not url:
                raise ValueError(f"Source URL is empty for {key}")
            if key in refs:
                raise ValueError(f"Duplicate baseline reference key: {key}")
            platform = platform_of(url)
            counts[platform] += 1
            refs[key] = {
                "entry_id": entry_id,
                "source_index": str(index),
                "archive_date": str(entry.get("date", "")),
                "archive_title": str(entry.get("title", "")),
                "archive_games": ";".join(entry.get("games") or []) if isinstance(entry.get("games") or [], list) else str(entry.get("games", "")),
                "archive_duration_min": str(entry.get("duration_min", "")),
                "source_url": url,
                "platform": platform,
                "source_kind": str(source.get("kind", "")),
                "source_status": str(source.get("status", "")),
                "declared_account": str(source.get("account", "")),
            }

    bili_rows = read_csv(args.bilibili_audit)
    bili_by_ref: dict[tuple[str, int], list[dict[str, str]]] = defaultdict(list)
    for row in bili_rows:
        key = key_from(row, "entry_id")
        if key not in refs or refs[key]["platform"] != "bilibili":
            raise ValueError(f"Bilibili audit has non-baseline reference {key}")
        if row.get("source_url") != refs[key]["source_url"]:
            raise ValueError(f"Bilibili audit URL mismatch for {key}")
        bili_by_ref[key].append(row)
    bili_expected = {key for key, ref in refs.items() if ref["platform"] == "bilibili"}
    if set(bili_by_ref) != bili_expected:
        raise ValueError(f"Bilibili join coverage mismatch: absent={len(bili_expected-set(bili_by_ref))} extra={len(set(bili_by_ref)-bili_expected)}")

    acfun_rows = read_csv(args.acfun_references)
    acfun_by_ref: dict[tuple[str, int], dict[str, str]] = {}
    for row in acfun_rows:
        key = key_from(row, "entry")
        if key in acfun_by_ref:
            raise ValueError(f"Duplicate AcFun reference key {key}")
        if key not in refs or refs[key]["platform"] != "acfun":
            raise ValueError(f"AcFun CSV has non-baseline reference {key}")
        if row.get("url") != refs[key]["source_url"]:
            raise ValueError(f"AcFun CSV URL mismatch for {key}")
        acfun_by_ref[key] = row
    acfun_expected = {key for key, ref in refs.items() if ref["platform"] == "acfun"}
    if set(acfun_by_ref) != acfun_expected:
        raise ValueError(f"AcFun join coverage mismatch: absent={len(acfun_expected-set(acfun_by_ref))} extra={len(set(acfun_by_ref)-acfun_expected)}")

    other_rows = read_csv(args.other_sources)
    other_by_ref: dict[tuple[str, int], dict[str, str]] = {}
    for row in other_rows:
        key = key_from(row, "entry_id")
        if key in other_by_ref:
            raise ValueError(f"Duplicate other-host reference key {key}")
        if key not in refs or refs[key]["platform"] != "other":
            raise ValueError(f"Other-host CSV has non-baseline reference {key}")
        if row.get("source_url") != refs[key]["source_url"]:
            raise ValueError(f"Other-host CSV URL mismatch for {key}")
        other_by_ref[key] = row
    other_expected = {key for key, ref in refs.items() if ref["platform"] == "other"}
    if set(other_by_ref) != other_expected:
        raise ValueError(f"Other-host join coverage mismatch: absent={len(other_expected-set(other_by_ref))} extra={len(set(other_by_ref)-other_expected)}")

    observations = load_observations(args.observations, refs)
    result = []
    for key in sorted(refs):
        base = refs[key]
        row = dict(base)
        row.update({
            "platform_metadata_status": "not_matched",
            "platform_metadata_title": "",
            "platform_metadata_owner_name": "",
            "platform_metadata_owner_uid": "",
            "platform_metadata_published_at_unix": "",
            "platform_metadata_duration_sec": "",
            "platform_metadata_page_count": "",
            "platform_metadata_page_checks_json": "",
            "expected_account_uid": "",
            "observed_uploader_uid": "",
            "account_identity_match_status": "not_provided_by_joined_metadata",
            "identity_evidence": "",
            "page_scope_or_review_flags": "",
            "platform_metadata_confidence": "not_assessed",
            "audit_observation_status": "not_observed",
            "audit_game_assessment": "not_individually_observed",
            "audit_date_assessment": "not_individually_observed",
            "audit_completeness_assessment": "not_individually_observed",
            "audit_risk_level": "not_individually_assessed",
            "audit_evidence_refs": "",
            "audit_verification_extent": "not_individually_observed",
            "audit_human_watch": "not_observed",
        })
        if base["platform"] == "bilibili":
            group = bili_by_ref[key]
            first = group[0]
            for field in ("id", "api_title", "api_owner", "api_owner_mid", "postdate", "api_page_count", "request_status", "expected_uid", "uid_attribution_status", "source_account"):
                values = {r.get(field, "") for r in group}
                if len(values) > 1:
                    raise ValueError(f"Inconsistent repeated Bilibili metadata field {field} for {key}: {values}")
            row.update({
                "platform_metadata_status": first.get("request_status", ""),
                "platform_metadata_title": first.get("api_title", ""),
                "platform_metadata_owner_name": first.get("api_owner", ""),
                "platform_metadata_owner_uid": first.get("api_owner_mid", ""),
                "platform_metadata_published_at_unix": first.get("postdate", ""),
                "platform_metadata_duration_sec": first.get("submission_duration_sec", ""),
                "platform_metadata_page_count": first.get("api_page_count", ""),
                "platform_metadata_page_checks_json": compact_pages(group),
                "expected_account_uid": first.get("expected_uid", ""),
                "observed_uploader_uid": first.get("api_owner_mid", ""),
                "account_identity_match_status": first.get("uid_attribution_status", ""),
                "identity_evidence": "Bilibili public submission owner.mid matched against registered expected UID when available.",
                "page_scope_or_review_flags": ";".join(sorted({x for r in group for x in (r.get("reference_scope", ""), r.get("review_flags", "")) if x})),
                "platform_metadata_confidence": "public_submission_metadata_observed_content_not_verified" if first.get("request_status") == "metadata_ok" else "metadata_not_confirmed",
            })
        elif base["platform"] == "acfun":
            source = acfun_by_ref[key]
            row.update({
                "platform_metadata_status": source.get("status", ""),
                "platform_metadata_title": source.get("metadata_title", ""),
                "platform_metadata_owner_name": "",
                "platform_metadata_owner_uid": source.get("observed_uid", ""),
                "platform_metadata_published_at_unix": "",
                "platform_metadata_duration_sec": "",
                "platform_metadata_page_count": "",
                "platform_metadata_page_checks_json": "",
                "expected_account_uid": source.get("expected_uid", ""),
                "observed_uploader_uid": source.get("observed_uid", ""),
                "account_identity_match_status": source.get("account_match", ""),
                "identity_evidence": source.get("identity_evidence", ""),
                "page_scope_or_review_flags": source.get("parse_error", ""),
                "platform_metadata_confidence": "public_page_metadata_observed_content_not_verified" if source.get("status") == "metadata_ok" else "metadata_not_confirmed",
            })
        else:
            source = other_by_ref[key]
            row.update({
                "platform_metadata_status": source.get("probe_status", ""),
                "platform_metadata_title": source.get("page_title") or source.get("og_title") or "",
                "platform_metadata_owner_name": "",
                "platform_metadata_owner_uid": "",
                "platform_metadata_published_at_unix": source.get("page_date", ""),
                "platform_metadata_duration_sec": source.get("duration_seconds", ""),
                "platform_metadata_page_count": "",
                "platform_metadata_page_checks_json": "",
                "expected_account_uid": "",
                "observed_uploader_uid": "",
                "account_identity_match_status": "not_exposed_in_cached_page_metadata",
                "identity_evidence": "",
                "page_scope_or_review_flags": ";".join(x for x in (source.get("playback_status", ""), source.get("error", "")) if x),
                "platform_metadata_confidence": "public_page_metadata_observed_content_not_verified" if source.get("probe_status") == "metadata_ok" else "metadata_not_confirmed_or_challenged",
            })

        # These independent dimensions deliberately do not inherit confidence from page metadata.
        row["game_attribution_evidence"] = "not_per_reference_playback_verified"
        row["mother_session_date_evidence"] = "upload_or_page_date_is_not_mother_session_date"
        row["completeness_evidence"] = "not_per_reference_content_or_end_checked"
        if row["account_identity_match_status"] == "uid_mismatch_confirmed":
            row["machine_review_suggestion"] = "metadata_only_identity_mismatch_candidate"
        elif row["platform_metadata_status"] != "metadata_ok":
            row["machine_review_suggestion"] = "metadata_status_unresolved_or_challenged"
        elif row["page_scope_or_review_flags"]:
            row["machine_review_suggestion"] = "metadata_only_review_existing_scope_or_probe_flags"
        else:
            row["machine_review_suggestion"] = "metadata_only_content_dimensions_still_unverified"
        row["review_provenance"] = "machine_join_only_not_human_watch"
        if key in observations:
            observation = observations[key]
            row.update({
                "audit_observation_status": "observed",
                "audit_game_assessment": str(observation.get("audit_game_assessment", "")),
                "audit_date_assessment": str(observation.get("audit_date_assessment", "")),
                "audit_completeness_assessment": str(observation.get("audit_completeness_assessment", "")),
                "audit_risk_level": str(observation.get("audit_risk_level", "")),
                "audit_evidence_refs": str(observation.get("audit_evidence_refs", "")),
                "audit_verification_extent": str(observation.get("audit_verification_extent", "")),
                "audit_human_watch": "false",
            })
        result.append(row)

    if len(result) != 6427:
        raise ValueError(f"Expected exactly 6427 source references; found {len(result)}")
    if len({(r["entry_id"], r["source_index"]) for r in result}) != len(result):
        raise ValueError("Output reference key is not unique")
    if counts != Counter({"bilibili": 3440, "acfun": 2390, "other": 597}):
        raise ValueError(f"Unexpected platform counts: {counts}")
    return result, counts


FIELDS = [
    "entry_id", "source_index", "archive_date", "archive_title", "archive_games", "archive_duration_min",
    "source_url", "platform", "source_kind", "source_status", "declared_account",
    "platform_metadata_status", "platform_metadata_title", "platform_metadata_owner_name",
    "platform_metadata_owner_uid", "platform_metadata_published_at_unix", "platform_metadata_duration_sec",
    "platform_metadata_page_count", "platform_metadata_page_checks_json", "expected_account_uid",
    "observed_uploader_uid", "account_identity_match_status", "identity_evidence", "page_scope_or_review_flags",
    "platform_metadata_confidence", "game_attribution_evidence", "mother_session_date_evidence",
    "completeness_evidence", "machine_review_suggestion", "review_provenance",
    "audit_observation_status", "audit_game_assessment", "audit_date_assessment",
    "audit_completeness_assessment", "audit_risk_level", "audit_evidence_refs",
    "audit_verification_extent", "audit_human_watch",
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True, type=Path, help="Read-only baseline data/entries directory")
    parser.add_argument("--bilibili-audit", required=True, type=Path, help="Cached per-reference Bilibili audit CSV")
    parser.add_argument("--acfun-references", required=True, type=Path, help="Cached source-level AcFun reference CSV")
    parser.add_argument("--other-sources", required=True, type=Path, help="Cached source-level other-host metadata CSV")
    parser.add_argument("--observations", type=Path, help="Optional JSON with exact source-reference observations")
    parser.add_argument("--output", required=True, type=Path, help="Output CSV path")
    args = parser.parse_args()
    rows, counts = build(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    uid_counts = Counter(r["account_identity_match_status"] for r in rows)
    acfun_observed = sum(bool(r["observed_uploader_uid"]) for r in rows if r["platform"] == "acfun")
    print(f"rows={len(rows)} unique_entry_source_keys={len({(r['entry_id'],r['source_index']) for r in rows})}")
    print("platform_counts=" + ",".join(f"{p}:{counts[p]}" for p in ("bilibili", "acfun", "other")))
    print(f"acfun_observed_uid_refs={acfun_observed}; acfun_identity_match_refs={sum(r['account_identity_match_status']=='match' for r in rows if r['platform']=='acfun')}")
    print("identity_status_counts=" + ",".join(f"{k}:{v}" for k, v in sorted(uid_counts.items())))
    observed = sum(r["audit_observation_status"] == "observed" for r in rows)
    print(f"audit_observations={observed}; unobserved={len(rows)-observed}")
    print("dimensions=game/date/completeness remain explicitly unverified unless separately reviewed")
    print(f"output_rows={len(rows)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError) as exc:
        print(f"inventory generation failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
