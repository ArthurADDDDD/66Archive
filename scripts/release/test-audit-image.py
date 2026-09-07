import hashlib
import importlib.util
import io
import json
import tarfile
import tempfile
import sys
sys.dont_write_bytecode = True
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('audit-image.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
SHA = 'a' * 40


def tar_bytes(items):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w') as archive:
        for name, raw in items.items():
            info = tarfile.TarInfo(name)
            if raw is None:
                info.type = tarfile.SYMTYPE
                info.linkname = '/outside'
                archive.addfile(info)
            else:
                info.size = len(raw)
                archive.addfile(info, io.BytesIO(raw))
    return output.getvalue()


def image(extra=None, source=None, environment=None):
    raw = json.dumps({'version': 1, 'source': source or {'commit': SHA, 'generatedAt': '2026-01-01T00:00:00.000Z'}}).encode()
    files = {'site/index.html': b'<html/>', 'snapshot/dataset-snapshot.json': raw,
             'snapshot/dataset-snapshot.json.sha256': hashlib.sha256(raw).hexdigest().encode()}
    files.update(extra or {})
    layer = tar_bytes(files)
    blobs = {}
    def blob(raw, media_type):
        digest = hashlib.sha256(raw).hexdigest()
        blobs[f'blobs/sha256/{digest}'] = raw
        return {'digest': f'sha256:{digest}', 'size': len(raw), 'mediaType': media_type}
    config = blob(json.dumps({'os': 'linux', 'architecture': 'amd64', 'config': {'Env': environment or []}, 'rootfs': {'diff_ids': ['sha256:' + hashlib.sha256(layer).hexdigest()]}}).encode(), 'application/vnd.oci.image.config.v1+json')
    manifest = blob(json.dumps({'config': config, 'layers': [blob(layer, 'application/vnd.oci.image.layer.v1.tar')]}).encode(), 'application/vnd.oci.image.manifest.v1+json')
    blobs['index.json'] = json.dumps({'manifests': [manifest]}).encode()
    return tar_bytes(blobs)


class AuditTests(unittest.TestCase):
    def check(self, raw):
        with tempfile.TemporaryDirectory() as tmp:
            filename = Path(tmp) / 'image.tar'
            filename.write_bytes(raw)
            return audit.audit(filename, SHA)

    def test_valid(self):
        self.assertEqual(self.check(image())['files'], 3)

    def test_environment_allowlist(self):
        default = ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin']
        self.assertEqual(self.check(image(environment=default))['files'], 3)
        with self.assertRaises(AssertionError):
            self.check(image(environment=default + ['UNEXPECTED=value']))

    def test_forbidden_files_and_links(self):
        for name, raw in [('other/file', b'x'), ('site/.env', b'x'), ('site/link', None),
                          ('site/../escape', b'x'), ('site/source.map', b'x'),
                          ('snapshot/extra.json', b'x')]:
            with self.subTest(name=name), self.assertRaises(AssertionError):
                self.check(image({name: raw}))

    def test_snapshot_source_and_hash(self):
        for raw in [image(source={'commit': SHA, 'generatedAt': '', 'repositoryPath': 'local'}),
                    image(source={'commit': 'b' * 40, 'generatedAt': ''}),
                    image({'snapshot/dataset-snapshot.json.sha256': b'wrong'})]:
            with self.assertRaises(AssertionError):
                self.check(raw)


if __name__ == '__main__':
    unittest.main()
