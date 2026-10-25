"""Synthetic issue ledger tests; no book media or live GitHub calls."""
import copy
import unittest

from build_g2_ch2_issue_overlay import overlay
from build_g2_ch2_achilles_reconciliation import COMMIT, PDF_SHA


class IssueOverlayTests(unittest.TestCase):
    def setUp(self):
        self.pages = {"schema": "arena-g2-ch2-achilles-metadata-reconciliation/v1",
                      "producer_commit": COMMIT, "question_evidence_status": "NONE_BOUND_BY_Q_ID",
                      "page_queue": [{"printed_page": p, "pdf_page_reported": p + 6,
                                      "page_evidence_refs": [f"EV-{p}"],
                                      "candidate_question_ids": ["Q-1"] if p == 33 else []}
                                     for p in range(19, 37)]}
        self.issues = {"book_code": "C205", "source_pdf_sha256": PDF_SHA,
                       "total_issues": 29,
                       "issues": [{"issue_id": f"ISS-{i}", "book_page": 33 if i == 0 else 100 + i,
                                   "pdf_page": 39 if i == 0 else 106 + i,
                                   "category": "TEST", "evidence_refs": ["EV-33"] if i == 0 else [],
                                   "status": "RESOLVED_BY_CROP_EVIDENCE" if i < 14
                                             else "NEEDS_TEACHER_VERDICT"}
                                  for i in range(29)]}

    def test_page_issue_not_equivalent_to_question_or_verdict(self):
        result = overlay(self.issues, self.pages)
        self.assertEqual(result['ch2_issue_count'], 1)
        self.assertEqual(result['ch2_issues'][0]['candidate_question_ids_on_page'], ['Q-1'])
        self.assertEqual(result['ch2_issues'][0]['question_issue_relation'], 'UNDETERMINED_NO_Q_ID_IN_ISSUE')
        self.assertEqual(result['automatically_accepted_question_count'], 0)

    def test_bad_page_evidence_and_status_counts_rejected(self):
        bad = copy.deepcopy(self.issues)
        bad['issues'][0]['evidence_refs'] = ['UNBOUND']
        with self.assertRaisesRegex(ValueError, 'ISSUE_EVIDENCE_PAGE_MISMATCH'):
            overlay(bad, self.pages)
        bad = copy.deepcopy(self.issues)
        bad['issues'][14]['status'] = 'RESOLVED_BY_CROP_EVIDENCE'
        with self.assertRaisesRegex(ValueError, 'ISSUE_STATUS_COUNTS_DRIFT'):
            overlay(bad, self.pages)
        bad = copy.deepcopy(self.pages)
        bad['question_evidence_status'] = 'ACCEPTED'
        with self.assertRaisesRegex(ValueError, 'ISSUE_SOURCE_OR_PAGE_LINEAGE_DRIFT'):
            overlay(self.issues, bad)


if __name__ == '__main__':
    unittest.main()
