#!/usr/bin/env python3
"""Read AcFun public page metadata once per normalized ac ID.

Raw page HTML is held only in memory. The external JSONL journal contains
selected metadata fields only; no media URLs, stream payloads, or credentials.
"""
import argparse
import csv
import datetime as dt
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import yaml

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
PAGE_JSON_MARKER = "window.pageInfo = window.videoInfo = "
BLOCK_CODES = {403, 412, 429}

# Previously checked in the immediately preceding online batch / root review.
# Reuse their compact metadata; do not issue another request for these posts.
SEEDS = {
    "2434647": {
        "title": "【主机游戏】跟着女流一起来玩《尼德霍格(Nidhogg)》吧（一）",
        "owner": "斗鱼录像厅",
        "post_date": "2016-01-04 13:30",
        "page_metadata_duration_sec": 3169,
        "video_count": 1,
        "video_list": [{"id": "", "title": "Part 1", "duration_sec": 3169}],
        "fetched_at": "2026-10-22 prior public-page metadata request; reused without refetch",
        "http_status": "reused_prior",
        "page_url": "https://www.acfun.cn/v/ac2434647",
        "note": "API metadata duration conflicts with root-confirmed playable stream duration 87:38; retain both observations, do not infer gap.",
    },
    "2731879": {
        "title": "5-9黑暗之魂3第九天-完结-高清",
        "owner": "女流录像小屋",
        "post_date": "2016-05-10 22:45",
        "page_metadata_duration_sec": 4772,
        "video_count": 2,
        "video_list": [
            {"id": "", "title": "双子P1", "duration_sec": 3481},
            {"id": "", "title": "薪王P2", "duration_sec": 1291},
        ],
        "fetched_at": "2026-10-22 prior public-page metadata request; root also confirmed P1 playback 58:01",
        "http_status": "reused_prior",
        "page_url": "https://www.acfun.cn/v/ac2731879",
        "note": "P1 page metadata duration agrees with root-confirmed playback 58:01; root noted alignment against Bilibili P1 remains to be checked.",
    },
}


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def source_refs(root):
    refs = []
    for p in sorted((root / "data/entries").glob("*.yaml")):
        docs = yaml.safe_load(p.read_text(encoding="utf-8")) or []
        if isinstance(docs, dict):
            docs = docs.get("entries", [])
        for e in docs:
            for ix, s in enumerate(e.get("sources") or []):
                url = str(s.get("url") or "")
                if not re.match(r"https?://(?:www\.)?acfun\.cn/", url, re.I):
                    continue
                m = re.search(r"/v/ac(\d+)(?:_(\d+))?(?:[/?#]|$)", url, re.I)
                if not m:
                    refs.append({"entry": e.get("id", ""), "entry_title": e.get("title", ""), "entry_duration_min": e.get("duration_min", ""),
                                 "entry_games": "; ".join(str(x) for x in e.get("games", []) or []), "parts": s.get("parts", ""), "source_index": ix, "url": url,
                                 "ac_id": "", "page_ref": "", "kind": s.get("kind", ""),
                                 "source_status": s.get("status", ""), "account": s.get("account", ""), "parse_error": "unrecognized_acfun_url"})
                    continue
                refs.append({"entry": e.get("id", ""), "entry_title": e.get("title", ""), "entry_duration_min": e.get("duration_min", ""),
                             "entry_games": "; ".join(str(x) for x in e.get("games", []) or []), "parts": s.get("parts", ""), "source_index": ix, "url": url,
                             "ac_id": m.group(1), "page_ref": m.group(2) or "",
                             "kind": s.get("kind", ""), "source_status": s.get("status", ""),
                             "account": s.get("account", ""), "parse_error": ""})
    return refs


