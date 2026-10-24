"""Synthetic metadata only; no PDF, XLSX or live remote in unit tests."""
import copy
import unittest

from build_g2_ch2_achilles_reconciliation import PDF_SHA, build


class AchillesPageJoinTests(unittest.TestCase):
    def setUp(self):
        sha = PDF_SHA
        self.snapshot = {"book_code": "C205", "source_pdf_sha256": sha,
                         "pages": [{"book_page": p, "pdf_page": p + 6,
                                    "reconciliation_status": "VERIFIED_EVIDENCE" if p < 28 else "AGREED_UNVERIFIED",
                                    "exercise_count": 1, "evidence_refs": [f"E-{p}"] if p == 19 else []}
                                   for p in range(19, 37)]}
        self.observation = {"book_code": "C205", "source_pdf_sha256": sha,
                            "claims": [{"book_page": 19, "claim_id": "CLM-19", "evidence_refs": ["E-19"]}],
                            "evidence_ledger": {"E-19": {"pdf_page": 25}}}
        self.queue = {"schema": "arena-g2-ch2-skeleton-queue/v1", "printed_pages": [19, 36],
                      "candidate_workbook_sha256": "b" * 64,
                      "page_queue": [{"printed_page": p, "candidate_s1_id": f"L-{p}",
                                      "candidate_question_ids": ["Q-1"] if p == 19 else [],
                                      "topic_hints": []} for p in range(19, 37)]}

    def test_join_preserves_q_hold_and_page_provenance(self):
        result = build(self.snapshot, self.observation, self.queue)
        self.assertEqual(len(result['page_queue']), 18)
        self.assertEqual(result['page_queue'][0]['page_claim_ids'], ['CLM-19'])
        self.assertEqual(result['page_queue'][0]['page_evidence_refs'], ['E-19'])
        self.assertEqual(result['page_queue'][0]['candidate_question_ids'], ['Q-1'])
        self.assertEqual(result['question_evidence_status'], 'NONE_BOUND_BY_Q_ID')
        self.assertEqual(result['educational_acceptance'], 'NOT_GRANTED')

    def test_bad_offset_and_missing_reference_fail(self):
        a = copy.deepcopy(self.snapshot)
        a['pages'][0]['pdf_page'] = 19
        with self.assertRaisesRegex(ValueError, 'PAGE_PDF_OFFSET_DRIFT'):
            build(a, self.observation, self.queue)
        a['pages'][0]['evidence_refs'] = ['MISSING']
        a['pages'][0]['pdf_page'] = 25
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_REF_UNBOUND'):
            build(a, self.observation, self.queue)

    def test_new_q_schema_requires_review_not_silent_join(self):
        a = copy.deepcopy(self.observation)
        a['claims'][0]['q_id'] = 'Q-1'
        with self.assertRaisesRegex(ValueError, 'OBSERVATION_SCHEMA_CHANGED_REVIEW_JOIN'):
            build(self.snapshot, a, self.queue)


if __name__ == '__main__':
    unittest.main()
