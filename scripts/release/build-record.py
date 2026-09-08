"""Create a public release record only after auditing the exact OCI archive."""
import argparse
import hashlib
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('image_audit', Path(__file__).with_name('audit-image.py'))
image_audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(image_audit)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()


def record(directory, repository, public_sha, run_id, attempt, image_repository, origin):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid repository')
    if not re.fullmatch(r'[0-9a-f]{40}', public_sha) or run_id < 1 or attempt < 1:
        raise ValueError('Invalid build identity')
    expected_image = f'ghcr.io/{repository.split("/")[0].lower()}/66archive-web-releases'
    if image_repository != expected_image:
        raise ValueError('Unexpected image repository')
    directory = Path(directory)
    baked_raw = (directory / 'baked-content.json').read_bytes()
    baked = json.loads(baked_raw)
    if baked.get('version') != 1 or baked.get('origin') != origin:
        raise ValueError('Frozen input origin or version mismatch')
    revisions = {}
    for key in ('narrative', 'copy', 'editorial'):
        value = baked['documents'][key]['revision']
        if type(value) is not int or value < 1:
            raise ValueError('Invalid content revision')
        revisions[key] = value
    report = image_audit.audit(directory / '66archive-web.tar', public_sha, baked_raw)
    snapshot_hash = digest((directory / 'dataset-snapshot.json').read_bytes())
    if snapshot_hash != report['snapshotSha256']:
        raise ValueError('Standalone snapshot differs from image snapshot')
    baked_hash = digest(baked_raw)
    if (directory / 'baked-content.json.sha256').read_text().strip() != baked_hash:
        raise ValueError('Frozen input changed since capture')
    inputs = {
        'publicSha': public_sha, 'snapshotSha256': snapshot_hash,
        'bakedContentSha256': baked_hash, 'siteOrigin': origin,
        'lockfileSha256': digest(Path('package-lock.json').read_bytes()), 'recipeVersion': 2,
    }
    return {
        'version': 2, 'releaseId': f'web-v2-{run_id}-{attempt}',
        'inputs': inputs, 'inputIdentity': digest(canonical(inputs)), 'bakedRevisions': revisions,
        'image': {'repository': image_repository, 'digest': report['digest'], 'platform': 'linux/amd64'},
        'build': {'repository': repository, 'workflow': '.github/workflows/release-web.yml',
                  'sourceRef': 'refs/heads/main', 'sourceSha': public_sha,
                  'runId': run_id, 'runAttempt': attempt},
        'archiveSha256': digest((directory / '66archive-web.tar').read_bytes()),
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', default='.local/release')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    result = record(args.directory, os.environ['GITHUB_REPOSITORY'], os.environ['GITHUB_SHA'],
                    int(os.environ['GITHUB_RUN_ID']), int(os.environ['GITHUB_RUN_ATTEMPT']),
                    os.environ['WEB_IMAGE_REPOSITORY'], os.environ['SITE_ORIGIN'].rstrip('/'))
    destination = Path(args.directory) / 'release.json'
    raw = canonical(result)
    if args.verify:
        if destination.read_bytes() != raw:
            raise ValueError('Release record differs from independently audited artifacts')
    else:
        destination.write_bytes(raw)
    with open(os.environ.get('GITHUB_OUTPUT', os.devnull), 'a') as output:
        output.write(f'release_id={result["releaseId"]}\nimage_digest={result["image"]["digest"]}\n')
    print(json.dumps(result))
