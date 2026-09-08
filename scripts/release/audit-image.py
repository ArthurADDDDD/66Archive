"""Verify every OCI layer, including hidden files, before publishing a shadow artifact."""
import hashlib
import io
import json
import re
import sys
import tarfile
from pathlib import PurePosixPath, Path


def audit(filename, public_sha, baked_content=None):
    assert re.fullmatch(r'[0-9a-f]{40}', public_sha), 'Invalid public SHA'
    files = {}
    with tarfile.open(filename) as archive:
        def read(name):
            return archive.extractfile(name).read()

        def blob(descriptor):
            algorithm, digest = descriptor['digest'].split(':')
            assert algorithm == 'sha256'
            raw = read(f'blobs/sha256/{digest}')
            assert len(raw) == descriptor['size']
            assert hashlib.sha256(raw).hexdigest() == digest, 'OCI blob digest mismatch'
            return raw

        index = json.loads(read('index.json'))
        assert len(index['manifests']) == 1, 'Expected one image, no attestations'
        descriptor = index['manifests'][0]
        manifest = json.loads(blob(descriptor))
        config = json.loads(blob(manifest['config']))
        assert config['os'] == 'linux' and config['architecture'] == 'amd64'
        environment = config.get('config', {}).get('Env') or []
        default_path = ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin']
        assert environment in ([], default_path), 'Unexpected image environment'
        diff_ids = []
        for layer in manifest['layers']:
            raw = blob(layer)
            import gzip
            if layer['mediaType'].endswith('+gzip'):
                raw = gzip.decompress(raw)
            diff_ids.append('sha256:' + hashlib.sha256(raw).hexdigest())
            with tarfile.open(fileobj=io.BytesIO(raw)) as contents:
                for member in contents:
                    name = member.name.removeprefix('./').rstrip('/')
                    path = PurePosixPath(name)
                    assert name and not path.is_absolute() and '..' not in path.parts
                    assert path.parts[0] in ('site', 'snapshot'), f'Unexpected root: {name}'
                    assert not any(p.startswith('.') for p in path.parts), f'Hidden file: {name}'
                    assert member.isdir() or member.isfile(), f'Link or special file: {name}'
                    if member.isfile():
                        assert not name.endswith(('.map', '.pem', '.key')), f'Forbidden file: {name}'
                        if path.parts[0] == 'snapshot':
                            allowed = {'snapshot/dataset-snapshot.json', 'snapshot/dataset-snapshot.json.sha256'}
                            if baked_content is not None:
                                allowed.add('snapshot/baked-content.json')
                            assert name in allowed
                        files[name] = contents.extractfile(member).read()
        assert config['rootfs']['diff_ids'] == diff_ids
    if baked_content is not None:
        assert files['snapshot/baked-content.json'] == baked_content, 'Image baked input differs from build input'
    assert 'site/index.html' in files
    snapshot_raw = files['snapshot/dataset-snapshot.json']
    snapshot_hash = hashlib.sha256(snapshot_raw).hexdigest()
    assert files['snapshot/dataset-snapshot.json.sha256'].decode().strip() == snapshot_hash
    snapshot = json.loads(snapshot_raw)
    assert snapshot['version'] == 1
    assert set(snapshot['source']) == {'commit', 'generatedAt'}
    assert snapshot['source']['commit'] == public_sha
    return {'publicSha': public_sha, 'digest': descriptor['digest'], 'snapshotSha256': snapshot_hash,
            'files': len(files), 'roots': ['site', 'snapshot']}


if __name__ == '__main__':
    result = audit(sys.argv[1], sys.argv[2])
    Path(sys.argv[3]).write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
