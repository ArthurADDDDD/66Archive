"""
画廊「全直播合集」（前台叫「超级大合集」）生成器：档案里每一场直播各取一帧，
再加上视频时代（2014 年及以前）的每一支投稿，按时间拼成按年份切片的长图。

    pip install pillow requests pyyaml
    python scripts/live-wall-build.py collect      # 取帧（可中断，重跑只补缺的）
    python scripts/live-wall-build.py assemble     # 拼图，写 public/gallery/live-wall/
    python scripts/live-wall-build.py append       # 只追加新收录的场次，不重拼已有切片

`append` 是给落盘流水线用的：每次有新直播条目进入档案，就只为它们取帧，追加到当年的
「自动切片」里，已有切片一个字节都不动。补档补进来的旧场次仍需维护者整体重拼。

取帧顺序（每场只取一张，取不到就往下退）：

1. B 站录像的进度条预览图（videoshot）里取中段一帧——这是录像本身的画面，最能说明
   「那天在干什么」。整场一个分 P 时取约 45% 处，躲开开播前的等待画面；按时长切成多 P
   的取中间那一 P 的 30% 处。画面几乎纯色（黑屏、转场）就换一个位置再取。
2. 同一个 BV 装了好几天的录像、链接又没指明第几 P 时，按分 P 标题里的日期挑；
   挑不出来就不猜，换下一个来源。
3. 没有预览图的稿件用该分 P 的首帧（first_frame）。
4. 以上都没有时退到条目封面，清单里标成 `c`，前台注明「录像封面」。
5. 连封面都没有（多是只有开播证据、没有录像的早期场次）就不收进合集。

视频时代的投稿（type: video，日期在 VIDEO_ERA_END 及以前）直接用条目封面——优酷那批
没有进度条预览图，封面就是视频自己的画面。清单里标成 `v`，前台注明「视频」。
2015 年以后的零星投稿不收：那时已经进入直播年代，合集按「每一场直播」来排。

拼图时跳过前台已隐藏（`hidden: true`）的条目；之后才隐藏的由前台按 id 盖掉，
不必为此重新生成。`.local/live-wall-exclude.txt`（每行一个条目 id，可选、不进版本库）
里列出的条目同样跳过。

取帧缓存默认放在 `.local/live-wall-cache/`，不进版本库。
"""
import argparse, hashlib, io, json, os, random, re, sys, threading, time
from concurrent.futures import ThreadPoolExecutor

import requests, yaml
from PIL import Image, ImageStat

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_DIR = os.path.join(ROOT, 'public', 'gallery', 'live-wall')
PUBLIC_PREFIX = '/gallery/live-wall/'

COLS = 10
# 每张切片出两档：清晰档（大格子用，240×135）只出 AVIF；轻量档（手机与小格子，128×72）
# 出 AVIF 与 WebP 两份。不认 AVIF 的浏览器一律用轻量 WebP——这一页是「图一乐」，
# 不值得为少数旧浏览器再存一份最重的清晰 WebP。
TILE_W, TILE_H = 240, 135
LITE_W, LITE_H = 128, 72
AVIF_QUALITY = 45
WEBP_QUALITY = 70
ROWS_PER_SLICE = 12
# 自动追加的切片每张最多这么多格（3 行）。越小，每次追加重编码写进仓库的字节越少。
AUTO_SLICE_TILES = 30
# 自动切片的逐格底图。不在 public/ 下，不进网站产物。
FRAMES_DIR = os.path.join(ROOT, 'data', 'assets', 'live-wall-frames')

UA = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    'Referer': 'https://www.bilibili.com/',
}


# ---------------------------------------------------------------- 数据

# 视频时代的终点，与前台 chronicle-eras.ts 的 video 段（到 2014 年）一致。
VIDEO_ERA_END = '2014-12-31'


def is_wall_entry(entry):
    if entry.get('type') == 'live':
        return True
    return entry.get('type') == 'video' and str(entry.get('date')) <= VIDEO_ERA_END


def load_live_entries():
    """合集收录的条目：全部直播，加上视频时代的投稿。"""
    entries = []
    folder = os.path.join(ROOT, 'data', 'entries')
    for name in sorted(os.listdir(folder)):
        if not name.endswith(('.yaml', '.yml')):
            continue
        for entry in yaml.safe_load(open(os.path.join(folder, name), encoding='utf8')) or []:
            if is_wall_entry(entry):
                entries.append(entry)
    entries.sort(key=lambda e: (str(e['date']), str(e.get('time') or ''), e['id']))
    return entries


