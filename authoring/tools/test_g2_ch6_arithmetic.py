"""Fail-closed arithmetic QA for *provisional* G2 chapter-6 authoring only."""
import re
import unittest
from unittest.mock import patch

from draft_g2_ch6_arithmetic import (
    MODES, OPS, generate, independent_answer, regroup_mode,
)

TO_ASCII = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")


class Chapter6ProposalsTest(unittest.TestCase):
    def test_all_eight_families_deterministic_and_unapproved(self):
        a = generate()
        self.assertEqual(a, generate())
        self.assertEqual(len(a), 32)
        self.assertEqual({r["variant_axis"] for r in a}, set(MODES))
        self.assertEqual(len({r["draft_id"] for r in a}), 32)
        self.assertEqual(len({r["skill_family"] for r in a}), len(MODES) * len(OPS))
        for row in a:
            self.assertEqual(row["status"], "PROVISIONAL_YELLOW_NOT_BOOK_VERIFIED")
            self.assertIsNone(row["q_id"])
            self.assertIsNone(row["book_page_evidence_id"])
            self.assertEqual(row["teacher_verdict"], "NOT_GRANTED")
            self.assertEqual(row["runtime_compatibility"], "NOT_TESTED")

    def test_answers_and_distractors_independently(self):
        for row in generate():
            stem = row["stem_fa"]
            self.assertNotRegex(stem, r"[0-9]")
            a, sign, b = re.findall(r"[۰-۹]+|[+−]", stem)
            a, b = int(a.translate(TO_ASCII)), int(b.translate(TO_ASCII))
            op = "add" if sign == "+" else "subtract"
            result = a + b if op == "add" else a - b
            options = [int(x.translate(TO_ASCII)) for x in row["options_fa"]]
            self.assertEqual(len(options), len(set(options)))
            self.assertEqual(options["ابجد".index(row["answer_letter_fa"])], result)
            self.assertTrue(independent_answer(op, a, b, result))
            self.assertEqual(regroup_mode(op, a, b), row["variant_axis"])

    def test_modified_candidate_hash_is_blocked(self):
        with patch("draft_g2_ch6_arithmetic.SKILL_CANDIDATE_SHA", "0" * 64):
            with self.assertRaisesRegex(ValueError, "SOURCE_CANDIDATE_SHA_DRIFT"):
                generate()

    def test_invalid_ops_and_sizes_are_rejected(self):
        with self.assertRaises(ValueError):
            regroup_mode("multiply", 200, 100)
        with self.assertRaises(ValueError):
            generate(examples_per_mode=0)
        with self.assertRaises(ValueError):
            generate(examples_per_mode=13)


if __name__ == "__main__":
    unittest.main()
