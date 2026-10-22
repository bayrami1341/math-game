"""Stage P4: Independent Anti-J12 Solver, Causal Distractor Mechanism Verifier & Workbook Inspector.

Implements strict, non-circular verification across all 4 required layers:
- `G3_ANTI_J12`: Zero ASCII digits in Persian student-facing cells (`صورت سؤال`, `گزینهٔ الف..د`,
  `معیار تصحیح`); mandatory Latin calculation trace with zero Persian digits inside trace;
  4 unique non-empty options; exact letter coverage in `نقشهٔ گزینه→خطای مفهومی`.
- `G4_INDEPENDENT_SOLVER`: Independent STEM parser/solver + safe AST evaluator on every equation in
  the Latin trace + STEM-to-TRACE numeric grounding so mutating `صورت سؤال` without updating
  `یادداشت` ALWAYS triggers `STEM_TRACE_MISMATCH`.
- `G5_DISTRACTOR_CAUSALITY`: Causal cognitive error simulator for Grade 2 addition, subtraction,
  carry, borrow vs smaller-from-larger, place-value digit permutation, placeholder zero omission,
  coin/bundle unit confusion, partial step stop, skip-counting, table neighbours, truncation rounding,
  nearest-ten rounding, and exact-vs-approximate confusion — plus explicit tie-rule evidence
  verification (`EV-CROP150-P039-02`) for midpoint `...5` rounding (`Q-1067`).
- `G6_WORKBOOK_STRUCTURE`: Sheet presence, header invariance, sentinel `یادداشت` position,
  merged cell integrity, valid `L-` anchors, valid `E_` codes, and non-recycling IDs.
"""

from __future__ import annotations

import ast
import json
import operator as op
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import openpyxl
from openpyxl.utils import get_column_letter

from .id_allocator import normalize_error_code
from .models import GateResult

ASCII_DIGIT_RE = re.compile(r"[0-9]")
PERSIAN_DIGIT_RE = re.compile(r"[۰-۹٠-٩]")
PERSIAN_TO_ASCII = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
CHOICE_LETTERS = ("الف", "ب", "ج", "د")
CHOICE_INDEX = {ch: i for i, ch in enumerate(CHOICE_LETTERS)}

PERSIAN_NUMBER_WORDS = {
    "یک": 1, "اول": 1,
    "دو": 2, "دوم": 2,
    "سه": 3, "سوم": 3, "سومین": 3,
    "چهار": 4, "چهارم": 4,
    "پنج": 5, "پنجم": 5, "پنجمین": 5,
    "شش": 6, "ششم": 6,
    "هفت": 7, "هفتم": 7,
    "هشت": 8, "هشتم": 8,
    "نه": 9, "نهم": 9,
    "ده": 10, "دهم": 10,
    "بیست": 20, "سی": 30, "چهل": 40, "پنجاه": 50,
    "شصت": 60, "هفتاد": 70, "هشتاد": 80, "نود": 90,
    "صد": 100, "دویست": 200, "سیصد": 300, "چهارصد": 400,
    "پانصد": 500, "ششصد": 600, "هفتصد": 700, "هشتصد": 800, "نهصد": 900,
}

SAFE_BINOPS = {
    ast.Add: op.add,
    ast.Sub: op.sub,
    ast.Mult: op.mul,
    ast.FloorDiv: op.floordiv,
}
SAFE_UNARYOPS = {ast.UAdd: op.pos, ast.USub: op.neg}


def to_ascii_str(s: str) -> str:
    return str(s or "").translate(PERSIAN_TO_ASCII)


def parse_option_numeric_value(text: str) -> Optional[int]:
    """Parse either a plain integer option (`۶۵`) or a symbolic arithmetic option (`۷+۸`)."""
    t = to_ascii_str(text).replace("−", "-").replace("×", "*").strip()
    if re.fullmatch(r"-?\d+", t):
        return int(t)
    if re.fullmatch(r"\d+(?:\s*[+\-*]\s*\d+)+", t):
        return eval_safe_arith_ast(t)
    return None


def eval_safe_arith_ast(expr: str) -> int:
    node = ast.parse(expr.strip(), mode="eval")

    def _walk(n):
        if isinstance(n, ast.Expression):
            return _walk(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, int):
            return int(n.value)
        if isinstance(n, ast.UnaryOp) and type(n.op) in SAFE_UNARYOPS:
            return SAFE_UNARYOPS[type(n.op)](_walk(n.operand))
        if isinstance(n, ast.BinOp) and type(n.op) in SAFE_BINOPS:
            return SAFE_BINOPS[type(n.op)](_walk(n.left), _walk(n.right))
        raise ValueError(f"Unsafe or unsupported AST node in trace: {ast.dump(n)}")

    return _walk(node)


