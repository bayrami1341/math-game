"""Domain 5 (`data_prob.py`): Two-Way Tables, Scaled Pictographs/Charts, and
Spinner/Bag Exact Probability Ratios (`C305` pp. 121–129 & Multi-Grade `G2..G6`).
"""

from __future__ import annotations

import re
from fractions import Fraction
from typing import Any, Dict, List, Optional, Set, Tuple

from .base import AnswerValue, DomainSolverPlugin, norm_ascii, values_equal


class DataProbSolverPlugin(DomainSolverPlugin):
    domain_id = "data_prob"

    def solve(self, params: Dict[str, Any]) -> AnswerValue:
        op = params["op"]
        if op == "probability":
            fav = int(params["favorable"])
            total = int(params["total"])
            if total <= 0 or not (0 <= fav <= total):
                raise ValueError(f"Invalid probability counts: favorable={fav}, total={total}")
            return Fraction(fav, total)
        if op == "pictograph_value":
            symbols = int(params["symbol_count"])
            scale = int(params["scale_per_symbol"])
            half_symbols = int(params.get("half_symbol_count", 0))
            if half_symbols and scale % 2 != 0:
                raise ValueError("Odd scale with half symbol")
            return symbols * scale + half_symbols * (scale // 2)
        if op == "table_query":
            rows: Dict[str, List[int]] = params["rows"]
            row_key = params["row"]
            mode = params.get("mode", "cell")
            if mode == "row_sum":
                return sum(rows[row_key])
            col_idx = int(params["col_index"])
            return rows[row_key][col_idx]
        raise ValueError(f"Unsupported data_prob op: {op!r}")

    def generate_causal_distractors(self, params: Dict[str, Any]) -> Dict[str, Set[AnswerValue]]:
        op = params["op"]
        true_ans = self.solve(params)
        out: Dict[str, Set[AnswerValue]] = {}

        def add_code(code: str, val: AnswerValue) -> None:
            if not values_equal(val, true_ans):
                out.setdefault(code, set()).add(val)

        if op == "probability":
            fav, tot = int(params["favorable"]), int(params["total"])
            rest = tot - fav
            if rest > 0:
                # Classic C305 spinner/bag error: comparing colored sectors to OTHER sectors (`fav / rest`) instead of whole!
                add_code("E_PROB_PART_TO_REST", Fraction(fav, rest))
            add_code("E_PROB_COMPLEMENT_CONFUSION", Fraction(rest, tot))
            if fav > 0:
                add_code("E_PROB_NUM_DENOM_SWAP", Fraction(tot, fav))

        elif op == "pictograph_value":
            symbols = int(params["symbol_count"])
            scale = int(params["scale_per_symbol"])
            half_symbols = int(params.get("half_symbol_count", 0))
            # Classic pictograph error (e.g. C305 p.130 milk crate = 6 bottles!): counting symbols without multiplying by scale!
            add_code("E_SCALE_IGNORED", symbols + half_symbols)
            add_code("E_ADD_CONFUSION", symbols + scale)
            if half_symbols:
                add_code("E_HALF_SYMBOL_AS_FULL", (symbols + half_symbols) * scale)

        elif op == "table_query":
            rows: Dict[str, List[int]] = params["rows"]
            row_key = params["row"]
            mode = params.get("mode", "cell")
            if mode == "cell":
                col_idx = int(params["col_index"])
                for other_k, vals in rows.items():
                    if other_k != row_key and col_idx < len(vals):
                        add_code("E_TABLE_ROW_COL_SWAP", vals[col_idx])
                for j, v in enumerate(rows[row_key]):
                    if j != col_idx:
                        add_code("E_TABLE_NEIGHBOUR", v)
            elif mode == "row_sum":
                for other_k, vals in rows.items():
                    if other_k != row_key:
                        add_code("E_TABLE_ROW_COL_SWAP", sum(vals))
                if len(rows[row_key]) >= 2:
                    add_code("E_PARTIAL_STEP_STOP", sum(rows[row_key][:-1]))
        return out

    def solve_from_stem(self, stem: str) -> Tuple[Optional[AnswerValue], Dict[str, Any]]:
        s = norm_ascii(stem)
        nums = [int(x) for x in re.findall(r"\d+", s)]
        if ("احتمال" in stem or "چرخنده" in stem or "کیسه" in stem) and len(nums) >= 2:
            if "چند برابر" not in stem:
                tot = sum(nums) if ("مهره" in stem and "مساوی" not in stem and len(nums) == 2 and max(nums) <= 12 and "کل" not in stem) else max(nums)
                fav = nums[0] if tot != nums[0] else min(nums)
                if 0 < fav <= tot and ("کسر" in stem or "احتمال" in stem):
                    return self.solve({"op": "probability", "favorable": fav, "total": tot}), {"kind": "probability"}
        if ("نماد" in stem or "شکل نشان‌دهنده" in stem or "هر شکل" in stem or "هر بطری" in stem or "هر جعبه" in stem) and len(nums) == 2:
            return (
                self.solve({"op": "pictograph_value", "symbol_count": nums[1], "scale_per_symbol": nums[0]}),
                {"kind": "pictograph_value"},
            )
        # Tally bundles (`۳ دستهٔ ۵تایی چوب‌خط و ۲ خط تکی روی هم چند رأی است؟`)
        if "چوب‌خط" in stem or "چوب خط" in stem:
            m_t = re.search(r"(\d+)\s*دستهٔ?\s*5\s*تایی.*?(\d+)\s*خط", s)
            if m_t:
                return int(m_t.group(1)) * 5 + int(m_t.group(2)), {"kind": "tally_bundles"}
        # Two-column bar chart difference (`در نمودار ستونی ستون اول ۹ و ستون دوم ۴ است؛ اختلاف دو ستون چند است؟`)
        if "نمودار ستونی" in stem and len(nums) == 2:
            if "اختلاف" in stem or "بیشتر" in stem or "کمتر" in stem:
                return abs(nums[0] - nums[1]), {"kind": "bar_diff"}
            if "مجموع" in stem or "روی هم" in stem:
                return nums[0] + nums[1], {"kind": "bar_sum"}
        return None, {}

    def simulate_mechanisms_from_stem(
        self,
        stem: str,
        note: str,
        correct_val: AnswerValue,
        wrong_val: AnswerValue,
    ) -> Set[str]:
        s = norm_ascii(stem)
        nums = [int(x) for x in re.findall(r"\d+", s)]
        matched: Set[str] = set()

        if ("احتمال" in stem or "چرخنده" in stem or "کیسه" in stem) and len(nums) >= 2:
            for tot in ({max(nums), sum(nums[:2])}):
                for fav in nums[:2]:
                    if 0 < fav < tot:
                        res = self.solve({"op": "probability", "favorable": fav, "total": tot})
                        if values_equal(res, correct_val):
                            for code, vals in self.generate_causal_distractors(
                                {"op": "probability", "favorable": fav, "total": tot}
                            ).items():
                                if any(values_equal(wrong_val, v) for v in vals):
                                    matched.add(code)

        if ("نماد" in stem or "هر شکل" in stem or "هر جعبه" in stem or "هر دسته" in stem) and len(nums) >= 2:
            a, b = nums[0], nums[1]
            if values_equal(a * b, correct_val):
                for sc, sym in ((a, b), (b, a)):
                    for code, vals in self.generate_causal_distractors(
                        {"op": "pictograph_value", "symbol_count": sym, "scale_per_symbol": sc}
                    ).items():
                        if any(values_equal(wrong_val, v) for v in vals):
                            matched.add(code)
        if ("چوب‌خط" in stem or "چوب خط" in stem) and isinstance(wrong_val, int):
            m_t = re.search(r"(\d+)\s*دستهٔ?\s*5\s*تایی.*?(\d+)\s*خط", s)
            if m_t:
                b_cnt, s_cnt = int(m_t.group(1)), int(m_t.group(2))
                if wrong_val == b_cnt * 4 + s_cnt:
                    matched.add("E_TALLY_BUNDLE_4_VS_5")
                if wrong_val == b_cnt + s_cnt:
                    matched.add("E_GROUPS")
                if abs(wrong_val - (b_cnt * 5 + s_cnt)) == 1:
                    matched.add("E_DOUBLE_OFF")
        if "نمودار ستونی" in stem and len(nums) == 2 and isinstance(wrong_val, int):
            a, b = nums[0], nums[1]
            if ("اختلاف" in stem or "بیشتر" in stem or "کمتر" in stem):
                if wrong_val == a + b:
                    matched.add("E_ADD_CONFUSION")
                if wrong_val in (a, b):
                    matched.add("E_TABLE_NEIGHBOUR")
                if abs(wrong_val - abs(a - b)) == 1:
                    matched.add("E_DOUBLE_OFF")
            elif ("مجموع" in stem or "روی هم" in stem):
                if wrong_val == abs(a - b):
                    matched.add("E_SUB_CONFUSION")
                if wrong_val in (a, b):
                    matched.add("E_TABLE_NEIGHBOUR")
                if abs(wrong_val - (a + b)) == 1:
                    matched.add("E_DOUBLE_OFF")
        return matched
