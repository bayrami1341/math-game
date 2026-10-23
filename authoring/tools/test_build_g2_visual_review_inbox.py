import copy
import csv
import unittest

from audit_g2_completion import inventory
from build_g2_visual_review_inbox import QUEUE, build


class VisualInboxTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = inventory()
        with QUEUE.open(encoding='utf-8-sig', newline='') as f:
            cls.rows = list(csv.DictReader(f))

    def test_exactly_109_pages_and_zero_claims_of_visual_or_human_approval(self):
        result = build(self.meta, self.rows)
        self.assertEqual(result['pages'], 109)
        self.assertEqual(result['visual_pages_scanned'], 0)
        self.assertEqual(result['pages_approved_from_inbox'], 0)
        self.assertEqual(result['human_decisions_requested_now'], 0)
        self.assertFalse(result['worker_deployed'])
        self.assertEqual(len({r['book_page_candidate'] for r in result['items']}), 109)
        for row in result['items']:
            self.assertEqual(row['ai_visual_scan'], 'NOT_PERFORMED')
            self.assertIsNone(row['visual_evidence_sha256'])
            self.assertEqual(row['teacher_stamp'], 'NOT_GRANTED')
            self.assertFalse(row['stop_whole_project'])
        self.assertEqual(next(r for r in result['items'] if r['book_page_candidate'] == 34)['pdf_page_expected_unverified'], 40)

    def test_scoped_prior_verdict_cannot_become_a_new_visual_scan(self):
        result = build(self.meta, self.rows)
        for page in (38, 46, 57, 80, 89, 138, 139):
            row = next(x for x in result['items'] if x['book_page_candidate'] == page)
            self.assertNotEqual(row['previous_user_scope_not_visual_scan'], 'حکم محدود قبلی در این inbox ثبت نشده.')
            self.assertEqual(row['ai_printed_comparison'], 'UNKNOWN_NO_VERIFIED_RENDER')
            self.assertEqual(row['optional_human_verdict'], 'NOT_REQUESTED')

    def test_bad_page_or_anchor_fails_closed(self):
        rows = copy.deepcopy(self.rows)
        rows[0]['صفحهٔ PDF'] = '999'
        with self.assertRaisesRegex(ValueError, 'VISUAL_INBOX_ANCHOR_DRIFT'):
            build(self.meta, rows)
        rows = copy.deepcopy(self.rows)
        rows[0]['شناسهٔ L'] = 'WRONG'
        with self.assertRaisesRegex(ValueError, 'VISUAL_INBOX_ANCHOR_DRIFT'):
            build(self.meta, rows)
        rows = copy.deepcopy(self.rows)
        rows.pop()
        with self.assertRaisesRegex(ValueError, 'VISUAL_INBOX_INPUT_DRIFT'):
            build(self.meta, rows)

    def test_green_or_source_status_drift_fails_closed(self):
        meta = copy.deepcopy(self.meta)
        meta['q_green'] = 1
        with self.assertRaisesRegex(ValueError, 'VISUAL_INBOX_INPUT_DRIFT'):
            build(meta, self.rows)
        meta = copy.deepcopy(self.meta)
        meta['source_visual_status'] = 'VERIFIED'
        with self.assertRaisesRegex(ValueError, 'VISUAL_INBOX_INPUT_DRIFT'):
            build(meta, self.rows)


if __name__ == '__main__':
    unittest.main()
