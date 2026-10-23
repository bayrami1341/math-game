"""Route the 85 not-yet-checkable G2 candidate Qs; NEVER request 85 human stamps.

This is a metadata/keyword routing HINT, not a visual classifier or an educational
verdict. No question stem, option, PDF or crop is written to the outputs.
Usage: python authoring/tools/build_g2_key_review_queue.py --out-dir authoring/g2-completion
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from audit_g2_completion import PINNED, ROOT, inventory
from audit_g2_independent_keys import inspect
from audit_g2_question_diversity import read_questions

VISUAL_HINTS = ("تصویر", "شکل", "نمودار", "ساعت", "سکه", "جدول", "محور", "تقارن", "رنگ", "خانه")
PRIORITIES = {"P0": 0, "P1": 1, "P2": 2}


def route(meta: dict, audited: dict, questions: list[dict]) -> dict:
    if (meta.get("schema") != "G2_CONTENT_INVENTORY_v1" or meta.get("hashes") != PINNED
        or meta.get("source_visual_status") != "NOT_VERIFIED_IN_THIS_RUN"
        or meta.get("q_total") != 104 or meta.get("q_green") != 0
        or audited.get("schema") != "G2_PARTIAL_INDEPENDENT_KEY_AUDIT_v1"
        or audited.get("status") != "PROVISIONAL_PARTIAL_ARITHMETIC_CHECK_NOT_BOOK_VERIFIED"
        or audited.get("q_count") != 104 or audited.get("not_checkable_count") != 85
        or audited.get("exact_arithmetic_checked") != 19 or audited.get("failures")
        or audited.get("source_visual_verified") is not False
        or audited.get("book_correctness_claimed") is not False):
        raise ValueError("PINNED_INPUT_OR_AUDIT_SCOPE_DRIFT")
    if audited.get("input_sha256", PINNED) != PINNED:
        raise ValueError("AUDIT_INPUT_SHA_DRIFT")
    pages = meta.get("pages")
    if not isinstance(pages, list) or len(pages) != 144:
        raise ValueError("PAGE_INVENTORY_DRIFT")
    by_anchor = {p["s1_id"]: p for p in pages}
    if len(by_anchor) != 144 or len(questions) != 104 or len(audited.get("rows", [])) != 104:
        raise ValueError("ANCHOR_OR_QUESTION_COUNT_DRIFT")
    qs = {q["q_id"]: q for q in questions}
    ar = {r["q_id"]: r for r in audited["rows"]}
    if len(qs) != 104 or set(qs) != set(ar) or len(ar) != 104:
        raise ValueError("QUESTION_AUDIT_JOIN_DRIFT")
    page_counts = Counter()
    result = []
    for qid, q in qs.items():
        a = ar[qid]
        if q["anchor"] not in by_anchor or a["anchor"] != q["anchor"]:
            raise ValueError(f"ANCHOR_MISMATCH: {qid}")
        p = by_anchor[q["anchor"]]
        page_counts[p["book_page"]] += 1
        if a["option_integrity"] != "PASS_OPTIONS_UNIQUE" or a["teacher_verdict"] != "NOT_GRANTED":
            raise ValueError(f"UNSAFE_AUDIT_ROW: {qid}")
        if a["arithmetic_status"] == "CHECKED_EXACT_ARITHMETIC_ONLY":
            continue
        if a["arithmetic_status"] != "NOT_CHECKABLE_NO_BOOK_OR_SEMANTIC_WITNESS":
            raise ValueError(f"UNKNOWN_AUDIT_STATE: {qid}")
        reason = a["reason_code"]
        hint = any(word in q["stem"] for word in VISUAL_HINTS)
        if reason == "APPROXIMATE_OR_CONTEXTUAL":
            lane, action = "ARENA_INDEPENDENT_ARITHMETIC_SPECIALIST", "verify rounding convention against the same edition; do not infer it from the selected option"
        elif reason == "NO_UNIQUE_SELF_CONTAINED_EXPRESSION":
            lane, action = "ARENA_CONTEXT_AND_KEY_REVIEW", "read full question context and recalculate independently; flag image-dependent inputs"
        elif reason == "NOT_AN_EXPLICIT_RESULT_PROMPT":
            lane = "ARENA_VISUAL_WITH_ACHILLES" if hint else "ARENA_SEMANTIC_KEY_REVIEW"
            action = ("verify possible image/table/axis dependency before key audit" if hint else
                      "independently solve the full semantic question; re-route if visual dependence is found")
        else:
            raise ValueError(f"UNRECOGNIZED_REASON: {qid}")
        raw_prio = p["queue_priority"]
        prio = "P0" if raw_prio == "P0" else "P1" if raw_prio == "P1" or hint or reason != "NOT_AN_EXPLICIT_RESULT_PROMPT" else "P2"
        prior_scope = ("PAGE57_QUESTION2_ONLY_NOT_THE_WHOLE_PAGE" if p["book_page"] == 57 else
                       "PAGE80_THREE_PRINTED_EXERCISES_DISTINCT_FROM_FOUR_ADAPTED_EQUATIONS" if p["book_page"] == 80 else
                       "NO_SCOPED_PRIOR_VERDICT_APPLIED_BY_THIS_ROUTER")
        result.append({"q_id": qid, "s1_id": q["anchor"], "chapter": p["chapter"],
                       "book_page_candidate": p["book_page"], "pdf_page_expected_unverified": p["pdf_page_expected"],
                       "prior_verdict_scope_note": prior_scope,
                       "review_priority": prio, "page_queue_priority": raw_prio,
                       "reason_code": reason, "visual_keyword_hint_not_evidence": hint,
                       "first_lane": lane, "next_action": action,
                       "owner_now": "Arena content / independent reviewer",
                       "status": "TRIAGE_ONLY_SOURCE_VISUAL_UNVERIFIED",
                       "human_decision_required_now": False,
                       "human_if_still_disputed": "scoped teacher/owner packet with page, evidence, alternatives and candidate SHA",
                       "book_evidence_status": "UNVERIFIED", "runtime_status": "NOT_TESTED",
                       "teacher_verdict": "NOT_GRANTED"})
    if any(page_counts[p["book_page"]] != p["existing_q_count"] for p in pages):
        raise ValueError("PAGE_Q_DISTRIBUTION_DRIFT")
    if len(result) != 85 or len({r["q_id"] for r in result}) != 85:
        raise ValueError("UNRESOLVED_QUEUE_COUNT_DRIFT")
    result.sort(key=lambda r: (PRIORITIES[r["review_priority"]], r["book_page_candidate"], r["q_id"]))
    return {"schema": "G2_UNCHECKED_Q_ROUTE_v1", "input_sha256": PINNED,
            "status": "PROVISIONAL_TRIAGE_NOT_BOOK_VERIFIED", "questions_total": 104,
            "already_checked_explicit_arithmetic_only": 19,
            "routed_without_human_approval": len(result),
            "priority_counts": dict(sorted(Counter(r["review_priority"] for r in result).items())),
            "reason_counts": dict(sorted(Counter(r["reason_code"] for r in result).items())),
            "lane_counts": dict(sorted(Counter(r["first_lane"] for r in result).items())),
            "human_decisions_requested_now": 0, "visual_evidence_verified": False,
            "note": "Keyword visual hints are triage only; no conclusion that unmarked questions are nonvisual.",
            "items": result}


def write(report: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "G2-UNCHECKED-Q-ROUTES-v1.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# G2 — ریل رسیدگی به ۸۵ سؤالِ هنوز بازحل‌نشده؛ نه ۸۵ درخواست رأی", "",
             "- مبنا: نامزد v1.2 و رسمی v0.5 و صف/نقشه با SHA پین‌شده. سؤال‌ها همه زرد؛ تصویر کتاب و قابلیت موتور هنوز تأیید نشده‌اند.",
             "- ۱۹ سؤال با عبارت محاسباتی صریح قبلاً فقط از نظر همان عبارت بررسی شدند. ۸۵ مورد زیر **غلط تشخیص داده نشده‌اند**؛ صرفاً با آن روش خاص قابل‌داوری نبودند.",
             f"- مسیرهای پیشنهادی: " + "؛ ".join(f"`{k}`: {v}" for k,v in report["lane_counts"].items()) + ".",
             f"- اولویت صف: " + "؛ ".join(f"{k}: {v}" for k,v in report["priority_counts"].items()) + ".",
             f"- درخواست رأی انسانی **الان: {report['human_decisions_requested_now']}**. فقط اختلاف‌های واقعاً باقی‌مانده پس از حسابرسی مستقل و شاهد صفحه به‌صورت بستهٔ محدود با گزینه/اثر به مرجع انسانی می‌روند.",
             "- P0 این صف شامل Qهای لنگرشده به ص۵۷ و ص۸۰ است؛ حکم پیشین ص۵۷ فقط سؤال۲ و حکم ص۸۰ فقط تفکیک سه تمرین چاپی از چهار تساوی اقتباسی را پوشش می‌دهد. هیچ‌یک تأیید تمام صفحه/این Qها نیست. ص۸۹/۱۳۸/۱۳۹ و سایر صفحه‌های بدون Q در صف شاهد ۱۰۸تایی جدا باقی‌اند.",
             "", "## ترتیب قابل اجرا", "",
             "1. موارد P0 و عبارت‌های تقریبی/غیرخودبسنده: وارسی مستقل دامنهٔ سؤال، محاسبه و قرارداد آموزشی؛ حدس از گزینهٔ انتخاب‌شده ممنوع.",
             "2. موارد دارای واژهٔ تصویر/جدول/محور: این واژه‌ها **فقط نشانهٔ مسیریابی‌اند**؛ پس از فراهم‌شدن دسترسی مجاز به تصویر همان چاپ و offset تأییدشده، آشیل/بازرس دوم شواهد را به Q-ID متصل کنند.",
             "3. بقیه: حل معنایی مستقل از پاسخ/یادداشت مؤلف؛ اگر وابستگی تصویری یا آموزشی پیدا شد دوباره مسیردهی. تنها اختلاف‌های حل‌نشده به بستهٔ حکم انسانی.",
             "", "**مرز:** واژه‌جویی نشانهٔ قطعی دیداری‌بودن یا نبودن نیست. این صف رأی معلم، اثبات خوانش صفحه، PASS موتور یا مجوز انتشار نیست؛ PDF، crop و متن سؤال در خروجی نیستند.", ""]
    (out_dir / "G2-UNCHECKED-Q-ROUTES-v1.fa.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out-dir", type=Path, required=True)
    args = p.parse_args()
    try:
        meta = inventory()
        questions = read_questions()
        audit = inspect(questions)
        audit["input_sha256"] = meta["hashes"]
        result = route(meta, audit, questions)
    except (ValueError, KeyError, OSError) as exc:
        print(f"BLOCKED_Q_ROUTE: {exc}", file=sys.stderr)
        return 1
    write(result, args.out_dir if args.out_dir.is_absolute() else ROOT / args.out_dir)
    print(json.dumps({k: result[k] for k in ("status", "routed_without_human_approval", "priority_counts",
                                          "lane_counts", "human_decisions_requested_now")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
