import copy
import unittest

from audit_g2_completion import inventory
from audit_g2_independent_keys import inspect
from audit_g2_question_diversity import read_questions
from audit_g2_six_scoped_keys import IDS, assess, audit
from build_g2_key_review_queue import route


class ScopedSixTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = inventory()
        cls.questions = read_questions()
        cls.queue = route(cls.meta, inspect(cls.questions), cls.questions)
        cls.q = {q['q_id']: q for q in cls.questions}
        cls.r = {r['q_id']: r for r in cls.queue['items']}

    def test_real_candidate_only_one_rounding_dispute(self):
        result = audit(self.meta, self.questions, self.queue)
        self.assertEqual([r['q_id'] for r in result['rows']], list(IDS))
        self.assertEqual(result['rounding_convention_disputes'], ['Q-1067'])
        self.assertEqual(result['arithmetic_consistent_under_checked_strategies'], 5)
        self.assertEqual(result['human_decisions_requested_now'], 0)
        self.assertFalse(result['book_correctness_claimed'])
        self.assertEqual(result['rows'][4]['status'], 'CONVENTION_DEPENDENT_KEY_NOT_BOOK_VERIFIED')
        self.assertTrue(result['rows'][4]['both_strategies_have_distinct_options'])
        self.assertFalse(result['rows'][4]['selected_key_matches_all_checked_strategies'])
        for row in result['rows']:
            self.assertNotIn('stem', row)
            self.assertNotIn('options', row)
            self.assertNotIn('answer', row)

    def test_bad_key_is_detected_not_silently_passed(self):
        q = copy.deepcopy(self.q['Q-1042'])
        q['answer'] = 'الف'
        r = assess(q, self.r[q['q_id']])
        self.assertEqual(r['status'], 'CANDIDATE_KEY_DISAGREES_WITH_INDEPENDENT_ARITHMETIC')

    def test_switched_rounding_key_is_still_convention_dependent(self):
        q = copy.deepcopy(self.q['Q-1067'])
        q['answer'] = 'الف'
        r = assess(q, self.r[q['q_id']])
        self.assertEqual(r['status'], 'CONVENTION_DEPENDENT_KEY_NOT_BOOK_VERIFIED')
        self.assertFalse(r['selected_key_matches_all_checked_strategies'])

    def test_changed_stem_fails_closed(self):
        q = copy.deepcopy(self.q['Q-1052'])
        q['stem'] = 'این تصویر چند دسته است؟'
        with self.assertRaisesRegex(ValueError, 'CONTEXT_STEM_UNRECOGNIZED'):
            assess(q, self.r[q['q_id']])

    def test_green_stamp_and_anchor_drift_fail_closed(self):
        q = copy.deepcopy(self.q['Q-1065'])
        q['stamp'] = 'تأییدشده'
        with self.assertRaisesRegex(ValueError, 'UNSAFE_QUESTION_STATE'):
            assess(q, self.r[q['q_id']])
        q['stamp'] = 'نیاز به تأیید'
        q['anchor'] = 'L-999'
        with self.assertRaisesRegex(ValueError, 'QUESTION_ROUTE_DRIFT'):
            assess(q, self.r[q['q_id']])

    def test_queue_sha_drift_fails_closed(self):
        queue = copy.deepcopy(self.queue)
        queue['input_sha256']['candidate'] = 'fake'
        with self.assertRaisesRegex(ValueError, 'PINNED_SCOPE_DRIFT'):
            audit(self.meta, self.questions, queue)


if __name__ == '__main__':
    unittest.main()
