"""Deterministic, evidence-first triage of G2 v1.2 review queue.

Only schedules independent review. Does not infer textbook facts, approve rows,
copy protected page images, or edit any workbook. Fail closed on source drift.
"""
from __future__ import annotations

import csv
import hashlib
from collections import Counter
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "G2-REVIEW-QUEUE-v1.2.csv"
MAP = ROOT / "PAGE-MAP-KH-G2-MATH-v1.2_teacher-followup.xlsx"
CANDIDATE = ROOT / "khshab-G2-MATH_v1.2_page-goals-draft.xlsx"
OUT = ROOT / "G2-REVIEW-PRIORITY-v1.csv"
SUMMARY = ROOT / "G2-REVIEW-PRIORITY-v1.fa.md"
EXPECTED = {
    QUEUE: "8fbb70606f577b2a5649f958be3870d7aae679f62ee23b4f912a3ea829d2ca6d",
    MAP: "3bfd31b6f3ebfb4f6d8391c7dedd6c25b164b64140c32977fb2f3b2731db70b2",
    CANDIDATE: "18e6b4fa4957e968eca2b3b8066387858a627a99d7d52340064a1e8d8880c618",
}
NUMBERS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
FIELDS = ["اولویت", "صفحهٔ کتاب", "صفحهٔ PDF", "فصل", "شناسهٔ L", "شمار سؤال موجود", "حکم نقشهٔ پیشین", "کدهای ریسک", "ارجاع اصلاح/شاهد", "گام بازبینی", "وضعیت"]


