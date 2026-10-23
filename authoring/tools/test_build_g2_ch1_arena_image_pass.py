import tempfile
import unittest
from pathlib import Path

from build_g2_ch1_arena_image_pass import UPLOADS, image_manifest, make_book


class ArenaImagePassTests(unittest.TestCase):
    def test_twelve_observed_and_six_explicit_missing_in_standard_workbook(self):
        images = image_manifest()
        self.assertEqual([r['book_page_candidate'] for r in images], list(range(1, 13)))
        self.assertFalse(any(r['source_pdf_sha256_verified'] for r in images))
        wb = make_book(images)
        try:
            self.assertEqual(wb.sheetnames, ['راهنما', 'شناسنامهٔ خشاب', 'نقشهٔ کتاب (S1)',
                                             'اطلس خطا', 'بانک سؤال', 'واژه‌نامهٔ ستون‌ها', 'پروتکل ممیزی'])
            ws = wb['نقشهٔ کتاب (S1)']
            self.assertEqual((ws.max_row, ws.max_column), (24, 14))
            for page in range(1, 19):
                r = page + 2
                self.assertEqual(ws.cell(r, 1).value, f'L-{100+page}')
                self.assertEqual(ws.cell(r, 13).value, 'نیاز به تأیید')
                if page > 12:
                    self.assertIn('BLOCKED_IMAGE_MISSING', ws.cell(r, 14).value)
                    self.assertTrue(ws.cell(r, 8).value.startswith('؟'))
                else:
                    self.assertIn('PDF C205 تطبیق بایتی نشده', ws.cell(r, 12).value)
            self.assertEqual(ws['A21'].value, 'یادداشت')
            self.assertEqual(ws['A22'].value, 'L-41 (نمونه)')
            self.assertEqual(ws['A24'].value, 'یادداشت')
            self.assertEqual(wb['بانک سؤال']['A5'].value, 'Q-101 (نمونه)')
            self.assertEqual(wb['بانک سؤال'].max_row, 6)
        finally:
            wb.close()

    def test_missing_or_modified_image_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(FileNotFoundError):
                image_manifest(Path(temp))
            path = Path(temp) / 'Math-book2-010.png'
            path.write_bytes((UPLOADS / 'Math-book2-010.png').read_bytes() + b'changed')
            with self.assertRaisesRegex(ValueError, 'PAGE_IMAGE_CHANGED_OR_NOT_PNG:1'):
                image_manifest(Path(temp))

    def test_manifest_missing_page_fails_closed(self):
        with self.assertRaisesRegex(ValueError, 'PARTIAL_IMAGE_MANIFEST_DRIFT'):
            make_book(image_manifest()[:-1])


if __name__ == '__main__':
    unittest.main()
