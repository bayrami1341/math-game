import copy
import unittest

from score_content_priority_v2 import SCHEMA, WEIGHTS, assess


def reference(kind='OFFICIAL_TEACHER_GUIDE'):
    return {'kind': kind, 'source_id': 'synthetic-guide', 'source_sha256': 'a' * 64,
            'locator': 'page 3, section A (synthetic)', 'reviewed_by': 'fixture-reviewer',
            'status': 'REVIEWED'}


def fixture(rating=4):
    return {'schema': SCHEMA, 'content_uid': 'test:edition:Q:Q-1',
            'workbook_sha256': 'b' * 64, 'achilles_receipt_id': 'synthetic-receipt',
            'achilles_status': 'APPROVED_INPUT_ASSUMED',
            'goal_binding': {'status': 'VERIFIED', 'edition_alignment': 'SAME_EDITION',
                             'objective_id': 'synthetic-objective', 'evidence': reference()},
            'concept_scope_binding': {'schema': 'arena-concept-scope/v1', 'decision': 'ALIGNED',
                                      'content_uid': 'test:edition:Q:Q-1', 'workbook_sha256': 'b' * 64,
                                      'profile_id': 'synthetic-scope', 'profile_revision': 1,
                                      'profile_source_sha256': 'a' * 64},
            'factors': {key: {'rating': rating,
                              'rationale': 'synthetic reviewed reason',
                              'target_objective_id': 'synthetic-later-goal',
                              'target_scope': 'later chapter, synthetic',
                              'evidence': [reference('REVIEWED_COVERAGE' if key == 'coverage_gap'
                                                     else 'OFFICIAL_TEACHER_GUIDE')]}
                        for key in WEIGHTS}}


class SixFactorPriorityTests(unittest.TestCase):
    def test_full_score_remains_candidacy_not_repetition_or_release(self):
        report = assess(fixture())
        self.assertEqual(report['selection_score_0_100'], 100)
        self.assertEqual(report['priority_band'], 'HIGH')
        self.assertEqual(report['status'], 'SCORED_EDUCATIONAL_CANDIDATE_ONLY')
        self.assertEqual(report['repetition_frequency'], 'NOT_DERIVED')
        self.assertEqual(report['engine_capability'], 'AWAITING_ZAI_VERSIONED_MANIFEST')
        self.assertEqual(report['approval_or_release'], 'NOT_GRANTED')

    def test_unknown_not_zero_and_interval_crosses_threshold(self):
        sample = fixture(2)
        sample['factors']['future_foundation'] = {'rating': None, 'evidence': [], 'missing_reason': 'no verified future guide'}
        result = assess(sample)
        self.assertEqual(result['score_interval_0_100'], [40, 60])
        self.assertIsNone(result['selection_score_0_100'])
        self.assertEqual(result['priority_band'], 'SUPPORTING')
        self.assertEqual(result['status'], 'PROVISIONAL_BAND_ONLY')
        sample['factors']['goal_alignment']['rating'] = 3
        result = assess(sample)
        self.assertEqual(result['score_interval_0_100'], [48.75, 68.75])
        self.assertEqual(result['priority_band'], 'SUPPORTING')
        sample['factors']['transfer_application']['rating'] = 4
        result = assess(sample)
        self.assertEqual(result['score_interval_0_100'], [56.25, 76.25])
        self.assertEqual(result['status'], 'HUMAN_REVIEW_DECISION_SENSITIVE')
        self.assertIsNone(result['priority_band'])

    def test_documented_off_scope_cannot_be_promoted(self):
        sample = fixture()
        sample['factors']['goal_alignment']['rating'] = 0
        result = assess(sample)
        self.assertEqual(result['status'], 'ARCHIVE_ONLY_OUTSIDE_GOAL')
        self.assertIsNone(result['selection_score_0_100'])

    def test_unmatched_edition_or_approval_holds_scoring(self):
        sample = fixture()
        sample['goal_binding']['edition_alignment'] = 'UNKNOWN_OLD_GUIDE'
        self.assertEqual(assess(sample)['status'], 'HOLD_GOAL_OR_EDITION')
        sample = fixture()
        sample['goal_binding']['edition_alignment'] = 'REVIEWED_EQUIVALENCE'
        with self.assertRaisesRegex(ValueError, 'UNSUPPORTED_OR_MISSING_EVIDENCE_SOURCE'):
            assess(sample)
        sample['goal_binding']['equivalence_evidence'] = reference('HUMAN_SCOPED_VERDICT')
        self.assertEqual(assess(sample)['status'], 'SCORED_EDUCATIONAL_CANDIDATE_ONLY')
        sample = fixture()
        sample['achilles_status'] = 'DRAFT'
        self.assertEqual(assess(sample)['status'], 'HOLD_ACHILLES_INPUT')

    def test_scope_gate_blocks_drift_unknown_or_mismatched_binding(self):
        sample = fixture()
        sample.pop('concept_scope_binding')
        self.assertEqual(assess(sample)['status'], 'HOLD_CONCEPT_SCOPE_REVIEW')
        sample = fixture()
        sample['concept_scope_binding']['decision'] = 'BLOCK_CRITICAL_SCOPE_DRIFT'
        self.assertEqual(assess(sample)['status'], 'HOLD_CRITICAL_CONCEPT_DRIFT')
        sample = fixture()
        sample['concept_scope_binding']['decision'] = 'UNKNOWN_REVIEW'
        self.assertEqual(assess(sample)['status'], 'HOLD_CONCEPT_SCOPE_REVIEW')
        sample = fixture()
        sample['concept_scope_binding']['workbook_sha256'] = 'c' * 64
        self.assertEqual(assess(sample)['status'], 'HOLD_CONCEPT_SCOPE_REVIEW')

    def test_reject_missing_evidence_wrong_future_source_and_fabricated_zero(self):
        sample = fixture()
        sample['factors']['goal_alignment']['evidence'] = []
        with self.assertRaisesRegex(ValueError, 'FACTOR_WITHOUT_EVIDENCE'):
            assess(sample)
        sample = fixture()
        sample['factors']['future_foundation']['evidence'] = [reference('REVIEWED_WORKBOOK')]
        with self.assertRaisesRegex(ValueError, 'UNSUPPORTED_OR_MISSING_EVIDENCE_SOURCE'):
            assess(sample)
        sample = fixture()
        sample['factors']['diagnostic_value'] = {'rating': None, 'evidence': [reference()], 'missing_reason': 'unknown'}
        with self.assertRaisesRegex(ValueError, 'UNKNOWN_WITH_UNREVIEWED_CLAIM'):
            assess(sample)
        sample = fixture()
        sample['factors']['goal_alignment']['rating'] = True
        with self.assertRaisesRegex(ValueError, 'RATING_MUST_BE_INTEGER'):
            assess(sample)
        sample = fixture()
        sample['goal_binding']['evidence']['status'] = 'UNREVIEWED'
        with self.assertRaisesRegex(ValueError, 'EVIDENCE_NOT_REVIEWED'):
            assess(sample)


if __name__ == '__main__':
    unittest.main()
