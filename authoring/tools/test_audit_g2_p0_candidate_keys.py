import copy
import unittest

from audit_g2_completion import inventory
from audit_g2_independent_keys import inspect
from audit_g2_p0_candidate_keys import IDS, assess, audit, solve_equation
from audit_g2_question_diversity import read_questions
from build_g2_key_review_queue import route


class P0CandidateKeysTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = inventory()
        cls.questions = read_questions()
        cls.queue = route(cls.meta, inspect(cls.questions), cls.questions)
        cls.q = {q['q_id']: q for q in cls.questions}
        cls.r = {r['q_id']: r for r in cls.queue['items']}

    def test_eight_candidate_keys_but_no_book_or_prior_verdict(self):
        result = audit(self.meta, self.questions, self.queue)
        self.assertEqual([r['q_id'] for r in result['rows']], list(IDS))
        self.assertEqual(result['failures'], [])
        self.assertEqual(result['status'], 'CANDIDATE_ARITHMETIC_ONLY_NOT_BOOK_VERIFIED')
        self.assertFalse(result['book_correctness_claimed'])
        for row in result['rows']:
            self.assertFalse(row['prior_verdict_applied_to_q'])
            self.assertEqual(row['printed_exercise_identity'], 'NOT_ESTABLISHED')
            self.assertNotIn('stem', row)
            self.assertNotIn('options', row)

    def test_wrong_key_detected(self):
        q = copy.deepcopy(self.q['Q-1103'])
        q['answer'] = 'د'
        self.assertEqual(assess(q, self.r[q['q_id']])['arithmetic_status'], 'FAIL_CANDIDATE_KEY_OR_OPTIONS')

    def test_wrong_option_detected(self):
        q = copy.deepcopy(self.q['Q-1069'])
        q['options'][0] = '۸۰'
        self.assertEqual(assess(q, self.r[q['q_id']])['arithmetic_status'], 'FAIL_CANDIDATE_KEY_OR_OPTIONS')

    def test_bad_pattern_or_changed_coin_wording_fails_closed(self):
        q = copy.deepcopy(self.q['Q-1070'])
        q['stem'] = q['stem'].replace('۱۴', '۱۵')
        with self.assertRaisesRegex(ValueError, 'P0_PATTERN_NOT_ARITHMETIC'):
            assess(q, self.r[q['q_id']])
        q = copy.deepcopy(self.q['Q-1069'])
        q['stem'] = 'به تصویر نگاه کن؛ چند سکه داریم؟'
        with self.assertRaisesRegex(ValueError, 'P0_COIN_STEM_DRIFT'):
            assess(q, self.r[q['q_id']])

    def test_equation_unknown_count_and_inversion(self):
        self.assertEqual(solve_equation('در تساوی □ + 17 = 51، چه عددی در جای خالی می آید؟'), 34)
        self.assertEqual(solve_equation('در تساوی 60 - □ = 27، چه عددی در جای خالی می آید؟'), 33)
        with self.assertRaisesRegex(ValueError, 'P0_EQUATION_UNKNOWN_COUNT'):
            solve_equation('در تساوی □ + □ = 51، چه عددی در جای خالی می آید؟')

    def test_green_or_route_drift_fails_closed(self):
        q = copy.deepcopy(self.q['Q-1101'])
        q['stamp'] = 'تأییدشده'
        with self.assertRaisesRegex(ValueError, 'P0_UNSAFE_QUESTION_STATE'):
            assess(q, self.r[q['q_id']])
        q['stamp'] = 'نیاز به تأیید'
        r = copy.deepcopy(self.r[q['q_id']])
        r['book_page_candidate'] = 81
        with self.assertRaisesRegex(ValueError, 'P0_ROUTE_OR_SCOPE_DRIFT'):
            assess(q, r)

    def test_p0_queue_is_exact_and_pinned(self):
        queue = copy.deepcopy(self.queue)
        queue['input_sha256']['candidate'] = 'wrong'
        with self.assertRaisesRegex(ValueError, 'P0_PINNED_INPUT_DRIFT'):
            audit(self.meta, self.questions, queue)
        queue = copy.deepcopy(self.queue)
        queue['items'][0]['review_priority'] = 'P1'
        with self.assertRaisesRegex(ValueError, 'P0_QUEUE_ID_DRIFT'):
            audit(self.meta, self.questions, queue)


if __name__ == '__main__':
    unittest.main()
