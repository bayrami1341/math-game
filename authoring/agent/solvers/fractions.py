"""Domain 3 (`fractions.py`): Exact Rational Fraction Solver & Cognitive Error Simulator (`G2..G6`).

Uses Python's exact `fractions.Fraction` exclusively (zero floating-point approximation!).
Covers part-of-whole shading/number-line reading, fraction equivalence, common-numerator &
common-denominator comparison, fraction addition/subtraction, and fraction of a quantity.
"""

from __future__ import annotations

import re
from fractions import Fraction
from typing import Any, Dict, Optional, Set, Tuple

from .base import FRACTION_WORDS, AnswerValue, DomainSolverPlugin, norm_ascii, parse_exact_value, values_equal


def _to_frac(v: Any) -> Fraction:
    if isinstance(v, Fraction):
        return v
    if isinstance(v, (list, tuple)) and len(v) == 2:
        return Fraction(int(v[0]), int(v[1]))
    parsed = parse_exact_value(v)
    if isinstance(parsed, (int, Fraction)):
        return Fraction(parsed)
    raise ValueError(f"Cannot convert {v!r} to exact Fraction")


class FractionsSolverPlugin(DomainSolverPlugin):
    domain_id = "fractions"

    def solve(self, params: Dict[str, Any]) -> AnswerValue:
        op = params["op"]
        if op == "part_whole":
            shaded = int(params["shaded"])
            total = int(params["total"])
            if total <= 0 or not (0 <= shaded <= total):
                raise ValueError(f"Invalid part-whole counts: shaded={shaded}, total={total}")
            return Fraction(shaded, total)
        if op == "equivalent_numerator":
            a, b, target_den = int(params["num"]), int(params["den"]), int(params["target_den"])
            val = Fraction(a, b) * target_den
            if val.denominator != 1:
                raise ValueError(f"Non-integer equivalent numerator for {a}/{b} with den={target_den}")
            return int(val)
        if op == "add":
            return _to_frac(params["f1"]) + _to_frac(params["f2"])
        if op == "sub":
            res = _to_frac(params["f1"]) - _to_frac(params["f2"])
            if res < 0:
                raise ValueError("Negative fraction in elementary subtraction")
            return res
        if op == "compare":
            f1, f2 = _to_frac(params["f1"]), _to_frac(params["f2"])
            want = params.get("want", "larger")
            return max(f1, f2) if want == "larger" else min(f1, f2)
        if op == "of_quantity":
            f = _to_frac(params["fraction"])
            qty = int(params["quantity"])
            res = f * qty
            return int(res) if res.denominator == 1 else res
        raise ValueError(f"Unsupported fractions op: {op!r}")

    def generate_causal_distractors(self, params: Dict[str, Any]) -> Dict[str, Set[AnswerValue]]:
        op = params["op"]
        true_ans = self.solve(params)
        out: Dict[str, Set[AnswerValue]] = {}

        def add_code(code: str, val: AnswerValue) -> None:
            if not values_equal(val, true_ans):
                out.setdefault(code, set()).add(val)

        if op == "part_whole":
            sh, tot = int(params["shaded"]), int(params["total"])
            if sh > 0:
                add_code("E_FRAC_NUM_DENOM_SWAP", Fraction(tot, sh))
            if tot - sh > 0:
                add_code("E_FRAC_PART_TO_UNSHADED", Fraction(sh, tot - sh))
                add_code("E_FRAC_COMPLEMENT", Fraction(tot - sh, tot))
            if tot > 1:
                add_code("E_DOUBLE_OFF", Fraction(sh, tot - 1))
                add_code("E_DOUBLE_OFF", Fraction(sh, tot + 1))

        elif op == "equivalent_numerator":
            a, b, target_den = int(params["num"]), int(params["den"]), int(params["target_den"])
            # Classic error: additive scaling (`a + (target_den - b)`) instead of multiplicative scaling!
            if a + (target_den - b) >= 0:
                add_code("E_FRAC_ADDITIVE_EQUIVALENCE", a + (target_den - b))
            add_code("E_FRAC_UNCHANGED_NUMERATOR", a)
            add_code("E_FRAC_NUM_DENOM_SWAP", target_den)

        elif op in ("add", "sub"):
            n1, d1 = int(params["f1"][0]), int(params["f1"][1])
            n2, d2 = int(params["f2"][0]), int(params["f2"][1])
            if op == "add":
                # Classic misconception: `(a + c) / (b + d)`!
                add_code("E_FRAC_ADD_NUM_AND_DENOM", Fraction(n1 + n2, d1 + d2))
                if n1 >= n2:
                    add_code("E_SUB_CONFUSION", Fraction(n1 - n2, d1 if d1 == d2 else d1 * d2))
            else:
                add_code("E_ADD_CONFUSION", Fraction(n1, d1) + Fraction(n2, d2))
                if d1 != d2 and abs(d1 - d2) > 0 and n1 >= n2:
                    add_code("E_FRAC_ADD_NUM_AND_DENOM", Fraction(n1 - n2, abs(d1 - d2)))

        elif op == "compare":
            f1, f2 = _to_frac(params["f1"]), _to_frac(params["f2"])
            other = f1 if values_equal(true_ans, f2) else f2
            # Classic misconception on common-numerator fractions (`1/5 > 1/3` because `5 > 3`)
            add_code("E_FRAC_DENOM_ORDER_INVERT", other)

        elif op == "of_quantity":
            f = _to_frac(params["fraction"])
            qty = int(params["quantity"])
            if f.numerator > 0:
                add_code("E_FRAC_NUM_DENOM_SWAP", Fraction(qty * f.denominator, f.numerator))
            # Dividing by denominator only and forgetting to multiply by numerator (`qty // den`)
            if f.numerator > 1 and qty % f.denominator == 0:
                add_code("E_FRAC_UNIT_STEP_STOP", qty // f.denominator)
            # Subtracting denominator or adding numerator directly
            add_code("E_ADD_CONFUSION", qty + f.numerator)
            if qty >= f.denominator:
                add_code("E_SUB_CONFUSION", qty - f.denominator)
        return out

    def solve_from_stem(self, stem: str) -> Tuple[Optional[AnswerValue], Dict[str, Any]]:
        s = norm_ascii(stem)
        frac_tokens = [(int(m.group(1)), int(m.group(2))) for m in re.finditer(r"(\d+)\s*/\s*(\d+)", s)]
        nums = [int(x) for x in re.findall(r"\d+", s)]

        # 1. `a/b + c/d` or `a/b - c/d`
        m_op = re.search(r"(\d+)\s*/\s*(\d+)\s*([+\-])\s*(\d+)\s*/\s*(\d+)", s)
        if m_op:
            f1 = (int(m_op.group(1)), int(m_op.group(2)))
            f2 = (int(m_op.group(4)), int(m_op.group(5)))
            op_kind = "add" if m_op.group(3) == "+" else "sub"
            return self.solve({"op": op_kind, "f1": f1, "f2": f2}), {"kind": f"fraction_{op_kind}"}

        # 2. Part-of-whole (`از ۸ قسمت مساوی، ۳ قسمت رنگ شده`)
        if ("قسمت مساوی" in stem or "بخش مساوی" in stem) and len(nums) >= 2 and "چند" in stem and "کدام کسر" in stem:
            tot = max(nums[0], nums[1])
            sh = min(nums[0], nums[1])
            return self.solve({"op": "part_whole", "shaded": sh, "total": tot}), {"kind": "part_whole"}

        # 3. Comparison (`کدام کسر بزرگ‌تر / کوچک‌تر است: ۱/۳ یا ۱/۵`)
        if len(frac_tokens) == 2 and ("بزرگ‌تر" in stem or "بزرگ تر" in stem or "کوچک‌تر" in stem or "کوچک تر" in stem):
            want = "larger" if "بزرگ" in stem else "smaller"
            return self.solve({"op": "compare", "f1": frac_tokens[0], "f2": frac_tokens[1], "want": want}), {"kind": "fraction_compare"}

        # 4. Word/symbolic fraction of quantity (`سه چهارم از ۲۰` or `۲/۵ از ۲۰`)
        if len(frac_tokens) == 1 and len(nums) == 3:
            qty = nums[-1]
            f = Fraction(frac_tokens[0][0], frac_tokens[0][1])
            if (f * qty).denominator == 1 and ("از" in stem or "تایی" in stem):
                return self.solve({"op": "of_quantity", "fraction": f, "quantity": qty}), {"kind": "fraction_of_quantity"}

        for w_phrase, frac_val in FRACTION_WORDS.items():
            if w_phrase in stem and len(nums) == 1 and (frac_val * nums[0]).denominator == 1:
                return self.solve({"op": "of_quantity", "fraction": frac_val, "quantity": nums[0]}), {"kind": "word_fraction_of_quantity"}

        return None, {}

    def simulate_mechanisms_from_stem(
        self,
        stem: str,
        note: str,
        correct_val: AnswerValue,
        wrong_val: AnswerValue,
    ) -> Set[str]:
        s = norm_ascii(stem)
        frac_tokens = [(int(m.group(1)), int(m.group(2))) for m in re.finditer(r"(\d+)\s*/\s*(\d+)", s)]
        nums = [int(x) for x in re.findall(r"\d+", s)]
        matched: Set[str] = set()

        m_op = re.search(r"(\d+)\s*/\s*(\d+)\s*([+\-])\s*(\d+)\s*/\s*(\d+)", s)
        if m_op:
            op_kind = "add" if m_op.group(3) == "+" else "sub"
            cands = self.generate_causal_distractors(
                {"op": op_kind, "f1": (int(m_op.group(1)), int(m_op.group(2))), "f2": (int(m_op.group(4)), int(m_op.group(5)))}
            )
            for code, vals in cands.items():
                if any(values_equal(wrong_val, v) for v in vals):
                    matched.add(code)

        if ("قسمت مساوی" in stem or "بخش مساوی" in stem) and len(nums) >= 2:
            tot, sh = max(nums[0], nums[1]), min(nums[0], nums[1])
            cands = self.generate_causal_distractors({"op": "part_whole", "shaded": sh, "total": tot})
            for code, vals in cands.items():
                if any(values_equal(wrong_val, v) for v in vals):
                    matched.add(code)

        if len(frac_tokens) == 2 and ("بزرگ" in stem or "کوچک" in stem):
            want = "larger" if "بزرگ" in stem else "smaller"
            cands = self.generate_causal_distractors({"op": "compare", "f1": frac_tokens[0], "f2": frac_tokens[1], "want": want})
            for code, vals in cands.items():
                if any(values_equal(wrong_val, v) for v in vals):
                    matched.add(code)

        if len(frac_tokens) == 1 and len(nums) == 3:
            cands = self.generate_causal_distractors(
                {"op": "of_quantity", "fraction": Fraction(frac_tokens[0][0], frac_tokens[0][1]), "quantity": nums[-1]}
            )
            for code, vals in cands.items():
                if any(values_equal(wrong_val, v) for v in vals):
                    matched.add(code)

        for w_phrase, frac_val in FRACTION_WORDS.items():
            if w_phrase in stem and len(nums) == 1:
                cands = self.generate_causal_distractors({"op": "of_quantity", "fraction": frac_val, "quantity": nums[0]})
                for code, vals in cands.items():
                    if any(values_equal(wrong_val, v) for v in vals):
                        matched.add(code)
        return matched
