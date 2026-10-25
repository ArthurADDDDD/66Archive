#!/usr/bin/env python3
"""Resumable, metadata-only Bilibili source-reference audit.

The cache and per-reference checkpoint are written only to the caller-supplied
cache directory. This script never requests playback/stream URLs or media.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

ID_RE = re.compile(r"(?P<id>BV[0-9A-Za-z]{10}|av\d+)")


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(value, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def get_entries(data_root: Path) -> list[dict]:
    entries: list[dict] = []
    for path in sorted([*data_root.glob("*.yaml"), *data_root.glob("*.yml")]):
        loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            entries.extend(x for x in loaded if isinstance(x, dict))
        elif isinstance(loaded, dict) and isinstance(loaded.get("entries"), list):
            entries.extend(x for x in loaded["entries"] if isinstance(x, dict))
    return entries


def make_refs(entries: list[dict]) -> tuple[list[dict], list[str]]:
    refs: list[dict] = []
    seen: set[tuple[str, str, str, str]] = set()
    for entry in entries:
        for source_index, source in enumerate(entry.get("sources") or []):
            url = source.get("url", "")
            if not isinstance(url, str) or not any(host in url for host in ("bilibili.com", "b23.tv")):
                continue
            match = ID_RE.search(url)
            if not match:
                continue
            sid = match.group("id")
            parsed = urllib.parse.urlparse(url)
            query = urllib.parse.parse_qs(parsed.query)
            p_values = query.get("p", [])
            p = None
            if p_values:
                try:
                    p = int(p_values[0])
                except ValueError:
                    p = p_values[0]
            key = (str(entry.get("id", "")), sid, str(p or ""), url)
            if key in seen:
                continue
            seen.add(key)
            refs.append({
                "entry_id": entry.get("id", ""),
                "date": entry.get("date", ""),
                "entry_title": entry.get("title", ""),
                "games": entry.get("games", []),
                "duration_min": entry.get("duration_min"),
                "source_index": source_index,
                "source_kind": source.get("kind", ""),
                "source_status": source.get("status", ""),
                "source_account": source.get("account", ""),
                "part_details": source.get("part_details", []) or [],
                "source_url": url,
                "id": sid,
                "p": p,
                "status": "resume_pending",
                "page_check": "not_checked",
                "finding": "",
            })
    return refs, sorted({r["id"] for r in refs})


def request_metadata(sid: str, timeout: float) -> tuple[int | None, dict | None, str]:
    if sid.startswith("BV"):
        params = {"bvid": sid}
    else:
        params = {"aid": sid[2:]}
    url = "https://api.bilibili.com/x/web-interface/view?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36",
        "Referer": "https://www.bilibili.com/",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = json.loads(response.read())
            return response.status, body, ""
    except urllib.error.HTTPError as e:
        return e.code, None, f"HTTP {e.code}"
    except Exception as e:
        return None, None, f"{type(e).__name__}: {e}"


def public_metadata(body: dict) -> dict:
    # Allowlist page metadata. Never copy play URLs, subtitle links, or tokens.
    data = body.get("data") or {}
    owner = data.get("owner") or {}
    return {
        "code": body.get("code"),
        "message": body.get("message"),
        "title": data.get("title"),
        "owner": owner.get("name"),
        "owner_mid": owner.get("mid"),
        "postdate": data.get("pubdate"),
        "duration": data.get("duration"),
        "pages": [
            {"page": p.get("page"), "cid": p.get("cid"), "part": p.get("part"), "duration": p.get("duration")}
            for p in data.get("pages", [])
        ],
    }


def write_ref_csv(path: Path, refs: list[dict]) -> None:
    fields = ["entry_id", "date", "entry_title", "games", "duration_min", "source_index", "source_kind", "source_status", "source_account", "part_details", "source_url", "id", "p", "status", "page_check", "finding"]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in refs:
            row = dict(r)
            row["games"] = ";".join(row["games"]) if isinstance(row["games"], list) else row["games"]
            row["part_details"] = json.dumps(row.get("part_details", []), ensure_ascii=False, separators=(",", ":"))
            w.writerow(row)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", required=True, type=Path, help="data/entries directory from the selected baseline")
    ap.add_argument("--cache-dir", required=True, type=Path, help="external-drive directory for metadata and checkpoints")
    ap.add_argument("--max-ids", type=int, default=0, help="process at most this many unique IDs this run; 0 means all pending")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between API requests; default 1.0")
    ap.add_argument("--timeout", type=float, default=20.0)
    args = ap.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)

    refs, ids = make_refs(get_entries(args.data_root))
    state_path = args.cache_dir / "reference-checkpoint.json"
    old = {}
    if state_path.exists():
        try:
            old = json.loads(state_path.read_text(encoding="utf-8"))
        except Exception:
            old = {}
    prior = {(x.get("entry_id"), x.get("id"), str(x.get("p") or ""), x.get("source_url")): x for x in old.get("refs", [])}
    for ref in refs:
        key = (ref["entry_id"], ref["id"], str(ref["p"] or ""), ref["source_url"])
        prev = prior.get(key)
        if prev and prev.get("status") in ("metadata_ok", "blocked", "error"):
            ref.update({k: prev[k] for k in ("status", "page_check", "finding") if k in prev})
    pending_ids = [sid for sid in ids if any(r["id"] == sid and r["status"] == "resume_pending" for r in refs)]
    # Check game-timeline basis snapshots early, then already-known high-risk IDs.
    explicit_priority = ["BV1xs411B7zV", "BV1ZW411j7oc", "BV1vV4y1b7rG"]
    timeline_path = args.data_root.parent / "game-timelines.yaml"
    basis_ids = []
    if timeline_path.exists():
        try:
            timelines = yaml.safe_load(timeline_path.read_text(encoding="utf-8")) or []
            for timeline in timelines if isinstance(timelines, list) else []:
                match = ID_RE.search(str(timeline.get("basis", "")))
                if match and match.group("id").startswith("BV") and match.group("id") not in basis_ids:
                    basis_ids.append(match.group("id"))
        except Exception:
            pass
    priority = [x for x in explicit_priority + basis_ids if x in pending_ids]
    priority_set = set(priority)
    pending_ids = priority + [x for x in pending_ids if x not in priority_set]
    if args.max_ids:
        pending_ids = pending_ids[:args.max_ids]
    results_path = args.cache_dir / "metadata.jsonl"
    known = set()
    if results_path.exists():
        for line in results_path.read_text(encoding="utf-8").splitlines():
            try:
                known.add(json.loads(line)["id"])
            except Exception:
                pass
    # Also honor an item file created just before an interrupted append.
    known.update(p.stem for p in (args.cache_dir / "items").glob("*.json"))
    consecutive_blocked = 0
    requested = 0

    def save_checkpoint() -> None:
        atomic_json(state_path, {"baseline": "34b35960", "unique_ids": len(ids), "reference_count": len(refs), "refs": refs})
        write_ref_csv(args.cache_dir / "reference-checkpoint.csv", refs)

    save_checkpoint()
    for sid in pending_ids:
        if sid in known:
            # Reapply cached response without a second request.
            try:
                meta = json.loads((args.cache_dir / "items" / f"{sid}.json").read_text(encoding="utf-8"))
            except Exception:
                meta = None
            if meta:
                body = {"code": meta.get("code"), "data": {"pages": meta.get("pages", [])}}
                for r in refs:
                    if r["id"] == sid:
                        r["status"] = "metadata_ok"
                        pages = meta.get("pages", [])
                        if isinstance(r["p"], int):
                            r["page_check"] = "in_range" if any(p.get("page") == r["p"] for p in pages) else "out_of_range"
                            r["finding"] = "p query exceeds returned page count" if r["page_check"] == "out_of_range" else ""
                        else:
                            r["page_check"] = "all_pages_available"
                save_checkpoint()
                continue
        # Ensure every source reference for this ID is marked attempted before request.
        for r in refs:
            if r["id"] == sid and r["status"] == "resume_pending":
                r["status"] = "attempted"
        save_checkpoint()
        status, body, error = request_metadata(sid, args.timeout)
        requested += 1
        if status in (403, 412) or (body and body.get("code") == -412):
            consecutive_blocked += 1
            for r in refs:
                if r["id"] == sid and r["status"] == "attempted":
                    r["status"] = "blocked"
                    r["finding"] = f"platform response blocked (HTTP/API {status or body.get('code')})"
        elif status is not None and body and body.get("code") == 0:
            consecutive_blocked = 0
            meta = public_metadata(body)
            atomic_json(args.cache_dir / "items" / f"{sid}.json", {"id": sid, **meta})
            with results_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps({"id": sid, **meta}, ensure_ascii=False, separators=(",", ":")) + "\n")
            known.add(sid)
            for r in refs:
                if r["id"] == sid and r["status"] == "attempted":
                    r["status"] = "metadata_ok"
                    if isinstance(r["p"], int):
                        r["page_check"] = "in_range" if any(p.get("page") == r["p"] for p in meta["pages"]) else "out_of_range"
                        if r["page_check"] == "out_of_range":
                            r["finding"] = f"p={r['p']} exceeds returned page count {len(meta['pages'])}"
                    else:
                        r["page_check"] = "all_pages_available"
        else:
            consecutive_blocked = 0
            err_text = error or (f"HTTP {status}" if status else "empty response")
            state = "blocked" if status in (403, 412) else "error"
            for r in refs:
                if r["id"] == sid and r["status"] == "attempted":
                    r["status"] = state
                    r["finding"] = err_text
        save_checkpoint()
        print(json.dumps({"processed": requested, "id": sid, "http": status, "state": next(r["status"] for r in refs if r["id"] == sid)}, ensure_ascii=False), flush=True)
        if consecutive_blocked >= 2:
            print("circuit_breaker: two consecutive blocked API responses; stopped", flush=True)
            break
        if args.delay > 0:
            time.sleep(args.delay)
    # Any interrupted 'attempted' references become resumable; pending stay explicit.
    for r in refs:
        if r["status"] == "attempted":
            r["status"] = "resume_pending"
    save_checkpoint()
    print(json.dumps({"requested_this_run": requested, "unique_ids": len(ids), "refs": len(refs), "status_counts": {s: sum(r["status"] == s for r in refs) for s in ("attempted", "metadata_ok", "blocked", "error", "resume_pending")}}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
