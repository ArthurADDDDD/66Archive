import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True

def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

builder = load('record_builder', 'build-record.py')
fixtures = load('image_fixtures', 'test-audit-image.py')


class RecordTests(unittest.TestCase):
    def test_identity_and_tamper_binding(self):
        cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as tmp:
            try:
                os.chdir(tmp)
                root = Path(tmp)
                (root / 'package-lock.json').write_text('{}')
                baked = {'version': 1, 'origin': 'https://example.com', 'documents': {k: {'revision': 1} for k in ('narrative', 'copy', 'editorial')}}
                raw = builder.canonical(baked)
                (root / 'baked-content.json').write_bytes(raw)
                (root / 'baked-content.json.sha256').write_text(builder.digest(raw))
                source = {'commit': fixtures.SHA, 'generatedAt': '2026-01-01T00:00:00.000Z'}
                snapshot = json.dumps({'version': 1, 'source': source}).encode()
                (root / 'dataset-snapshot.json').write_bytes(snapshot)
                (root / '66archive-web.tar').write_bytes(fixtures.image({'snapshot/baked-content.json': raw}, source=source))
                def make(run=1):
                    return builder.record(root, 'example/public', fixtures.SHA, run, 1, 'ghcr.io/example/66archive-web-releases', baked['origin'])
                first, second = make(1), make(2)
                self.assertNotEqual(first['releaseId'], second['releaseId'])
                self.assertEqual(first['inputIdentity'], second['inputIdentity'])
                # New image bytes with identical input identities are distinct publications.
                (root / '66archive-web.tar').write_bytes(fixtures.image({'site/index.html': b'new render', 'snapshot/baked-content.json': raw}, source=source))
                third = make(3)
                self.assertEqual(first['inputIdentity'], third['inputIdentity'])
                self.assertNotEqual(first['image']['digest'], third['image']['digest'])
                (root / 'baked-content.json').write_bytes(raw + b' ')
                with self.assertRaises(AssertionError): make()
                (root / 'baked-content.json').write_bytes(raw)
                (root / 'dataset-snapshot.json').write_text('{}')
                with self.assertRaisesRegex(ValueError, 'Standalone snapshot'): make()
            finally: os.chdir(cwd)


if __name__ == '__main__': unittest.main()
