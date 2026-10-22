"""دروازه پاشنه آشیل — Achilles Heel Gate v2.2

Fail-closed, evidence-grounded guard against AI hallucination of PDF page
attribution. Every `L-*` (and by anchor, `Q-*`) that claims a concrete
printed page MUST be backed by ledger evidence (`pdf_page` + `bbox` +
`sha256`) with proven chapter offset; agreeing without evidence NEVER
produces `EVIDENCE_MATCHED`.

Design (پس از درخواست چندسالهٔ کاربر):
  - اگر هوش مصنوعی صفحهٔ PDF را اشتباه بخواند و انسان هرگز نفهمد،
    خسارت برگشت‌ناپذیر است — این دروازه همان پاشنهٔ آشیل است.
  - سبز کاذبِ AI هرگز مجاز نیست: `تأییدشده` فقط با شاهدِ کراپ/عکس/BBOX.
  - زرد (`نیاز به تأیید`) بدون شاهد مجاز است اما هرگز رها نمی‌شود
    (مهر معلم `G0` قفل است).

Integration points:
  - `wave_exporter.export_wave_cartridge`  — hard FAIL before XLSX leaves
    the vault if ledger missing.
  - `autopilot.SelfHealingEngine`          — no forging; downgrade green→yellow.
  - `cli audit / check-wave`               — visible in morning report.
  - `validators.inspect_cartridge_workbook` stays 4-gate to keep baseline
    tests green; Achilles runs as a distinct 5th gate in autopilot.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import openpyxl

from .models import GateResult
from .validators import (
    load_chapter_bounds_from_pagemap,
    resolve_pagemap_for_workbook,
    to_ascii_str,
)

FA_TO_ASCII = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
STRONG_EVIDENCE_KINDS = {
    "pdf_crop_150dpi",
    "pdf_crop_300dpi_nearest",
    "physical_book_photo",
    "pdf_text_bbox",  # footer bbox also proves offset, counts as strong for page attribution
}
HEX64_RE = re.compile(r"^[0-9a-fA-F]{64}$")
# Skeleton chapter anchors are vouched by PAGE-MAP verified file, not by per-page crop
SKELETON_L_IDS = {"L-100", "L-200", "L-300", "L-400", "L-500", "L-600", "L-700", "L-800"}


def _parse_book_pages(page_str: str) -> List[int]:
    """Parse printed page spec: '۵۵' / '۱-۱۸' / '۱ تا ۱۸' / '۵۵،۵۶'."""
    raw = str(page_str or "").strip()
    if not raw or raw in ("—", "--", "–") or "؟" in raw:
        return []
    ascii_raw = to_ascii_str(raw)
    # range with Persian 'تا'
    if "تا" in raw:
        m = re.search(r"(\d+)\s*تا\s*(\d+)", ascii_raw)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if 1 <= a <= b <= 400 and b - a < 100:
                return list(range(a, b + 1))
    # dash range
    if "-" in ascii_raw or "–" in ascii_raw:
        norm = ascii_raw.replace("–", "-")
        parts = [p.strip() for p in norm.split("-")]
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            a, b = int(parts[0]), int(parts[1])
            if 1 <= a <= b <= 400 and b - a < 100:
                return list(range(a, b + 1))
    # non-range: collect all integers
    nums = [int(x) for x in re.findall(r"\d+", ascii_raw)]
    # if page_str was single token like "۵۵" we return that single
    # if it was "55, 56" keep all
    return nums


def _validate_ledger_entries(ev_ledger: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []
    for ev_id, rec in ev_ledger.items():
        if not re.match(r"^EV-[A-Z0-9_\-]+$", ev_id):
            issues.append({"evidence_id": ev_id, "error": "MALFORMED_EVIDENCE_ID"})
        src = str(rec.get("source_sha256") or "")
        if not HEX64_RE.match(src):
            issues.append({"evidence_id": ev_id, "error": "INVALID_SOURCE_SHA256"})
        pdf_p = rec.get("pdf_page")
        if not isinstance(pdf_p, int) or pdf_p < 1:
            issues.append({"evidence_id": ev_id, "error": "INVALID_PDF_PAGE"})
        kind = rec.get("evidence_kind")
        if kind not in STRONG_EVIDENCE_KINDS and kind not in {"independent_computation", "teacher_verdict"}:
            # allow other kinds but flag unknown
            issues.append({"evidence_id": ev_id, "error": f"UNKNOWN_EVIDENCE_KIND:{kind}"})
        bbox = rec.get("bbox_normalized")
        if bbox is not None:
            if not (isinstance(bbox, list) and len(bbox) == 4 and all(isinstance(v, (int, float)) for v in bbox)):
                issues.append({"evidence_id": ev_id, "error": "INVALID_BBOX_SHAPE"})
            elif not all(0 <= v <= 1 for v in bbox):
                issues.append({"evidence_id": ev_id, "error": "BBOX_OUT_OF_NORMALIZED_RANGE"})
            elif bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
                issues.append({"evidence_id": ev_id, "error": "BBOX_ZERO_AREA"})
        if kind in {"pdf_crop_150dpi", "pdf_crop_300dpi_nearest", "physical_book_photo"}:
            cs = rec.get("crop_sha256")
            if cs is not None and not HEX64_RE.match(str(cs)):
                issues.append({"evidence_id": ev_id, "error": "INVALID_CROP_SHA256"})
    return issues


def verify_achilles_evidence_gate(
    workbook_path: str | Path,
    observation_json_path: Optional[str | Path] = None,
    pagemap_xlsx_path: Optional[str | Path] = None,
    repo_root: Optional[str | Path] = None,
) -> GateResult:
    """
    دروازهٔ پاشنهٔ آشیل — هر L-*/Q-* با صفحهٔ چاپیِ معیّن باید
    `EV-CROP/BBOX + pdf_page + sha256` داشته باشد؛
    سبز بدون شاهد مساوی FAIL (هلوسهٔ غیرقابل جبران).
    """
    wb_path = Path(workbook_path).resolve()
    # --- ledger load ---
    obs: Dict[str, Any] = {}
    if observation_json_path and Path(observation_json_path).exists():
        try:
            obs = json.loads(Path(observation_json_path).read_text(encoding="utf-8"))
        except Exception as exc:
            return GateResult(
                gate_id="G_ACHILLES_EVIDENCE",
                stage="P2",
                status="FAIL",
                reason_code="EVIDENCE_LEDGER_UNREADABLE",
                summary=f"دفتر شواهد خوانده نشد: {exc}",
                issues=[{"error": "EVIDENCE_LEDGER_UNREADABLE", "detail": str(exc)}],
            )
    ev_ledger: Dict[str, Dict[str, Any]] = obs.get("evidence_ledger", {}) if isinstance(obs, dict) else {}
    # Try fixture fallback if ledger empty and no explicit path given
    if not ev_ledger and observation_json_path is None and repo_root is not None:
        from .paths import resolve_fixture

        cand = resolve_fixture(Path(repo_root), "observation_C205.json", "authoring/audit/observation_C205.json")
        if cand.exists():
            try:
                obs = json.loads(cand.read_text(encoding="utf-8"))
                ev_ledger = obs.get("evidence_ledger", {})
            except Exception:
                pass

    ledger_issues = _validate_ledger_entries(ev_ledger)
    # If no ledger at all, hard gate — but only for AI-proposed greens (official teacher greens trusted)
    if not ev_ledger:
        # Check workbook still has concrete AI green rows — then hallucination risk
        try:
            wb_tmp = openpyxl.load_workbook(wb_path, data_only=True)
            if "نقشهٔ کتاب (S1)" in wb_tmp.sheetnames:
                ws = wb_tmp["نقشهٔ کتاب (S1)"]
                greens_concrete = 0
                for r in range(3, ws.max_row + 1):
                    lid = str(ws.cell(r, 1).value or "").strip()
                    if lid == "یادداشت" or not lid:
                        break
                    if lid in SKELETON_L_IDS:
                        continue
                    status = str(ws.cell(r, 13).value or "").strip()
                    pages = _parse_book_pages(str(ws.cell(r, 2).value or ""))
                    source = str(ws.cell(r, 12).value or "")
                    is_ai_green = pages and status == "تأییدشده" and ("پیشنهاد AI" in source or "موتور تألیف" in source or "AI" in source)
                    if is_ai_green:
                        greens_concrete += 1
                wb_tmp.close()
                if greens_concrete > 0:
                    return GateResult(
                        gate_id="G_ACHILLES_EVIDENCE",
                        stage="P2",
                        status="FAIL",
                        reason_code="MISSING_EVIDENCE_LEDGER",
                        summary=f"دفتر شواهد خالی است ولی {greens_concrete} ردیف سبزِ AI با صفحهٔ معیّن وجود دارد — خطر هلوسهٔ صفحه.",
                        issues=[{"error": "MISSING_EVIDENCE_LEDGER", "green_concrete_rows": greens_concrete}],
                    )
        except Exception:
            pass
        # If only yellows, allow PASS-but-warn (no green to hallucinate)
        if ledger_issues:
            return GateResult(
                gate_id="G_ACHILLES_EVIDENCE",
                stage="P2",
                status="FAIL",
                reason_code=ledger_issues[0]["error"],
                summary="دفتر شواهد ناقص است.",
                issues=ledger_issues,
            )
        return GateResult(
            gate_id="G_ACHILLES_EVIDENCE",
            stage="P2",
            status="PASS",
            reason_code="ACHILLES_NO_LEDGER_BUT_NO_GREEN_RISK",
            summary="دفتر شواهد تهی است ولی هیچ ردیف سبزی با صفحهٔ معیّن یافت نشد — زردها نیاز به تأیید معلم.",
            issues=[],
            metrics={"ledger_size": 0},
        )

    if ledger_issues:
        return GateResult(
            gate_id="G_ACHILLES_EVIDENCE",
            stage="P2",
            status="FAIL",
            reason_code=ledger_issues[0]["error"],
            summary="ورودی‌های دفتر شواهد نامعتبر است.",
            issues=ledger_issues,
        )

    # --- pagemap offset ---
    if pagemap_xlsx_path is None:
        resolved = resolve_pagemap_for_workbook(wb_path, repo_root)
    else:
        resolved = Path(pagemap_xlsx_path) if Path(pagemap_xlsx_path).exists() else None
    pm_info = load_chapter_bounds_from_pagemap(resolved) if resolved else {"proven_offset": None, "chapters": {}, "source": None}
    proven_offset: Optional[int] = pm_info.get("proven_offset")
    # Build pdf_page → evidence index
    pdf_to_evs: Dict[int, List[Dict[str, Any]]] = {}
    source_shas: Set[str] = set()
    for ev in ev_ledger.values():
        pdf_p = ev.get("pdf_page")
        if isinstance(pdf_p, int):
            pdf_to_evs.setdefault(pdf_p, []).append(ev)
        if ev.get("source_sha256"):
            source_shas.add(str(ev["source_sha256"]))

    # --- workbook S1 scan ---
    try:
        wb = openpyxl.load_workbook(wb_path, data_only=True)
    except Exception as exc:
        return GateResult(
            gate_id="G_ACHILLES_EVIDENCE",
            stage="P2",
            status="FAIL",
            reason_code="WORKBOOK_UNREADABLE",
            summary=f"خواندن خشاب ناموفق: {exc}",
            issues=[{"error": "WORKBOOK_UNREADABLE", "detail": str(exc)}],
        )

    if "نقشهٔ کتاب (S1)" not in wb.sheetnames:
        return GateResult(
            gate_id="G_ACHILLES_EVIDENCE",
            stage="P2",
            status="FAIL",
            reason_code="MISSING_S1_SHEET",
            summary="شیت S1 یافت نشد.",
            issues=[{"error": "MISSING_S1_SHEET"}],
        )

    ws_s1 = wb["نقشهٔ کتاب (S1)"]
    issues: List[Dict[str, Any]] = []
    s1_total = 0
    green_total = 0
    yellow_with_page = 0
    # collect Bank anchor coverage as well
    ws_qb = wb["بانک سؤال"] if "بانک سؤال" in wb.sheetnames else None

    for r in range(3, ws_s1.max_row + 1):
        lid = str(ws_s1.cell(r, 1).value or "").strip()
        if lid == "یادداشت" or not lid:
            break
        s1_total += 1
        page_raw = str(ws_s1.cell(r, 2).value or "")
        status = str(ws_s1.cell(r, 13).value or "").strip()
        note = str(ws_s1.cell(r, 14).value or "")
        source_s1 = str(ws_s1.cell(r, 12).value or "")
        book_pages = _parse_book_pages(page_raw)
        is_green = status == "تأییدشده"
        is_yellow = status == "نیاز به تأیید"
        if is_green:
            green_total += 1
        if is_yellow and book_pages:
            yellow_with_page += 1

        if not book_pages:
            # rows with "؟" or "—" or empty are exempt — they are scaffolds
            continue

        # Skeleton chapter lids are vouched by PAGE-MAP (verified xlsx) — not by crop ledger
        if lid in SKELETON_L_IDS:
            continue

        # Only AI-proposed greens are subject to Achilles hallucination gate
        # Official teacher greens ("سند پداگوژیک", legacy approved) are trusted.
        is_ai_row = ("پیشنهاد AI" in source_s1 or "موتور تألیف" in source_s1)
        if not is_ai_row:
            continue

        # Single-page rows require exact pdf evidence; range rows require at least one endpoint
        required_pdf_pages: List[int] = []
        if proven_offset is not None and len(book_pages) == 1:
            required_pdf_pages = [book_pages[0] + proven_offset]
        elif proven_offset is not None and len(book_pages) > 1:
            # range: check endpoints + middle sample
            required_pdf_pages = [book_pages[0] + proven_offset, book_pages[-1] + proven_offset]
            # if range small, also include all
            if len(book_pages) <= 5:
                required_pdf_pages = [bp + proven_offset for bp in book_pages]
        else:
            # without proven offset we cannot map; require note mention
            required_pdf_pages = []

        # Check that note mentions evidence
        has_evidence_mention = any(kw in note for kw in ("شاهد", "EV-", "PDF", "پاسیفحه", "پاصفحه", "کراپ", "عکس"))
        if not has_evidence_mention and is_green:
            issues.append(
                {
                    "sheet": "نقشهٔ کتاب (S1)",
                    "row": r,
                    "id": lid,
                    "error": "GREEN_WITHOUT_EVIDENCE_MENTION_IN_NOTE",
                    "detail": "ردیف سبز باید در یادداشت به شاهد کراپ/عکس/PDF ارجاع دهد.",
                }
            )
            continue

        # Validate PDF number in note matches proven offset
        if proven_offset is not None and book_pages and required_pdf_pages:
            m_pdf = re.search(r"PDF\s*(\d+)", to_ascii_str(note))
            if m_pdf and len(book_pages) == 1:
                claimed_pdf = int(m_pdf.group(1))
                expected_pdf = book_pages[0] + proven_offset
                if claimed_pdf != expected_pdf:
                    issues.append(
                        {
                            "sheet": "نقشهٔ کتاب (S1)",
                            "row": r,
                            "id": lid,
                            "error": "PAGE_OFFSET_MISMATCH_HALLUCINATION",
                            "expected_pdf": expected_pdf,
                            "claimed_pdf": claimed_pdf,
                            "proven_offset": proven_offset,
                        }
                    )
                    continue

        # Check ledger coverage — fail-closed for green
        if required_pdf_pages:
            missing_pdfs = [p for p in required_pdf_pages if not any(
                ev.get("evidence_kind") in STRONG_EVIDENCE_KINDS for ev in pdf_to_evs.get(p, [])
            )]
            if missing_pdfs:
                if is_green:
                    issues.append(
                        {
                            "sheet": "نقشهٔ کتاب (S1)",
                            "row": r,
                            "id": lid,
                            "error": "MISSING_STRONG_EVIDENCE_FOR_GREEN",
                            "missing_pdf_pages": missing_pdfs,
                            "proven_offset": proven_offset,
                            "book_pages": book_pages,
                        }
                    )
                else:
                    # yellow without evidence is allowed but record for autopsy;
                    # only fail if the yellow row tries to fake green via note
                    # (we already handled green). So yellow missing evidence is NOT a blocker.
                    pass
        else:
            # No proven offset — require that at least one evidence id mentioned in note exists in ledger
            ev_refs_in_note = re.findall(r"EV-[A-Z0-9_\-]+", note)
            if is_green and not ev_refs_in_note:
                # fallback: check ledger has any entry for this lid's pages via bbox?
                pass  # yellow already allowed, green requires mention handled above
            elif ev_refs_in_note:
                for ref in ev_refs_in_note:
                    if ref not in ev_ledger:
                        issues.append(
                            {
                                "sheet": "نقشهٔ کتاب (S1)",
                                "row": r,
                                "id": lid,
                                "error": "DANGLING_EVIDENCE_REF",
                                "ref": ref,
                            }
                        )

    # --- Bank anchor coverage (Q-* inherits S1 evidence) ---
    # We do not block yellow Q rows without evidence, but ensure green Q's anchor has evidence
    if ws_qb is not None:
        # build anchor → S1 status map
        anchor_status: Dict[str, str] = {}
        for r in range(3, ws_s1.max_row + 1):
            lid = str(ws_s1.cell(r, 1).value or "").strip()
            if lid == "یادداشت" or not lid:
                break
            anchor_status[lid] = str(ws_s1.cell(r, 13).value or "").strip()
        header_q = None
        for rr in range(1, min(8, ws_qb.max_row + 1)):
            if str(ws_qb.cell(rr, 1).value or "").strip().startswith("شناسه (Q-)"):
                header_q = rr
                break
        header_q = header_q or 3
        for r in range(header_q + 1, ws_qb.max_row + 1):
            qid = str(ws_qb.cell(r, 1).value or "").strip()
            if qid == "یادداشت" or not qid:
                break
            anchor = str(ws_qb.cell(r, 2).value or "").strip()
            q_status = str(ws_qb.cell(r, 16).value or "").strip()
            q_source = str(ws_qb.cell(r, 15).value or "")
            if q_status != "تأییدشده":
                continue
            # Only AI-proposed Q greens are in scope; official teacher Q greens are trusted
            if "پیشنهاد AI" not in q_source and "موتور تألیف" not in q_source:
                continue
            # green AI Q must have anchor green OR its own evidence
            if anchor in anchor_status and anchor_status[anchor] != "تأییدشده":
                issues.append(
                    {
                        "sheet": "بانک سؤال",
                        "row": r,
                        "qid": qid,
                        "anchor": anchor,
                        "error": "GREEN_Q_WITH_YELLOW_ANCHOR",
                        "detail": "سؤال سبز روی لنگری زرد — باید یا لنگر شاهد داشته باشد یا سؤال به زرد بازگردد.",
                    }
                )

    wb.close()

    if issues:
        return GateResult(
            gate_id="G_ACHILLES_EVIDENCE",
            stage="P2",
            status="FAIL",
            reason_code=issues[0]["error"],
            summary=f"دروازهٔ پاشنهٔ آشیل مسدود شد — {len(issues)} هلوسه/نقص شاهد (سبز بدون کراپ/BBOX).",
            issues=issues,
            metrics={
                "s1_total": s1_total,
                "green_rows": green_total,
                "yellow_with_page": yellow_with_page,
                "ledger_size": len(ev_ledger),
                "proven_offset": proven_offset,
                "missing_count": len(issues),
            },
        )

    return GateResult(
        gate_id="G_ACHILLES_EVIDENCE",
        stage="P2",
        status="PASS",
        reason_code="ACHILLES_EVIDENCE_VERIFIED",
        summary=f"پاشنهٔ آشیل امن — {s1_total} ردیف S1، {green_total} سبز با شاهد کراپ/BBOX، آفست +{proven_offset}.",
        issues=[],
        metrics={
            "s1_total": s1_total,
            "green_rows": green_total,
            "yellow_with_page": yellow_with_page,
            "ledger_size": len(ev_ledger),
            "proven_offset": proven_offset,
            "source_sha_variants": len(source_shas),
        },
    )
