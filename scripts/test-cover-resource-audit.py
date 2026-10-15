import importlib.util
from pathlib import Path
import tempfile
import sys
sys.dont_write_bytecode = True
import unittest

spec = importlib.util.spec_from_file_location('cover_audit', Path(__file__).with_name('audit-cover-resources.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ResourceAuditTest(unittest.TestCase):
    def test_empty_export_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertTrue(module.audit(Path(folder))['issues'])
            (Path(folder) / 'index.html').write_text('<img src="https://example.com/images/covers/photo.jpg">')
            self.assertEqual(module.audit(Path(folder))['cover_pages'], 0)

    def test_markup_and_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            directory = root / 'images/covers'
            directory.mkdir(parents=True)
            (directory / 'sample.jpg').write_bytes(b'original')
            page = root / 'index.html'
            image = '<img src="/images/covers/sample.jpg" alt="">'
            page.write_text(image)
            self.assertIn('original-only', module.audit(root)['issues'][0])
            page.write_text(image.replace('<img ', '<img data-cover-original="full-size" '))
            self.assertEqual(module.audit(root)['issues'], [])
            self.assertEqual(module.audit(root)['pages']['index.html']['full_size_covers'], 1)
            sources = []
            for kind in ['avif', 'webp']:
                for width in [360, 720]:
                    (directory / f'sample.w{width}.{kind}').write_bytes(b'variant')
                sources.append(f'<source type="image/{kind}" sizes="45vw" srcset="/images/covers/sample.w360.{kind} 360w, /images/covers/sample.w720.{kind} 720w">')
            page.write_text('<picture>' + ''.join(sources) + image + '</picture>')
            self.assertEqual(module.audit(root)['issues'], [])
            page.write_text(page.read_text().replace(' sizes="45vw"', ''))
            self.assertTrue(any('missing sizes' in item for item in module.audit(root)['issues']))
            page.write_text('<picture>' + ''.join(sources) + image + '</picture>')
            (directory / 'sample.w720.avif').unlink()
            self.assertTrue(any('missing local' in item for item in module.audit(root)['issues']))

    def test_fixed_quality_is_valid(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for kind in ['avif', 'webp']:
                (root / f'fixed.{kind}').touch()
            (root / 'index.html').write_text('<picture><source type="image/avif" srcset="/fixed.avif"><source type="image/webp" srcset="/fixed.webp"><img src="/gallery/photos/example.thumb.jpg"></picture>')
            self.assertEqual(module.audit(root)['issues'], [])


if __name__ == '__main__':
    unittest.main()
