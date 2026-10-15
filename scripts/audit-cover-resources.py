"""Check exported cover markup and local image candidates without network access."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


COVER = re.compile(r'^/(?:images/covers/[^/]+\.jpg|gallery/anniv_[^/]+\.(?:jpg|png)|gallery/photos/[^/]+\.thumb\.jpg)$', re.I)


class Covers(HTMLParser):
    def __init__(self):
        super().__init__()
        self.picture = None
        self.images = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'picture':
            self.picture = []
        elif tag == 'source' and self.picture is not None:
            self.picture.append(attrs)
        elif tag == 'img':
            src = urlsplit(attrs.get('src', ''))
            if not src.scheme and not src.netloc and COVER.fullmatch(src.path):
                self.images.append((attrs, list(self.picture or [])))

    def handle_endtag(self, tag):
        if tag == 'picture':
            self.picture = None


def audit(root):
    issues = []
    pages = {}
    files = sorted(root.rglob('*.html'))
    if not files:
        issues.append('No exported HTML found; build the site first.')
    for page in files:
        parser = Covers()
        parser.feed(page.read_text())
        if not parser.images:
            continue
        originals, small, large = {}, {}, {}
        full_size = 0
        route = page.relative_to(root).as_posix()
        for attrs, sources in parser.images:
            src = attrs['src']
            original = root / unquote(urlsplit(src).path).lstrip('/')
            if original.is_file():
                originals[src] = original.stat().st_size
            if attrs.get('data-cover-original') == 'full-size':
                full_size += 1
                continue
            supported = {item.get('type'): item for item in sources}
            if not all(kind in supported for kind in ('image/avif', 'image/webp')):
                issues.append(f'{route}: original-only cover {src}')
                continue
            for kind in ('image/avif', 'image/webp'):
                source = supported[kind]
                if re.search(r'\s[1-9]\d*w(?:,|$)', source.get('srcset', '')) and not source.get('sizes'):
                    issues.append(f'{route}: missing sizes for {src}')
                candidates = source.get('srcset', '').split(',')
                for candidate in candidates:
                    parts = candidate.strip().split()
                    if not parts or len(parts) > 2 or (len(parts) == 2 and not re.fullmatch(r'[1-9]\d*w', parts[1])):
                        issues.append(f'{route}: invalid candidate {candidate}')
                        continue
                    url = parts[0]
                    width = parts[1] if len(parts) == 2 else '720w'
                    parsed = urlsplit(url)
                    path = root / unquote(parsed.path).lstrip('/')
                    if parsed.netloc or not path.resolve().is_relative_to(root.resolve()) or not path.is_file():
                        issues.append(f'{route}: missing local candidate {url}')
                        continue
                    if kind == 'image/avif':
                        (small if width == '360w' else large)[url] = path.stat().st_size
        pages[route] = {
            'covers': len(parser.images),
            'full_size_covers': full_size,
            'original_bytes': sum(originals.values()),
            'avif_360_bytes': sum(small.values()),
            'avif_720_bytes': sum(large.values()),
        }
    return {'html_pages': len(files), 'cover_pages': len(pages), 'issues': issues, 'pages': pages}


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('root', nargs='?', default='out')
    cli.add_argument('--report-only', action='store_true')
    cli.add_argument('--json', action='store_true')
    args = cli.parse_args()
    result = audit(Path(args.root))
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Checked {result['html_pages']} HTML pages; {result['cover_pages']} contain local covers.")
        for issue in result['issues'][:30]:
            print(issue)
        print(f"Cover resource issues: {len(result['issues'])}")
    raise SystemExit(1 if result['issues'] and not args.report_only else 0)
