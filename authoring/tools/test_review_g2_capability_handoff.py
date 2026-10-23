"""Consumer contract checks use immutable fixture snapshots, not a book-PDF assertion."""
import copy
import json
import unittest
from pathlib import Path

from review_g2_capability_handoff import ROOT, COMMIT, CONTRACT_PATH, REPLY_PATH, git_json, review


class HandoffReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.request = json.loads((ROOT / 'authoring/G2-ENGINE-CAPABILITY-REQUEST-v1.json').read_text(encoding='utf-8'))
        cls.reply = git_json(COMMIT, REPLY_PATH)
        cls.contract = git_json(COMMIT, CONTRACT_PATH)

    def test_current_producer_receipt_is_not_a_pinned_consumer_receipt(self):
        result = review(self.request, self.reply, self.contract, COMMIT)
        self.assertEqual(result['status'], 'HOLD_PINNED_CONTRACT_RECEIPT')
        self.assertEqual(len(result['cases']), 9)
        self.assertEqual(result['teacher_decisions_requested_now'], 0)
        self.assertIn('TOP_LEVEL_ENGINE_COMMIT_NOT_IMMUTABLY_PINNED', result['issues'])
        self.assertIn('G2-CAP-09:CASE_SCHEMA_VERSION_MISSING_OR_DRIFT', result['issues'])
        self.assertFalse(result['book_evidence_verified'])

    def test_pinned_per_case_receipt_clears_only_structural_gate(self):
        reply = copy.deepcopy(self.reply)
        reply['engine_version_commit'] = COMMIT
        for row in reply['cases']:
            row['engine_version_commit'] = COMMIT
            row['engine_schema_version'] = reply['engine_schema_version']
        result = review(self.request, reply, self.contract, COMMIT)
        self.assertEqual(result['status'], 'STRUCTURAL_CONTRACT_OK_NOT_BOOK_ACCEPTANCE')
        self.assertEqual(result['issues'], [])
        self.assertFalse(result['book_evidence_verified'])

    def test_missing_case_fails_closed(self):
        reply = copy.deepcopy(self.reply)
        reply['cases'].pop()
        with self.assertRaisesRegex(ValueError, 'CASE_SET_COUNT_DRIFT'):
            review(self.request, reply, self.contract, COMMIT)

    def test_wrong_family_fails_closed(self):
        reply = copy.deepcopy(self.reply)
        reply['cases'][0]['candidate_family'] = 'WRONG'
        with self.assertRaisesRegex(ValueError, 'CASE_FAMILY_OR_VERDICT_DRIFT'):
            review(self.request, reply, self.contract, COMMIT)

    def test_wrong_source_scope_fails_closed(self):
        request = copy.deepcopy(self.request)
        request['teacher_verdict'] = 'GRANTED'
        with self.assertRaisesRegex(ValueError, 'CONTRACT_IDENTITY_OR_TRUST_SCOPE_DRIFT'):
            review(request, self.reply, self.contract, COMMIT)


if __name__ == '__main__':
    unittest.main()