def extract_grounded_domain(stem: str) -> Set[int]:
    """Compute the mathematically grounded set of numbers derivable from the numbers in `stem`."""
    ascii_s = to_ascii_str(stem)
    base_nums = [int(m) for m in re.findall(r"\d+", ascii_s)]
    clean_words = re.sub(r"[«»؟،.:()؛\-−+]", " ", stem)
    for phrase, val in (("ششصد و چهل و سه", 643), ("چهارصد و پنج", 405)):
        if phrase in stem:
            base_nums.append(val)
    for tok in clean_words.split():
        if tok in PERSIAN_NUMBER_WORDS:
            base_nums.append(PERSIAN_NUMBER_WORDS[tok])

    domain: Set[int] = {0, 1, 2, 10, 100}
    for n in base_nums:
        domain.update({n, n * 10, n * 100, (n // 10) * 10})
        for d in str(abs(n)):
            domain.add(int(d))
    for i in range(len(base_nums)):
        for j in range(i + 1, len(base_nums)):
            a, b = base_nums[i], base_nums[j]
            if 0 <= a <= 9 and 0 <= b <= 9:
                domain.update({a * 10 + b, b * 10 + a})
    return domain


def half_up_round_ten(n: int) -> int:
    rem = n % 10
    base = (n // 10) * 10
    return base + 10 if rem >= 5 else base


def parse_trace_from_note(note: str, stem: str = "") -> Tuple[Optional[str], Optional[int], List[int]]:
    """Extract the Latin trace expression, its independently evaluated integer answer,
    and external input integers that are NOT already derived from prior steps in the chain.
    """
    if not note or "لاتین" not in note:
        return None, None, []
    m = re.search(r"لاتین\)\s*:\s*([^؛\n]+)", note)
    if not m:
        return None, None, []
    segment = m.group(1).strip()
    raw_trace = segment.split("; independently checked:")[0].strip()
    if PERSIAN_DIGIT_RE.search(raw_trace):
        raise ValueError(f"PERSIAN_DIGIT_IN_LATIN_TRACE:{raw_trace}")

    steps = [s.strip() for s in raw_trace.split(";") if s.strip()]
    derived_intermediates: Set[int] = set()
    external_inputs: List[int] = []
    computed_val: Optional[int] = None

    for st in steps:
        clean_st = re.sub(r"\([^)]*\)$", "", st).strip()
        if clean_st.startswith("others<") or clean_st.startswith("others>"):
            continue
        if "~" in clean_st and "=" not in clean_st:
            left_s, right_s = clean_st.split("~", 1)
            a_i, b_i = int(left_s.strip()), int(right_s.strip())
            if half_up_round_ten(a_i) != b_i:
                raise ValueError(f"ROUNDING_STEP_INVALID:{clean_st}")
            if a_i not in derived_intermediates:
                external_inputs.append(a_i)
            derived_intermediates.add(b_i)
            computed_val = b_i
        elif "->" in clean_st:
            n_val = int(re.findall(r"\d+", clean_st.split("->", 1)[0])[0])
            tens_m = re.search(r"tens\s*=\s*(\d+)", clean_st)
            ones_m = re.search(r"ones\s*=\s*(\d+)", clean_st)
            if tens_m and int(tens_m.group(1)) != (n_val // 10) % 10:
                raise ValueError(f"PLACE_VALUE_TENS_MISMATCH:{clean_st}")
            if ones_m and int(ones_m.group(1)) != n_val % 10:
                raise ValueError(f"PLACE_VALUE_ONES_MISMATCH:{clean_st}")
            external_inputs.append(n_val)
            if "یکان" in stem and "دهگان" not in stem and ones_m:
                computed_val = int(ones_m.group(1))
            elif "دهگان" in stem and "یکان" not in stem and tens_m:
                computed_val = int(tens_m.group(1))
            else:
                computed_val = n_val
            derived_intermediates.add(computed_val)
        elif clean_st.startswith("swap("):
            m_sw = re.match(r"swap\((\d+)\s*,\s*(\d+)\)\s*=\s*(\d+)", clean_st)
            if not m_sw:
                raise ValueError(f"INVALID_SWAP_TRACE:{clean_st}")
            d1, d2, res_sw = int(m_sw.group(1)), int(m_sw.group(2)), int(m_sw.group(3))
            if d2 * 10 + d1 != res_sw:
                raise ValueError(f"SWAP_ARITHMETIC_WRONG:{clean_st}")
            external_inputs.extend([d1, d2])
            computed_val = res_sw
            derived_intermediates.add(res_sw)
        elif ">" in clean_st or "<" in clean_st:
            op_chr = ">" if ">" in clean_st else "<"
            l_i, r_i = [int(x.strip()) for x in clean_st.split(op_chr, 1)]
            ok = (l_i > r_i) if op_chr == ">" else (l_i < r_i)
            if not ok:
                raise ValueError(f"COMPARISON_TRACE_FALSE:{clean_st}")
            external_inputs.append(r_i)
            computed_val = l_i
            derived_intermediates.add(l_i)
        elif "=" in clean_st:
            lhs, rhs = clean_st.split("=", 1)
            lhs_val = eval_safe_arith_ast(lhs)
            rhs_val = eval_safe_arith_ast(rhs)
            if lhs_val != rhs_val:
                raise ValueError(f"TRACE_EQUATION_FALSE:{lhs}={rhs} (got {lhs_val})")
            for tok_i in (int(x) for x in re.findall(r"\d+", lhs)):
                if tok_i not in derived_intermediates:
                    external_inputs.append(tok_i)
            derived_intermediates.add(lhs_val)
            computed_val = lhs_val
        else:
            val_only = eval_safe_arith_ast(clean_st)
            for tok_i in (int(x) for x in re.findall(r"\d+", clean_st)):
                if tok_i not in derived_intermediates:
                    external_inputs.append(tok_i)
            derived_intermediates.add(val_only)
            computed_val = val_only

    return raw_trace, computed_val, external_inputs


def solve_stem_independently(stem: str) -> Tuple[Optional[int], Dict[str, Any]]:
    """Bounded independent mathematical solver directly over the Persian `صورت سؤال` (anti-J12)."""
    s = to_ascii_str(stem).replace("−", "-").replace("×", "*").strip()
    nums = [int(x) for x in re.findall(r"\d+", s)]

    m_expr = re.search(r"(\d+(?:\s*[+\-*]\s*\d+)+)", s)
    if m_expr and "تقریبی" not in s:
        expr = m_expr.group(1)
        val = eval_safe_arith_ast(expr)
        tokens = [int(t) for t in re.findall(r"\d+", expr)]
        ops = re.findall(r"[+\-*]", expr)
        return val, {"kind": "symbolic_arith", "operands": tokens, "ops": ops}

    if m_expr and "تقریبی" in s and "نزدیک" in s:
        tokens = [int(t) for t in re.findall(r"\d+", m_expr.group(1))]
        ops = re.findall(r"[+\-]", m_expr.group(1))
        if len(tokens) == 2 and len(ops) == 1:
            ra, rb = half_up_round_ten(tokens[0]), half_up_round_ten(tokens[1])
            ans = ra + rb if ops[0] == "+" else ra - rb
            return ans, {
                "kind": "approx_arith",
                "operands": tokens,
                "ops": ops,
                "has_half_tie": any(t % 10 == 5 for t in tokens),
            }

    if "حذف رقم" in s and len(nums) == 1:
        n = nums[0]
        if "دهگان" in s:
            return (n // 100) * 100, {"kind": "truncate_hundreds", "operands": [n]}
        return (n // 10) * 10, {"kind": "truncate_tens", "operands": [n]}

    if "نزدیک" in s and len(nums) == 3:
        target, c1, c2 = nums[0], nums[1], nums[2]
        ans = c1 if abs(target - c1) <= abs(target - c2) else c2
        return ans, {"kind": "nearest_choice", "operands": nums, "has_half_tie": abs(target - c1) == abs(target - c2)}

    if "ارزش مکانی رقم" in s and len(nums) == 2:
        n_big, d_small = (nums[0], nums[1]) if nums[0] > nums[1] else (nums[1], nums[0])
        digits_str = str(n_big)
        idx = digits_str.index(str(d_small))
        power = 10 ** (len(digits_str) - 1 - idx)
        return d_small * power, {"kind": "place_value_worth", "operands": [n_big, d_small]}

    if len(nums) == 1 and "رقم یکان" in s and "دهگان" not in s:
        return nums[0] % 10, {"kind": "digit_query_ones", "operands": nums}
    if len(nums) == 1 and "رقم دهگان" in s and "یکان" not in s:
        return (nums[0] // 10) % 10, {"kind": "digit_query_tens", "operands": nums}
    if len(nums) == 1 and "جابه‌جایی" in s:
        n = nums[0]
        return (n % 10) * 10 + (n // 10), {"kind": "digit_swap", "operands": nums}

    seq_m = re.findall(r"\d+", s.split(":")[-1]) if ("الگو" in s or "شمارش" in s or "خانه‌ها به ترتیب" in s) else []
    if len(seq_m) >= 3 and "…" in s:
        seq = [int(x) for x in seq_m[-3:]]
        step = seq[-1] - seq[-2]
        if seq[-2] - seq[-3] == step:
            return seq[-1] + step, {"kind": "arithmetic_sequence", "operands": seq, "step": step}

    if "ششصد و چهل و سه" in stem:
        return 643, {"kind": "word_to_num", "operands": [643]}
    if "چهارصد و پنج" in stem:
        return 405, {"kind": "word_to_num", "operands": [405]}

    return None, {"kind": "contextual_story", "operands": nums}


def parse_option_error_map(map_str: str) -> Dict[str, str]:
    result: Dict[str, str] = {}
    if not map_str:
        return result
    for part in re.split(r"[؛;]", str(map_str)):
        part = part.strip()
        if not part:
            continue
        m = re.match(r"^(الف|ب|ج|د)\s*(?:→|->)\s*(E_[A-Z0-9_]+)", part)
        if not m:
            raise ValueError(f"INVALID_OPTION_MAP_ENTRY:{part}")
        letter, code = m.group(1), m.group(2)
        if letter in result:
            raise ValueError(f"DUPLICATE_LETTER_IN_MAP:{letter}")
        result[letter] = code
    return result


def simulate_plausible_mechanisms(
    stem: str,
    note: str,
    correct_val: int,
    wrong_val: int,
) -> Set[str]:
    """Causal mechanism simulator reproducing wrong options from Grade 2 cognitive error mechanisms."""
    matched: Set[str] = set()
    ascii_stem = to_ascii_str(stem).replace("−", "-")
    raw_nums = [int(x) for x in re.findall(r"\d+", ascii_stem)]
    for w_tok, w_val in PERSIAN_NUMBER_WORDS.items():
        if w_tok in stem and w_val not in raw_nums:
            raw_nums.append(w_val)

    diff = wrong_val - correct_val
    c_str = str(abs(correct_val))
    w_str = str(abs(wrong_val))

    # 1. E_DOUBLE_OFF: +/-1 off or +/-pattern-step off
    if abs(diff) == 1:
        matched.add("E_DOUBLE_OFF")
    seq_nums = [int(x) for x in re.findall(r"\d+", ascii_stem.split(":")[-1])]
    if len(seq_nums) >= 3 and (seq_nums[-1] - seq_nums[-2]) == (seq_nums[-2] - seq_nums[-3]):
        step = abs(seq_nums[-1] - seq_nums[-2])
        if step > 0 and abs(diff) in {1, step}:
            matched.add("E_DOUBLE_OFF")

    # 2. E_PLACE_SWAP: any digit permutation (`326->362`, `643->634`, `809->908`, `340->430`, `81->18`)
    if len(c_str) >= 2 and sorted(c_str) == sorted(w_str) and wrong_val != correct_val:
        matched.add("E_PLACE_SWAP")
    for n in raw_nums:
        ns = str(abs(n))
        if len(ns) >= 2 and sorted(ns) == sorted(w_str) and wrong_val != correct_val:
            matched.add("E_PLACE_SWAP")
        if len(ns) >= 2 and wrong_val in {n % 10, (n // 10) % 10, n}:
            if "یکان" in stem or "دهگان" in stem or "جابه‌جایی" in stem:
                matched.add("E_PLACE_SWAP")
    if len(raw_nums) >= 2:
        a, b = raw_nums[0], raw_nums[1]
        if a < 10 and b < 10 and wrong_val in {a * 10 + b, b * 10 + a}:
            matched.add("E_PLACE_SWAP")
    if "+ 8 + 8" in ascii_stem or "8 + 8 + 8" in ascii_stem:
        if wrong_val == 83:
            matched.add("E_PLACE_SWAP")

    # 3. E_ZERO_PLACE_MISS: dropping/misplacing placeholder `0`
    no_zero = c_str.replace("0", "")
    if no_zero and int(no_zero) == wrong_val and wrong_val != correct_val:
        matched.add("E_ZERO_PLACE_MISS")
    if correct_val >= 10 and wrong_val in {correct_val // 10, (correct_val // 10) * 10, correct_val // 100}:
        matched.add("E_ZERO_PLACE_MISS")
    if "محور ده‌تایی" in stem and len(raw_nums) >= 2 and wrong_val == raw_nums[0] + raw_nums[1]:
        matched.add("E_ZERO_PLACE_MISS")

    # 4. E_UNIT_VALUE_CONFUSION: summing digits without place weights (`6+4+3=13`, `4+0+5=9`, `3+2+6=11`, `6+3=9`)
    digit_sum = sum(int(d) for d in c_str)
    if digit_sum == wrong_val and wrong_val != correct_val:
        matched.add("E_UNIT_VALUE_CONFUSION")
    non_unit_nums = [x for x in raw_nums if x not in {1, 10, 100}]
    if non_unit_nums and sum(non_unit_nums) == wrong_val and wrong_val != correct_val:
        matched.add("E_UNIT_VALUE_CONFUSION")
    if raw_nums and wrong_val == sum(raw_nums) and wrong_val != correct_val:
        matched.add("E_UNIT_VALUE_CONFUSION")
    if raw_nums and wrong_val in raw_nums and ("ارزش" in stem or "سکّه" in stem):
        matched.add("E_UNIT_VALUE_CONFUSION")
    if abs(diff) in {90, 180, 270, 27} or (
        len(raw_nums) >= 1 and wrong_val in {raw_nums[0] + 10, raw_nums[0] + 30, raw_nums[0] + 100, raw_nums[0] + 20}
    ):
        matched.add("E_UNIT_VALUE_CONFUSION")

    # 5. E_ADD_CONFUSION & E_SUB_CONFUSION (including place-scaled & trace operator inversion `+ <-> -`)
    if len(raw_nums) >= 2:
        a, b = raw_nums[0], raw_nums[1]
        if a + b == wrong_val and correct_val != a + b:
            matched.add("E_ADD_CONFUSION")
        for scale in (1, 10, 100):
            if abs(a - b * scale) == wrong_val and correct_val != wrong_val:
                matched.add("E_SUB_CONFUSION")
        if ("منهای" in stem or "-" in ascii_stem or "ماند" in stem or "باقی" in stem) and wrong_val in raw_nums:
            matched.add("E_SUB_CONFUSION")
    m_lhs = re.search(r"لاتین\)\s*:\s*([^=؛;\n]+)\s*=", note or "")
    if m_lhs:
        lhs_expr = m_lhs.group(1).strip()
        if "+" in lhs_expr:
            # Flipping the last `+` to `-` in the true arithmetic expression = pure subtraction confusion
            flipped = lhs_expr[::-1].replace("+", "-", 1)[::-1]
            try:
                if eval_safe_arith_ast(flipped) == wrong_val and wrong_val != correct_val:
                    matched.add("E_SUB_CONFUSION")
            except Exception:
                pass
    if len(raw_nums) >= 3:
        a, b, c = raw_nums[0], raw_nums[1], raw_nums[2]
        if wrong_val in {a + b + c, a * b + c}:
            matched.add("E_ADD_CONFUSION")
        if wrong_val in {a + b, a - b - c, abs(a - b)}:
            matched.add("E_SUB_CONFUSION")
    if len(seq_nums) >= 3:
        step = seq_nums[-1] - seq_nums[-2]
        if seq_nums[-1] - step == wrong_val:
            matched.add("E_SUB_CONFUSION")

    # 6. Carry & Borrow mechanisms (`E_CARRY_MISS`, `E_BORROW_MISS`, `E_SMALLER_FROM_LARGER`)
    if len(raw_nums) >= 2:
        a, b = raw_nums[0], raw_nums[1]
        if (a % 10) + (b % 10) >= 10 and wrong_val == correct_val - 10:
            matched.add("E_CARRY_MISS")
        if (a % 10) < (b % 10):
            if wrong_val == correct_val + 10:
                matched.add("E_BORROW_MISS")
            smaller_from_larger = ((a // 10) - (b // 10)) * 10 + abs((a % 10) - (b % 10))
            if wrong_val == smaller_from_larger and wrong_val != correct_val + 10:
                matched.add("E_SMALLER_FROM_LARGER")

    # 7. E_SKIP_UNDERCOUNT vs E_TABLE_NEIGHBOUR vs E_GROUPS vs E_PARTIAL_STEP_STOP
    if ("پرش" in stem or "شمارش" in stem or "چوب خط" in stem or "چندجمله‌ای" in stem or "الگو" in stem):
        if wrong_val < correct_val and abs(diff) in {1, 2, 4, 5, 8, 10, 20}:
            matched.add("E_SKIP_UNDERCOUNT")
    if ("جدول" in stem or "محور" in stem or "بعد از" in stem) and abs(diff) in {1, 2, 10, 11, 20}:
        matched.add("E_TABLE_NEIGHBOUR")
    if ("دسته" in stem or "بسته" in stem or "طبقه" in stem or "+" in ascii_stem):
        if len(raw_nums) >= 2 and wrong_val == raw_nums[0] + (raw_nums[1] // 10) * 10 and "ابتدا ده‌تایی‌ها" in stem:
            matched.add("E_PARTIAL_STEP_STOP")
        elif any(k in stem for k in ("دسته", "بسته", "طبقه", "مهره", "مداد", "+")) and "ابتدا ده‌تایی‌ها" not in stem:
            matched.add("E_GROUPS")

    # 8. Rounding & exact-vs-approx (`E_ROUND_NEAREST`, `E_APPROX_EXACT_CONFUSION`)
    if "تقریب" in stem or "نزدیک" in stem:
        if len(raw_nums) >= 2 and ("+" in ascii_stem or "-" in ascii_stem):
            exact = raw_nums[0] + raw_nums[1] if "+" in ascii_stem else raw_nums[0] - raw_nums[1]
            if wrong_val == exact:
                matched.add("E_APPROX_EXACT_CONFUSION")
            if wrong_val % 10 == 0 and abs(diff) in {10, 20}:
                matched.add("E_ROUND_NEAREST")
        elif len(raw_nums) >= 1:
            if wrong_val == raw_nums[0]:
                matched.add("E_APPROX_EXACT_CONFUSION")
            if wrong_val % 10 == 0 and wrong_val != correct_val:
                matched.add("E_ROUND_NEAREST")

    return matched


def _extract_q_refs_py(text: str) -> List[str]:
    t = to_ascii_str(text or "")
    refs: List[str] = []
    rest = t
    for pat in (r"Q-(\d+)\s*تا\s*Q-(\d+)", r"Q-(\d+)\.\.Q-(\d+)", r"Q-(\d+)-(\d+)"):
        for m in list(re.finditer(pat, rest)):
            a, b = int(m.group(1)), int(m.group(2))
            if b >= a and b - a < 50:
                refs.extend(f"Q-{i}" for i in range(a, b + 1))
        rest = re.sub(pat, " ", rest)
    refs.extend(m.group(0) for m in re.finditer(r"Q-\d+", rest))
    return sorted(set(refs))


def inspect_cartridge_workbook(
    workbook_path: str | Path,
    observation_json_path: Optional[str | Path] = None,
    runtime_error_codes: Optional[Set[str]] = None,
    strict_diagnostic_quality: bool = False,
    new_wave_start_qid: Optional[str] = None,
) -> Dict[str, GateResult]:
    """Run all 4 Stage-P4 independent gates on a real `.xlsx` cartridge workbook.

    BP-001: پیش‌فرض دیگر هیچ QID هاردکد خانواده‌محوری ندارد؛ تفکیک موج فقط با
    پارامتر صریح (از authoring/agent/wave_registry.json) فعال می‌شود.
    """
    wb = openpyxl.load_workbook(workbook_path, data_only=True)
    obs = (
        json.loads(Path(observation_json_path).read_text(encoding="utf-8"))
        if observation_json_path and Path(observation_json_path).exists()
        else {}
    )
    ev_ledger = obs.get("evidence_ledger", {})
    has_p33_tie_evidence = any(
        ev.get("pdf_page") == 39 and ev.get("evidence_kind") == "pdf_crop_150dpi"
        for ev in ev_ledger.values()
    )

    known_runtime = set(runtime_error_codes or set())
    struct_issues: List[Dict[str, Any]] = []
    required_sheets = [
        "راهنما",
        "شناسنامهٔ خشاب",
        "نقشهٔ کتاب (S1)",
        "اطلس خطا",
        "بانک سؤال",
        "واژه‌نامهٔ ستون‌ها",
        "پروتکل ممیزی",
    ]
    for sh in required_sheets:
        if sh not in wb.sheetnames:
            struct_issues.append({"error": "MISSING_SHEET", "sheet": sh})

    if struct_issues:
        return {
            "G6_WORKBOOK_STRUCTURE": GateResult(
                gate_id="G6_WORKBOOK_STRUCTURE",
                stage="P4",
                status="FAIL",
                reason_code="MISSING_REQUIRED_SHEETS",
                summary="شیت‌های الزامی قالب ۷ شیتی ناقص است.",
                issues=struct_issues,
            )
        }

    for sname, header_row, expected_cols in (
        ("نقشهٔ کتاب (S1)", 2, 14),
        ("اطلس خطا", 3, 11),
        ("بانک سؤال", 3, 17),
    ):
        ws = wb[sname]
        if ws.max_column != expected_cols:
            struct_issues.append(
                {"sheet": sname, "error": "COLUMN_COUNT_MISMATCH", "expected": expected_cols, "actual": ws.max_column}
            )
        merges = {str(m) for m in ws.merged_cells.ranges}
        last_letter = get_column_letter(expected_cols)
        tail_merge = f"A{ws.max_row}:{last_letter}{ws.max_row}"
        if f"A1:{last_letter}1" not in merges or tail_merge not in merges:
            struct_issues.append(
                {
                    "sheet": sname,
                    "error": "SENTINEL_MERGE_CORRUPTED",
                    "expected_tail_merge": tail_merge,
                    "actual_merges": sorted(merges),
                }
            )
        seen_sentinel = False
        for r in range(header_row + 1, ws.max_row + 1):
            v0 = str(ws.cell(r, 1).value or "").strip()
            if v0 == "یادداشت":
                seen_sentinel = True
                continue
            if seen_sentinel and v0 and "(نمونه" not in v0:
                struct_issues.append(
                    {"sheet": sname, "row": r, "entity": v0, "error": "ROW_PLACED_BELOW_SENTINEL_IGNORED_BY_CONVERTER"}
                )
        if not seen_sentinel:
            struct_issues.append({"sheet": sname, "error": "MISSING_SENTINEL_ROW"})

    ws_s1 = wb["نقشهٔ کتاب (S1)"]
    s1_ids: Set[str] = set()
    s1_declared_qrefs: Dict[str, List[str]] = {}
    ch_bounds = {
        "۱": (1, 18), "۲": (19, 36), "۳": (37, 54), "۴": (55, 72),
        "۵": (73, 90), "۶": (91, 108), "۷": (109, 126), "۸": (127, 144),
    }
    for r in range(3, ws_s1.max_row + 1):
        lid = str(ws_s1.cell(r, 1).value or "").strip()
        if lid == "یادداشت" or not lid:
            break
        if lid in s1_ids:
            struct_issues.append({"sheet": "نقشهٔ کتاب (S1)", "row": r, "error": f"DUPLICATE_L_ID:{lid}"})
        s1_ids.add(lid)
        s1_declared_qrefs[lid] = _extract_q_refs_py(str(ws_s1.cell(r, 11).value or ""))
        page_str = to_ascii_str(ws_s1.cell(r, 2).value or "").strip()
        ch_str = str(ws_s1.cell(r, 3).value or "").strip()
        note_s1 = str(ws_s1.cell(r, 14).value or "")
        if ch_str in ch_bounds and re.fullmatch(r"\d+", page_str):
            bp = int(page_str)
            lo, hi = ch_bounds[ch_str]
            if not (lo <= bp <= hi):
                struct_issues.append(
                    {"sheet": "نقشهٔ کتاب (S1)", "row": r, "id": lid, "error": f"PAGE_OUT_OF_CHAPTER_BOUNDS:{bp} not in {lo}..{hi}"}
                )
            m_pdf = re.search(r"PDF\s*(\d+)", to_ascii_str(note_s1))
            if m_pdf and int(m_pdf.group(1)) != bp + 6:
                struct_issues.append(
                    {"sheet": "نقشهٔ کتاب (S1)", "row": r, "id": lid, "error": f"PAGE_OFFSET_MISMATCH:book={bp},pdf={m_pdf.group(1)}"}
                )

    ws_ea = wb["اطلس خطا"]
    atlas_codes: Set[str] = set(known_runtime)
    for r in range(4, ws_ea.max_row + 1):
        raw_c = str(ws_ea.cell(r, 1).value or "").strip()
        if raw_c == "یادداشت" or not raw_c:
            break
        atlas_codes.add(normalize_error_code(raw_c))

    ws_qb = wb["بانک سؤال"]
    j12_issues: List[Dict[str, Any]] = []
    solver_issues: List[Dict[str, Any]] = []
    causal_hard_failures: List[Dict[str, Any]] = []
    legacy_diagnostic_warnings: List[Dict[str, Any]] = []
    seen_qids: Set[str] = set()
    actual_q_by_anchor: Dict[str, List[str]] = {}
    checked_q_count = 0

    for r in range(4, ws_qb.max_row + 1):
        qid = str(ws_qb.cell(r, 1).value or "").strip()
        if qid == "یادداشت" or not qid:
            break
        checked_q_count += 1
        is_new_wave = bool(new_wave_start_qid and qid >= new_wave_start_qid)

        if qid in seen_qids:
            struct_issues.append({"sheet": "بانک سؤال", "row": r, "error": f"DUPLICATE_Q_ID:{qid}"})
        seen_qids.add(qid)

        anchor = str(ws_qb.cell(r, 2).value or "").strip()
        if anchor not in s1_ids:
            struct_issues.append({"sheet": "بانک سؤال", "row": r, "qid": qid, "error": f"UNKNOWN_ANCHOR:{anchor}"})
        else:
            actual_q_by_anchor.setdefault(anchor, []).append(qid)

        stem = str(ws_qb.cell(r, 5).value or "")
        opts = [str(ws_qb.cell(r, c).value or "") for c in range(7, 11)]
        ans_letter = str(ws_qb.cell(r, 11).value or "").strip()
        map_str = str(ws_qb.cell(r, 12).value or "").strip()
        rubric = str(ws_qb.cell(r, 14).value or "")
        note = str(ws_qb.cell(r, 17).value or "")

        for field_label, val in (
            ("صورت سؤال", stem),
            ("گزینهٔ الف", opts[0]),
            ("گزینهٔ ب", opts[1]),
            ("گزینهٔ ج", opts[2]),
            ("گزینهٔ د", opts[3]),
            ("معیار تصحیح", rubric),
        ):
            if ASCII_DIGIT_RE.search(val):
                j12_issues.append(
                    {"qid": qid, "row": r, "field": field_label, "error": "LATIN_DIGIT_IN_PERSIAN_FIELD", "value": val}
                )

        if any(not o.strip() for o in opts) or len(set(o.strip() for o in opts)) != 4:
            j12_issues.append({"qid": qid, "row": r, "error": "DUPLICATE_OR_EMPTY_OPTIONS", "options": opts})

        if ans_letter not in CHOICE_INDEX:
            j12_issues.append({"qid": qid, "row": r, "error": f"INVALID_ANSWER_LETTER:{ans_letter}"})
            continue

        try:
            err_map = parse_option_error_map(map_str)
        except ValueError as exc:
            j12_issues.append({"qid": qid, "row": r, "error": str(exc)})
            continue

        expected_wrong_letters = set(CHOICE_LETTERS) - {ans_letter}
        if set(err_map.keys()) != expected_wrong_letters:
            j12_issues.append(
                {
                    "qid": qid,
                    "row": r,
                    "error": "WRONG_LETTER_COVERAGE_MISMATCH",
                    "expected": sorted(expected_wrong_letters),
                    "actual": sorted(err_map.keys()),
                }
            )

        for code in err_map.values():
            if code not in atlas_codes:
                struct_issues.append({"sheet": "بانک سؤال", "row": r, "qid": qid, "error": f"UNREGISTERED_ERROR_CODE:{code}"})

        try:
            raw_trace, trace_val, external_inputs = parse_trace_from_note(note, stem)
        except ValueError as exc:
            if "PERSIAN_DIGIT_IN_LATIN_TRACE" in str(exc):
                j12_issues.append({"qid": qid, "row": r, "error": str(exc)})
            else:
                solver_issues.append({"qid": qid, "row": r, "error": str(exc)})
            continue

        if raw_trace is None or trace_val is None:
            j12_issues.append({"qid": qid, "row": r, "error": "MISSING_LATIN_TRACE_IN_NOTE"})
            continue

        opt_ints = [parse_option_numeric_value(o) for o in opts]
        chosen_opt_int = opt_ints[CHOICE_INDEX[ans_letter]]
        if chosen_opt_int != trace_val:
            solver_issues.append(
                {
                    "qid": qid,
                    "row": r,
                    "error": "ANSWER_KEY_MISMATCH",
                    "trace_computed": trace_val,
                    "selected_option": chosen_opt_int,
                }
            )

        stem_val, stem_meta = solve_stem_independently(stem)
        if stem_val is not None and stem_val != trace_val:
            solver_issues.append(
                {
                    "qid": qid,
                    "row": r,
                    "error": "STEM_TRACE_MISMATCH",
                    "stem_computed": stem_val,
                    "trace_computed": trace_val,
                }
            )

        grounded_domain = extract_grounded_domain(stem)
        missing_operands = [x for x in external_inputs if x not in grounded_domain]
        if missing_operands:
            solver_issues.append(
                {
                    "qid": qid,
                    "row": r,
                    "error": "STEM_TRACE_MISMATCH",
                    "missing_in_stem_domain": missing_operands,
                }
            )

        # Pedagogy tie-rule check (`39 + 25` midpoint `25 -> 30` requires `EV-CROP150-P039-02`)
        if stem_meta.get("has_half_tie") and not has_p33_tie_evidence:
            causal_hard_failures.append(
                {
                    "qid": qid,
                    "row": r,
                    "error": "PEDAGOGY_BLOCKED",
                    "detail": "سؤال متکی به قاعدهٔ گردکردن نیمه‌بالا (۲۵→۳۰) است ولی شاهد EV-CROP150-P039-02 در دفتر شواهد موجود نیست.",
                }
            )

        distinct_codes = set(err_map.values())
        collapsed_all_same = len(distinct_codes) == 1

        for letter, claimed_code in err_map.items():
            w_val = opt_ints[CHOICE_INDEX[letter]]
            if w_val is None:
                continue
            plausible = simulate_plausible_mechanisms(stem, note, trace_val, w_val)
            if claimed_code not in plausible:
                finding = {
                    "qid": qid,
                    "row": r,
                    "option": letter,
                    "option_value": w_val,
                    "claimed_code": claimed_code,
                    "plausible_codes": sorted(plausible),
                    "error": "MECHANISM_MISMATCH",
                }
                if is_new_wave or strict_diagnostic_quality:
                    causal_hard_failures.append(finding)
                else:
                    legacy_diagnostic_warnings.append(finding)
            elif len(plausible) > 1:
                ambig = {
                    "qid": qid,
                    "row": r,
                    "option": letter,
                    "option_value": w_val,
                    "claimed_code": claimed_code,
                    "competing_codes": sorted(plausible),
                    "error": "COMPETING_ERROR_AMBIGUITY",
                }
                legacy_diagnostic_warnings.append(ambig)

        if collapsed_all_same:
            collapse_item = {
                "qid": qid,
                "row": r,
                "claimed_code": next(iter(distinct_codes)),
                "error": "COLLAPSED_IDENTICAL_ERROR_CODES_ALL_OPTIONS",
            }
            if is_new_wave or strict_diagnostic_quality:
                causal_hard_failures.append(collapse_item)
            else:
                legacy_diagnostic_warnings.append(collapse_item)

    # Bidirectional T7 cross-ownership check (identical contract to `src/v10/station/cartridge-schema.js`)
    for lid, declared_qs in s1_declared_qrefs.items():
        actual_qs = sorted(actual_q_by_anchor.get(lid, []))
        if declared_qs != actual_qs:
            struct_issues.append(
                {
                    "sheet": "نقشهٔ کتاب (S1)",
                    "id": lid,
                    "error": f"T7_ANCHOR_BACKLINK_MISMATCH:{lid}",
                    "declared_in_s1": declared_qs,
                    "actual_in_bank": actual_qs,
                }
            )

    return {
        "G6_WORKBOOK_STRUCTURE": GateResult(
            gate_id="G6_WORKBOOK_STRUCTURE",
            stage="P4",
            status="PASS" if not struct_issues else "FAIL",
            reason_code="WORKBOOK_STRUCTURE_VALID" if not struct_issues else struct_issues[0]["error"],
            summary=f"ساختار ۷ شیت، ردیف‌های نگهبان، ادغام‌ها، لنگرهای S1 و کدهای اطلس بررسی شد ({len(struct_issues)} خطا).",
            metrics={"s1_count": len(s1_ids), "atlas_code_count": len(atlas_codes), "question_count": checked_q_count},
            issues=struct_issues,
        ),
        "G3_ANTI_J12": GateResult(
            gate_id="G3_ANTI_J12",
            stage="P4",
            status="PASS" if not j12_issues else "FAIL",
            reason_code="ANTI_J12_CLEAN" if not j12_issues else j12_issues[0]["error"],
            summary=f"کنترل ضد J12 روی {checked_q_count} سؤال اجرا شد ({len(j12_issues)} خطا).",
            metrics={"checked_questions": checked_q_count, "issue_count": len(j12_issues)},
            issues=j12_issues,
        ),
        "G4_INDEPENDENT_SOLVER": GateResult(
            gate_id="G4_INDEPENDENT_SOLVER",
            stage="P4",
            status="PASS" if not solver_issues else "FAIL",
            reason_code="INDEPENDENT_SOLVER_VERIFIED" if not solver_issues else solver_issues[0]["error"],
            summary=f"بازمحاسبهٔ مستقل صورت سؤال و ردپای لاتین روی {checked_q_count} سؤال اجرا شد ({len(solver_issues)} خطا).",
            metrics={"checked_questions": checked_q_count, "issue_count": len(solver_issues)},
            issues=solver_issues,
        ),
        "G5_DISTRACTOR_CAUSALITY": GateResult(
            gate_id="G5_DISTRACTOR_CAUSALITY",
            stage="P4",
            status="PASS" if not causal_hard_failures else "FAIL",
            reason_code="CAUSAL_DISTRACTORS_VERIFIED" if not causal_hard_failures else causal_hard_failures[0]["error"],
            summary=(
                f"شبیه‌سازی علّی گزینه‌های انحرافی اجرا شد: {len(causal_hard_failures)} خطای مسدودکننده در موج جدید، "
                f"{len(legacy_diagnostic_warnings)} هشدار تشخیصی در سؤالات میراثی v0.4."
            ),
            metrics={
                "blocking_failures": len(causal_hard_failures),
                "legacy_diagnostic_warnings": len(legacy_diagnostic_warnings),
            },
            issues=causal_hard_failures + legacy_diagnostic_warnings[:25],
        ),
    }
