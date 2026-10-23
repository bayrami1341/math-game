import hashlib
import tempfile
import unittest
from pathlib import Path

import pymupdf

from prepare_g2_ch1_visual_pass import prepare, render_candidate_pages
from verify_c205_source import verify


class ChapterOneVisualPreparationTests(unittest.TestCase):
    def test_absent_source_creates_no_pixels(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            result = prepare(root / 'not-there.pdf', root / 'render')
            self.assertEqual(result['status'], 'BLOCKED')
            self.assertEqual(result['reason_code'], 'SOURCE_PDF_UNAVAILABLE')
            self.assertEqual(result['images_count'], 0)
            self.assertFalse((root / 'render').exists())

    def test_source_inside_repo_is_rejected(self):
        result = prepare(Path(__file__), Path(__file__).parent / 'private-render')
        self.assertEqual(result['reason_code'], 'SOURCE_OR_RENDER_INSIDE_REPOSITORY')

    def test_synthetic_gate_renders_18_but_not_book_claims(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            pdf = root / 'synthetic.pdf'
            doc = pymupdf.open()
            for i in range(152):
                page = doc.new_page(width=120, height=160)
                page.insert_text((10, 20), 'synthetic page ' + str(i + 1))
            doc.save(str(pdf))
            doc.close()
            sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
            gate = verify(pdf, expected_sha=sha, expected_size=pdf.stat().st_size, expected_pages=152)
            self.assertEqual(gate['status'], 'PASS_SOURCE_BYTES_ONLY')
            result = render_candidate_pages(pdf, root / 'private', gate)
            self.assertEqual(result['images_count'], 18)
            self.assertEqual(result['status'], 'PRIVATE_RENDER_READY_NOT_SCANNED')
            self.assertEqual(result['book_claims_verified'], 0)
            self.assertTrue(result['candidate_offset_not_verified'])
            self.assertEqual(result['images'][0]['pdf_page_candidate_1based'], 7)
            self.assertEqual(result['images'][-1]['pdf_page_candidate_1based'], 24)
            self.assertTrue((root / 'private' / result['images'][0]['render_filename_private']).is_file())
            with self.assertRaisesRegex(ValueError, 'SOURCE_CHANGED_AFTER_GATE'):
                render_candidate_pages(pdf, root / 'other', {**gate, 'actual_pdf_sha256': '0'*64})
            self.assertFalse((root / 'other').exists())


if __name__ == '__main__':
    unittest.main()
