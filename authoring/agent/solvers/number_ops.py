"""Domain 1 (`number_ops.py`): Multi-Grade Place Value (`G1..G6`, up to 7+ digits),
Multi-Step Column Addition/Subtraction with Carry/Borrow, and Rounding with Evidence Lock.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Set, Tuple

from .base import AnswerValue, DomainSolverPlugin, norm_ascii, values_equal

PLACE_POWERS = [
    ("صدگان هزار", 5),
    ("دهگان هزار", 4),
    ("یکان هزار", 3),
    ("هزارگان", 3),
    ("میلیون", 6),
    ("صدگان", 2),
    ("دهگان", 1),
    ("یکان", 0),
]


def round_half_up_power(n: int, power: int) -> int:
    unit = 10 ** power
    rem = n % unit
    base = (n // unit) * unit
    return base + unit if rem * 2 >= unit else base


class NumberOpsSolverPlugin(DomainSolverPlugin):
    domain_id = "number_ops"

    def solve(self, params: Dict[str, Any]) -> AnswerValue:
        op = params["op"]
        if op == "place_value":
            n = int(params["number"])
            pos = int(params["place_power"])
            digit = (abs(n) // (10 ** pos)) % 10
            return digit if params.get("digit_only") else digit * (10 ** pos)
        if op == "column_add":
            return sum(int(x) for x in params["operands"])
        if op == "column_sub":
            a, b = int(params["a"]), int(params["b"])
            if a < b and not params.get("allow_negative", False):
                raise ValueError(f"Negative difference in elementary subtraction: {a} - {b}")
            return a - b
        if op == "round":
            n = int(params["number"])
            power = int(params.get("place_power", 1))
            mode = params.get("mode", "half_up")
            if mode == "truncate":
                unit = 10 ** power
                return (n // unit) * unit
            return round_half_up_power(n, power)
        raise ValueError(f"Unsupported number_ops op: {op!r}")

    def generate_causal_distractors(self, params: Dict[str, Any]) -> Dict[str, Set[AnswerValue]]:
        op = params["op"]
        true_ans = int(self.solve(params))
        out: Dict[str, Set[AnswerValue]] = {}

        def add_code(code: str, val: int) -> None:
            if val != true_ans and val >= 0:
                out.setdefault(code, set()).add(val)

        if op == "place_value":
            n = abs(int(params["number"]))
            pos = int(params["place_power"])
            digit = (n // (10 ** pos)) % 10
            add_code("E_UNIT_VALUE_CONFUSION", digit)
            if pos > 0:
                add_code("E_ZERO_PLACE_MISS", digit * (10 ** (pos - 1)))
            add_code("E_PLACE_SHIFT", digit * (10 ** (pos + 1)))
            s = str(n)
            if len(s) >= 2:
                add_code("E_PLACE_SWAP", int(s[::-1]))
                add_code("E_UNIT_VALUE_CONFUSION", sum(int(ch) for ch in s))

        elif op == "column_add":
            ops = [int(x) for x in params["operands"]]
            if len(ops) == 2:
                a, b = ops
                add_code("E_SUB_CONFUSION", abs(a - b))
                # Column-by-column carry omission across arbitrary 2..7 digit numbers
                max_len = max(len(str(a)), len(str(b)))
                for col in range(max_len):
                    da = (a // (10 ** col)) % 10
                    db = (b // (10 ** col)) % 10
                    if da + db >= 10:
                        add_code("E_CARRY_MISS", true_ans - (10 ** (col + 1)))
                        add_code("E_CARRY_FORGOT", true_ans - (10 ** (col + 1)))
                        add_code("E_CARRY_WRONG_PLACE", true_ans + 9 * (10 ** (col + 1)))
                # Multi-carry simultaneous drop across all columns
                no_carry_digits = []
                for col in range(max_len):
                    da = (a // (10 ** col)) % 10
                    db = (b // (10 ** col)) % 10
                    no_carry_digits.append(str((da + db) % 10))
                add_code("E_CARRY_MISS", int("".join(reversed(no_carry_digits))))
            add_code("E_DOUBLE_OFF", true_ans + 1)
            add_code("E_DOUBLE_OFF", true_ans - 1)

        elif op == "column_sub":
            a, b = int(params["a"]), int(params["b"])
            add_code("E_ADD_CONFUSION", a + b)
            max_len = max(len(str(a)), len(str(b)))
            sfl_digits = []
            for col in range(max_len):
                da = (a // (10 ** col)) % 10
                db = (b // (10 ** col)) % 10
                sfl_digits.append(str(abs(da - db)))
                if da < db:
                    add_code("E_BORROW_MISS", true_ans + (10 ** (col + 1)))
            add_code("E_SMALLER_FROM_LARGER", int("".join(reversed(sfl_digits))))
            add_code("E_DOUBLE_OFF", true_ans + 1)
            add_code("E_DOUBLE_OFF", true_ans - 1)

        elif op == "round":
            n = int(params["number"])
            power = int(params.get("place_power", 1))
            unit = 10 ** power
            add_code("E_APPROX_EXACT_CONFUSION", n)
            lo = (n // unit) * unit
            hi = lo + unit
            add_code("E_ROUND_NEAREST", hi if true_ans == lo else lo)
            if true_ans >= 10:
                add_code("E_ZERO_PLACE_MISS", true_ans // 10)
        return out

    def solve_from_stem(self, stem: str) -> Tuple[Optional[AnswerValue], Dict[str, Any]]:
        s = norm_ascii(stem)
        nums = [int(x) for x in re.findall(r"\d+", s)]
        # Multi-digit place-value queries (`هزارگان`, `دهگان هزار`, `صدگان هزار`, `میلیون`, ...)
        if "ارزش مکانی" in stem and nums:
            n_big = max(nums)
            for label, power in PLACE_POWERS:
                if label in stem:
                    ans = self.solve({"op": "place_value", "number": n_big, "place_power": power})
                    return ans, {"kind": "multigrade_place_value", "number": n_big, "place_power": power}
        if ("نزدیک‌ترین صدگان" in stem or "نزدیک ترین صدگان" in stem) and len(nums) == 1:
            ans = self.solve({"op": "round", "number": nums[0], "place_power": 2, "mode": "half_up"})
            return ans, {"kind": "round_hundreds", "number": nums[0]}
        if ("نزدیک‌ترین هزارگان" in stem or "نزدیک ترین هزارگان" in stem) and len(nums) == 1:
            ans = self.solve({"op": "round", "number": nums[0], "place_power": 3, "mode": "half_up"})
            return ans, {"kind": "round_thousands", "number": nums[0]}
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

        if "ارزش مکانی" in stem and nums:
            n_big = max(nums)
            for label, power in PLACE_POWERS:
                if label in stem:
                    cands = self.generate_causal_distractors(
                        {"op": "place_value", "number": n_big, "place_power": power}
                    )
                    for code, vals in cands.items():
                        if any(values_equal(wrong_val, v) for v in vals):
                            matched.add(code)
            if len(nums) >= 2:
                d_small = min(nums)
                if str(d_small) in str(n_big):
                    idx = str(n_big).index(str(d_small))
                    power = len(str(n_big)) - 1 - idx
                    cands = self.generate_causal_distractors(
                        {"op": "place_value", "number": n_big, "place_power": power}
                    )
                    for code, vals in cands.items():
                        if any(values_equal(wrong_val, v) for v in vals):
                            matched.add(code)

        if len(nums) >= 2:
            a, b = nums[0], nums[1]
            if "+" in s and a + b == correct_val:
                for code, vals in self.generate_causal_distractors({"op": "column_add", "operands": [a, b]}).items():
                    if wrong_val in vals:
                        matched.add(code)
            if "-" in s and a >= b and a - b == correct_val:
                for code, vals in self.generate_causal_distractors({"op": "column_sub", "a": a, "b": b}).items():
                    if wrong_val in vals:
                        matched.add(code)

        for label, power in (("صدگان", 2), ("هزارگان", 3), ("دهگان", 1)):
            if "نزدیک" in stem and label in stem and len(nums) == 1:
                for code, vals in self.generate_causal_distractors(
                    {"op": "round", "number": nums[0], "place_power": power, "mode": "half_up"}
                ).items():
                    if wrong_val in vals:
                        matched.add(code)
        return matched
