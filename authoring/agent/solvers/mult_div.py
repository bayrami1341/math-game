"""Domain 2 (`mult_div.py`): Multi-Grade Multiplication, Distributive Property, and
Division with Remainder (`dividend == divisor * quotient + remainder`, `0 <= remainder < divisor`).
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Set, Tuple

from .base import AnswerValue, DomainSolverPlugin, norm_ascii


class MultDivSolverPlugin(DomainSolverPlugin):
    domain_id = "mult_div"

    def solve(self, params: Dict[str, Any]) -> AnswerValue:
        op = params["op"]
        if op == "multiply":
            a, b = int(params["a"]), int(params["b"])
            return a * b
        if op == "distributive":
            a, b1, b2 = int(params["a"]), int(params["b1"]), int(params["b2"])
            return a * (b1 + b2)
        if op == "divide":
            dividend = int(params["dividend"])
            divisor = int(params["divisor"])
            if divisor <= 0:
                raise ValueError(f"Divisor must be strictly positive, got {divisor}")
            q, r = divmod(dividend, divisor)
            assert dividend == divisor * q + r and 0 <= r < divisor
            if "claimed_remainder" in params:
                cr = int(params["claimed_remainder"])
                if not (0 <= cr < divisor):
                    raise ValueError(f"INVALID_REMAINDER_GE_DIVISOR: remainder={cr} >= divisor={divisor}")
            target = params.get("target", "quotient")
            if target == "remainder":
                return r
            if target == "ceiling_containers":
                return q + (1 if r > 0 else 0)
            return q
        raise ValueError(f"Unsupported mult_div op: {op!r}")

    def generate_causal_distractors(self, params: Dict[str, Any]) -> Dict[str, Set[AnswerValue]]:
        op = params["op"]
        true_ans = int(self.solve(params))
        out: Dict[str, Set[AnswerValue]] = {}

        def add_code(code: str, val: int) -> None:
            if val != true_ans and val >= 0:
                out.setdefault(code, set()).add(val)

        if op == "multiply":
            a, b = int(params["a"]), int(params["b"])
            add_code("E_ADD_CONFUSION", a + b)
            if a == 0 or b == 0:
                add_code("E_ZERO_PROPERTY", max(a, b))
            if a == 1 or b == 1:
                add_code("E_IDENTITY_CONFUSION", 1)
                add_code("E_ADD_CONFUSION", a + b)
            if true_ans >= 10 and true_ans % 10 == 0:
                add_code("E_PLACE_SHIFT", true_ans // 10)
            add_code("E_PLACE_SHIFT", true_ans * 10)
            add_code("E_SKIP_OVERCOUNT", a * (b + 1))
            add_code("E_SKIP_OVERCOUNT", (a + 1) * b)
            if b >= 1:
                add_code("E_SKIP_UNDERCOUNT", a * (b - 1))
            if a >= 1:
                add_code("E_SKIP_UNDERCOUNT", (a - 1) * b)
            # Multi-digit partial-product & distributive errors (e.g., 14 * 3 -> 10*3 + 4 = 34)
            for big, small in ((a, b), (b, a)):
                if big >= 10:
                    tens_part = (big // 10) * 10
                    ones_part = big % 10
                    add_code("E_DISTRIBUTIVE_LEAK", tens_part * small + ones_part)
                    add_code("E_ANCHOR_DRIFT", tens_part * small)
                    add_code("E_PLACE_SHIFT", (big // 10) * small + ones_part * small)
                    # Carry forgot in column multiplication (`(ones_part * small) % 10` without tens carry)
                    if ones_part * small >= 10:
                        carry = (ones_part * small) // 10
                        add_code("E_CARRY_MISS", true_ans - carry * 10)

        elif op == "distributive":
            a, b1, b2 = int(params["a"]), int(params["b1"]), int(params["b2"])
            add_code("E_DISTRIBUTIVE_LEAK", a * b1 + b2)
            add_code("E_ANCHOR_DRIFT", a * b1)
            add_code("E_ADD_CONFUSION", a + b1 + b2)

        elif op == "divide":
            dividend = int(params["dividend"])
            divisor = int(params["divisor"])
            q, r = divmod(dividend, divisor)
            target = params.get("target", "quotient")
            add_code("E_OP_REVERSE", abs(dividend - divisor))
            add_code("E_OP_REVERSE", dividend + divisor)
            add_code("E_OP_REVERSE", dividend * divisor)
            add_code("E_GROUP_VS_COUNT", divisor)
            if target == "quotient":
                add_code("E_REMAINDER_QUOTIENT_SWAP", r)
                add_code("E_REMAINDER_DROP", q + 1)
                if q > 0:
                    add_code("E_REMAINDER_GE_DIVISOR", q - 1)
                add_code("E_DOUBLE_OFF", q + 1)
                if q > 0:
                    add_code("E_DOUBLE_OFF", q - 1)
            elif target == "remainder":
                add_code("E_REMAINDER_QUOTIENT_SWAP", q)
                add_code("E_REMAINDER_DROP", 0)
                # Classic student mistake: stopping 1 group early -> remainder = r + divisor >= divisor!
                add_code("E_REMAINDER_GE_DIVISOR", r + divisor)
                add_code("E_DOUBLE_OFF", r + 1)
                if r > 0:
                    add_code("E_DOUBLE_OFF", r - 1)
            elif target == "ceiling_containers":
                add_code("E_REMAINDER_DROP", q)
                add_code("E_REMAINDER_QUOTIENT_SWAP", r)
        return out

    def solve_from_stem(self, stem: str) -> Tuple[Optional[AnswerValue], Dict[str, Any]]:
        s = norm_ascii(stem)
        nums = [int(x) for x in re.findall(r"\d+", s)]
        m_mul = re.search(r"(\d+)\s*\*\s*(\d+)", s)
        if m_mul and len(nums) == 2 and not any(op in s for op in ("+", "-", "/", "☐", "[")):
            a, b = int(m_mul.group(1)), int(m_mul.group(2))
            return self.solve({"op": "multiply", "a": a, "b": b}), {"kind": "direct_multiply", "a": a, "b": b}
        m_div = re.search(r"(\d+)\s*/\s*(\d+)", s)
        if ("تقسیم" in stem or m_div) and len(nums) >= 2:
            dividend, divisor = (int(m_div.group(1)), int(m_div.group(2))) if m_div else (nums[0], nums[1])
            if divisor > 0 and dividend >= divisor:
                if "باقی‌مانده" in stem or "باقیمانده" in stem:
                    if "خارج‌قسمت" not in stem and "خارج قسمت" not in stem:
                        ans = self.solve({"op": "divide", "dividend": dividend, "divisor": divisor, "target": "remainder"})
                        return ans, {"kind": "division_remainder", "dividend": dividend, "divisor": divisor}
                if any(k in stem for k in ("چند جعبه", "چند بسته", "چند سبد", "هر کدام چند", "خارج‌قسمت", "خارج قسمت", "= ?")):
                    ans = self.solve({"op": "divide", "dividend": dividend, "divisor": divisor, "target": "quotient"})
                    return ans, {"kind": "division_quotient", "dividend": dividend, "divisor": divisor}
        return None, {}

    def simulate_mechanisms_from_stem(
        self,
        stem: str,
        note: str,
        correct_val: AnswerValue,
        wrong_val: AnswerValue,
    ) -> Set[str]:
        if not isinstance(correct_val, int) or not isinstance(wrong_val, int):
            return set()
        s = norm_ascii(stem)
        nums = [int(x) for x in re.findall(r"\d+", s)]
        matched: Set[str] = set()

        if len(nums) >= 2:
            a, b = nums[0], nums[1]
            if ("*" in s or "برابر" in stem or "ضرب" in stem or "بسته" in stem or "ردیف" in stem) and a * b == correct_val:
                for code, vals in self.generate_causal_distractors({"op": "multiply", "a": a, "b": b}).items():
                    if wrong_val in vals:
                        matched.add(code)
            if b > 0 and a >= b and ("تقسیم" in stem or "/" in s or "باقی‌مانده" in stem or "باقیمانده" in stem or "مساوی" in stem):
                for target in ("quotient", "remainder", "ceiling_containers"):
                    if self.solve({"op": "divide", "dividend": a, "divisor": b, "target": target}) == correct_val:
                        cands = self.generate_causal_distractors(
                            {"op": "divide", "dividend": a, "divisor": b, "target": target}
                        )
                        for code, vals in cands.items():
                            if wrong_val in vals:
                                matched.add(code)
        return matched
