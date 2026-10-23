import unittest

from build_g2_dual_vision_template import HEADERS, make_book


class TemplateTests(unittest.TestCase):
    def test_only_blank_capture_sheets_and_declared_schema(self):
        wb = make_book()
        self.assertEqual(wb.sheetnames, ['GUIDE', 'RUN', 'PAGES', 'ELEMENTS', 'LINKS'])
        for name, headers in HEADERS.items():
            ws = wb[name]
            self.assertEqual([cell.value for cell in ws[1]], headers)
            self.assertEqual(ws.max_row, 1)
            self.assertGreater(len(ws.data_validations.dataValidation), 0)
        run = {row[0]: row[1] for row in wb['RUN'].iter_rows(min_row=2, values_only=True)}
        self.assertEqual(run['schema'], 'C205_DUAL_VISION_CAPTURE_v1')
        self.assertEqual(run['source_identity_level'], 'UNKNOWN')
        self.assertEqual(run['pixel_view_method'], 'PIXELS_NOT_AVAILABLE')
        self.assertEqual(run['source_sha256_if_computed'], '')
        self.assertNotIn('MATCH', str(list(wb['ELEMENTS'].values)))

    def test_links_are_local_and_positions_are_page_relative(self):
        headers = HEADERS['ELEMENTS']
        for key in ('element_id_local', 'x1_0_1000', 'y1_0_1000', 'x2_0_1000', 'y2_0_1000'):
            self.assertIn(key, headers)
        self.assertIn('from_element_id_local', HEADERS['LINKS'])
        self.assertIn('to_element_id_local', HEADERS['LINKS'])
        self.assertNotIn('teacher_stamp', HEADERS['ELEMENTS'])


if __name__ == '__main__':
    unittest.main()