def load_excludes():
    path = os.path.join(ROOT, '.local', 'live-wall-exclude.txt')
    if not os.path.exists(path):
        return set()
    return {line.split('#', 1)[0].strip() for line in open(path, encoding='utf8')} - {''}


# ---------------------------------------------------------------- 取帧

class Fetcher:
    def __init__(self, cache):
        self.api_dir = os.path.join(cache, 'apicache')
        os.makedirs(self.api_dir, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update(UA)

    def json(self, url, key):
        path = os.path.join(self.api_dir, key + '.json')
        if os.path.exists(path):
            return json.load(open(path, encoding='utf8'))
        for attempt in range(5):
            try:
                time.sleep(0.25 + random.random() * 0.3)
                data = self.session.get(url, timeout=20).json()
                if data.get('code') in (-412, -352):  # 风控：放慢再试
                    time.sleep(20 * (attempt + 1))
                    continue
                json.dump(data, open(path, 'w', encoding='utf8'), ensure_ascii=False)
                return data
            except Exception:
                time.sleep(3 * (attempt + 1))
        return None

    def image(self, url):
        if url.startswith('//'):
            url = 'https:' + url
        url = url.replace('http://', 'https://')
        for attempt in range(4):
            try:
                response = self.session.get(url, timeout=30)
                if response.status_code == 200:
                    return Image.open(io.BytesIO(response.content)).convert('RGB')
            except Exception:
                pass
            time.sleep(2 * (attempt + 1))
        return None


def date_patterns(date):
    y, m, d = (int(x) for x in str(date).split('-'))
    tokens = [f'{m}.{d}', f'{m:02d}.{d:02d}', f'{m:02d}{d:02d}', f'{m}月{d}日', f'{y}{m:02d}{d:02d}', f'{m}-{d}', f'{m:02d}-{d:02d}']
    return [re.compile(r'(?<!\d)' + re.escape(t) + r'(?!\d)') for t in tokens]


def is_flat(img):
    stat = ImageStat.Stat(img.convert('L'))
    return stat.stddev[0] < 14 or stat.mean[0] < 18


def bili_candidates(entry):
    out = []
    for source in entry.get('sources') or []:
        if source.get('status') == 'dead':
            continue
        bv = re.search(r'bilibili\.com/video/(BV\w+)', source['url'])
        if not bv:
            continue
        page = re.search(r'[?&]p=(\d+)', source['url'])
        out.append((0 if page else 1, bv.group(1), int(page.group(1)) if page else None))
    return [(bv, page) for _, bv, page in sorted(out, key=lambda c: c[0])]


def frame_from_bili(fetch, entry, shared_bvs):
    for bvid, page in bili_candidates(entry):
        pagelist = fetch.json(f'https://api.bilibili.com/x/player/pagelist?bvid={bvid}', f'pl_{bvid}')
        if not pagelist or pagelist.get('code') != 0 or not pagelist.get('data'):
            continue
        pages = pagelist['data']
        chosen = next((p for p in pages if p['page'] == page), None) if page else None
        if chosen is None and len(pages) > 1 and bvid in shared_bvs:
            patterns = date_patterns(entry['date'])
            hits = [p for p in pages if any(pt.search(p.get('part') or '') for pt in patterns)]
            if not hits:
                continue
            chosen = hits[len(hits) // 2]
        if chosen is None:
            chosen = pages[len(pages) // 2] if len(pages) > 2 else pages[0]

        tile = storyboard_frame(fetch, bvid, chosen['cid'], split=len(pages) > 2 and not page)
        if tile is not None:
            return tile, {'kind': 'frame', 'bvid': bvid, 'page': chosen['page']}
        if chosen.get('first_frame'):
            img = fetch.image(chosen['first_frame'])
            if img is not None and not is_flat(img):
                return crop_16x9(img), {'kind': 'frame', 'bvid': bvid, 'page': chosen['page'], 'first_frame': True}
    return None, None


def storyboard_frame(fetch, bvid, cid, split):
    shot = fetch.json(f'https://api.bilibili.com/x/player/videoshot?bvid={bvid}&cid={cid}&index=1', f'vs_{bvid}_{cid}')
    if not shot or shot.get('code') != 0:
        return None
    data = shot['data']
    sheets_urls = data.get('image') or []
    if not sheets_urls:
        return None
    x_len, y_len = data['img_x_len'], data['img_y_len']
    per_sheet = x_len * y_len
    index = data.get('index') or []
    total = min(len(index) - 1 if len(index) > 1 else per_sheet * len(sheets_urls), per_sheet * len(sheets_urls))
    if total <= 0:
        return None
    base = 0.3 if split else 0.45
    sheets = {}
    for fraction in (base, base + 0.12, base - 0.12, base + 0.25, 0.8):
        n = max(0, min(total - 1, int(total * fraction)))
        sheet_no, k = divmod(n, per_sheet)
        if sheet_no >= len(sheets_urls):
            continue
        if sheet_no not in sheets:
            sheets[sheet_no] = fetch.image(sheets_urls[sheet_no])
        sheet = sheets[sheet_no]
        if sheet is None:
            continue
        # 预览图的实际尺寸不一定等于接口声明的格子尺寸，按图宽反推
        w = sheet.width // x_len
        h = w * data['img_y_size'] // data['img_x_size']
        row, col = divmod(k, x_len)
        if (row + 1) * h > sheet.height:
            continue
        tile = sheet.crop((col * w, row * h, col * w + w, row * h + h))
        if not is_flat(tile):
            return tile
    return None


def crop_16x9(img):
    w, h = img.size
    cw, ch = (w, w * 9 // 16) if w * 9 // 16 <= h else (h * 16 // 9, h)
    left, top = (w - cw) // 2, (h - ch) // 2
    return img.crop((left, top, left + cw, top + ch))


def frame_from_cover(fetch, entry):
    url = entry.get('cover')
    if not url:
        return None, None
    if url.startswith('/'):
        path = os.path.join(ROOT, 'public', url.lstrip('/'))
        img = Image.open(path).convert('RGB') if os.path.exists(path) else None
    else:
        sized = url + '@480w_270h_1c.jpg' if 'hdslb.com' in url and '@' not in url else url
        img = fetch.image(sized) or (fetch.image(url) if sized != url else None)
    if img is None:
        return None, None
    return crop_16x9(img), {'kind': 'cover'}


def collect(cache, retry_kinds):
    frames_dir = os.path.join(cache, 'frames')
    os.makedirs(frames_dir, exist_ok=True)
    results_path = os.path.join(cache, 'results.json')
    results = json.load(open(results_path, encoding='utf8')) if os.path.exists(results_path) else {}
    seeded = seed_cache_from_manifest(results, frames_dir)
    if seeded:
        print(f'从现有合集补进缓存 {seeded} 格（自动追加的格子或本机缓存缺失的格子）', flush=True)
    entries = load_live_entries()
    excludes = load_excludes()

    counts = {}
    for entry in entries:
        for bv in {m for s in entry.get('sources') or [] for m in re.findall(r'(BV\w+)', s['url'])}:
            counts[bv] = counts.get(bv, 0) + 1
    shared = {bv for bv, n in counts.items() if n > 1}

    todo = [e for e in entries if e['id'] not in excludes
            and (e['id'] not in results or results[e['id']]['kind'] in retry_kinds)]
    print(f'{len(entries)} entries (live + video era), {len(todo)} to fetch', flush=True)
    fetch = Fetcher(cache)
    lock = threading.Lock()
    done = [0]

    def work(entry):
        try:
            # 视频时代的投稿直接取封面：见文件头第 5 条之后的说明
            tile, meta = (None, None) if entry.get('type') == 'video' else frame_from_bili(fetch, entry, shared)
            if tile is None:
                tile, meta = frame_from_cover(fetch, entry)
        except Exception as error:  # 单条失败不拖垮整批，下次 --retry error 重来
            tile, meta = None, {'kind': 'error', 'error': str(error)[:200]}
        if tile is not None:
            if tile.width > 480:
                tile = tile.resize((480, 270), Image.LANCZOS)
            tile.save(os.path.join(frames_dir, entry['id'] + '.jpg'), quality=88)
        with lock:
            previous = results.get(entry['id'])
            # 重试没取到更好的，就保留上一次的结果（及其帧文件）
            if meta is None and previous is not None:
                meta = previous
            results[entry['id']] = meta or {'kind': 'none'}
            done[0] += 1
            if done[0] % 25 == 0:
                json.dump(results, open(results_path, 'w', encoding='utf8'), ensure_ascii=False)
                print(done[0], entry['id'], results[entry['id']]['kind'], flush=True)

    with ThreadPoolExecutor(4) as pool:
        list(pool.map(work, todo))
    json.dump(results, open(results_path, 'w', encoding='utf8'), ensure_ascii=False)
    summary = {}
    for meta in results.values():
        summary[meta['kind']] = summary.get(meta['kind'], 0) + 1
    print(summary)


# ---------------------------------------------------------------- 拼图

def write_slice(images, year, part):
    """把一串 240×135 的格子拼成一张切片，写出清晰 AVIF、轻量 AVIF、轻量 WebP 三份。"""
    count = len(images)
    rows = -(-count // COLS)
    sheet = Image.new('RGB', (COLS * TILE_W, rows * TILE_H), (20, 21, 26))
    for offset, img in enumerate(images):
        row, col = divmod(offset, COLS)
        sheet.paste(img, (col * TILE_W, row * TILE_H))
    lite = sheet.resize((COLS * LITE_W, rows * LITE_H), Image.LANCZOS)

    def write(image, fmt, tier):
        buffer = io.BytesIO()
        if fmt == 'avif':
            image.save(buffer, 'AVIF', quality=AVIF_QUALITY, speed=4)
        else:
            image.save(buffer, 'WEBP', quality=WEBP_QUALITY, method=6)
        digest = hashlib.sha256(buffer.getvalue()).hexdigest()[:10]
        name = f'{year}-{part}.{tier}.{digest}.{fmt}'
        open(os.path.join(OUT_DIR, name), 'wb').write(buffer.getvalue())
        return PUBLIC_PREFIX + name

    os.makedirs(OUT_DIR, exist_ok=True)
    return {'hd': write(sheet, 'avif', 'hd'), 'lite': write(lite, 'avif', 'lite'), 'liteWebp': write(lite, 'webp', 'lite')}


def write_manifest(manifest):
    text = json.dumps(manifest, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(OUT_DIR, 'index.json'), 'w', encoding='utf8', newline='\n').write(text + '\n')


def read_manifest():
    path = os.path.join(OUT_DIR, 'index.json')
    return json.load(open(path, encoding='utf8')) if os.path.exists(path) else None


def crop_from_slice(slice_, offset):
    """从已发布的清晰切片里切回一格。只在没有底图时兜底用：切片本身是有损压缩过的。"""
    path = os.path.join(ROOT, 'public', slice_['hd'].lstrip('/'))
    if not os.path.exists(path):
        return None
    sheet = Image.open(path).convert('RGB')
    row, col = divmod(offset, COLS)
    return sheet.crop((col * TILE_W, row * TILE_H, col * TILE_W + TILE_W, row * TILE_H + TILE_H))


def seed_cache_from_manifest(results, frames_dir):
    """
    本机缓存里没有、但合集里已经有的格子（多半是自动追加进来的），先从仓库里补进缓存：
    有逐格底图就用底图，否则从已发布的切片里切回来。这样 assemble 整体重拼时不会因为
    「还没取帧」卡住，也不会把自动追加的格子弄丢。
    """
    manifest = read_manifest()
    if not manifest:
        return 0
    seeded = 0
    for slice_ in manifest['slices']:
        for offset in range(slice_['count']):
            tile = manifest['tiles'][slice_['first'] + offset]
            entry_id = tile[0]
            if entry_id in results:
                continue
            frame_path = os.path.join(FRAMES_DIR, entry_id + '.jpg')
            img = Image.open(frame_path).convert('RGB') if os.path.exists(frame_path) else crop_from_slice(slice_, offset)
            if img is None:
                continue
            img.save(os.path.join(frames_dir, entry_id + '.jpg'), quality=92)
            results[entry_id] = {'kind': 'frame' if tile[3] == 'f' else 'cover', 'seeded': True}
            seeded += 1
    return seeded


# ---------------------------------------------------------------- 自动追加

def append(cache, only_ids):
    """
    新录像收录后，把新场次追加进合集，不动任何已有切片。

    只追加日期不早于合集最后一格的场次（新录像总是最新的）；补档补进来的旧场次会打乱
    年份内的时间顺序，留给维护者整体重拼（collect + assemble）。

    追加的格子放在「自动切片」里（清单里带 `auto: true`，每张最多 AUTO_SLICE_TILES 格）。
    自动切片每次追加都从逐格底图重新编码，底图存在 data/assets/live-wall-frames/（不进网站产物），
    所以不会一次次重压而越来越糊；一张自动切片满了就封口，它的底图随即删掉，
    仓库里永远只留最后一张未满切片的那几十张小图。
    """
    manifest = read_manifest()
    if not manifest or not manifest.get('tiles'):
        sys.exit('还没有合集清单，先跑 collect + assemble 生成一次')
    tiles, slices = manifest['tiles'], manifest['slices']
    have = {tile[0] for tile in tiles}
    last_date = tiles[-1][1]
    excludes = load_excludes()
    entries = [e for e in load_live_entries() if e['id'] not in excludes and not e.get('hidden')]
    pending = [e for e in entries if e['id'] not in have and (not only_ids or e['id'] in only_ids)]
    fresh = [e for e in pending if str(e['date']) >= last_date]
    older = [e['id'] for e in pending if str(e['date']) < last_date]
    if older:
        # 其中多数是取不到画面、整体重拼时本就不收的早期场次；这里只报个数，不逐条刷屏。
        print(f'有 {len(older)} 场早于合集最后一格（{last_date}）且不在合集里，自动追加不处理，例如 {older[-3:]}', flush=True)
    if not fresh:
        print('没有需要追加的新场次')
        return []

    counts = {}
    for entry in load_live_entries():
        for bv in {m for s in entry.get('sources') or [] for m in re.findall(r'(BV\w+)', s['url'])}:
            counts[bv] = counts.get(bv, 0) + 1
    shared = {bv for bv, n in counts.items() if n > 1}
    fetch = Fetcher(cache)
    os.makedirs(FRAMES_DIR, exist_ok=True)

    added = []
    for entry in fresh:
        try:
            tile, meta = (None, None) if entry.get('type') == 'video' else frame_from_bili(fetch, entry, shared)
            if tile is None:
                tile, meta = frame_from_cover(fetch, entry)
        except Exception as error:  # 取不到就这次不加，下次落盘再试
            print(f'{entry["id"]}：取帧失败 {str(error)[:120]}', flush=True)
            continue
        if tile is None:
            print(f'{entry["id"]}：没有可用画面，暂不收录', flush=True)
            continue
        tile.convert('RGB').resize((TILE_W, TILE_H), Image.LANCZOS).save(
            os.path.join(FRAMES_DIR, entry['id'] + '.jpg'), quality=92)
        kind = 'v' if entry.get('type') == 'video' else 'f' if meta['kind'] == 'frame' else 'c'
        added.append([entry['id'], str(entry['date']), entry['title'], kind])
    if not added:
        return []

    dirty = []
    for tile in added:
        year = tile[1][:4]
        last = slices[-1] if slices else None
        open_slice = (last and last.get('auto') and last['year'] == year and last['count'] < AUTO_SLICE_TILES
                      and last['first'] + last['count'] == len(tiles))
        if not open_slice:
            last = {'year': year, 'hd': '', 'lite': '', 'liteWebp': '', 'first': len(tiles), 'count': 0, 'auto': True}
            slices.append(last)
        tiles.append(tile)
        last['count'] += 1
        if not any(item is last for item in dirty):
            dirty.append(last)

    for slice_ in dirty:
        images = []
        for offset in range(slice_['count']):
            entry_id = tiles[slice_['first'] + offset][0]
            path = os.path.join(FRAMES_DIR, entry_id + '.jpg')
            img = Image.open(path).convert('RGB') if os.path.exists(path) else (crop_from_slice(slice_, offset) if slice_['hd'] else None)
            images.append((img or Image.new('RGB', (TILE_W, TILE_H), (20, 21, 26))).resize((TILE_W, TILE_H), Image.LANCZOS))
        for tier in ('hd', 'lite', 'liteWebp'):
            old = slice_[tier]
            if old and os.path.exists(os.path.join(ROOT, 'public', old.lstrip('/'))):
                os.remove(os.path.join(ROOT, 'public', old.lstrip('/')))
        part = sum(1 for s in slices if s['year'] == slice_['year'] and s is not slice_ and s['first'] < slice_['first'])
        slice_.update(write_slice(images, slice_['year'], part))

    # 只有最后一张未满的自动切片还需要底图；其余的（已封口或已整体重拼的）删掉。
    keep = set()
    last = slices[-1]
    if last.get('auto') and last['count'] < AUTO_SLICE_TILES:
        keep = {tiles[last['first'] + offset][0] for offset in range(last['count'])}
    for name in os.listdir(FRAMES_DIR):
        if name[:-4] not in keep:
            os.remove(os.path.join(FRAMES_DIR, name))

    write_manifest(manifest)
    print(f'追加 {len(added)} 格：{", ".join(tile[0] for tile in added)}；合集共 {len(tiles)} 格')
    return added


def assemble(cache):
    results = json.load(open(os.path.join(cache, 'results.json'), encoding='utf8'))
    frames_dir = os.path.join(cache, 'frames')
    excludes = load_excludes()
    entries = [e for e in load_live_entries() if e['id'] not in excludes and not e.get('hidden')]
    missing = [e['id'] for e in entries if e['id'] not in results]
    if missing:
        sys.exit(f'{len(missing)} 场还没取帧（先跑 collect），例如 {missing[:3]}')

    tiles, images = [], []
    for entry in entries:
        meta = results[entry['id']]
        path = os.path.join(frames_dir, entry['id'] + '.jpg')
        if meta['kind'] not in ('frame', 'cover') or not os.path.exists(path):
            continue  # 没有画面的场次不收：合集只放真的截到或找到的图
        img = Image.open(path).convert('RGB').resize((TILE_W, TILE_H), Image.LANCZOS)
        kind = 'v' if entry.get('type') == 'video' else 'f' if meta['kind'] == 'frame' else 'c'
        tiles.append([entry['id'], str(entry['date']), entry['title'], kind])
        images.append(img)

    os.makedirs(OUT_DIR, exist_ok=True)
    for name in os.listdir(OUT_DIR):
        if name.endswith(('.webp', '.avif')):
            os.remove(os.path.join(OUT_DIR, name))

    slices, start = [], 0
    while start < len(tiles):
        year = tiles[start][1][:4]
        end = start
        while end < len(tiles) and tiles[end][1][:4] == year and end - start < COLS * ROWS_PER_SLICE:
            end += 1
        part = sum(1 for s in slices if s['year'] == year)
        files = write_slice(images[start:end], year, part)
        slices.append({'year': year, **files, 'first': start, 'count': end - start})
        start = end

    write_manifest({'version': 2, 'cols': COLS, 'slices': slices, 'tiles': tiles})
    # 整体重拼之后所有切片都是从缓存完整生成的，自动追加留下的逐格底图不再需要。
    if os.path.isdir(FRAMES_DIR):
        for name in os.listdir(FRAMES_DIR):
            os.remove(os.path.join(FRAMES_DIR, name))
    kinds = {}
    for tile in tiles:
        kinds[tile[3]] = kinds.get(tile[3], 0) + 1
    size = sum(os.path.getsize(os.path.join(OUT_DIR, n)) for n in os.listdir(OUT_DIR))
    print(f'{len(tiles)} tiles in {len(slices)} slices, {size / 1e6:.1f} MB, kinds {kinds}')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('command', choices=['collect', 'assemble', 'append'])
    parser.add_argument('--cache', default=os.path.join(ROOT, '.local', 'live-wall-cache'))
    parser.add_argument('--retry', nargs='*', default=[], help='collect 时重取这些结果类型，如 cover none error')
    parser.add_argument('--ids', nargs='*', default=[], help='append 时只追加这些条目（默认追加所有尚未收录的新场次）')
    args = parser.parse_args()
    if args.command == 'collect':
        collect(args.cache, set(args.retry))
    elif args.command == 'append':
        append(args.cache, set(args.ids))
    else:
        assemble(args.cache)


if __name__ == '__main__':
    main()
