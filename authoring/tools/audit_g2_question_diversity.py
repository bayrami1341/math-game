"""Read-only G2 candidate-bank diversity proxy; NOT book-depth or runtime proof.

Pin the official/candidate/queue/page-map via audit_g2_completion.inventory().
Outputs only counts and stem-template hashes, never exercise text or PDF bytes.
Run: python authoring/tools/audit_g2_question_diversity.py --out-dir authoring/g2-completion
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

from audit_g2_completion import CANDIDATE, ROOT, inventory, _rows

DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
NUMBER = re.compile(r"\d+(?:[٫.,/]\d+)*")
KEYS = {"الف", "ب", "ج", "د"}


def fingerprint(stem: str) -> str:
    # A literal skeleton, not a semantic classification of book exercise types.
    normalized = NUMBER.sub("#", " ".join(stem.translate(DIGITS).split()))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def read_questions() -> list[dict]:
    wb = openpyxl.load_workbook(CANDIDATE, read_only=True, data_only=True)
    try:
        rows = list(_rows(wb["بانک سؤال"], "Q-", 4))
    finally:
        wb.close()
    if len(rows) != 104:
        raise ValueError("QUESTION_COUNT_DRIFT")
    return [{"q_id": str(row[0]).strip(), "anchor": str(row[1]).strip(),
             "domain": str(row[2] or "").strip(), "cpa": str(row[3] or "").strip(),
             "stem": str(row[4] or "").strip(), "structure": str(row[5] or "").strip(),
             "options": [str(row[i] or "").strip() for i in range(6, 10)],
             "answer": str(row[10] or "").strip(), "difficulty": str(row[12] or "").strip(),
             "stamp": str(row[15] or "").strip()} for row in rows]


def analyze(meta: dict, questions: list[dict]) -> dict:
    if (meta.get("schema") != "G2_CONTENT_INVENTORY_v1" or meta.get("q_total") != 104
        or meta.get("q_green") != 0 or meta.get("s1_yellow_page_rows") != 144
        or meta.get("source_visual_status") != "NOT_VERIFIED_IN_THIS_RUN"):
        raise ValueError("INVENTORY_SCOPE_OR_VERSION_DRIFT")
    pages = meta.get("pages")
    if not isinstance(pages, list) or len(pages) != 144:
        raise ValueError("PAGE_INVENTORY_INCOMPLETE")
    by_anchor = {p["s1_id"]: p for p in pages}
    if len(by_anchor) != 144 or len(questions) != 104:
        raise ValueError("PAGE_OR_Q_COUNT_DRIFT")
    ids: set[str] = set()
    buckets: dict[int, list[dict]] = defaultdict(list)
    for q in questions:
        if q["q_id"] in ids or q["anchor"] not in by_anchor:
            raise ValueError(f"DUPLICATE_Q_OR_DANGLING_ANCHOR: {q['q_id']}")
        ids.add(q["q_id"])
        if q["stamp"] == "تأییدشده" or q["answer"] not in KEYS or not all(
            q[k] for k in ("domain", "cpa", "stem", "structure", "difficulty")
        ):
            raise ValueError(f"UNSAFE_Q_METADATA: {q['q_id']}")
        p = by_anchor[q["anchor"]]
        buckets[p["book_page"]].append({"q_id": q["q_id"], "cpa": q["cpa"],
                                         "domain": q["domain"], "structure": q["structure"],
                                         "difficulty": q["difficulty"], "fingerprint": fingerprint(q["stem"])})
    rows = []
    chapter_summary = []
    for chapter in range(1, 9):
        section = [p for p in pages if p["chapter"] == chapter]
        if len(section) != 18:
            raise ValueError(f"CHAPTER_PAGE_DRIFT: {chapter}")
        scoped = [q for p in section for q in buckets[p["book_page"]]]
        templates = Counter(q["fingerprint"] for q in scoped)
        for p in section:
            group = buckets[p["book_page"]]
            if len(group) != p["existing_q_count"] or {q["q_id"] for q in group} != set(filter(None,p["existing_q_ids"].split(";"))):
                raise ValueError(f"QUESTION_ANCHOR_DRIFT: page {p['book_page']}")
            rows.append({"chapter": chapter, "book_page": p["book_page"], "s1_id": p["s1_id"],
                         "queue_priority": p["queue_priority"], "q_count": len(group),
                         "q_ids": [q["q_id"] for q in group],
                         "observed_cpa": sorted({q["cpa"] for q in group}),
                         "observed_structure": sorted({q["structure"] for q in group}),
                         "template_fingerprints": sorted({q["fingerprint"] for q in group}),
                         "book_variant_status": "UNVERIFIED_NO_PDF", "runtime_status": "NOT_TESTED"})
        chapter_summary.append({
            "chapter": chapter, "q_count": len(scoped), "pages_with_q": sum(bool(buckets[p["book_page"]]) for p in section),
            "pages_without_q": sum(not buckets[p["book_page"]] for p in section),
            "observed_cpa": sorted({q["cpa"] for q in scoped}),
            "observed_structure": sorted({q["structure"] for q in scoped}),
            "observed_difficulty": sorted({q["difficulty"] for q in scoped}),
            "observed_domains": sorted({q["domain"] for q in scoped}),
            "distinct_literal_templates": len(templates),
            "repeat_excess_after_number_mask": sum(n-1 for n in templates.values() if n > 1),
            "top_page_q_count": max((len(buckets[p["book_page"]]) for p in section), default=0),
            "book_depth_verdict": "NOT_PROVEN",
        })
    return {"schema": "G2_Q_DIVERSITY_PROXY_v1", "input_sha256": meta["hashes"],
            "status": "PROVISIONAL_METADATA_ONLY_NOT_BOOK_DEPTH", "source_visual_verified": False,
            "engine_interaction_tested": False, "teacher_approvals": 0,
            "note": "Template hashing masks numbers only; different text can encode identical mechanics and identical text may need separate visual interpretation.",
            "questions_counted": len(questions), "chapter_summary": chapter_summary, "pages": rows}


def write(report: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "G2-Q-DIVERSITY-PROXY-v1.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# G2 — نمایهٔ تنوعِ *مشاهده‌شده در بانک نامزد*؛ نه عمق کتاب", "",
             "خروجیِ محاسبه از Excel/صف SHAپین‌شده؛ متن سؤال، PDF یا تصویر در این گزارش منتشر نمی‌شود. همهٔ ۱۰۴ Q زردند. این نمایه فقط برای **انتخاب اولویت ممیزی** است: تعداد زیاد Q/قالب/لایهٔ CPA هرگز عمق گونه‌های واقعی کتاب یا اجرای موتور را اثبات نمی‌کند.", "",
             "| فصل | Q | صفحهٔ دارای Q/۱۸ | CPA دیده‌شده | ساختار دیده‌شده | قالب لفظی با عدد ماسک‌شده | تکرارِ اضافی همان قالب | وضعیت |",
             "|---:|---:|---:|---:|---:|---:|---|",
    ]
    for c in report["chapter_summary"]:
        lines.append(f"| {c['chapter']} | {c['q_count']} | {c['pages_with_q']}/۱۸ | {len(c['observed_cpa'])} | {len(c['observed_structure'])} | {c['distinct_literal_templates']} | {c['repeat_excess_after_number_mask']} | `NOT_PROVEN` |")
    lines += ["", "**اولویت ممیزی:** فصل‌های ۶–۸ (۰ Q)، سپس ۵ و ۳، سپس بررسی تمرکز/تکرار و نبود گونه در ۱، ۲ و ۴. این ترتیب از metadata است؛ شاهد صفحه و نقشهٔ گونه‌های کتاب می‌توانند آن را تغییر دهند.",
              "", "**مرز استنتاج:** صفر Q برای فصل ۶–۸ یک خلأ بانک است؛ غیرصفر Q در فصل‌های دیگر فقط موجودی بانک است. hash الگوی لفظی با اعداد ماسک‌شده طبقه‌بندی معناییِ گونه نیست. ۱۴۴ ردیف صفحه در JSON metadata است؛ هرکدام شاهد بصری/موتور `UNVERIFIED` دارد. هیچ سؤال جدید، Q-ID تازه، مهر یا حکم آموزشی تولید نشده است.", ""]
    (out_dir / "G2-Q-DIVERSITY-PROXY-v1.fa.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out-dir", type=Path, required=True)
    args = p.parse_args()
    try:
        result = analyze(inventory(), read_questions())
    except (ValueError, KeyError, OSError) as exc:
        print("BLOCKED_Q_DIVERSITY: " + str(exc), file=sys.stderr)
        return 1
    path = args.out_dir if args.out_dir.is_absolute() else ROOT / args.out_dir
    write(result, path)
    print(json.dumps({"status": result["status"], "q": result["questions_counted"],
                      "q_by_chapter": [x["q_count"] for x in result["chapter_summary"]]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