def load_journal(path):
    latest = {}
    if not path.exists():
        return latest
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            item = json.loads(line)
            latest[item["ac_id"]] = item
        except (ValueError, KeyError):
            continue
    for ac_id, item in list(latest.items()):
        if item.get("status") == "attempted":
            item["status"] = "resume_pending"
            item["note"] = "Request was recorded as attempted but no final response checkpoint exists; not retried to preserve one-GET policy."
            latest[ac_id] = item
    return latest


def append_journal(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n")
        f.flush()


def selected_page_metadata(ac_id):
    url = f"https://www.acfun.cn/v/ac{ac_id}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Referer": "https://www.acfun.cn/"})
    with urllib.request.urlopen(req, timeout=20) as response:
        status_code = response.status
        final_url = response.geturl()
        # Read only HTML, bounded in-memory. Never follow any extracted stream URL.
        raw = response.read(1_500_001)
    if len(raw) > 1_500_000:
        raise ValueError("page_html_over_size_limit")
    text = raw.decode("utf-8", "replace")
    start = text.find(PAGE_JSON_MARKER)
    if start < 0:
        raise ValueError("page_json_marker_missing")
    start += len(PAGE_JSON_MARKER)
    page, _ = json.JSONDecoder().raw_decode(text[start:])
    videos = []
    for v in page.get("videoList") or []:
        videos.append({
            "id": str(v.get("id") or ""),
            "title": str(v.get("title") or ""),
            "duration_sec": round((v.get("durationMillis") or 0) / 1000),
            "upload_time": dt.datetime.fromtimestamp(v["uploadTime"] / 1000, dt.timezone.utc).isoformat(timespec="seconds") if v.get("uploadTime") else "",
            "source_status": v.get("sourceStatus"),
        })
    created = page.get("createTimeMillis")
    created_at = dt.datetime.fromtimestamp(created / 1000, dt.timezone.utc).isoformat(timespec="seconds") if created else str(page.get("createTime") or "")
    user = page.get("user") or {}
    # Preserve an identity only if the public page JSON explicitly exposes it.
    user_id_fields = [(k, user[k]) for k in user if str(k).lower() in {"id", "uid", "userid", "user_id"} and user[k] not in (None, "")]
    user_id_field, user_id_value = user_id_fields[0] if user_id_fields else ("", "")
    return {
        "ac_id": ac_id,
        "status": "metadata_ok",
        "fetched_at": now(),
        "http_status": status_code,
        "page_url": url,
        "final_url": final_url,
        "title": str(page.get("title") or ""),
        "owner": str(user.get("name") or ""),
        "public_user_id": str(user_id_value),
        "user_id_field": str(user_id_field),
        "post_date": created_at,
        "view_count": page.get("viewCount"),
        "page_metadata_duration_sec": round((page.get("durationMillis") or 0) / 1000),
        "video_list": videos,
        "video_count": len(videos),
        "note": "Selected page metadata only; playback/content not tested. Stream URLs intentionally omitted.",
    }


def write_csvs(out_dir, refs, latest, expected_uids):
    out_dir.mkdir(parents=True, exist_ok=True)
    post_fields = ["ac_id", "status", "fetched_at", "http_status", "page_url", "final_url", "title", "owner", "public_user_id", "user_id_field", "post_date",
                   "view_count", "page_metadata_duration_sec", "video_count", "video_list", "note"]
    post_path = out_dir / "acfun-posts.csv"
    with post_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=post_fields)
        w.writeheader()
        for ac_id in sorted(latest, key=lambda x: int(x) if x.isdigit() else x):
            item = dict(latest[ac_id])
            item["video_list"] = json.dumps(item.get("video_list", []), ensure_ascii=False, separators=(",", ":"))
            w.writerow({k: item.get(k, "") for k in post_fields})
    ref_fields = ["entry", "entry_title", "entry_duration_min", "entry_games", "parts", "source_index", "url", "ac_id", "page_ref", "kind", "source_status", "account", "expected_uid", "observed_uid", "account_match", "identity_evidence", "status", "parse_error", "metadata_title"]
    ref_path = out_dir / "acfun-references.csv"
    with ref_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=ref_fields)
        w.writeheader()
        for ref in refs:
            item = latest.get(ref["ac_id"], {}) if ref.get("ac_id") else {}
            status = item.get("status", "resume_pending") if ref.get("ac_id") else "error"
            observed = str(item.get("public_user_id") or "")
            expected = expected_uids.get(ref.get("account", ""), "")
            match = "match" if observed and expected and observed == expected else ("mismatch" if observed and expected else "unverified")
            identity_evidence = "new public page field" if observed else ("prior cache lacks UID" if item.get("status") in {"metadata_ok", "imported_partial_metadata"} else "not yet available")
            w.writerow({**ref, "expected_uid": expected, "observed_uid": observed, "account_match": match,
                        "identity_evidence": identity_evidence, "status": status, "metadata_title": item.get("title", "")})


