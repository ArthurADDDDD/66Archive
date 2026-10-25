#!/usr/bin/env python3
"""Refresh missing public uploader UIDs for exact source submissions only.

This research helper reads source-credibility-reviewed.csv and writes only
allowlisted identity metadata to a caller-supplied directory on an already
mounted external volume. It never downloads or stores media, HTML, stream URLs,
tokens, or full platform responses. It does not edit archive data or the source
ledger. Each unique posting ID is attempted at most once per cache journal;
all recorded outcomes are reused without retry.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
DEFAULT_LEDGER = HERE / "source-credibility-reviewed.csv"
BILI_ID_RE = re.compile(r"(?i)(BV[0-9A-Za-z]{10}|av\d+)")
ACFUN_ID_RE = re.compile(r"(?i)/v/ac(\d+)(?:_\d+)?(?:[/?#]|$)")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 Chrome/130 Safari/537.36")
ALLOWED_RECORD_KEYS = {
    "platform", "id", "page_url", "uid", "name", "fetched_at",
    "status", "http_status", "field",
}
CHALLENGE_HTTP = {403, 412, 429}


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def normalize_bili_id(raw: str) -> str:
    value = raw.strip()
    if value.lower().startswith("av"):
        return "av" + str(int(value[2:]))
    # BV identifiers are case-sensitive after the prefix.
    return "BV" + value[2:] if value[:2].lower() == "bv" else value


def parse_source(platform: str, url: str) -> tuple[str, str] | None:
    if platform == "bilibili":
        match = BILI_ID_RE.search(url)
        if not match:
            return None
        sid = normalize_bili_id(match.group(1))
        return sid, f"https://www.bilibili.com/video/{sid}"
    if platform == "acfun":
        match = ACFUN_ID_RE.search(url)
        if not match:
            return None
        sid = str(int(match.group(1)))
        return sid, f"https://www.acfun.cn/v/ac{sid}"
    return None


def load_missing_refs(ledger: Path) -> dict[str, list[dict[str, str]]]:
    queues: dict[str, dict[str, dict[str, str]]] = {
        "bilibili": {}, "acfun": {},
    }
    with ledger.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"platform", "source_url", "platform_metadata_owner_uid"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("ledger is missing required source/UID columns")
        all_rows = list(reader)

    # Group first so one UID-bearing reference for the same exact post prevents
    # a duplicate lookup for another row that happens to lack its joined value.
    grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in all_rows:
        platform = (row.get("platform") or "").strip().lower()
        if platform not in queues:
            continue
        parsed = parse_source(platform, row.get("source_url") or "")
        if parsed is None:
            continue
        sid, page_url = parsed
        grouped[(platform, sid)].append({**row, "_id": sid, "_page_url": page_url})

    for (platform, sid), refs in grouped.items():
        if any((r.get("platform_metadata_owner_uid") or "").strip() for r in refs):
            continue
        queues[platform][sid] = refs[0]
    return {platform: list(items.values()) for platform, items in queues.items()}


def normalize_platform(raw: str, source_url: str = "") -> str:
    value = (raw or "").strip().lower()
    if value in {"bili", "bilibili"}:
        return "bilibili"
    if value in {"ac", "acfun"}:
        return "acfun"
    host = (urllib.parse.urlparse(source_url).hostname or "").lower()
    if "bilibili.com" in host or host == "b23.tv":
        return "bilibili"
    if "acfun.cn" in host:
        return "acfun"
    return ""


def normalize_explicit_id(platform: str, raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    if platform == "bilibili":
        match = BILI_ID_RE.search(value)
        return normalize_bili_id(match.group(1)) if match else ""
    if platform == "acfun":
        match = re.search(r"(?i)(?:ac)?(\d+)$", value)
        return str(int(match.group(1))) if match else ""
    return ""


def load_reuse_csv(path: Path | None, queues: dict[str, list[dict[str, str]]]) -> dict[tuple[str, str], dict[str, Any]]:
    """Read numeric UID evidence for an exact source post; never join by name."""
    if path is None:
        return {}
    candidates = {(platform, ref["_id"]): ref
                  for platform, refs in queues.items() for ref in refs}
    seeds: dict[tuple[str, str], dict[str, Any]] = {}
    id_fields = ("post_id", "normalized_submission_id", "id", "ac_id",
                 "bvid", "avid", "source_id")
    uid_fields = ("observed_uid", "uid", "actual_uid", "actual_owner_uid",
                  "api_owner_mid", "public_user_id", "owner_mid")
    name_fields = ("name", "owner", "api_owner", "platform_metadata_owner_name")
    time_fields = ("fetched_at", "observed_at", "retrieved_at")
    field_fields = ("field", "uid_field", "user_id_field", "identity_field")
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for line_number, row in enumerate(csv.DictReader(handle), 2):
            url = (row.get("source_url") or row.get("url") or "").strip()
            platform = normalize_platform(row.get("platform") or "", url)
            if not platform:
                continue
            parsed = parse_source(platform, url) if url else None
            from_url = parsed[0] if parsed else ""
            raw_id = next((row.get(field, "") for field in id_fields if row.get(field)), "")
            post_id = normalize_explicit_id(platform, raw_id) if raw_id else ""
            if from_url and post_id and from_url != post_id:
                raise ValueError(f"reuse CSV line {line_number} has conflicting URL and post ID")
            sid = from_url or post_id
            key = (platform, sid)
            if not sid or key not in candidates:
                continue
            uid = next((str(row.get(field, "")).strip() for field in uid_fields
                        if str(row.get(field, "")).strip()), "")
            if not uid.isdigit():
                continue
            name = next((row.get(field, "").strip() for field in name_fields
                         if row.get(field, "").strip()), "")
            fetched_at = next((row.get(field, "").strip() for field in time_fields
                               if row.get(field, "").strip()), "") or now_utc()
            field = next((row.get(candidate, "").strip() for candidate in field_fields
                          if row.get(candidate, "").strip()), "reuse_csv_numeric_uid")
            seed = {
                "platform": platform, "id": sid,
                "page_url": candidates[key]["_page_url"], "uid": uid,
                "name": name, "fetched_at": fetched_at,
                "status": "reused_uid", "http_status": "", "field": field,
            }
            previous = seeds.get(key)
            if previous and previous["uid"] != uid:
                raise ValueError(f"reuse CSV has conflicting numeric UIDs for {platform} {sid}")
            seeds[key] = seed
    return seeds


def mount_for(path: Path) -> Path:
    resolved = path.resolve(strict=True)
    if not resolved.is_dir():
        raise ValueError("--cache-dir must be an existing directory")
    root_device = os.stat("/").st_dev
    mounts = [candidate for candidate in (resolved, *resolved.parents)
              if os.path.ismount(candidate)]
    for mount in mounts:
        if mount != Path("/").resolve() and os.stat(mount).st_dev != root_device:
            if os.path.commonpath((str(resolved), str(mount))) != str(mount):
                continue
            return mount
    raise ValueError("--cache-dir is not on a separate, currently mounted volume")


def load_journal(path: Path) -> dict[tuple[str, str], dict[str, Any]]:
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    if not path.exists():
        return latest
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"invalid cache journal line {line_number}") from exc
            if not isinstance(record, dict) or set(record) != ALLOWED_RECORD_KEYS:
                raise ValueError(f"cache journal line {line_number} violates field allowlist")
            if record.get("platform") not in {"bilibili", "acfun"} or not record.get("id"):
                raise ValueError(f"cache journal line {line_number} has an invalid key")
            latest[(record["platform"], str(record["id"]))] = record
    return latest


def is_retryable(record: dict[str, Any]) -> bool:
    return record.get("status") == "attempted" or (
        record.get("status") == "error" and record.get("field") == "network")


def safe_record(platform: str, sid: str, page_url: str, uid: Any,
                name: Any, status: str, http_status: Any = "",
                field: str = "") -> dict[str, Any]:
    normalized_uid = str(uid or "").strip()
    if not normalized_uid.isdigit():
        normalized_uid = ""
    return {
        "platform": platform,
        "id": sid,
        "page_url": page_url,
        "uid": normalized_uid,
        "name": str(name or "").strip(),
        "fetched_at": now_utc(),
        "status": status,
        "http_status": http_status,
        "field": field,
    }


MAX_BODY_BYTES = 2_000_000
# Known platform risk-control API codes; any of these stops the platform.
BILI_CHALLENGE_CODES = {-412, -352, -351}
# Public "this submission cannot be shown" codes; recorded, never a challenge,
# and never interpreted as missing footage.
BILI_UNAVAILABLE_CODES = {-404, 62002, 62004, 62012}
ACFUN_PAGE_JSON_MARKER = "window.pageInfo = window.videoInfo = "
CHALLENGE_TEXT_HINTS = ("captcha", "geetest", "验证码", "安全验证", "人机验证",
                        "滑动验证", "访问频繁", "请求过于频繁")
UNAVAILABLE_TEXT_HINTS = ("视频不存在", "稿件不存在", "该视频已被删除",
                          "内容不存在", "页面不存在")


def read_bounded(response: Any) -> bytes:
    raw = response.read(MAX_BODY_BYTES + 1)
    if len(raw) > MAX_BODY_BYTES:
        raise ValueError("response_over_size_limit")
    return raw


def classify_unparsed_body(text: str) -> str:
    """Classify an HTTP 200 body that lacks the expected structured data."""
    lowered = text.lower()
    if any(hint in lowered for hint in CHALLENGE_TEXT_HINTS):
        return "challenge"
    if any(hint in text for hint in UNAVAILABLE_TEXT_HINTS):
        return "unavailable"
    return "unclassified"


def bili_lookup(sid: str, page_url: str, timeout: float) -> tuple[dict[str, Any], str]:
    """Return (record, signal); signal is challenge, network, suspect or ok."""
    if sid.lower().startswith("bv"):
        params = {"bvid": sid}
    else:
        params = {"aid": sid[2:]}
    api_url = "https://api.bilibili.com/x/web-interface/view?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(api_url, headers={
        "User-Agent": UA,
        "Referer": "https://www.bilibili.com/",
        "Accept": "application/json",
    })
    http_status: Any = ""
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            http_status = response.status
            raw = read_bounded(response)
    except urllib.error.HTTPError as exc:
        blocked = exc.code in CHALLENGE_HTTP
        record = safe_record("bilibili", sid, page_url, "", "",
                             "challenge" if blocked else "error", exc.code,
                             "http_status")
        return record, "challenge" if blocked else "ok"
    except ValueError:
        return safe_record("bilibili", sid, page_url, "", "", "error",
                           http_status, "response_over_size_limit"), "suspect"
    except (OSError, TimeoutError):
        return safe_record("bilibili", sid, page_url, "", "", "error",
                           http_status, "network"), "network"
    try:
        body = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        kind = classify_unparsed_body(raw.decode("utf-8", "replace"))
        status = "challenge" if kind == "challenge" else "error"
        return safe_record("bilibili", sid, page_url, "", "", status,
                           http_status, f"non_json_body_{kind}"), (
                               "challenge" if kind == "challenge" else "suspect")

    code = body.get("code") if isinstance(body, dict) else None
    if code in BILI_CHALLENGE_CODES:
        return safe_record("bilibili", sid, page_url, "", "", "challenge",
                           http_status, f"api_code_{code}"), "challenge"
    if code in BILI_UNAVAILABLE_CODES:
        return safe_record("bilibili", sid, page_url, "", "", "unavailable",
                           http_status, f"api_code_{code}"), "ok"
    if code != 0:
        return safe_record("bilibili", sid, page_url, "", "", "error",
                           http_status, f"api_code_{code}"), "suspect"
    data = body.get("data") or {}
    owner = data.get("owner") or {}
    uid = owner.get("mid") if isinstance(owner, dict) else ""
    name = owner.get("name") if isinstance(owner, dict) else ""
    field = "data.owner.mid" if uid not in (None, "") else ""
    status = "metadata_ok" if str(uid or "").isdigit() else "metadata_ok_uid_absent"
    return safe_record("bilibili", sid, page_url, uid, name, status,
                       http_status, field), "ok"


def acfun_lookup(sid: str, page_url: str, timeout: float) -> tuple[dict[str, Any], str]:
    """Read only the public page JSON's user block; same field rule as audit_acfun.py."""
    request = urllib.request.Request(page_url, headers={
        "User-Agent": UA, "Referer": "https://www.acfun.cn/",
    })
    http_status: Any = ""
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            http_status = response.status
            raw = read_bounded(response)
    except urllib.error.HTTPError as exc:
        blocked = exc.code in CHALLENGE_HTTP
        if exc.code == 404:
            return safe_record("acfun", sid, page_url, "", "", "unavailable",
                               exc.code, "http_status"), "ok"
        return safe_record("acfun", sid, page_url, "", "",
                           "challenge" if blocked else "error", exc.code,
                           "http_status"), "challenge" if blocked else "ok"
    except ValueError:
        return safe_record("acfun", sid, page_url, "", "", "error",
                           http_status, "response_over_size_limit"), "suspect"
    except (OSError, TimeoutError):
        return safe_record("acfun", sid, page_url, "", "", "error",
                           http_status, "network"), "network"
    text = raw.decode("utf-8", "replace")
    start = text.find(ACFUN_PAGE_JSON_MARKER)
    if start < 0:
        kind = classify_unparsed_body(text)
        status = {"challenge": "challenge", "unavailable": "unavailable"}.get(kind, "error")
        signal = {"challenge": "challenge", "unavailable": "ok"}.get(kind, "suspect")
        return safe_record("acfun", sid, page_url, "", "", status,
                           http_status, f"page_json_missing_{kind}"), signal
    try:
        page, _ = json.JSONDecoder().raw_decode(text[start + len(ACFUN_PAGE_JSON_MARKER):])
    except json.JSONDecodeError:
        return safe_record("acfun", sid, page_url, "", "", "error",
                           http_status, "page_json_decode"), "suspect"
    user = page.get("user") if isinstance(page, dict) else None
    user = user if isinstance(user, dict) else {}
    id_fields = [(k, user[k]) for k in user
                 if str(k).lower() in {"id", "uid", "userid", "user_id"}
                 and user[k] not in (None, "")]
    field, uid = id_fields[0] if id_fields else ("", "")
    status = "metadata_ok" if str(uid).isdigit() else "metadata_ok_uid_absent"
    return safe_record("acfun", sid, page_url, uid, user.get("name"), status,
                       http_status, f"pageInfo.user.{field}" if field else ""), "ok"


