"""Build a bounded, asynchronous visual-review inbox (NOT an AI scan).

No PDF bytes/image are available here. This tool inventories the claims and
refuses to mark any page visually scanned, accepted or green. Only a later
verified render + actual vision observation can change visual status.
Usage: python authoring/tools/build_g2_visual_review_inbox.py --out-dir authoring/g2-completion
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from audit_g2_completion import ROOT, PINNED, inventory

QUEUE = ROOT / "authoring/G2-REVIEW-PRIORITY-v1.csv"
FOCUS = (34, 38, 46, 57, 80, 89, 138, 139)
CLAIMS = {
    34: ("Q-1067: کلید نامزد با گردکردن عددها پیش از حساب سازگار است؛ دو قرارداد محاسبه جواب متفاوت می‌دهند.", "هنوز حکمی دربارهٔ دستور چاپی تقریب داده نشده است."),
    38: ("هدف پیشنهادی باید با دستور رسم شش‌ضلعی سنجیده شود، نه با فرض وجود شکل آماده.", "حکم قبلی فقط دربارهٔ دستور رسم همین صفحه است."),
    46: ("بنر «تقارن» باید از تمرین/شکل صفحه جدا شناخته شود.", "حکم قبلی فقط دربارهٔ بنر همین صفحه است."),
    57: ("Q-1069 نامزد ۶۰ سکّهٔ ۱ ریالی دارد؛ این متن را به سؤال۲ چاپی نسبت ندهید.", "حکم محدود کاربر: سؤال۲ چاپی ۸۰ سکّهٔ ۱ ریالی دارد؛ نه حکم کل صفحه."),
    80: ("چهار تساوی Q-1101..Q-1104 اقتباس‌اند، نه چهار تمرین چاپی.", "حکم محدود کاربر: سه تمرین جای‌خالی شماره‌دار، سپس جدول شگفت‌انگیز؛ چهار تساوی در تصویر ارسالی دیده شدند."),
    89: ("شمارهٔ تمرین‌ها با نامزد صفحه مقابله شود.", "حکم محدود کاربر: شماره‌های تمرین ۳ تا ۶؛ نه تأیید بقیهٔ صفحه."),
    138: ("عنوان بخش در نقشهٔ نامزد با صفحه سنجیده شود.", "حکم محدود کاربر: «تمرین»؛ نه تأیید کل صفحه."),
    139: ("عنوان بخش در نقشهٔ نامزد با صفحه سنجیده شود.", "حکم محدود کاربر: «انتخاب نمودار»؛ نه تأیید کل صفحه."),
}


def build(meta: dict, rows: list[dict]) -> dict:
    if (meta.get("hashes") != PINNED or meta.get("source_visual_status") != "NOT_VERIFIED_IN_THIS_RUN"
        or meta.get("q_green") != 0 or len(meta.get("pages", [])) != 144 or len(rows) != 108):
        raise ValueError("VISUAL_INBOX_INPUT_DRIFT")
    by_page = {int(r["صفحهٔ کتاب"]): r for r in rows}
    page_map = {p["book_page"]: p for p in meta["pages"]}
    if set(by_page) != set(range(37, 145)) or set(page_map) != set(range(1, 145)):
        raise ValueError("VISUAL_INBOX_PAGE_COVERAGE_DRIFT")
    items = []
    for page in sorted(set(by_page) | {34}):
        p = page_map[page]
        r = by_page.get(page)
        expected = p["pdf_page_expected"]
        if (r and (int(r["صفحهٔ PDF"]) != expected or r["شناسهٔ L"] != p["s1_id"]
                   or int(r["شمار سؤال موجود"]) != p["existing_q_count"])):
            raise ValueError(f"VISUAL_INBOX_ANCHOR_DRIFT:{page}")
        claim, prior = CLAIMS.get(page, ("مطابقت هدف/گونه/اعداد نامزد با صفحهٔ چاپی هنوز بررسی نشده است.", "حکم محدود قبلی در این inbox ثبت نشده."))
        items.append({"book_page_candidate": page, "pdf_page_expected_unverified": expected,
                      "s1_id": p["s1_id"], "queue_priority": r["اولویت"] if r else "P1_SCOPED_Q_EXCEPTION",
                      "candidate_q_count": p["existing_q_count"], "candidate_claim_to_check": claim,
                      "previous_user_scope_not_visual_scan": prior,
                      "ai_visual_scan": "NOT_PERFORMED", "ai_printed_comparison": "UNKNOWN_NO_VERIFIED_RENDER",
                      "visual_evidence_sha256": None, "source_pdf_sha256_verified_here": None,
                      "optional_human_verdict": "NOT_REQUESTED", "teacher_stamp": "NOT_GRANTED",
                      "next_without_user": "continue candidate/engine/key audits in parallel; keep this page yellow until verified visual scan",
                      "stop_whole_project": False})
    return {"schema": "G2_ASYNC_VISUAL_REVIEW_INBOX_v1", "input_sha256": PINNED,
            "status": "VISUAL_INBOX_READY_SCAN_NOT_PERFORMED", "pages": len(items),
            "visual_pages_scanned": 0, "pages_approved_from_inbox": 0,
            "human_decisions_requested_now": 0, "worker_deployed": False,
            "note": "Queue page numbers are proposed offsets, not visual verification; human absence does not approve any page and does not stop independent tasks.",
            "items": items}


def write(report: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "G2-ASYNC-VISUAL-REVIEW-INBOX-v1.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# صندوق بررسی تصویری G2 — اول هوش مصنوعی، سپس نظر موردیِ اختیاری شما", "",
             f"وضعیت واقعی: `{report['status']}`؛ {report['pages']} ردیف (۱۰۸ صفحهٔ صف + ص۳۴ برای اختلاف تقریب). **۰ صفحه در محیط آرنا اسکن تصویری شده**؛ هیچ تطابق تصویری یا رأی نهایی ادعا نمی‌شود. offset PDF همهٔ ردیف‌ها پیشنهادی است.",
             "", "| صفحهٔ کتاب / PDF احتمالی | ادعای مشخص برای مقابله | مشاهدهٔ تصویری AI | نقش شما (اختیاری و موردی) |",
             "|---|---|---|---|"]
    for item in report["items"]:
        if item["book_page_candidate"] in FOCUS:
            lines.append(f"| {item['book_page_candidate']} / {item['pdf_page_expected_unverified']} | {item['candidate_claim_to_check']} | **هنوز اسکن نشده؛ تطابق نامعلوم** | اگر بعد از گزارش تصویری مغایرت دیدید، همان ادعا را تأیید/اصلاح/رد کنید؛ حکم پیشین: {item['previous_user_scope_not_visual_scan']} |")
    lines += ["", "## روش اجرا و مسیر نبودِ پاسخ", "",
              "1. فقط پس از ورود امن PDF به vault خارج از Git، SHA/تعداد صفحه را گیت کنید، offset چاپ/PDF را مستقل تثبیت کنید و **تصویر همان صفحه** را واقعاً به بینایی AI بدهید. OCR یا metadata برابر اسکن بصری نیست.",
              "2. خروجی AI برای هر ردیف: تصویر/منشأ هش‌شده و ذخیره‌شده فقط در vault؛ ادعای جزئی (عنوان/دستور/اعداد/شکل/شمارهٔ تمرین)؛ نتیجهٔ `MATCH / MISMATCH / UNCERTAIN` و دلیل کوتاه. مورد اختلاف به بازرس مستقل می‌رود؛ ادعای match نیز تا وارسی دوم/گیت بازی، سبز نمی‌شود.",
              "3. شما فقط می‌توانید روی همان ردیف با «تأیید»، «اصلاح: ...»، «رد» یا «تعویق» پاسخ بدهید. رأیِ محدود با چاپ/صفحه/شناسه/نسخه ثبت می‌شود. بدون پاسخ شما وضعیت همان ردیف `WAITING_FOR_EVIDENCE_OR_REVIEW` می‌ماند؛ نه تأیید ضمنی، نه توقف سایر صفحه‌ها و کارهای فنی.",
              "4. صف شبانه‌روزی در این محیط هنوز مستقر نیست (`NOT_DEPLOYED`). خودکار بودنِ فعلی: تولید صف و ممیزی‌های مستقل هنگام اجرا؛ پیگیری ۲۴ساعته فقط پس از صف بادوام/هویت سرویس و آزمون واقعی Z.ai ادعا خواهد شد.",
              "", "**مانع فعلی:** Drive metadata و متن استخراج‌شدهٔ C205 موجودند، ولی بایت/رندرِ معتبر در vault آرنا در دسترس نیست. لینک تازه از شما لازم نیست؛ این مانع فقط ادعای اسکن تصویری/حکم کتاب برای ردیف‌ها را متوقف می‌کند، نه همهٔ کارهای مستقل خط محتوا.", ""]
    (out_dir / "G2-ASYNC-VISUAL-REVIEW-INBOX-v1.fa.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out-dir", type=Path, required=True)
    args = p.parse_args()
    try:
        meta = inventory()
        with QUEUE.open(encoding="utf-8-sig", newline="") as f:
            result = build(meta, list(csv.DictReader(f)))
    except (ValueError, KeyError, OSError, TypeError) as exc:
        print("BLOCKED_VISUAL_INBOX: " + str(exc), file=sys.stderr)
        return 2
    out_dir = args.out_dir if args.out_dir.is_absolute() else ROOT / args.out_dir
    write(result, out_dir)
    print(json.dumps({k: result[k] for k in ("status", "pages", "visual_pages_scanned", "human_decisions_requested_now")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
