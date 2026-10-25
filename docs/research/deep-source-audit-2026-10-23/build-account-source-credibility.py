#!/usr/bin/env python3
"""Read-only verifier for source-reference and uploader-UID audit coverage.

Requires PyYAML. It does not change archive data or the supplied audit tables.
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

import yaml


def platform_of(url: str) -> str:
    host = (urlparse(url or "").hostname or "").lower()
    if "bilibili.com" in host:
        return "bilibili"
    if "acfun.cn" in host:
        return "acfun"
    if "douyu.com" in host:
        return "douyu"
    if "youku" in host:
        return "youku"
    if "douyin.com" in host:
        return "douyin"
    if "sohu.com" in host:
        return "sohu"
    if host == "t.cn":
        return "shortlink"
    return host or "unknown"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def entries_from(data_dir: Path) -> list[dict]:
    entries: list[dict] = []
    for path in sorted((data_dir / "entries").glob("*.yaml")):
        payload = yaml.safe_load(path.read_text(encoding="utf-8")) or []
        if isinstance(payload, list):
            entries.extend(payload)
        elif isinstance(payload, dict) and isinstance(payload.get("entries"), list):
            entries.extend(payload["entries"])
        else:
            raise ValueError(f"Unexpected entry YAML shape in {path.name}")
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True, help="Baseline data directory containing entries/ and accounts.yaml")
    parser.add_argument("--acfun-references", type=Path, help="Existing source-level AcFun reference CSV")
    parser.add_argument("--bilibili-audit", type=Path, help="Cached Bilibili per-reference/page audit CSV; repeated page rows are collapsed by entry and source index")
    args = parser.parse_args()

    entries = entries_from(args.data_dir)
    by_entry: dict[str, dict] = {}
    refs: dict[tuple[str, int], dict] = {}
    counts: Counter[str] = Counter()
    duplicates: list[tuple[str, int]] = []
    for entry in entries:
        entry_id = str(entry.get("id", ""))
        if not entry_id or entry_id in by_entry:
            raise ValueError(f"Missing or duplicate entry id: {entry_id!r}")
        by_entry[entry_id] = entry
        for index, source in enumerate(entry.get("sources") or []):
            key = (entry_id, index)
            if key in refs:
                duplicates.append(key)
            refs[key] = source
            counts[platform_of(source.get("url", ""))] += 1
    if duplicates:
        raise ValueError(f"Duplicate source references: {duplicates[:10]}")

    print(f"entries={len(entries)} source_refs={len(refs)} duplicate_refs={len(duplicates)}")
    print("platform_counts=" + ",".join(f"{key}:{counts[key]}" for key in sorted(counts)))

    if args.acfun_references:
        rows = read_csv(args.acfun_references)
        account_file = args.data_dir / "accounts.yaml"
        account_payload = yaml.safe_load(account_file.read_text(encoding="utf-8")) or []
        acfun_uid_by_account: dict[str, str] = {}
        for account in account_payload:
            if account.get("platform") == "acfun":
                uid = urlparse(account.get("url", "")).path.rstrip("/").split("/")[-1]
                if uid.isdigit():
                    acfun_uid_by_account[account["id"]] = uid
        seen: set[tuple[str, int]] = set()
        uid_by_ref: dict[tuple[str, int], str] = {}
        match_counts: Counter[str] = Counter()
        matched_uid_refs = 0
        for row in rows:
            key = (row["entry"], int(row["source_index"]))
            if key in seen:
                raise ValueError(f"Duplicate AcFun reference row: {key}")
            seen.add(key)
            source = refs.get(key)
            if not source or source.get("url") != row.get("url") or platform_of(row.get("url", "")) != "acfun":
                raise ValueError(f"AcFun CSV does not match baseline source: {key}")
            uid_by_ref[key] = row.get("observed_uid", "")
            match_counts[row.get("account_match", "")] += 1
            expected_uid = acfun_uid_by_account.get(row.get("account", ""), "")
            observed_uid = row.get("observed_uid", "")
            if row.get("account_match") == "match":
                if not observed_uid or observed_uid != expected_uid or observed_uid != row.get("expected_uid", ""):
                    raise ValueError(f"AcFun UID mismatch in row: {key}")
                matched_uid_refs += 1
            elif observed_uid and expected_uid and observed_uid == expected_uid:
                raise ValueError(f"AcFun reference has matching UID but is marked unverified: {key}")
        expected = {key for key, source in refs.items() if platform_of(source.get("url", "")) == "acfun"}
        if seen != expected:
            raise ValueError(f"AcFun reference coverage mismatch: missing={len(expected-seen)} extra={len(seen-expected)}")
        observed = sum(bool(uid) for uid in uid_by_ref.values())
        unique_uids = len({uid for uid in uid_by_ref.values() if uid})
        print(f"acfun_refs={len(rows)} observed_uid_refs={observed} uid_unverified_refs={len(rows)-observed} unique_observed_uids={unique_uids} uid_verified_match_refs={matched_uid_refs} account_match={dict(match_counts)}")
        by_uid: Counter[str] = Counter(uid for uid in uid_by_ref.values() if uid)
        print("acfun_uid_refs=" + ",".join(f"{uid}:{by_uid[uid]}" for uid in sorted(by_uid)))

    if args.bilibili_audit:
        rows = read_csv(args.bilibili_audit)
        by_ref: dict[tuple[str, int], dict[str, str]] = {}
        for row in rows:
            key = (row["entry_id"], int(row["source_index"]))
            source = refs.get(key)
            if not source or platform_of(source.get("url", "")) != "bilibili":
                raise ValueError(f"Bilibili audit has non-baseline reference: {key}")
            if row.get("source_url") and row["source_url"] != source.get("url"):
                raise ValueError(f"Bilibili audit URL mismatch: {key}")
            by_ref.setdefault(key, row)
        expected = {key for key, source in refs.items() if platform_of(source.get("url", "")) == "bilibili"}
        if set(by_ref) != expected:
            raise ValueError(f"Bilibili reference coverage mismatch: missing={len(expected-set(by_ref))} extra={len(set(by_ref)-expected)}")
        observed = Counter((r.get("api_owner_mid") or "").strip() for r in by_ref.values())
        uid_refs = sum(n for uid, n in observed.items() if uid)
        print(f"bilibili_refs={len(by_ref)} observed_uid_refs={uid_refs} uid_unverified_refs={len(by_ref)-uid_refs} unique_observed_uids={len([u for u in observed if u])}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError) as exc:
        print(f"audit verification failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
