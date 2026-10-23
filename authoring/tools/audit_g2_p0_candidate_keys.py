"""Independent arithmetic-only review of the eight routed P0 yellow Qs.

Never treats candidate exercises as printed book witnesses. Fail-closed on
wording/anchor/schema drift. Do not write stems/options/book extracts to output.
Usage: python authoring/tools/audit_g2_p0_candidate_keys.py --out-dir authoring/g2-completion
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

IDS = ("Q-1069", "Q-1070", "Q-1071", "Q-1072", "Q-1101", "Q-1102", "Q-1103", "Q-1104")
PAGE = {qid: ("L-403", 57) for qid in IDS[:4]} | {qid: ("L-10080", 80) for qid in IDS[4:]}


def normalize(text: str) -> str:
    return " ".join(text.translate(TO_ASCII).replace("\u200c", " ").split())


def solve_equation(text: str) -> int:
    match = re.fullmatch(r"در تساوی (\d+|□|△|○)\s*([+\-])\s*(\d+|□|△|○)\s*=\s*(\d+|□|△|○)، چه عددی در جای خالی می آید[؟?]", text)
    if not match:
        raise ValueError("P0_EQUATION_STEM_DRIFT")
    a, op, b, c = match.groups()
    terms = [a, b, c]
    unknowns = [i for i, item in enumerate(terms) if not item.isdecimal()]
    if len(unknowns) != 1:
        raise ValueError("P0_EQUATION_UNKNOWN_COUNT")
    index = unknowns[0]
    if index == 0:
        result = int(c) - int(b) if op == "+" else int(c) + int(b)
    elif index == 1:
        result = int(c) - int(a) if op == "+" else int(a) - int(c)
    else:
        result = int(a) + int(b) if op == "+" else int(a) - int(b)
    filled = [result if i == index else int(value) for i, value in enumerate(terms)]
    if result < 0 or (filled[0] + filled[1] if op == "+" else filled[0] - filled[1]) != filled[2]:
        raise ValueError("P0_EQUATION_INCONSISTENT")
    return result


def independent_value(qid: str, text: str) -> int:
    if qid == "Q-1069":
        m = re.fullmatch(r"ارزش (\d+) سکّهٔ (\d+) ریالی با ارزش چند سکّهٔ (\d+) ریالی برابر است[؟?]", text)
        if not m:
            raise ValueError("P0_COIN_STEM_DRIFT")
        count, coin, target = map(int, m.groups())
        if target <= 0 or (count * coin) % target:
            raise ValueError("P0_COIN_UNIT_OR_REMAINDER")
        return count * coin // target
    if qid == "Q-1071":
        m = re.fullmatch(r"(\d+) سکّهٔ (\d+) ریالی و (\d+) سکّهٔ (\d+) ریالی روی هم چند ریال می شوند[؟?]", text)
        if not m:
            raise ValueError("P0_COIN_STEM_DRIFT")
        a, b, c, d = map(int, m.groups())
        return a * b + c * d
    if qid in ("Q-1070", "Q-1072"):
        if qid == "Q-1070":
            m = re.fullmatch(r"الگوی شمارش (\d+)تایی را ادامه دهید: (\d+)، (\d+)، (\d+)، … عدد بعدی چیست[؟?]", text)
            if not m:
                raise ValueError("P0_PATTERN_STEM_DRIFT")
            step, a, b, c = map(int, m.groups())
            if step <= 0 or b - a != step or c - b != step or a != step:
                raise ValueError("P0_PATTERN_NOT_ARITHMETIC")
            return c + step
        m = re.fullmatch(r"در الگوی (\d+)، (\d+)، (\d+)، (\d+)، … پنجمین عدد کدام است[؟?]", text)
        if not m:
            raise ValueError("P0_PATTERN_STEM_DRIFT")
        a, b, c, d = map(int, m.groups())
        if b - a <= 0 or b - a != c - b or c - b != d - c:
            raise ValueError("P0_PATTERN_NOT_ARITHMETIC")
        return d + (b - a)
    if qid in IDS[4:]:
        return solve_equation(text)
    raise ValueError("UNSUPPORTED_P0_ID")


def assess(q: dict, routed: dict) -> dict:
    qid = q.get("q_id")
    if (qid not in PAGE or q.get("anchor") != PAGE[qid][0] or routed.get("s1_id") != PAGE[qid][0]
        or routed.get("book_page_candidate") != PAGE[qid][1]
        or routed.get("review_priority") != "P0" or routed.get("teacher_verdict") != "NOT_GRANTED"
        or routed.get("book_evidence_status") != "UNVERIFIED"):
        raise ValueError("P0_ROUTE_OR_SCOPE_DRIFT")
    options = q.get("options")
    if q.get("stamp") == "تأییدشده" or q.get("answer") not in KEY_INDEX or not isinstance(options, list) or len(options) != 4:
        raise ValueError("P0_UNSAFE_QUESTION_STATE")
    normalized = [normalize(o) for o in options]
    if not all(re.fullmatch(r"\d+", x) for x in normalized) or len(set(normalized)) != 4:
        raise ValueError("P0_OPTIONS_NOT_UNIQUE_NUMERIC")
    answer = independent_value(qid, normalize(q["stem"]))
    matches = [i for i, n in enumerate(normalized) if int(n) == answer]
    verdict = ("CANDIDATE_ARITHMETIC_CONSISTENT_ONLY" if matches == [KEY_INDEX[q["answer"]]] else
               "FAIL_CANDIDATE_KEY_OR_OPTIONS")
    return {"q_id": qid, "s1_id": q["anchor"], "book_page_candidate": PAGE[qid][1],
            "arithmetic_status": verdict, "prior_verdict_applied_to_q": False,
            "printed_exercise_identity": "NOT_ESTABLISHED", "book_visual_evidence": "UNVERIFIED",
            "runtime_status": "NOT_TESTED", "teacher_verdict": "NOT_GRANTED"}


def audit(meta: dict, questions: list[dict], routed: dict) -> dict:
    if (meta.get("hashes") != PINNED or meta.get("q_green") != 0 or len(questions) != 104
        or len({q.get("q_id") for q in questions}) != 104
        or routed.get("input_sha256") != PINNED or routed.get("routed_without_human_approval") != 85
        or routed.get("priority_counts", {}).get("P0") != 8 or routed.get("visual_evidence_verified") is not False):
        raise ValueError("P0_PINNED_INPUT_DRIFT")
    qs = {q["q_id"]: q for q in questions}
    rows = routed.get("items", [])
    by_id = {r["q_id"]: r for r in rows}
    if len(by_id) != 85 or {r["q_id"] for r in rows if r["review_priority"] == "P0"} != set(IDS):
        raise ValueError("P0_QUEUE_ID_DRIFT")
    assessed = [assess(qs[qid], by_id[qid]) for qid in IDS]
    failures = [x["q_id"] for x in assessed if x["arithmetic_status"].startswith("FAIL")]
    return {"schema": "G2_P0_CANDIDATE_KEY_AUDIT_v1", "input_sha256": PINNED,
            "status": "FAIL_CANDIDATE_KEY" if failures else "CANDIDATE_ARITHMETIC_ONLY_NOT_BOOK_VERIFIED",
            "checked_count": len(assessed), "failures": failures, "rows": assessed,
            "source_visual_verified": False, "book_correctness_claimed": False,
            "teacher_approvals": 0, "human_decisions_requested_now": 0}


def write(result: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "G2-P0-CANDIDATE-KEY-AUDIT-v1.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# G2 — بازحل مستقلِ ۸ Q اولویت P0؛ فقط حساب نامزد، نه صفحهٔ چاپی", "",
             f"SHA نامزد `{PINNED['candidate']}`؛ `{result['status']}`؛ {result['checked_count']} متن نامزد بررسی شدند، کلید/گزینهٔ قرمز در همین دامنه: {len(result['failures'])}.",
             "", "| صفحهٔ نامزد | Qهای حساب‌شده | مرز حکم پیشین |",
             "|---:|---|---|",
             "| ۵۷ | Q-1069..Q-1072 | حکم کاربر دربارهٔ سؤال۲ چاپیِ «۸۰ سکهٔ ۱ ریالی» است؛ Q-1069 با شمار دیگری صورت‌بندی شده و اقتباسِ نامزد است. پاسخ‌پذیری حسابی آن شاهدِ انطباق با سؤال۲ یا کل صفحه نیست. |",
             "| ۸۰ | Q-1101..Q-1104 | چهار تساویِ بانک اقتباس از مشاهدهٔ کاربرند، نه چهار تمرین شماره‌دار چاپی؛ نماد جای‌خالی در دو مورد با نقلِ شکل‌های کاربر نیز یکی نیست. این بررسی آن‌ها را به تمرین چاپی تبدیل نمی‌کند. |",
             "", "جواب‌ها از ساختار مبلغ/الگو/تساوی محاسبه و سپس با چهار گزینه و کلید نامزد مقایسه شدند؛ از خود کلید برای تولید جواب استفاده نشده است. نه stem، نه گزینه، نه تصویر/PDF در گزارش منتشر می‌شود.",
             "", "**گام بعدی:** با تصویر همان چاپ، جداگانه واحد تمرین چاپی ص۵۷ سؤال۲ و سه تمرین شماره‌دار ص۸۰ و نسبت بازی اقتباسی با آن‌ها را ثبت کنید. هشت ردیف همچنان زرد و صف شاهد P0 باز می‌ماند؛ صفر درخواست رأی اکنون، صفر مُهر تازه.", ""]
    (out_dir / "G2-P0-CANDIDATE-KEY-AUDIT-v1.fa.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out-dir", type=Path, required=True)
    args = p.parse_args()
    try:
        meta = inventory()
        questions = read_questions()
        result = audit(meta, questions, route(meta, inspect(questions), questions))
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print("BLOCKED_P0_CANDIDATE_AUDIT: " + str(exc), file=sys.stderr)
        return 2
    write(result, args.out_dir if args.out_dir.is_absolute() else ROOT / args.out_dir)
    print(json.dumps({"status": result["status"], "checked_count": result["checked_count"],
                      "failures": result["failures"], "human_decisions_requested_now": 0}, ensure_ascii=False))
    return 1 if result["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
