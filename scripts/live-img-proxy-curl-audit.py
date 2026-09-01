#!/usr/bin/env python3
import json
import os
import subprocess
import tempfile
import time
import urllib.parse

WORKER = 'https://chronicle-66-img-proxy.chronicle66-a7m4.workers.dev'
BILI = 'https://i0.hdslb.com/bfs/archive/7781f3640a2501f777d74ae803d6a8a9d17c9113.jpg'
ACFUN = 'https://tx-free-imgs.acfun.cn/newUpload/4397992_e346220d9277412399cc8c04b8080ffc.jpeg?imageslim'
YOUTUBE = 'https://i.ytimg.com/vi/P1uoFo-mmJw/hqdefault.jpg'
DOUYU = 'https://sta-op.douyucdn.cn/vod-cover/2020/01/04/19e98ad38b584f0968f0bcb1784bae50.jpg'


def bust(raw: str, token: str) -> str:
    u = urllib.parse.urlsplit(raw)
    q = urllib.parse.parse_qsl(u.query, keep_blank_values=True)
    q.append(('archive_proxy_audit', token))
    return urllib.parse.urlunsplit((u.scheme, u.netloc, u.path, urllib.parse.urlencode(q), u.fragment))


def worker_url(source: str) -> str:
    return f"{WORKER}/?url={urllib.parse.quote(source, safe='')}&w=480"


def weserv_url(source: str) -> str:
    return f"https://images.weserv.nl/?url={urllib.parse.quote(source, safe='')}&w=480"


def parse_headers(path: str) -> dict:
    values = {}
    try:
        with open(path, encoding='iso-8859-1') as f:
            for line in f:
                if ':' not in line:
                    continue
                k, v = line.split(':', 1)
                values[k.strip().lower()] = v.strip()
    except FileNotFoundError:
        pass
    return {
        'cacheControl': values.get('cache-control'),
        'age': values.get('age'),
        'cfCacheStatus': values.get('cf-cache-status'),
        'cfRay': values.get('cf-ray'),
    }


def cold_warm(url: str) -> dict:
    with tempfile.TemporaryDirectory() as d:
        b1, b2 = os.path.join(d, 'b1'), os.path.join(d, 'b2')
        h1, h2 = os.path.join(d, 'h1'), os.path.join(d, 'h2')
        fmt1 = 'COLD {"status":%{http_code},"ttfbSec":%{time_starttransfer},"totalSec":%{time_total},"bytes":%{size_download},"contentType":"%{content_type}","httpVersion":"%{http_version}","remoteIp":"%{remote_ip}"}\\n'
        fmt2 = 'WARM {"status":%{http_code},"ttfbSec":%{time_starttransfer},"totalSec":%{time_total},"bytes":%{size_download},"contentType":"%{content_type}","httpVersion":"%{http_version}","remoteIp":"%{remote_ip}"}\\n'
        proc = subprocess.run([
            'curl', '-sS', '-L', '--max-time', '25',
            '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0',
            '-D', h1, '-o', b1, '-w', fmt1, url,
            '--next', '-sS', '-L', '--max-time', '25',
            '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0',
            '-D', h2, '-o', b2, '-w', fmt2, url,
        ], capture_output=True, text=True, check=False)
        out = {'returnCode': proc.returncode, 'stderr': proc.stderr[-300:] if proc.stderr else ''}
        for line in proc.stdout.splitlines():
            if line.startswith('COLD '):
                out['cold'] = {**json.loads(line[5:]), **parse_headers(h1)}
            elif line.startswith('WARM '):
                out['warm'] = {**json.loads(line[5:]), **parse_headers(h2)}
        return out


def one(url: str) -> dict:
    result = cold_warm(url)
    return result.get('cold', result)


def main():
    rounds = []
    for i in range(3):
        stamp = f"20260901-{i}-{time.time_ns()}"
        bili_direct = bust(BILI, 'bd-' + stamp)
        bili_weserv = bust(BILI, 'bw-' + stamp)
        bili_worker = bust(BILI, 'bk-' + stamp)
        acfun_direct = bust(ACFUN, 'ad-' + stamp)
        acfun_worker = bust(ACFUN, 'ak-' + stamp)
        rounds.append({
            'id': stamp,
            'bilibili': {
                'direct': cold_warm(bili_direct),
                'weserv': cold_warm(weserv_url(bili_weserv)),
                'worker': cold_warm(worker_url(bili_worker)),
            },
            'acfun': {
                'direct': cold_warm(acfun_direct),
                'worker': cold_warm(worker_url(acfun_worker)),
            },
        })
    result = {
        'worker': WORKER,
        'root': one(WORKER + '/'),
        'rounds': rounds,
        'rejection': {
            'youtube': one(worker_url(YOUTUBE)),
            'douyu': one(worker_url(DOUYU)),
        },
    }
    print('CURL_LIVE_IMAGE_PROXY_AUDIT=' + json.dumps(result, separators=(',', ':')))


if __name__ == '__main__':
    main()
