"""Audit six routed candidate keys using two explicit rounding conventions.

This only tests candidate text. It does not establish printed wording, visual
independence, G2 curriculum convention, runtime behavior, or teacher approval.
Run: python authoring/tools/audit_g2_six_scoped_keys.py --out-dir authoring/g2-completion
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from audit_g2_completion import ROOT, PINNED, inventory
from audit_g2_independent_keys import KEY_INDEX, TO_ASCII, inspect
from audit_g2_question_diversity import read_questions
from build_g2_key_review_queue import route

IDS = ("Q-1042", "Q-1052", "Q-1065", "Q-1066", "Q-1067", "Q-1068")
EXPECTED = {"Q-1042": ("NO_UNIQUE_SELF_CONTAINED_EXPRESSION", "L-202"),
            "Q-1052": ("NO_UNIQUE_SELF_CONTAINED_EXPRESSION", "L-210"),
            **{f"Q-{i}": ("APPROXIMATE_OR_CONTEXTUAL", "L-216") for i in range(1065, 1069)}}
ROUNDING = re.compile(r"^حاصل تقریبی (\d+)\s*([+−-])\s*(\d+) با گردکردن به نزدیک\s*ترین دهگان چیست[؟?]$")


def normalize(text: str) -> str:
    return " ".join(text.translate(TO_ASCII).replace("\u200c", " ").split())


def round_tens_nonnegative(n: int) -> int:
    """Explicit half-up hypothesis, NOT an assertion about the printed book."""
    if n < 0:
        raise ValueError("NEGATIVE_ROUNDING_OUT_OF_SCOPE")
    return ((n + 5) // 10) * 10


def assess(q: dict, routing: dict) -> dict:
    ident = q["q_id"]
    if ident not in EXPECTED or (routing["reason_code"], routing["s1_id"]) != EXPECTED[ident] or q["anchor"] != EXPECTED[ident][1]:
        raise ValueError("QUESTION_ROUTE_DRIFT")
    if q.get("stamp") == "تأییدشده" or q.get("answer") not in KEY_INDEX or len(q.get("options", [])) != 4:
        raise ValueError("UNSAFE_QUESTION_STATE")
    stem = normalize(q["stem"])
    options = [normalize(x) for x in q["options"]]
    if not all(re.fullmatch(r"\d+", o) for o in options) or len(set(options)) != 4:
        raise ValueError("NOT_FOUR_UNIQUE_NUMERIC_OPTIONS")
    nums = [int(o) for o in options]
    picked = KEY_INDEX[q["answer"]]
    if ident == "Q-1042":
        m = re.fullmatch(r"(\d+) منهای (\d+) چند می شود[؟?]", stem)
        if not m:
            raise ValueError("CONTEXT_STEM_UNRECOGNIZED")
        a, b = map(int, m.groups())
        result = a - b
        if result < 0:
            raise ValueError("NEGATIVE_RESULT_OUT_OF_SCOPE")
        computed = {"explicit_candidate_arithmetic": result}
    elif ident == "Q-1052":
        m = re.fullmatch(r"(\d+) دستهٔ ده تایی و (\d+) یکی داریم[.]? (\d+) دستهٔ ده تایی و (\d+) یکی می افزاییم؛ حاصل چیست[؟?]", stem)
        if not m:
            raise ValueError("CONTEXT_STEM_UNRECOGNIZED")
        x, y, z, w = map(int, m.groups())
        if max(x, y, z, w) > 9:
            raise ValueError("OUT_OF_SCOPE_PLACE_VALUE")
        computed = {"explicit_candidate_arithmetic": 10 * x + y + 10 * z + w}
    else:
        m = ROUNDING.fullmatch(stem)
        if not m:
            raise ValueError("ROUNDING_STEM_UNRECOGNIZED")
        a, op, b = m.groups()
        a, b = int(a), int(b)
        if a > 99 or b > 99 or op not in ("+", "-", "−"):
            raise ValueError("ROUNDING_INPUT_OUT_OF_SCOPE")
        sign = 1 if op == "+" else -1
        exact = a + sign * b
        operand_first = round_tens_nonnegative(a) + sign * round_tens_nonnegative(b)
        if exact < 0 or operand_first < 0:
            raise ValueError("NEGATIVE_RESULT_OUT_OF_SCOPE")
        computed = {"round_operands_then_compute_half_up": operand_first,
                    "compute_then_round_result_half_up": round_tens_nonnegative(exact)}
    matches = {name: [i for i, n in enumerate(nums) if n == value] for name, value in computed.items()}
    if any(len(hits) != 1 for hits in matches.values()):
        status = "MISSING_OR_NONUNIQUE_COMPUTED_OPTION_REVIEW"
    elif any(picked not in hits for hits in matches.values()):
        status = ("CONVENTION_DEPENDENT_KEY_NOT_BOOK_VERIFIED" if len(set(computed.values())) > 1
                  else "CANDIDATE_KEY_DISAGREES_WITH_INDEPENDENT_ARITHMETIC")
    else:
        status = "CANDIDATE_ARITHMETIC_CONSISTENT_ONLY_NOT_BOOK_VERIFIED"
    # No stems, numeric answers, full choices or answer-letter leaked to the report.
    return {"q_id": ident, "anchor": q["anchor"], "book_page_candidate": routing["book_page_candidate"],
            "status": status, "strategies_checked": list(computed),
            "strategies_diverge": len(set(computed.values())) > 1,
            "both_strategies_have_distinct_options": len(set(computed.values())) > 1 and all(len(v) == 1 for v in matches.values()),
            "selected_key_matches_all_checked_strategies": all(picked in v for v in matches.values()),
            "book_evidence": "UNVERIFIED", "visual_independence": "NOT_PROVEN",
            "teacher_verdict": "NOT_GRANTED", "runtime": "NOT_TESTED"}


def audit(meta: dict, questions: list[dict], queued: dict) -> dict:
    if (meta.get("hashes") != PINNED or meta.get("q_green") != 0
        or queued.get("input_sha256") != PINNED or queued.get("routed_without_human_approval") != 85
        or queued.get("visual_evidence_verified") is not False
        or len(questions) != 104 or len({q["q_id"] for q in questions}) != 104):
        raise ValueError("PINNED_SCOPE_DRIFT")
    q_by_id = {q["q_id"]: q for q in questions}
    r_by_id = {r["q_id"]: r for r in queued["items"]}
    if not set(IDS) <= set(q_by_id) or len(r_by_id) != 85 or not set(IDS) <= set(r_by_id):
        raise ValueError("ROUTING_ID_DRIFT")
    rows = [assess(q_by_id[i], r_by_id[i]) for i in IDS]
    return {"schema": "G2_SIX_SCOPED_CANDIDATE_KEY_AUDIT_v1", "input_sha256": PINNED,
            "status": "CONVENTION_DISPUTE_WITHOUT_BOOK_WITNESS" if any(r["strategies_diverge"] for r in rows)
                      else "CANDIDATE_ARITHMETIC_ONLY_NOT_BOOK_VERIFIED",
            "audited_count": 6, "arithmetic_consistent_under_checked_strategies": sum(r["selected_key_matches_all_checked_strategies"] for r in rows),
            "rounding_convention_disputes": [r["q_id"] for r in rows if r["strategies_diverge"]],
            "human_decisions_requested_now": 0, "source_visual_verified": False,
            "book_correctness_claimed": False, "teacher_approvals": 0, "rows": rows}


def write(result: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "G2-SIX-SCOPED-KEY-AUDIT-v1.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    text = ["# G2 — بازحل شش موردِ ارجاع‌شده از بانک زرد (فقط متن نامزد)", "",
            f"نامزد SHA `{PINNED['candidate']}`؛ `{result['status']}`؛ تصویر همان چاپ/بازی/رأی معلم بررسی نشده است.",
            "", "| شناسه | صفحهٔ نامزد | یافتهٔ محدود |", "|---|---:|---|"]
    for r in result["rows"]:
        text.append(f"| {r['q_id']} | {r['book_page_candidate']} | `{r['status']}` |")
    text += ["", f"{result['arithmetic_consistent_under_checked_strategies']}/۶ کلید نامزد با همهٔ محاسبه‌های صریحِ قابل‌اجرای همین متن سازگارند؛ این عدد صحت کتاب یا ۶ تأیید آموزشی نیست.",
             "در چهار تقریب، دو قرارداد را جداگانه آزمودیم: گردکردنِ هر عدد به دهگان پیش از محاسبه، یا گردکردنِ جواب بعد از محاسبه (فرض half-up برای حالت نیمه). در Q-1067 حاصل‌ها متفاوت‌اند و هر دو در میان گزینه‌ها آمده‌اند؛ کلید فعلی فقط با قرارداد اول سازگار است. سه مورد دیگر تحت این دو قرارداد هم‌نتیجه‌اند؛ پس قرارداد کتاب از کلید آن‌ها نیز استنتاج نمی‌شود.",
             "Q-1042 و Q-1052 بر مبنای متن نامزد به‌ترتیب تفریق صریح و دهگان/یکان افزوده را بازحل می‌کنند؛ برچسب تصویریِ Q-1052 نبودِ تصویر در کتاب یا کافی‌بودن متن برای بازی را ثابت نمی‌کند.",
             "", "**اقدام بعدی:** صفحهٔ ۳۴ همان چاپ و صورت تمرین/راهنمای تقریب را با تصویر و offset تأییدشده بخوانید؛ قرارداد آموزشی را مستقل از کلید و گزینهٔ نامزد ثبت کنید. اگر همچنان دو خوانش مجاز ماند، فقط Q-1067 را همراه شاهد، دو تفسیر و اثرشان به بستهٔ تصمیم محدود ببرید. تا آن زمان نه کلید عوض می‌شود، نه Q/صف سبز، نه رأی جمعی از مالک خواسته می‌شود.", ""]
    (out_dir / "G2-SIX-SCOPED-KEY-AUDIT-v1.fa.md").write_text("\n".join(text), encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out-dir", required=True, type=Path)
    args = p.parse_args()
    try:
        meta = inventory()
        questions = read_questions()
        queued = route(meta, inspect(questions), questions)
        result = audit(meta, questions, queued)
    except (OSError, ValueError, KeyError) as exc:
        print("BLOCKED_SIX_KEY_AUDIT: " + str(exc), file=sys.stderr)
        return 2
    target = args.out_dir if args.out_dir.is_absolute() else ROOT / args.out_dir
    write(result, target)
    print(json.dumps({k: result[k] for k in ("status", "audited_count", "arithmetic_consistent_under_checked_strategies", "rounding_convention_disputes", "human_decisions_requested_now")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
