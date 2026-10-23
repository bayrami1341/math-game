"""Independent, deliberately partial Q-key audit of SHA-pinned yellow G2 candidate.

Checks option integrity on all 104 Q, computes *only* unambiguous explicit
addition/subtraction expressions from the question stem, not author notes or
printed book/PDF. Unknown semantics are NOT_CHECKABLE, never an approval.
Usage: python authoring/tools/audit_g2_independent_keys.py --out-dir authoring/g2-completion
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

from audit_g2_completion import ROOT, inventory
from audit_g2_question_diversity import read_questions

TO_ASCII = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩−–", "01234567890123456789--")
EXPRESSION = re.compile(r"(?<![\w])\d+(?:\s*[+\-]\s*\d+)+(?![\w])")
NUMERIC_OPTION = re.compile(r"\d+")
KEY_INDEX = {"الف": 0, "ب": 1, "ج": 2, "د": 3}
EXCLUDE = ("تقریبی", "گردکردن", "گرد کردن", "گردکرده", "تخمین", "حدس")


def exact_expression(stem: str) -> tuple[int | None, str]:
    text = stem.translate(TO_ASCII)
    if any(word in text for word in EXCLUDE):
        return None, "APPROXIMATE_OR_CONTEXTUAL"
    if not ("حاصل" in text or "چند می‌شود" in text or "نتیجه چیست" in text or "= چند" in text):
        return None, "NOT_AN_EXPLICIT_RESULT_PROMPT"
    matches = list(EXPRESSION.finditer(text))
    if len(matches) != 1 or re.findall(r"\d+", text) != re.findall(r"\d+", matches[0].group()):
        return None, "NO_UNIQUE_SELF_CONTAINED_EXPRESSION"
    tokens = re.findall(r"\d+|[+\-]", matches[0].group())
    if len(tokens) < 3 or len(tokens) > 7 or len(tokens) % 2 == 0:
        return None, "EXPRESSION_OUT_OF_SCOPE"
    answer = int(tokens[0])
    for op, part in zip(tokens[1::2], tokens[2::2]):
        answer = answer + int(part) if op == "+" else answer - int(part)
    return answer, "EXPLICIT_ARITHMETIC_ONLY"


def inspect(questions: list[dict]) -> dict:
    if len(questions) != 104 or len({q.get("q_id") for q in questions}) != 104:
        raise ValueError("QUESTION_COUNT_OR_ID_DRIFT")
    rows = []
    for q in questions:
        opts = q.get("options")
        if q.get("stamp") == "تأییدشده" or q.get("answer") not in KEY_INDEX or not isinstance(opts, list) or len(opts) != 4:
            raise ValueError(f"UNSAFE_Q_SCHEMA: {q.get('q_id')}")
        normalized = [" ".join(o.translate(TO_ASCII).split()) for o in opts]
        option_integrity = "PASS_OPTIONS_UNIQUE" if all(normalized) and len(set(normalized)) == 4 else "FAIL_EMPTY_OR_DUPLICATE_OPTIONS"
        answer, reason = exact_expression(q["stem"])
        status = "NOT_CHECKABLE_NO_BOOK_OR_SEMANTIC_WITNESS"
        if answer is not None:
            if all(NUMERIC_OPTION.fullmatch(o) for o in normalized):
                numbers = [int(o) for o in normalized]
                hits = [i for i, n in enumerate(numbers) if n == answer]
                status = ("CHECKED_EXACT_ARITHMETIC_ONLY" if hits == [KEY_INDEX[q["answer"]]]
                          else "FAIL_KEY_OR_DISTRACTOR_FOR_EXPLICIT_EXPRESSION")
                reason = "INDEPENDENT_EXPRESSION_EVALUATION"
            else:
                reason = "NON_NUMERIC_OPTIONS_REQUIRE_HUMAN_OR_SPECIALIZED_AUDIT"
        rows.append({"q_id": q["q_id"], "anchor": q["anchor"],
                     "option_integrity": option_integrity, "arithmetic_status": status,
                     "reason_code": reason, "book_evidence": "UNVERIFIED",
                     "runtime_status": "NOT_TESTED", "teacher_verdict": "NOT_GRANTED"})
    failed = [r for r in rows if r["option_integrity"].startswith("FAIL") or r["arithmetic_status"].startswith("FAIL")]
    checked = sum(r["arithmetic_status"] == "CHECKED_EXACT_ARITHMETIC_ONLY" for r in rows)
    reasons = Counter(r["reason_code"] for r in rows if r["arithmetic_status"].startswith("NOT_CHECKABLE"))
    return {"schema": "G2_PARTIAL_INDEPENDENT_KEY_AUDIT_v1",
            "not_checkable_reasons": dict(sorted(reasons.items())),
            "status": "FAIL_ANSWER_INTEGRITY" if failed else "PROVISIONAL_PARTIAL_ARITHMETIC_CHECK_NOT_BOOK_VERIFIED",
            "q_count": len(rows), "option_integrity_checked": len(rows), "exact_arithmetic_checked": checked,
            "not_checkable_count": len(rows) - checked - sum(r["arithmetic_status"].startswith("FAIL") for r in rows),
            "failures": [r["q_id"] for r in failed], "source_visual_verified": False,
            "book_correctness_claimed": False, "teacher_approvals": 0, "rows": rows}


def write(report: dict, hashes: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    report["input_sha256"] = hashes
    (out_dir / "G2-PARTIAL-INDEPENDENT-KEY-AUDIT-v1.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# G2 — بازحل مستقلِ محدودِ بانک نامزد، نه تأیید کتاب", "",
             f"- وضعیت: `{report['status']}`؛ نامزد `{hashes['candidate']}`؛ سؤال زرد: {report['q_count']}.",
             f"- یکتایی/خالی‌نبودن گزینه‌ها بررسی‌شده: {report['option_integrity_checked']}؛ عبارت محاسباتیِ صریح و خودبسنده: {report['exact_arithmetic_checked']}؛ خارج از دامنهٔ این محاسبه: {report['not_checkable_count']}؛ موارد قرمز: {len(report['failures'])}.",
             "- این ابزار جواب را از عبارتِ صورت سؤال مستقل از یادداشت/کلیدِ تألیف حساب می‌کند؛ واژه‌های تقریبی/گردکردن را کنار می‌گذارد. PASS یک عبارت، شاهد صفحه/تصویر، درستی آموزشی یا اجرای موتور نیست.",
             "- موارد خارج از دامنه به معنی «درست» نیستند؛ باید با روش مستقل تخصصی/شاهد همان چاپ و ممیزی دوم بررسی شوند. هیچ سؤال، صورت چاپی، PDF یا گزینهٔ کامل در گزارش عمومی نوشته نمی‌شود.",
             f"- علت‌های ارجاع برای {report['not_checkable_count']} مورد: " + "؛ ".join(f"`{k}`: {v}" for k, v in report["not_checkable_reasons"].items()) + ".",
             "", "## موردهای قرمز (شناسه، نه صورت سؤال)", "",
             ", ".join(report["failures"]) if report["failures"] else f"هیچ در دامنهٔ بررسی ماشینی فعلی؛ {report['not_checkable_count']} مورد هنوز با این روش قابل بازحل نیستند.", "",
             "نتیجهٔ پایانی: `NOT_READY` برای پوشش کتاب/انتشار؛ مُهر و workbook تغییر نکرده‌اند.", ""]
    (out_dir / "G2-PARTIAL-INDEPENDENT-KEY-AUDIT-v1.fa.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out-dir", type=Path, required=True)
    args = p.parse_args()
    try:
        meta = inventory()
        result = inspect(read_questions())
        if result["q_count"] != meta["q_total"] or meta["q_green"] != 0:
            raise ValueError("INVENTORY_Q_STATUS_DRIFT")
    except (ValueError, OSError, KeyError) as exc:
        print("BLOCKED_KEY_AUDIT: " + str(exc), file=sys.stderr)
        return 1
    write(result, meta["hashes"], args.out_dir if args.out_dir.is_absolute() else ROOT / args.out_dir)
    print(json.dumps({k: result[k] for k in ("status", "q_count", "exact_arithmetic_checked", "not_checkable_count", "failures")}, ensure_ascii=False))
    return 1 if result["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
