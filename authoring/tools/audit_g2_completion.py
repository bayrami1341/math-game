"""Read-only coverage inventory for the *candidate* G2 workbook.

This is NOT a textbook/visual evidence audit, a teacher verdict, or a release gate.
Run: python authoring/tools/audit_g2_completion.py --out-dir authoring/g2-completion
The resulting CSV is one row per printed teaching page, with no PDF imagery.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
CANDIDATE = ROOT / "authoring/khshab-G2-MATH_v1.2_page-goals-draft.xlsx"
QUEUE = ROOT / "authoring/G2-REVIEW-PRIORITY-v1.csv"
PAGEMAP = ROOT / "authoring/PAGE-MAP-KH-G2-MATH-v1.2_teacher-followup.xlsx"
OFFICIAL_REF = "origin/v10.3-beta"
OFFICIAL_PATH = "public/math-game/authoring/khshab-G2-MATH_v0.5.xlsx"
PINNED = {
    "candidate": "18e6b4fa4957e968eca2b3b8066387858a627a99d7d52340064a1e8d8880c618",
    "priority_queue": "f949a58ba7e2852e948170e7bee0a46312b762a7a318e0089fc10053928d3148",
    "pagemap": "3bfd31b6f3ebfb4f6d8391c7dedd6c25b164b64140c32977fb2f3b2731db70b2",
    "official": "f1f339a09a8cba3363c8c526e088063c2d733c62c5e7e4c236eba871f97d2656",
}
FA = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
PRIORITIES = {"P0": 5, "P1": 2, "P2": 56, "P3": 45}


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def integer(value: object) -> int:
    text = str(value or "").translate(FA).strip()
    if not text.isdecimal():
        raise ValueError(f"expected a single page/chapter number, got {text!r}")
    return int(text)


def _rows(ws, prefix: str, start: int):
    for row in ws.iter_rows(min_row=start, values_only=True):
        key = str(row[0] or "").strip()
        if not key or key == "یادداشت":
            break
        if not key.startswith(prefix):
            raise ValueError(f"UNEXPECTED_ROW_KEY: {key!r}")
        yield row


def inventory() -> dict:
    hashes = {"candidate": digest(CANDIDATE), "priority_queue": digest(QUEUE), "pagemap": digest(PAGEMAP)}
    for key, actual in hashes.items():
        if actual != PINNED[key]:
            raise ValueError(f"{key.upper()}_SHA_DRIFT: {actual}")
    official_bytes = subprocess.run(
        ["git", "show", f"{OFFICIAL_REF}:{OFFICIAL_PATH}"], cwd=ROOT, check=True, capture_output=True
    ).stdout
    hashes["official"] = hashlib.sha256(official_bytes).hexdigest()
    if hashes["official"] != PINNED["official"]:
        raise ValueError("OFFICIAL_SHA_DRIFT")

    queue_by_page: dict[int, dict] = {}
    priority_counts: Counter[str] = Counter()
    with QUEUE.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            page = integer(row["صفحهٔ کتاب"])
            if page in queue_by_page or integer(row["صفحهٔ PDF"]) != page + 6:
                raise ValueError(f"QUEUE_DUPLICATE_OR_OFFSET_MISMATCH: {page}")
            queue_by_page[page] = row
            priority_counts[row["اولویت"]] += 1
    if len(queue_by_page) != 108 or priority_counts != PRIORITIES:
        raise ValueError(f"QUEUE_COUNTS_DRIFT: {len(queue_by_page)} / {dict(priority_counts)}")

    wb = openpyxl.load_workbook(CANDIDATE, read_only=True, data_only=True)
    try:
        s1 = list(_rows(wb["نقشهٔ کتاب (S1)"], "L-", 3))
        q = list(_rows(wb["بانک سؤال"], "Q-", 4))
    finally:
        wb.close()
    if len(s1) != 152 or len(q) != 104:
        raise ValueError(f"WORKBOOK_COUNTS_DRIFT: {len(s1)} / {len(q)}")
    s1_ids = [str(r[0]).strip() for r in s1]
    q_ids = [str(r[0]).strip() for r in q]
    if len(set(s1_ids)) != len(s1_ids) or len(set(q_ids)) != len(q_ids):
        raise ValueError("DUPLICATE_S1_OR_Q_ID")
    q_by_anchor: dict[str, list] = defaultdict(list)
    for row in q:
        anchor = str(row[1] or "").strip()
        if anchor not in s1_ids:
            raise ValueError(f"DANGLING_Q_ANCHOR: {row[0]} -> {anchor}")
        q_by_anchor[anchor].append(row)
        if str(row[15] or "").strip() == "تأییدشده":
            raise ValueError(f"UNEXPECTED_GREEN_Q: {row[0]}")
    anchors = []
    pages: dict[int, dict] = {}
    for row in s1:
        lid = str(row[0]).strip()
        if lid in {f"L-{i}00" for i in range(1, 9)}:
            anchors.append(row)
            continue
        page = integer(row[1])
        chapter = integer(row[2])
        if not 1 <= page <= 144 or chapter != (page - 1) // 18 + 1 or page in pages:
            raise ValueError(f"S1_PAGE_OR_CHAPTER_MISMATCH: {lid} p={page} ch={chapter}")
        if str(row[12] or "").strip() == "تأییدشده":
            raise ValueError(f"UNEXPECTED_GREEN_PAGE: {lid}")
        queue_row = queue_by_page.get(page)
        if queue_row and str(queue_row["شناسهٔ L"]).strip() != lid:
            raise ValueError(f"QUEUE_ANCHOR_MISMATCH: p={page}")
        anchored_q = q_by_anchor.get(lid, [])
        pages[page] = {
            "chapter": chapter, "book_page": page, "pdf_page_expected": page + 6,
            "s1_id": lid, "s1_status": str(row[12] or "").strip(),
            "existing_q_count": len(anchored_q),
            "existing_q_ids": ";".join(str(item[0]) for item in anchored_q),
            "queue_priority": queue_row["اولویت"] if queue_row else "NOT_QUEUED_EXISTING",
            "risk_codes": queue_row["کدهای ریسک"] if queue_row else "",
            "visual_evidence_status": "NOT_REVERIFIED_IN_THIS_RUN",
            "breadth_status": "UNVERIFIED_AGAINST_BOOK_AND_RUNTIME",
            "depth_status": "UNVERIFIED_VARIANTS",
        }
    if len(anchors) != 8 or len(pages) != 144 or set(pages) != set(range(1, 145)):
        raise ValueError("S1_PAGE_COVERAGE_GAP_OR_ANCHOR_DRIFT")
    for row in anchors:
        if str(row[12] or "").strip() != "تأییدشده":
            raise ValueError("OFFICIAL_CHAPTER_STAMP_DRIFT")
    if sum(len(q_by_anchor.get(str(row[0]), [])) for row in anchors):
        raise ValueError("Q_ON_CHAPTER_SKELETON_NOT_COUNTED")
    summary = []
    for chapter in range(1, 9):
        p = [pages[i] for i in range((chapter - 1) * 18 + 1, chapter * 18 + 1)]
        summary.append({
            "chapter": chapter, "book_pages": f"{p[0]['book_page']}-{p[-1]['book_page']}",
            "s1_page_rows": len(p), "existing_q_count": sum(item["existing_q_count"] for item in p),
            "pages_without_q": sum(item["existing_q_count"] == 0 for item in p),
            "queued_pages": sum(item["queue_priority"] != "NOT_QUEUED_EXISTING" for item in p),
            "breadth_depth_verdict": "NOT_PROVEN",
        })
    return {
        "schema": "G2_CONTENT_INVENTORY_v1", "hashes": hashes,
        "source_visual_status": "NOT_VERIFIED_IN_THIS_RUN",
        "note": "This is Excel/queue metadata, not verified textbook-page evidence or release permission.",
        "s1_total": len(s1), "s1_official_green_anchors": len(anchors),
        "s1_yellow_page_rows": len(pages), "q_total": len(q), "q_green": 0,
        "review_queue_total": len(queue_by_page), "review_priorities": dict(sorted(priority_counts.items())),
        "chapter_summary": summary, "pages": [pages[i] for i in sorted(pages)],
    }


def write_outputs(report: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "G2-COVERAGE-INVENTORY-v1.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    with (out_dir / "G2-COVERAGE-PAGES-v1.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(report["pages"][0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(report["pages"])
    lines = [
        "# G2 — موجودی مکانیکی پوشش؛ نه گواهِ کامل‌بودن کتاب", "",
        "- **نتیجه:** `CONTENT_NOT_READY`: تنها metadata خشاب/صف شمرده شده است؛ شاهد تصویر، وسعت هدف‌ها و عمق گونه‌های کتاب هنوز اثبات نشده‌اند.",
        f"- رسمی v0.5: `{report['hashes']['official']}`؛ نامزد v1.2: `{report['hashes']['candidate']}`.",
        "- ۱۵۲ S1 = ۸ لنگر سبزِ قدیمی + ۱۴۴ صفحهٔ زرد؛ ۱۰۴ Q همگی زرد؛ ۱۰۸ صفحه در صف بازبینی.",
        "- صفر Q در یک فصل به معنی خلأ بانک آن فصل است؛ Q غیرصفر به معنی پوشش کاملِ هدف/گونه نیست.",
        "", "| فصل | صفحهٔ چاپی | S1 صفحه | Q موجود | صفحهٔ بدون Q | صفحهٔ در صف | گیت وسعت/عمق |",
        "|---:|---|---:|---:|---:|---:|---|",
    ]
    for ch in report["chapter_summary"]:
        lines.append(
            f"| {ch['chapter']} | {ch['book_pages']} | {ch['s1_page_rows']} | {ch['existing_q_count']} | "
            f"{ch['pages_without_q']} | {ch['queued_pages']} | `NOT_PROVEN` |"
        )
    lines += [
        "", "## مرز گزارش", "",
        "این ابزار متن/تصویر کتاب را نمی‌خواند، سؤال تازه یا رأی انسانی نمی‌سازد، هیچ مُهری را تغییر نمی‌دهد و PDF/کراپ را وارد Git نمی‌کند.",
        "نامزد با گیت فنیِ مبدل جدا سنجیده می‌شود؛ برای `READY_FOR_OWNER_DECISION` باید شاهد و ماتریس وسعت×عمق به‌صورت مستقل کامل شوند.", "",
    ]
    (out_dir / "G2-COVERAGE-INVENTORY-v1.fa.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = inventory()
    except (ValueError, OSError, subprocess.CalledProcessError, KeyError) as exc:
        print(f"BLOCKED_INVENTORY: {exc}", file=sys.stderr)
        return 1
    dest = args.out_dir if args.out_dir.is_absolute() else ROOT / args.out_dir
    write_outputs(report, dest)
    print(json.dumps({"status": "CONTENT_NOT_READY", "s1": report["s1_total"], "q": report["q_total"],
                      "chapter_q": [c["existing_q_count"] for c in report["chapter_summary"]]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
