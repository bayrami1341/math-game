"""Provisional parameterized chapter-6 arithmetic pool, NOT textbook-verified Q rows.

Deterministic examples for the yellow S1 skill *candidates* at chapter 6.
No Q identifiers or printed-page evidence are asserted. Do not import into the
official cartridge before C205 visual/source binding, motor review and verdicts.
"""
from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path
from typing import Any

FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
SKILL_CANDIDATE_SHA = "18e6b4fa4957e968eca2b3b8066387858a627a99d7d52340064a1e8d8880c618"
MODES = ("none", "ones_only", "tens_only", "both")
OPS = ("add", "subtract")


def regroup_mode(op: str, a: int, b: int) -> str:
    if op == "add":
        ones = a % 10 + b % 10 >= 10
        tens = ((a // 10) % 10 + (b // 10) % 10 + int(ones)) >= 10
    elif op == "subtract":
        ones = a % 10 < b % 10
        tens = ((a // 10) % 10 - int(ones)) < (b // 10) % 10
    else:
        raise ValueError("unsupported operator")
    return "both" if ones and tens else "ones_only" if ones else "tens_only" if tens else "none"


def independent_answer(op: str, a: int, b: int, result: int) -> bool:
    # A second calculation path uses place-value decomposition for addition;
    # the inverse-operation invariant for subtraction. Not a teacher verdict.
    if op == "add":
        via_places = 100 * (a // 100 + b // 100) + 10 * ((a // 10) % 10 + (b // 10) % 10) + a % 10 + b % 10
        return via_places == result and result - a == b and result - b == a
    if op == "subtract":
        return result + b == a and a - result == b
    raise ValueError("unsupported operator")


def generate(seed: int = 205, examples_per_mode: int = 4) -> list[dict[str, Any]]:
    candidate = Path(__file__).resolve().parents[2] / "authoring/khshab-G2-MATH_v1.2_page-goals-draft.xlsx"
    if hashlib.sha256(candidate.read_bytes()).hexdigest() != SKILL_CANDIDATE_SHA:
        raise ValueError("SOURCE_CANDIDATE_SHA_DRIFT")
    if examples_per_mode < 1 or examples_per_mode > 12:
        raise ValueError("examples_per_mode must be between 1 and 12")
    rng = random.Random(seed)
    chosen: dict[tuple[str, str], list[tuple[int, int, int]]] = {(op, mode): [] for op in OPS for mode in MODES}
    used: set[tuple[str, int, int]] = set()
    for _ in range(250_000):
        if all(len(group) == examples_per_mode for group in chosen.values()):
            break
        a, b = rng.randint(100, 899), rng.randint(100, 899)
        for op in OPS:
            result = a + b if op == "add" else a - b
            if not 100 <= result <= 999 or (op, a, b) in used:
                continue
            mode = regroup_mode(op, a, b)
            group = chosen[(op, mode)]
            if len(group) < examples_per_mode:
                assert independent_answer(op, a, b, result)
                group.append((a, b, result))
                used.add((op, a, b))
    if any(len(group) != examples_per_mode for group in chosen.values()):
        raise RuntimeError("CANNOT_GENERATE_VARIANT_FAMILY")
    out = []
    for op in OPS:
        for mode in MODES:
            for serial, (a, b, result) in enumerate(chosen[(op, mode)], 1):
                offsets = (-10, 10, -100, 100, -1, 1)
                distractors = [result + n for n in offsets if 0 <= result + n <= 999][:3]
                if len(set(distractors + [result])) != 4:
                    raise RuntimeError("NON_DISTINCT_OPTIONS")
                correct_slot = (serial + MODES.index(mode) + OPS.index(op)) % 4
                options = distractors[:]
                options.insert(correct_slot, result)
                sign = "+" if op == "add" else "−"
                row = {
                    "draft_id": f"DRAFT-G2-CH6-{op.upper()}-{mode.upper()}-{serial:02d}",
                    "status": "PROVISIONAL_YELLOW_NOT_BOOK_VERIFIED",
                    "source": "yellow S1 candidate skill idea; not a printed exercise",
                    "candidate_sha256": SKILL_CANDIDATE_SHA,
                    "book_page_evidence_id": None,
                    "q_id": None, "teacher_verdict": "NOT_GRANTED",
                    "skill_family": f"CH6_{op.upper()}_{mode.upper()}",
                    "variant_axis": mode, "runtime_compatibility": "NOT_TESTED",
                    "stem_fa": f"حاصل {str(a).translate(FA)} {sign} {str(b).translate(FA)} چند است؟",
                    "options_fa": [str(x).translate(FA) for x in options],
                    "answer_letter_fa": "ابجد"[correct_slot],
                    "tech_note_latin": f"{a}{'+' if op == 'add' else '-'}{b}={result}; independent_inverse={independent_answer(op,a,b,result)}; mode={mode}",
                    "distractors": "PROVISIONAL_PLACE_VALUE_OFFSETS_NEED_CAUSAL_REVIEW",
                }
                out.append(row)
    if len({r["draft_id"] for r in out}) != len(out):
        raise RuntimeError("DUPLICATE_DRAFT_ID")
    return out


def main() -> None:
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    out = generate()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"schema": "g2-ch6-arithmetic-proposals-v1", "draft_count": len(out),
                                       "book_evidence_verified": False, "engine_tested": False,
                                       "ready_for_workbook": False, "drafts": out}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PROVISIONAL_ONLY: {len(out)} drafts, 8 families; no workbook/green/teacher change")


if __name__ == "__main__":
    main()