def ascii_num(value: object) -> int:
    return int(str(value).translate(NUMBERS))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run() -> None:
    for path, expected in EXPECTED.items():
        if sha(path) != expected:
            raise ValueError(f"SOURCE_SHA_DRIFT: {path.name}")

    with QUEUE.open(encoding="utf-8-sig", newline="") as f:
        queue = list(csv.DictReader(f))
    if len(queue) != 108:
        raise ValueError("QUEUE_COVERAGE_MISMATCH")

    # Small pinned workbooks: materialize once; repeated random .cell reads on read_only
    # worksheets re-scan XML and turn a 108-page triage into a slow quadratic job.
    wb_map = openpyxl.load_workbook(MAP, data_only=True)
    wb = openpyxl.load_workbook(CANDIDATE, data_only=True)
    try:
        ms = wb_map["نقشهٔ صفحه‌ها"]
        s1, qs = wb["نقشهٔ کتاب (S1)"], wb["بانک سؤال"]
        map_rows = {}
        for row in range(3, ms.max_row + 1):
            if ms.cell(row, 1).value is None:
                continue
            page = ascii_num(ms.cell(row, 1).value)
            if page in map_rows:
                raise ValueError(f"DUPLICATE_PAGE_MAP: {page}")
            map_rows[page] = row
        if set(map_rows) != set(range(1, 145)):
            raise ValueError("MAP_PAGE_COVERAGE_MISMATCH")

        s1_rows = {}
        for row in range(3, s1.max_row + 1):
            if str(s1.cell(row, 1).value or "").strip() == "یادداشت":
                break  # template examples below this sentinel are not cartridge rows
            raw_page = s1.cell(row, 2).value
            try:
                page = ascii_num(raw_page)
            except (ValueError, TypeError):
                continue  # chapter-wide anchors have page ranges; they are not page rows
            if page in s1_rows:
                raise ValueError(f"DUPLICATE_S1_PAGE: {page}")
            s1_rows[page] = row
        if set(s1_rows) != set(range(1, 145)):
            raise ValueError("S1_PAGE_COVERAGE_MISMATCH")

        q_by_lid = Counter()
        for row in range(4, qs.max_row + 1):
            qid = qs.cell(row, 1).value
            if str(qid or "").strip() == "یادداشت":
                break
            if not (isinstance(qid, str) and qid.startswith("Q-")):
                raise ValueError(f"UNEXPECTED_QUESTION_ID: row={row}")
            q_by_lid[str(qs.cell(row, 2).value).strip()] += 1

        result = []
        for item in queue:
            page = ascii_num(item["صفحهٔ کتاب"])
            if page not in range(37, 145):
                raise ValueError(f"QUEUE_PAGE_OUT_OF_SCOPE: {page}")
            mrow, srow = map_rows[page], s1_rows[page]
            lid = str(s1.cell(srow, 1).value)
            chapter = ascii_num(s1.cell(srow, 3).value)
            qcount = q_by_lid[lid]
            pdf_page = ascii_num(ms.cell(mrow, 2).value)
            verdict = str(ms.cell(mrow, 14).value or "؟").strip()
            if any((
                ascii_num(item["صفحهٔ PDF"]) != pdf_page,
                ascii_num(item["فصل"]) != chapter,
                item["شناسهٔ L"] != lid,
                ascii_num(item["محل در S1"]) != srow,
                ascii_num(item["شمار سؤال"]) != qcount,
                item["حکم N نقشهٔ پیشین"] != verdict,
            )):
                raise ValueError(f"QUEUE_MAP_WORKBOOK_MISMATCH: page={page}")
            limited = item["حکم محدود معلم"].strip() not in ("", "—")
            correction = verdict == "✗"
            unobservable = verdict == "؟"
            if verdict not in ("✓", "✗", "؟"):
                raise ValueError(f"UNKNOWN_MAP_VERDICT: page={page}")
            codes = []
            if limited:
                codes.append("SCOPED_TEACHER_VERDICT")
            if correction:
                codes.append("MAP_CORRECTION_REVIEW")
            if unobservable:
                codes.append("PAGE_UNOBSERVABLE")
            if qcount:
                codes.append("EXISTING_ITEMS_CHECK")
            if chapter in (6, 7, 8) and not qcount:
                codes.append("NO_ITEMS_ENGINE_REVIEW")

            priority = "P0" if limited or unobservable else ("P1" if correction and qcount else ("P2" if correction or chapter in (6, 7, 8) else "P3"))
            ref = f"نقشهٔ صفحه‌ها!N{mrow}"
            if correction:
                if not (ms.cell(mrow, 15).value and ms.cell(mrow, 16).value):
                    raise ValueError(f"CORRECTION_WITHOUT_EVIDENCE_POINTER: page={page}")
                ref += f"؛ O{mrow}/P{mrow} (اصلاح/ارجاع؛ فقط در منبعِ مجاز بخوانید)"
            action = "مقابلهٔ مستقل با چاپ و بررسی پاسخ/قابلیت موتور" if qcount else "مقابلهٔ مستقل با چاپ؛ سپس طراحی مهارت و قابلیت موتور"
            if limited:
                action += "؛ حکم معلم فقط در دامنهٔ همان مورد"
            result.append({
                "اولویت": priority, "صفحهٔ کتاب": page, "صفحهٔ PDF": pdf_page, "فصل": chapter,
                "شناسهٔ L": lid, "شمار سؤال موجود": qcount, "حکم نقشهٔ پیشین": verdict,
                "کدهای ریسک": ";".join(codes) or "SOURCE_CHECK_REQUIRED", "ارجاع اصلاح/شاهد": ref,
                "گام بازبینی": action, "وضعیت": "در انتظار شاهد/بازرس مستقل؛ بدون مُهر",
            })
        if {row["صفحهٔ کتاب"] for row in result} != set(range(37, 145)):
            raise ValueError("QUEUE_DUPLICATE_OR_MISSING_PAGE")
    finally:
        wb_map.close()
        wb.close()

    result.sort(key=lambda x: (int(x["اولویت"][1:]), x["صفحهٔ کتاب"]))
    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(result)
    by_priority = Counter(x["اولویت"] for x in result)
    by_chapter = Counter(x["فصل"] for x in result)
    lines = [
        "# اولویت‌بندی ماشینی صف بازبین G2 v1.2 (پیشنهاد، نه حکم کتاب)", "",
        "ورودی‌ها با SHA-256 پین شده‌اند: `G2-REVIEW-QUEUE-v1.2.csv`، نقشهٔ `v1.2_teacher-followup.xlsx` و خشاب `v1.2_page-goals-draft.xlsx`. ساخت مجدد باید بایت‌یکسان باشد؛ PDF/عکس و متن کامل اصلاح‌های کتاب در خروجی تکثیر نمی‌شود.", "",
        f"- کل: **{len(result)}** صفحه (۹۰ ردیف تازه + ۱۸ ردیف رسمی فصل ۴ در صف؛ هر فصل ۳–۸: {', '.join(f'{k}={by_chapter[k]}' for k in range(3,9))}).",
        f"- اولویت‌ها: **{', '.join(f'{k}={by_priority[k]}' for k in ('P0','P1','P2','P3'))}**. P0 = حکم محدود یا صفحهٔ نامشهود؛ P1 = اصلاح نقشه + سؤال موجود؛ P2 = اصلاح دیگر یا فصل‌های ۶–۸ بی‌سؤال؛ P3 = بقیه. این اولویت‌ها رأیِ معلم یا گواهی مشاهدهٔ مستقل نیستند.",
        "- تمام ۱۰۸ ردیف همچنان **در انتظار شاهد تصویری/بازرس مستقل، بدون مُهر** هستند. ✓ در نقشهٔ پیشین فقط وضعیت همان نقشه است، نه تأیید خشاب یا همهٔ تصویرهای صفحه.", "",
        "## نخستین بستهٔ کوچک برای بازبین (نه درخواست تأیید کل صفحه)", "",
        "| اولویت | ص کتاب/PDF | L | سؤال | علت محدود | مرجع |", "|---|---:|---|---:|---|---|",
    ]
    for r in result[:16]:
        lines.append(f"| {r['اولویت']} | {r['صفحهٔ کتاب']}/{r['صفحهٔ PDF']} | `{r['شناسهٔ L']}` | {r['شمار سؤال موجود']} | `{r['کدهای ریسک']}` | {r['ارجاع اصلاح/شاهد']} |")
    lines += ["", "**گیت خروج:** بازبین دوم به کتاب/چاپ همان SHA دسترسی بگیرد، اختلافِ همان فیلد/سؤال را با شاهد ثبت کند؛ موارد مؤثر بر پاسخ به پروندهٔ رأی محدودی برای مالک تبدیل شوند. تا آن زمان CSV تنها برنامهٔ کار است. کارهای بی‌نیاز از حکم همزمان ادامه می‌یابند.", ""]
    SUMMARY.write_text("\n".join(lines), encoding="utf-8")
    print(f"triage: {len(result)} pages, priorities {dict(sorted(by_priority.items()))}; no approvals")


if __name__ == "__main__":
    run()
