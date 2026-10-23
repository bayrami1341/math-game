"""Fail-closed partial key audit; unparseable content must never be called correct."""
import copy
import json
import unittest

from audit_g2_independent_keys import exact_expression, inspect
from audit_g2_question_diversity import read_questions


class IndependentKeysTest(unittest.TestCase):
    def test_arithmetic_parser_is_conservative_and_left_to_right(self):
        self.assertEqual(exact_expression("حاصل ۲۴−۷+۳ چند است؟"), (20, "EXPLICIT_ARITHMETIC_ONLY"))
        self.assertEqual(exact_expression("۹ + ۴ = چند؟")[0], 13)
        for stem in ("حاصل تقریبی ۲۴+۷ چند است؟", "حاصل ۲۴+۷ با ۳ چیز دیگر چند است؟",
                     "کدام عمل را برای ۲۴+۷ انتخاب می‌کنی؟"):
            self.assertIsNone(exact_expression(stem)[0], stem)
        self.assertEqual(exact_expression("اگر ۳ قدم عقب برگردیم روی چه عددی می‌ایستیم؟")[1],
                         "NOT_AN_EXPLICIT_RESULT_PROMPT")

    def test_actual_yellow_candidate_has_partial_not_global_pass(self):
        result = inspect(read_questions())
        self.assertEqual(result["q_count"], 104)
        self.assertEqual(result["option_integrity_checked"], 104)
        self.assertEqual(result["exact_arithmetic_checked"], 19)
        self.assertEqual(result["not_checkable_count"], 85)
        self.assertEqual(result["failures"], [])
        self.assertFalse(result["book_correctness_claimed"])
        self.assertNotIn("stem", json.dumps(result, ensure_ascii=False))

    def test_wrong_key_and_duplicate_options_raise_red_without_promoting(self):
        baseline = read_questions()
        first = next(i for i, q in enumerate(baseline) if exact_expression(q["stem"])[0] is not None)
        wrong = copy.deepcopy(baseline)
        wrong[first]["answer"] = "د" if wrong[first]["answer"] != "د" else "الف"
        result = inspect(wrong)
        self.assertEqual(result["status"], "FAIL_ANSWER_INTEGRITY")
        self.assertIn(wrong[first]["q_id"], result["failures"])
        dup = copy.deepcopy(baseline)
        dup[first]["options"][1] = dup[first]["options"][0]
        self.assertIn(dup[first]["q_id"], inspect(dup)["failures"])

    def test_green_or_missing_items_refused(self):
        questions = read_questions()
        with self.assertRaisesRegex(ValueError, "QUESTION_COUNT_OR_ID_DRIFT"):
            inspect(questions[:-1])
        questions[0]["stamp"] = "تأییدشده"
        with self.assertRaisesRegex(ValueError, "UNSAFE_Q_SCHEMA"):
            inspect(questions)


if __name__ == "__main__":
    unittest.main()