def append_record(path: Path, record: dict[str, Any]) -> None:
    if set(record) != ALLOWED_RECORD_KEYS:
        raise ValueError("internal error: attempted to write a non-allowlisted field")
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER,
                        help="source credibility ledger (default: sibling CSV)")
    parser.add_argument("--cache-dir", type=Path,
                        help="existing directory on a separate mounted external volume; never created")
    parser.add_argument("--reuse-csv", type=Path,
                        help="exact source-ID/URL rows with a numeric observed UID; names alone are ignored")
    parser.add_argument("--platform", choices=("both", "bilibili", "acfun"), default="both")
    parser.add_argument("--max-ids", type=int, default=5,
                        help="unique IDs attempted this run; default 5, use 0 explicitly for all pending")
    parser.add_argument("--delay", type=float, default=1.0,
                        help="seconds between requests; must be at least 1")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--retry-network-errors", action="store_true",
                        help="re-attempt IDs whose latest record is a network error or an "
                             "interrupted attempt; challenges and parsed outcomes are never retried")
    parser.add_argument("--dry-run", action="store_true", help="count eligible unique IDs; no writes or requests")
    args = parser.parse_args()

    if args.max_ids < 0:
        parser.error("--max-ids must be nonnegative")
    if args.delay < 1.0:
        parser.error("--delay must be at least 1 second")
    if args.timeout <= 0:
        parser.error("--timeout must be positive")
    if not args.dry_run and not args.cache_dir:
        parser.error("--cache-dir is required unless --dry-run is used")

    ledger = args.ledger.resolve(strict=True)
    queues = load_missing_refs(ledger)
    reuse = load_reuse_csv(args.reuse_csv.resolve(strict=True) if args.reuse_csv else None, queues)
    platforms = ("bilibili", "acfun") if args.platform == "both" else (args.platform,)
    if args.dry_run and not args.cache_dir:
        for platform in platforms:
            seeded = sum((platform, ref["_id"]) in reuse for ref in queues[platform])
            print(f"{platform}: unique_missing_uid_ids={len(queues[platform])} reused_uid_seeds={seeded} remaining={len(queues[platform])-seeded}")
        eligible = sum(len(queues[platform]) - sum((platform, ref["_id"]) in reuse for ref in queues[platform]) for platform in platforms)
        selected_count = eligible if args.max_ids == 0 else min(eligible, args.max_ids)
        print(f"dry_run=true selected_ids={selected_count} requests=0 writes=0")
        return 0

    cache_dir = args.cache_dir.resolve(strict=True)
    mount = mount_for(cache_dir)
    journal_path = cache_dir / "missing-owner-uids.jsonl"
    journal = load_journal(journal_path)

    # Seed exact-ID numeric UID evidence from existing local CSVs. It is
    # checkpointed once so future runs do not request a known submission.
    for key, seed in reuse.items():
        prior = journal.get(key)
        if prior and prior.get("uid"):
            if prior["uid"] != seed["uid"]:
                raise ValueError(f"reuse CSV UID conflicts with cache for {key[0]} {key[1]}")
            continue
        if not args.dry_run:
            append_record(journal_path, seed)
        journal[key] = seed

    pending: list[dict[str, str]] = []
    counts: dict[str, dict[str, int]] = {}
    for platform in platforms:
        todo = [ref for ref in queues[platform]
                if (platform, ref["_id"]) not in journal
                or (args.retry_network_errors and is_retryable(journal[(platform, ref["_id"])]))]
        counts[platform] = {
            "unique_missing_uid_ids": len(queues[platform]),
            "reused_uid_seeds": sum((platform, ref["_id"]) in reuse for ref in queues[platform]),
            "already_checkpointed": len(queues[platform]) - len(todo),
            "pending": len(todo),
        }
        for ref in todo:
            pending.append({**ref, "_platform": platform})
    selected = pending if args.max_ids == 0 else pending[:args.max_ids]

    if args.dry_run:
        for platform, count in counts.items():
            print(f"{platform}: {count}")
        print(f"dry_run=true selected_ids={len(selected)} requests=0 writes=0 mounted_external_volume=true")
        return 0

    if not os.access(cache_dir, os.W_OK):
        parser.error("--cache-dir is not writable")

    print("eligible=" + json.dumps(counts, ensure_ascii=False, sort_keys=True))
    print(f"selected_unique_ids={len(selected)} max_ids={args.max_ids} delay={args.delay:.1f}s")
    # Stop a platform on two consecutive challenges, three consecutive
    # unrecognised bodies, or three consecutive network failures. A stopped
    # platform's remaining IDs stay pending; they are never marked missing.
    streaks: dict[str, Counter] = defaultdict(Counter)
    stopped: dict[str, str] = {}
    limits = {"challenge": 2, "suspect": 3, "network": 3}
    requested = 0
    for ref in selected:
        platform = ref["_platform"]
        if platform in stopped:
            continue
        sid = ref["_id"]
        page_url = ref["_page_url"]
        if requested:
            time.sleep(args.delay)
        # Write an attempt marker first. If interrupted, a later run will not
        # repeat the request unless --retry-network-errors is given.
        attempt = safe_record(platform, sid, page_url, "", "", "attempted")
        append_record(journal_path, attempt)
        lookup = bili_lookup if platform == "bilibili" else acfun_lookup
        result, signal = lookup(sid, page_url, args.timeout)
        requested += 1
        append_record(journal_path, result)
        journal[(platform, sid)] = result
        streak = streaks[platform]
        for kind in limits:
            streak[kind] = streak[kind] + 1 if signal == kind else 0
        print(json.dumps({"platform": platform, "id": sid,
                          "status": result["status"],
                          "http_status": result["http_status"],
                          "field": result["field"],
                          "uid_present": bool(result["uid"])}, ensure_ascii=False))
        for kind, limit in limits.items():
            if streak[kind] >= limit:
                stopped[platform] = f"{limit}_consecutive_{kind}"
                print(f"stopped_platform={platform} reason={stopped[platform]}")
                break
    print("run_summary=" + json.dumps({"requested": requested, "stopped": stopped},
                                      ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as exc:
        print(f"refresh failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
