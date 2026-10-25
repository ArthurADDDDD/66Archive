#!/usr/bin/env python3
"""Create per-reference page metadata and conservative review leads."""
import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

import yaml


def entries(root):
    out = []
    for p in sorted([*root.glob("*.yaml"), *root.glob("*.yml")]):
        value = yaml.safe_load(p.read_text(encoding="utf-8"))
        if isinstance(value, list): out.extend(x for x in value if isinstance(x, dict))
        elif isinstance(value, dict) and isinstance(value.get("entries"), list): out.extend(x for x in value["entries"] if isinstance(x, dict))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", required=True, type=Path)
    ap.add_argument("--games-file", required=True, type=Path)
    ap.add_argument("--accounts-file", required=True, type=Path)
    ap.add_argument("--cache-dir", required=True, type=Path)
    a = ap.parse_args()
    metas = {}
    path = a.cache_dir / "metadata.jsonl"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            try:
                x = json.loads(line); metas[x["id"]] = x
            except Exception: pass
    state = json.loads((a.cache_dir / "reference-checkpoint.json").read_text(encoding="utf-8"))
    games = yaml.safe_load(a.games_file.read_text(encoding="utf-8")) or []
    accounts = yaml.safe_load(a.accounts_file.read_text(encoding="utf-8")) or []
    account_map = {}
    for acc in accounts:
        if acc.get("platform") != "bilibili": continue
        url = str(acc.get("url", ""))
        m = re.search(r"space\.bilibili\.com/(\d+)", url) or re.search(r"[?&]uid=(\d+)", url)
        account_map[acc.get("id", "")] = {"name": acc.get("name", ""), "uid": m.group(1) if m else "", "role": acc.get("role", "")}
    account_ids_by_uid = defaultdict(list)
    for account_id, account in account_map.items():
        if account.get("uid"):
            account_ids_by_uid[account["uid"]].append(account_id)
    alias_rows = []
    for g in games:
        for name in [g.get("name", ""), *g.get("aliases", [])]:
            if isinstance(name, str) and len(name.strip()) >= 2:
                alias_rows.append((name.strip().casefold(), g.get("id", "")))
    entry_by_id = {e.get("id"): e for e in entries(a.data_root)}
    rows = []
    grouped = defaultdict(list)
    for ref in state["refs"]:
        meta = metas.get(ref["id"], {})
        details = ref.get("part_details") or []
        if not isinstance(details, list): details = []
        detail_rows = details if details else [None]
        for detail in detail_rows:
            declared_page = detail.get("page") if isinstance(detail, dict) else None
            pnum = declared_page if isinstance(declared_page, int) else ref.get("p") if isinstance(ref.get("p"), int) else 1
            page = next((p for p in meta.get("pages", []) if p.get("page") == pnum), None)
            scope = "declared_part_details" if isinstance(declared_page, int) else "explicit_url_p" if isinstance(ref.get("p"), int) else "submission_without_p"
            expected_account = account_map.get(ref.get("source_account", ""), {})
            expected_uid = str(expected_account.get("uid", ""))
            api_owner_mid = str(meta.get("owner_mid", ""))
            matching_account_ids = account_ids_by_uid.get(api_owner_mid, []) if api_owner_mid else []
            proposed_account_id = matching_account_ids[0] if len(matching_account_ids) == 1 else ""
            if ref["status"] != "metadata_ok" or not api_owner_mid:
                proposed_account_status = "uid_not_retained_or_metadata_unavailable"
            elif len(matching_account_ids) == 1:
                proposed_account_status = "matched_registered_uid"
            elif len(matching_account_ids) > 1:
                proposed_account_status = "ambiguous_registered_uid_mapping"
            else:
                proposed_account_status = "needs_new_account_review"
            if not ref.get("source_account"):
                uid_status = "source_account_unset"
            elif not expected_account:
                uid_status = "account_id_unmapped"
            elif not expected_uid:
                uid_status = "expected_uid_unavailable_name_only"
            elif ref["status"] != "metadata_ok":
                uid_status = "metadata_unavailable"
            elif not api_owner_mid:
                uid_status = "uid_not_retained_name_only"
            elif api_owner_mid != expected_uid:
                uid_status = "uid_mismatch_confirmed"
            elif expected_account.get("name") and meta.get("owner") and expected_account["name"] != meta["owner"]:
                uid_status = "uid_match_name_diff_candidate"
            else:
                uid_status = "uid_match"
            row = {
                "entry_id": ref["entry_id"], "date": ref.get("date", ""), "entry_title": ref.get("entry_title", ""),
                "games": ";".join(ref.get("games", [])) if isinstance(ref.get("games"), list) else ref.get("games", ""),
                "duration_min": ref.get("duration_min", ""), "source_index": ref.get("source_index", ""),
                "source_kind": ref.get("source_kind", ""), "source_status": ref.get("source_status", ""),
                "source_account": ref.get("source_account", ""), "expected_account_name": expected_account.get("name", ""),
                "expected_role": expected_account.get("role", ""), "expected_uid": expected_uid, "api_owner_mid": api_owner_mid, "uid_attribution_status": uid_status,
                "proposed_account_id": proposed_account_id, "proposed_account_status": proposed_account_status,
                "source_url": ref.get("source_url", ""), "id": ref["id"],
                "url_p": ref.get("p", ""), "declared_page": declared_page if declared_page is not None else "",
                "declared_title": detail.get("title", "") if isinstance(detail, dict) else "",
                "declared_duration_sec": detail.get("duration_sec", "") if isinstance(detail, dict) else "",
                "request_status": ref["status"], "page_check": ref.get("page_check", ""), "reference_scope": scope,
                "api_title": meta.get("title", ""), "api_owner": meta.get("owner", ""), "postdate": meta.get("postdate", ""),
                "api_page_count": len(meta.get("pages", [])), "page_cid": page.get("cid", "") if page else "",
                "page_part": page.get("part", "") if page else "", "page_duration_sec": page.get("duration", "") if page else "",
                "submission_duration_sec": meta.get("duration", ""), "review_flags": "",
            }
            flags = []
            if ref["status"] in ("blocked", "error"):
                flags.append(ref["status"])
            if ref.get("p") and ref.get("page_check") == "out_of_range": flags.append("p_out_of_range")
            if scope == "declared_part_details" and not page:
                flags.append("declared_part_page_missing_from_api")
            if scope == "declared_part_details" and isinstance(ref.get("p"), int) and details and ref.get("p") != details[0].get("page"):
                flags.append("url_p_differs_from_first_declared_part_candidate")
            if page:
                title_text = str(meta.get("title", "")).casefold()
                part_text = str(page.get("part", "")).casefold()
                date_text = part_text or title_text
                date_matches = re.findall(r"(20\d{2})[-./年](\d{1,2})[-./月](\d{1,2})日?", date_text)
                api_dates = {f"{int(y):04d}-{int(m):02d}-{int(d):02d}" for y, m, d in date_matches}
                expected = str(ref.get("date", ""))
                if expected and any(d != expected for d in api_dates): flags.append("title_date_conflict_candidate")
                page_games = sorted({gid for alias, gid in alias_rows if alias and alias in part_text})
                title_games = sorted({gid for alias, gid in alias_rows if alias and alias in title_text})
                if page_games and title_games and set(page_games).isdisjoint(title_games): flags.append("submission_title_vs_part_game_conflict_candidate")
                found_games = page_games or title_games
                entry_games = set(ref.get("games", [])) if isinstance(ref.get("games"), list) else set()
                conflicts = [gid for gid in found_games if gid and gid not in entry_games]
                if conflicts: flags.append("textual_game_conflict_candidate:" + ";".join(conflicts))
                if isinstance(detail, dict):
                    declared_text = str(detail.get("title", ""))
                    api_part_text = str(page.get("part", ""))
                    def temporal_key(value):
                        full_date = re.search(r"(20\d{2})[-./年](\d{1,2})[-./月](\d{1,2})日?", value)
                        short_date = None if full_date else re.search(r"(\d{1,2})月(\d{1,2})日?", value)
                        if full_date:
                            date_key = tuple(map(int, full_date.groups()))
                            rest = value[:full_date.start()] + " " + value[full_date.end():]
                        elif short_date:
                            date_key = (None, *map(int, short_date.groups()))
                            rest = value[:short_date.start()] + " " + value[short_date.end():]
                        else:
                            date_key, rest = None, value
                        tm = re.search(r"(?<!\d)(\d{1,2})[:_点](\d{2})", rest)
                        time_key = tuple(map(int, tm.groups())) if tm else None
                        return date_key, time_key
                    declared_key, api_key = temporal_key(declared_text), temporal_key(api_part_text)
                    date_diff = declared_key[0] and api_key[0] and all(x is not None for x in declared_key[0]) and all(x is not None for x in api_key[0]) and declared_key[0] != api_key[0]
                    time_diff = declared_key[1] and api_key[1] and declared_key[1] != api_key[1]
                    if date_diff or time_diff:
                        flags.append("declared_part_time_differs_from_api_candidate")
                    try:
                        if abs(int(detail.get("duration_sec")) - int(page.get("duration", 0))) > 2:
                            flags.append("declared_part_duration_differs_from_api_candidate")
                    except (TypeError, ValueError): pass
                try:
                    entry_sec = int(ref["duration_min"]) * 60
                    page_sec = int(page.get("duration", 0))
                    if scope == "declared_part_details" and len(details) > 1:
                        total_sec = sum(int(d.get("duration_sec", 0)) for d in details if isinstance(d, dict))
                        if detail is details[0] and abs(entry_sec - total_sec) >= 900:
                            flags.append("entry_vs_declared_source_parts_duration_delta")
                    elif scope in ("explicit_url_p", "declared_part_details") and abs(entry_sec - page_sec) >= 900:
                        flags.append("entry_vs_selected_page_duration_delta")
                    elif scope == "submission_without_p" and len(meta.get("pages", [])) == 1 and abs(entry_sec - page_sec) >= 900:
                        flags.append("entry_vs_single_page_duration_delta")
                except (TypeError, ValueError): pass
            row["review_flags"] = ";".join(flags)
            rows.append(row)
        mapped_pages = [d.get("page") for d in (ref.get("part_details") or []) if isinstance(d, dict) and isinstance(d.get("page"), int)] or ([ref.get("p")] if isinstance(ref.get("p"), int) else [])
        if mapped_pages:
            grouped[(ref["entry_id"], ref["id"])].extend({"page": p} for p in mapped_pages)
    # Only flag page order/gaps when multiple explicit page references exist for the same entry and submission.
    for (eid, sid), refs in grouped.items():
        vals = [r.get("page") for r in refs if isinstance(r.get("page"), int)]
        if len(vals) > 1:
            if vals != sorted(vals):
                for r in rows:
                    if r["entry_id"] == eid and r["id"] == sid: r["review_flags"] += ";referenced_page_order_candidate"
            if sorted(vals) != list(range(min(vals), max(vals) + 1)):
                for r in rows:
                    if r["entry_id"] == eid and r["id"] == sid: r["review_flags"] += ";referenced_page_gap_candidate"
    out = a.cache_dir / "per-reference-page-audit.csv"
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        fields = list(rows[0]) if rows else []
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
    candidates = [r for r in rows if r["uid_attribution_status"] in ("uid_mismatch_confirmed", "uid_match_name_diff_candidate", "uid_not_retained_name_only", "expected_uid_unavailable_name_only", "account_id_unmapped")]
    cout = a.cache_dir / "account-attribution-candidates.csv"
    with cout.open("w", encoding="utf-8-sig", newline="") as f:
        fields = ["entry_id", "date", "source_index", "source_account", "expected_account_name", "expected_role", "expected_uid", "api_owner", "api_owner_mid", "uid_attribution_status", "proposed_account_id", "proposed_account_status", "request_status", "source_url", "id"]
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore"); w.writeheader(); w.writerows(candidates)
    shared = defaultdict(list)
    for ref in state["refs"]:
        details = ref.get("part_details") or []
        if ref.get("p") is None and not details:
            shared[ref["id"]].append(ref)
    shared_candidates = []
    for sid, refs_for_id in shared.items():
        distinct_entries = {r["entry_id"] for r in refs_for_id}
        if len(distinct_entries) < 2:
            continue
        dates = {str(r.get("date", "")) for r in refs_for_id if r.get("date")}
        game_sets = {tuple(sorted(r.get("games", []))) for r in refs_for_id}
        meta = metas.get(sid, {})
        parts = meta.get("pages", [])
        for ref in refs_for_id:
            shared_candidates.append({
                "id": sid, "entry_id": ref["entry_id"], "date": ref.get("date", ""),
                "entry_title": ref.get("entry_title", ""), "games": ";".join(ref.get("games", [])),
                "duration_min": ref.get("duration_min", ""), "source_index": ref.get("source_index", ""),
                "source_kind": ref.get("source_kind", ""), "source_status": ref.get("source_status", ""),
                "source_account": ref.get("source_account", ""), "source_url": ref.get("source_url", ""),
                "scope": "unscoped_no_p_no_part_details", "request_status": ref.get("status", ""),
                "shared_entry_count": len(distinct_entries), "date_varies_across_entries": len(dates) > 1,
                "games_vary_across_entries": len(game_sets) > 1, "api_page_count": len(parts),
                "api_parts": " | ".join(f"P{p.get('page')} {p.get('duration')}s {p.get('part')}" for p in parts),
                "entry_note": entry_by_id.get(ref["entry_id"], {}).get("note", "") or "",
            })
    shared_path = a.cache_dir / "cross-entry-unscoped-submission-candidates.csv"
    with shared_path.open("w", encoding="utf-8-sig", newline="") as f:
        fields = list(shared_candidates[0]) if shared_candidates else ["id", "entry_id", "date", "entry_title", "games", "duration_min", "source_index", "source_kind", "source_status", "source_account", "source_url", "scope", "request_status", "shared_entry_count", "date_varies_across_entries", "games_vary_across_entries", "api_page_count", "api_parts", "entry_note"]
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(shared_candidates)
    short_replays = []
    for ref in state["refs"]:
        if ref.get("source_kind") != "replay" or ref.get("status") != "metadata_ok":
            continue
        meta = metas.get(ref["id"], {})
        pages = meta.get("pages", [])
        if len(pages) != 1:
            continue
        try:
            entry_sec = int(ref.get("duration_min") or 0) * 60
            submission_sec = int(meta.get("duration") or 0)
        except (TypeError, ValueError):
            continue
        if submission_sec <= 0 or submission_sec > 900 or entry_sec <= 2 * submission_sec:
            continue
        short_replays.append({
            "entry_id": ref["entry_id"], "date": ref.get("date", ""), "entry_title": ref.get("entry_title", ""),
            "games": ";".join(ref.get("games", [])), "entry_duration_min": ref.get("duration_min", ""),
            "source_index": ref.get("source_index", ""), "source_kind": ref.get("source_kind", ""),
            "source_status": ref.get("source_status", ""), "source_account": ref.get("source_account", ""),
            "source_url": ref.get("source_url", ""), "id": ref["id"], "api_title": meta.get("title", ""),
            "api_owner": meta.get("owner", ""), "api_duration_sec": submission_sec,
            "entry_vs_source_ratio": round(entry_sec / submission_sec, 2), "api_page_count": len(pages),
            "entry_note": entry_by_id.get(ref["entry_id"], {}).get("note", "") or "",
            "interpretation": "review_candidate_only_other_sources_may_cover_session",
        })
    short_path = a.cache_dir / "single-page-short-replay-candidates.csv"
    with short_path.open("w", encoding="utf-8-sig", newline="") as f:
        fields = list(short_replays[0]) if short_replays else ["entry_id", "date", "entry_title", "games", "entry_duration_min", "source_index", "source_kind", "source_status", "source_account", "source_url", "id", "api_title", "api_owner", "api_duration_sec", "entry_vs_source_ratio", "api_page_count", "entry_note", "interpretation"]
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(short_replays)
    timeline_path = a.data_root.parent / "game-timelines.yaml"
    timeline_checks = []
    if timeline_path.exists():
        timelines = yaml.safe_load(timeline_path.read_text(encoding="utf-8")) or []
        for timeline in timelines if isinstance(timelines, list) else []:
            match = re.search(r"BV[0-9A-Za-z]{10}", str(timeline.get("basis", "")))
            sid = match.group(0) if match else ""
            meta = metas.get(sid, {})
            for snap in timeline.get("parts", []) or []:
                pnum = snap.get("page")
                page = next((p for p in meta.get("pages", []) if p.get("page") == pnum), None)
                findings = []
                if sid and not meta: findings.append("resume_pending_or_unavailable")
                elif not sid: findings.append("non_bilibili_basis")
                elif not page: findings.append("snapshot_page_missing")
                else:
                    if str(snap.get("id")) != str(page.get("cid")): findings.append("cid_changed")
                    try:
                        if abs(int(snap.get("duration_sec")) - int(page.get("duration", 0))) > 2:
                            findings.append("duration_changed_over_2s")
                    except (TypeError, ValueError): pass
                timeline_checks.append({
                    "entry": timeline.get("entry", ""), "basis_id": sid, "page": pnum,
                    "snapshot_cid": snap.get("id", ""), "api_cid": page.get("cid", "") if page else "",
                    "snapshot_duration_sec": snap.get("duration_sec", ""), "api_duration_sec": page.get("duration", "") if page else "",
                    "metadata_status": "metadata_ok" if sid in metas else "resume_pending",
                    "review_flags": ";".join(findings),
                })
    tout = a.cache_dir / "timeline-snapshot-check.csv"
    with tout.open("w", encoding="utf-8-sig", newline="") as f:
        fields = ["entry", "basis_id", "page", "snapshot_cid", "api_cid", "snapshot_duration_sec", "api_duration_sec", "metadata_status", "review_flags"]
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(timeline_checks)
    print(json.dumps({"references": len(rows), "metadata_ok": sum(r["request_status"] == "metadata_ok" for r in rows), "flagged": sum(bool(r["review_flags"]) for r in rows), "uid_status_counts": {s: sum(r["uid_attribution_status"] == s for r in rows) for s in sorted({r["uid_attribution_status"] for r in rows})}, "account_candidates": len(candidates), "timeline_snapshots": len(timeline_checks), "snapshot_deltas": sum(bool(r["review_flags"]) and "resume_pending" not in r["review_flags"] and "non_bilibili" not in r["review_flags"] for r in timeline_checks), "out_csv": out.name}, ensure_ascii=False))


if __name__ == "__main__": main()
