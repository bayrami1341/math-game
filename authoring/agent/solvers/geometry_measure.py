"""Domain 4 (`geometry_measure.py`): Polygon/Grid Perimeter & Area, Compound Metric Units
(`km/m/cm/mm`, `kg/g`, `L/mL`), and 12h <-> 24h Afternoon Clock Conversion (`G2..G6`).
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Set, Tuple

from .base import AnswerValue, DomainSolverPlugin, norm_ascii, values_equal

COMPOUND_UNIT_FACTORS: Dict[str, int] = {
    "km_m": 1000,
    "kg_g": 1000,
    "L_mL": 1000,
    "m_cm": 100,
    "cm_mm": 10,
}


class GeometryMeasureSolverPlugin(DomainSolverPlugin):
    domain_id = "geometry_measure"

    def solve(self, params: Dict[str, Any]) -> AnswerValue:
        op = params["op"]
        if op == "perimeter_rect":
            w, h = int(params["width"]), int(params["height"])
            return 2 * (w + h)
        if op == "perimeter_square":
            return 4 * int(params["side"])
        if op == "perimeter_polygon":
            return sum(int(x) for x in params["sides"])
        if op == "area_rect":
            return int(params["width"]) * int(params["height"])
        if op == "area_square":
            s = int(params["side"])
            return s * s
        if op == "compound_to_minor":
            factor = COMPOUND_UNIT_FACTORS[params["unit_pair"]]
            return int(params["major"]) * factor + int(params.get("minor", 0))
        if op == "clock_to_24h":
            h12 = int(params["hour_12"])
            minute = int(params.get("minute", 0))
            period = params.get("period", "pm")
            if period == "pm":
                h24 = h12 if h12 == 12 else h12 + 12
            else:
                h24 = 0 if h12 == 12 else h12
            if params.get("hour_only", minute == 0 and params.get("format") != "hh:mm"):
                return h24
            return f"{h24:02d}:{minute:02d}"
        if op == "clock_elapsed":
            total = int(params["hour"]) * 60 + int(params.get("minute", 0)) + int(params["delta_minutes"])
            h_out = (total // 60) % 24
            m_out = total % 60
            return f"{h_out:02d}:{m_out:02d}"
        raise ValueError(f"Unsupported geometry_measure op: {op!r}")

    def generate_causal_distractors(self, params: Dict[str, Any]) -> Dict[str, Set[AnswerValue]]:
        op = params["op"]
        true_ans = self.solve(params)
        out: Dict[str, Set[AnswerValue]] = {}

        def add_code(code: str, val: AnswerValue) -> None:
            if not values_equal(val, true_ans):
                out.setdefault(code, set()).add(val)

        if op == "perimeter_rect":
            w, h = int(params["width"]), int(params["height"])
            add_code("E_PERIMETER_AREA_CONFUSION", w * h)
            add_code("E_HALF_PERIMETER", w + h)
            add_code("E_INCOMPLETE_SIDES", 2 * w + h)
            add_code("E_INCOMPLETE_SIDES", w + 2 * h)

        elif op == "perimeter_square":
            s = int(params["side"])
            add_code("E_PERIMETER_AREA_CONFUSION", s * s)
            add_code("E_HALF_PERIMETER", 2 * s)
            add_code("E_ADD_CONFUSION", s + 4)

        elif op == "area_rect":
            w, h = int(params["width"]), int(params["height"])
            add_code("E_PERIMETER_AREA_CONFUSION", 2 * (w + h))
            add_code("E_ADD_CONFUSION", w + h)

        elif op == "area_square":
            s = int(params["side"])
            add_code("E_PERIMETER_AREA_CONFUSION", 4 * s)
            add_code("E_DOUBLING_HALVING", 2 * s)

        elif op == "compound_to_minor":
            factor = COMPOUND_UNIT_FACTORS[params["unit_pair"]]
            major = int(params["major"])
            minor = int(params.get("minor", 0))
            add_code("E_UNIT_RAW_SUM", major + minor)
            for wrong_f in (10, 100, 1000):
                if wrong_f != factor:
                    add_code("E_UNIT_FACTOR_WRONG_POWER", major * wrong_f + minor)
            if minor > 0:
                add_code("E_ZERO_PLACE_MISS", int(f"{major}{minor}"))

        elif op == "clock_to_24h":
            h12 = int(params["hour_12"])
            minute = int(params.get("minute", 0))
            is_hour_only = isinstance(true_ans, int)
            if is_hour_only:
                add_code("E_CLOCK_12_24_CONFUSION", h12)
                add_code("E_CLOCK_PLUS_10_ERROR", h12 + 10)
                add_code("E_DOUBLE_OFF", int(true_ans) - 1)
                add_code("E_DOUBLE_OFF", int(true_ans) + 1)
            else:
                add_code("E_CLOCK_12_24_CONFUSION", f"{h12:02d}:{minute:02d}")
                add_code("E_CLOCK_PLUS_10_ERROR", f"{(h12 + 10):02d}:{minute:02d}")

        elif op == "clock_elapsed":
            h0, m0, dm = int(params["hour"]), int(params.get("minute", 0)), int(params["delta_minutes"])
            # Base-100 minute rollover misconception (`14:40 + 30 min -> 14:70 or 15:70 / 14:10`)
            if m0 + dm >= 60:
                add_code("E_CLOCK_BASE100_CARRY", f"{h0:02d}:{(m0 + dm) % 100:02d}")
                add_code("E_CARRY_MISS", f"{h0:02d}:{(m0 + dm) - 60:02d}")
        return out

    def solve_from_stem(self, stem: str) -> Tuple[Optional[AnswerValue], Dict[str, Any]]:
        s = norm_ascii(stem)
        nums = [int(x) for x in re.findall(r"\d+", s)]

        # 1. Rectangle / Square Perimeter & Area
        if "مستطیل" in stem and len(nums) >= 2:
            if "محیط" in stem and "مساحت" not in stem:
                return self.solve({"op": "perimeter_rect", "width": nums[0], "height": nums[1]}), {"kind": "perimeter_rect"}
            if "مساحت" in stem and "محیط" not in stem:
                return self.solve({"op": "area_rect", "width": nums[0], "height": nums[1]}), {"kind": "area_rect"}
        if ("مربع" in stem or "مربّع" in stem) and len(nums) == 1:
            if "محیط" in stem and "مساحت" not in stem:
                return self.solve({"op": "perimeter_square", "side": nums[0]}), {"kind": "perimeter_square"}
            if "مساحت" in stem and "محیط" not in stem:
                return self.solve({"op": "area_square", "side": nums[0]}), {"kind": "area_square"}

        # 2. Non-zero start ruler measurement (must precede compound conversion to avoid misclassification)
        if "خط‌کش" in stem and "از عدد" in stem and "تا عدد" in stem and len(nums) == 2:
            a, b = min(nums), max(nums)
            return b - a, {"kind": "ruler_offset", "start": a, "end": b}
        # 3. Compound metric conversions (`کیلوگرم و ... گرم چند گرم`, `کیلومتر و ... متر چند متر`, `متر و ... سانتی‌متر`)
        #    Guard: never trigger on ruler items (already handled above).
        if "خط‌کش" not in stem:
            for maj_lbl, min_lbl, pair_key in (
                ("کیلوگرم", "گرم", "kg_g"),
                ("کیلومتر", "متر", "km_m"),
                ("لیتر", "میلی", "L_mL"),
                ("متر", "سانتی", "m_cm"),
                ("سانتی", "میلی", "cm_mm"),
            ):
                if maj_lbl in stem and min_lbl in stem and ("چند " + min_lbl in stem):
                    if len(nums) == 2:
                        return (
                            self.solve({"op": "compound_to_minor", "unit_pair": pair_key, "major": nums[0], "minor": nums[1]}),
                            {"kind": "compound_to_minor", "unit_pair": pair_key},
                        )
                    if len(nums) == 1:
                        return (
                            self.solve({"op": "compound_to_minor", "unit_pair": pair_key, "major": nums[0], "minor": 0}),
                            {"kind": "compound_to_minor", "unit_pair": pair_key},
                        )

        # 4. Afternoon 12h -> 24h clock conversion (`ساعت ۴ بعدازظهر ... چند است`)
        if ("بعدازظهر" in stem or "بعد از ظهر" in stem or "عصر" in stem or "شب" in stem) and "ساعت" in stem:
            m_hm = re.search(r"(\d{1,2})\s*:\s*(\d{2})", s)
            if m_hm:
                ans = self.solve(
                    {"op": "clock_to_24h", "hour_12": int(m_hm.group(1)), "minute": int(m_hm.group(2)), "period": "pm", "format": "hh:mm"}
                )
                return ans, {"kind": "clock_24h_hm"}
            hour_candidates = [n for n in nums if 1 <= n <= 11]
            if len(hour_candidates) == 1 and "دقیقه" not in stem:
                ans = self.solve({"op": "clock_to_24h", "hour_12": hour_candidates[0], "period": "pm", "hour_only": True})
                return ans, {"kind": "clock_24h_int"}
        # 5. Polygon symmetry axes / polygon vertices (`تعداد خط‌های تقارن` / `تعداد ضلع‌ها`)
        if "خط تقارن" in stem or "خط‌های تقارن" in stem:
            for shape_kw, ax in (("مربع", 4), ("مربّع", 4), ("مستطیل", 2), ("متساوی‌الاضلاع", 3)):
                if shape_kw in stem and not nums:
                    return ax, {"kind": "symmetry_axes"}
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

        if "مستطیل" in stem and len(nums) >= 2:
            op_k = "perimeter_rect" if "محیط" in stem else ("area_rect" if "مساحت" in stem else None)
            if op_k:
                for code, vals in self.generate_causal_distractors({"op": op_k, "width": nums[0], "height": nums[1]}).items():
                    if any(values_equal(wrong_val, v) for v in vals):
                        matched.add(code)
        if ("مربع" in stem or "مربّع" in stem) and len(nums) == 1:
            op_k = "perimeter_square" if "محیط" in stem else ("area_square" if "مساحت" in stem else None)
            if op_k:
                for code, vals in self.generate_causal_distractors({"op": op_k, "side": nums[0]}).items():
                    if any(values_equal(wrong_val, v) for v in vals):
                        matched.add(code)

        for maj_lbl, min_lbl, pair_key in (
            ("کیلوگرم", "گرم", "kg_g"),
            ("کیلومتر", "متر", "km_m"),
            ("لیتر", "میلی", "L_mL"),
            ("متر", "سانتی", "m_cm"),
            ("سانتی", "میلی", "cm_mm"),
        ):
            if maj_lbl in stem and min_lbl in stem and len(nums) in (1, 2):
                minor = nums[1] if len(nums) == 2 else 0
                for code, vals in self.generate_causal_distractors(
                    {"op": "compound_to_minor", "unit_pair": pair_key, "major": nums[0], "minor": minor}
                ).items():
                    if any(values_equal(wrong_val, v) for v in vals):
                        matched.add(code)

        if ("بعدازظهر" in stem or "بعد از ظهر" in stem or "عصر" in stem or "شب" in stem) and "ساعت" in stem:
            m_hm = re.search(r"(\d{1,2})\s*:\s*(\d{2})", s)
            if m_hm:
                for code, vals in self.generate_causal_distractors(
                    {"op": "clock_to_24h", "hour_12": int(m_hm.group(1)), "minute": int(m_hm.group(2)), "period": "pm", "format": "hh:mm"}
                ).items():
                    if any(values_equal(wrong_val, v) for v in vals):
                        matched.add(code)
            else:
                hour_candidates = [n for n in nums if 1 <= n <= 11]
                if len(hour_candidates) == 1:
                    for code, vals in self.generate_causal_distractors(
                        {"op": "clock_to_24h", "hour_12": hour_candidates[0], "period": "pm", "hour_only": True}
                    ).items():
                        if any(values_equal(wrong_val, v) for v in vals):
                            matched.add(code)
        if "خط‌کش" in stem and "از عدد" in stem and "تا عدد" in stem and len(nums) == 2 and isinstance(wrong_val, int):
            a, b = min(nums), max(nums)
            if wrong_val == b:
                matched.add("E_RULER_NONZERO_START")
            if wrong_val == a + b:
                matched.add("E_ADD_CONFUSION")
            if abs(wrong_val - (b - a)) == 1:
                matched.add("E_DOUBLE_OFF")
        if ("خط تقارن" in stem or "خط‌های تقارن" in stem) and isinstance(wrong_val, int) and isinstance(correct_val, int):
            if wrong_val == correct_val // 2 or wrong_val == correct_val * 2:
                matched.add("E_SYM_AXIS_MISCOUNT")
            if wrong_val in (4, 2) and wrong_val != correct_val:
                matched.add("E_POLYGON_SIDE_CONFUSION")
            if abs(wrong_val - correct_val) == 1:
                matched.add("E_DOUBLE_OFF")
        return matched