def timeline_basis(root):
    """Return unique AcFun basis IDs and expected timeline parts, if any."""
    result = {}
    for timeline in yaml.safe_load((root / "data/game-timelines.yaml").read_text(encoding="utf-8")) or []:
        basis = str(timeline.get("basis") or "")
        m = re.search(r"ac(\d+)", basis, re.I) if "acfun.cn" in basis.lower() else None
        if not m:
            continue
        result.setdefault(m.group(1), []).append({
            "entry": timeline.get("entry", ""),
            "coverage": timeline.get("coverage", ""),
            "parts": timeline.get("parts") or [],
            "basis": basis,
        })
    return result


def write_basis_csv(out_dir, basis, latest):
    fields = ["ac_id", "entry", "basis", "coverage", "status", "page", "expected_id", "observed_id",
              "expected_duration_sec", "observed_duration_sec", "id_match", "duration_match", "note"]
    with (out_dir / "acfun-timeline-basis.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader()
        for ac_id, timelines in sorted(basis.items(), key=lambda pair: int(pair[0])):
            item = latest.get(ac_id, {})
            by_page = {i + 1: v for i, v in enumerate(item.get("video_list") or [])}
            for timeline in timelines:
                for part in timeline["parts"]:
                    page = part.get("page")
                    obs = by_page.get(page) if isinstance(page, int) else None
                    expected_id = str(part.get("id", ""))
                    observed_id = str((obs or {}).get("id", ""))
                    expected_duration = part.get("duration_sec", "")
                    observed_duration = (obs or {}).get("duration_sec", "")
                    status = item.get("status", "resume_pending")
                    w.writerow({"ac_id": ac_id, "entry": timeline["entry"], "basis": timeline["basis"],
                                "coverage": timeline["coverage"], "status": status, "page": page,
                                "expected_id": expected_id, "observed_id": observed_id,
                                "expected_duration_sec": expected_duration, "observed_duration_sec": observed_duration,
                                "id_match": (expected_id == observed_id) if obs else "unavailable",
                                "duration_match": (abs(float(expected_duration) - float(observed_duration)) < 0.5) if obs and expected_duration != "" and observed_duration != "" else "unavailable",
                                "note": "Page-list metadata comparison only; not playback/content verification."})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", required=True, type=Path)
    ap.add_argument("--journal", required=True, type=Path)
    ap.add_argument("--batch-size", type=int, default=25)
    ap.add_argument("--limit", type=int, default=0, help="stop after this many new GETs; 0 means continue until done or blocked")
    args = ap.parse_args()
    root = args.baseline.resolve()
    out_dir = Path(__file__).resolve().parent
    refs = source_refs(root)
    account_rows = yaml.safe_load((root / "data/accounts.yaml").read_text(encoding="utf-8")) or []
    expected_uids = {}
    for account in account_rows:
        if account.get("platform") == "acfun":
            match = re.search(r"/u/(\d+)", str(account.get("url") or ""))
            if match:
                expected_uids[account.get("id", "")] = match.group(1)
    ids = sorted({r["ac_id"] for r in refs if r.get("ac_id")}, key=lambda x: int(x))
    basis = timeline_basis(root)
    latest = load_journal(args.journal)
    for ac_id, item in SEEDS.items():
        if ac_id not in latest or latest[ac_id].get("status") == "metadata_ok":
            record = {"ac_id": ac_id, "status": "imported_partial_metadata", **item,
                      "provenance": "imported_partial_metadata",
                      "note": "Prior partial metadata reused; not fetched in this full audit. " + item.get("note", "")}
            latest[ac_id] = record
            append_journal(args.journal, record)
    # Initial state is visible before network work begins.
    write_csvs(out_dir, refs, latest, expected_uids)
    write_basis_csv(out_dir, basis, latest)
    queue = [x for x in ids if x not in latest]
    priority = [x for x in sorted(basis, key=lambda x: int(x)) if x in queue]
    queue = priority + [x for x in queue if x not in set(priority)]
    print(f"baseline={root.name} references={len(refs)} unique_posts={len(ids)} timeline_basis_posts={len(basis)} basis_queued={len(priority)} already_checked_or_attempted={len(ids)-len(queue)} queued_gets={len(queue)}", flush=True)
    prev_start = None
    blocked_streak = 0
    done = 0
    for ac_id in queue:
        if args.limit and done >= args.limit:
            break
        if prev_start is not None:
            wait = 1.0 - (time.monotonic() - prev_start)
            if wait > 0:
                time.sleep(wait)
        prev_start = time.monotonic()
        append_journal(args.journal, {"ac_id": ac_id, "status": "attempted", "attempted_at": now(), "page_url": f"https://www.acfun.cn/v/ac{ac_id}"})
        try:
            result = selected_page_metadata(ac_id)
            latest[ac_id] = result
            append_journal(args.journal, result)
            blocked_streak = 0
        except urllib.error.HTTPError as e:
            state = "blocked" if e.code in BLOCK_CODES else "error"
            record = {"ac_id": ac_id, "status": state, "fetched_at": now(), "http_status": e.code,
                      "page_url": f"https://www.acfun.cn/v/ac{ac_id}", "title": "", "owner": "", "post_date": "",
                      "video_count": "", "video_list": [], "note": f"HTTP {e.code}; no retry."}
            latest[ac_id] = record
            append_journal(args.journal, record)
            blocked_streak = blocked_streak + 1 if state == "blocked" else 0
        except Exception as e:
            record = {"ac_id": ac_id, "status": "error", "fetched_at": now(), "http_status": "",
                      "page_url": f"https://www.acfun.cn/v/ac{ac_id}", "title": "", "owner": "", "post_date": "",
                      "video_count": "", "video_list": [], "note": f"{type(e).__name__}: {str(e)[:180]}; no retry."}
            latest[ac_id] = record
            append_journal(args.journal, record)
            blocked_streak = 0
        done += 1
        if done % args.batch_size == 0 or blocked_streak >= 2 or (args.limit and done >= args.limit):
            write_csvs(out_dir, refs, latest, expected_uids)
            write_basis_csv(out_dir, basis, latest)
            counts = {}
            for item in latest.values(): counts[item.get("status", "?")] = counts.get(item.get("status", "?"), 0) + 1
            print(f"checkpoint new_gets={done} latest={counts}", flush=True)
        if blocked_streak >= 2:
            print("STOP: two consecutive AcFun 403/412/429 responses; remaining IDs left resume_pending; no bypass/retry.", flush=True)
            break
    write_csvs(out_dir, refs, latest, expected_uids)
    write_basis_csv(out_dir, basis, latest)
    counts = {}
    for item in latest.values(): counts[item.get("status", "?")] = counts.get(item.get("status", "?"), 0) + 1
    print(f"finished_batch new_gets={done} unique_posts={len(ids)} latest={counts}; remaining refs are resume_pending", flush=True)


if __name__ == "__main__":
    main()
