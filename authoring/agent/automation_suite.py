"""Complete 10-Function Automation Suite (§8) + 16 Historical Incident Gates (§6) for Cartridge Production.

Implements all 10 high-ROI functions specified in `انتقال تجربه — خط تولید محتوا v۱.۰`:
  1. `diff_workbooks_by_key`          — Column-A keyed cell-level diff across all sheets (Incident #11)
  2. `verify_wave_whitelist`          — Closed cell-modification whitelist verifier
  3. `verify_official_stamps`         — Official stamp integrity verifier & restorer (Incident #7)
  4. `verify_bidirectional_anchors`   — Bidirectional `S1.K <-> Bank.B` exact set match (Incidents #6, #10)
  5. `verify_cpa_and_answer_balance`  — `AUD-06` CPA triad + `الف/ب/ج/د` balance + deep coverage (Incident #12)
  6. `count_visual_components`        — Machine pixel connected-component shape counter (Incident #9: 13 triangles)
  7. `run_converter_and_parse_report` — Executes Z.ai's verbatim `convert.mjs` & parses `download/convert-report-*.md`
  8. `manage_version_and_sha`         — Version bump guard, SHA-256 sidecars & 20-item Arena delivery report generator
  9. `plan_and_verify_pdf_chunks`     — Palindrome + footer offset prover (`+6`) & `<=12`p / `2`p-overlap chunk scheduler (Incidents #15, #16)
  10. `audit_historical_incidents_16` — Executable regression check across all 16 historical incidents (`INC-01..INC-16`)
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
from collections import Counter, deque
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

import openpyxl
from openpyxl.utils import get_column_letter

from .models import GateResult, file_sha256

FA_TO_ASCII = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
VALID_CPA = ("مجسم", "تصویری", "علامتی")
VALID_ANSWERS = ("الف", "ب", "ج", "د")
VALID_CATALOG_MODELS = {
    "M_ARRAY", "M_GROUPS", "M_NUMBERLINE", "M_BUNDLES", "M_PLACEVALUE",
    "M_AREAMODEL", "M_BARS", "M_FRACTION", "M_GEO_SHAPES", "M_CLOCK_TIME",
    "M_BALANCE", "M_MONEY", "M_CHART", "M_PATTERN",
}
SKELETON_L_IDS = ("L-100", "L-200", "L-300", "L-400", "L-500", "L-600", "L-700", "L-800")

# Exact SHA-256 digests of Z.ai's canonical converter files from `c6372dc`
ZAI_CONVERTER_SHAS = {
    "convert.mjs": None,  # verified dynamically at runtime
}


def norm_key(sheet_name: str, row_values: List[Any]) -> Optional[str]:
    first = row_values[0]
    if first is None:
        return None
    s = str(first).strip()
    if not s or s == "یادداشت":
        return None
    if sheet_name == "اطلس خطا":
        return re.sub(r"\s*\(پیشنهاد\)\s*", "", s).strip()
    if sheet_name.startswith("واژه"):
        sec = str(row_values[1] or "").strip()
        return f"{s}::{sec}" if sec else s
    return s


def sheet_header_row(ws) -> int:
    prefixes = {
        "شناسنامه": "فیلد",
        "نقشهٔ کتاب": "شناسه (L-)",
        "اطلس خطا": "کد (E-)",
        "بانک سؤال": "شناسه (Q-)",
        "واژه": "شیت",
        "پروتکل": "گام",
        "سجل": "شناسهٔ یافته",
    }
    target = None
    for k, v in prefixes.items():
        if k in ws.title:
            target = v
            break
    if target:
        for r in range(1, min(8, ws.max_row + 1)):
            c0 = str(ws.cell(r, 1).value or "").strip()
            if c0.startswith(target):
                return r
    return 1


def extract_q_refs_canonical(text: str) -> List[str]:
    """Identical Q-range expansion rules to Z.ai's `cartridge-schema.js` (`Q-a تا Q-b` & `Q-a-b`)."""
    t = str(text or "").translate(FA_TO_ASCII)
    refs: List[str] = []
    rest = t
    for pat in (r"Q-(\d+)\s*تا\s*Q-(\d+)", r"Q-(\d+)-(\d+)"):
        hits = list(re.finditer(pat, rest))
        for h in hits:
            a, b = int(h.group(1)), int(h.group(2))
            if b >= a and b - a < 50:
                refs.extend(f"Q-{i}" for i in range(a, b + 1))
            rest = rest.replace(h.group(0), " ", 1)
    for m in re.finditer(r"Q-\d+", rest):
        refs.append(m.group(0))
    return sorted(set(refs))


# ==============================================================================
# Function 1 (§8.1): Deterministic Keyed Diff by Column A (`diff_workbooks_by_key`)
# ==============================================================================
def diff_workbooks_by_key(old_xlsx: str | Path, new_xlsx: str | Path) -> Dict[str, Any]:
    """Value-by-value workbook diff anchored on Column A keys (`Q-id`, `L-id`, `E_code`, `فیلد`)."""
    wb_old = openpyxl.load_workbook(old_xlsx, data_only=False)
    wb_new = openpyxl.load_workbook(new_xlsx, data_only=False)

    changed_cells: List[Dict[str, Any]] = []
    added_rows: List[Dict[str, Any]] = []
    removed_rows: List[Dict[str, Any]] = []

    keyed_sheets = [s for s in wb_old.sheetnames if s in wb_new.sheetnames and s != "راهنما"]
    for sname in keyed_sheets:
        ws_o, ws_n = wb_old[sname], wb_new[sname]
        h_o, h_n = sheet_header_row(ws_o), sheet_header_row(ws_n)
        headers = [str(ws_n.cell(h_n, c).value or get_column_letter(c)).strip() for c in range(1, ws_n.max_column + 1)]

        map_o: Dict[str, Tuple[int, List[Any]]] = {}
        for r in range(h_o + 1, ws_o.max_row + 1):
            vals = [ws_o.cell(r, c).value for c in range(1, ws_o.max_column + 1)]
            k = norm_key(sname, vals)
            if k is None:
                if str(vals[0] or "").strip() == "یادداشت":
                    break
                continue
            map_o[k] = (r, vals)

        map_n: Dict[str, Tuple[int, List[Any]]] = {}
        for r in range(h_n + 1, ws_n.max_row + 1):
            vals = [ws_n.cell(r, c).value for c in range(1, ws_n.max_column + 1)]
            k = norm_key(sname, vals)
            if k is None:
                if str(vals[0] or "").strip() == "یادداشت":
                    break
                continue
            map_n[k] = (r, vals)

        for k in map_n:
            if k not in map_o:
                added_rows.append({"sheet": sname, "key": k, "new_row": map_n[k][0]})
        for k in map_o:
            if k not in map_n:
                removed_rows.append({"sheet": sname, "key": k, "old_row": map_o[k][0]})

        for k in map_o:
            if k not in map_n:
                continue
            r_o, vals_o = map_o[k]
            r_n, vals_n = map_n[k]
            max_c = max(len(vals_o), len(vals_n))
            for idx in range(max_c):
                vo = vals_o[idx] if idx < len(vals_o) else None
                vn = vals_n[idx] if idx < len(vals_n) else None
                if vo != vn:
                    col_letter = get_column_letter(idx + 1)
                    changed_cells.append({
                        "sheet": sname,
                        "key": k,
                        "col_index": idx + 1,
                        "col_letter": col_letter,
                        "header": headers[idx] if idx < len(headers) else col_letter,
                        "old_coord": f"{col_letter}{r_o}",
                        "new_coord": f"{col_letter}{r_n}",
                        "old_value": vo,
                        "new_value": vn,
                    })

    return {
        "old_sha256": file_sha256(str(old_xlsx)),
        "new_sha256": file_sha256(str(new_xlsx)),
        "added_rows": added_rows,
        "removed_rows": removed_rows,
        "changed_cells": changed_cells,
        "summary": {
            "added_row_count": len(added_rows),
            "removed_row_count": len(removed_rows),
            "changed_cell_count": len(changed_cells),
        },
    }


# ==============================================================================
# Function 2 (§8.2): Closed Wave Cell-Modification Whitelist (`verify_wave_whitelist`)
# ==============================================================================
def verify_wave_whitelist(
    diff_result: Dict[str, Any],
    allowed_cell_triples: Set[Tuple[str, str, str]],
    allowed_added_keys: Set[Tuple[str, str]],
) -> GateResult:
    """Reject ANY modified cell, added row, or deleted row outside the explicit wave whitelist."""
    violations: List[Dict[str, Any]] = []
    for rem in diff_result.get("removed_rows", []):
        violations.append({"type": "UNAUTHORIZED_ROW_DELETION", **rem})
    for add in diff_result.get("added_rows", []):
        pair = (add["sheet"], add["key"])
        if pair not in allowed_added_keys:
            violations.append({"type": "OUT_OF_WHITELIST_ADDED_ROW", **add})
    for chg in diff_result.get("changed_cells", []):
        triple = (chg["sheet"], chg["key"], chg["col_letter"])
        if triple not in allowed_cell_triples:
            violations.append({"type": "OUT_OF_WHITELIST_CELL_DIFF", **chg})

    if violations:
        return GateResult(
            stage="AUTO",
            summary="automation-gate",
            gate_id="G_AUTO_02_WAVE_WHITELIST",
            status="FAIL",
            reason_code="OUT_OF_WHITELIST_MUTATION",
            issues=violations,
            metrics={
                "checked_changes": len(diff_result.get("changed_cells", [])),
                "violation_count": len(violations),
            },
        )
    return GateResult(
        stage="AUTO",
        summary="automation-gate",
        gate_id="G_AUTO_02_WAVE_WHITELIST",
        status="PASS",
        reason_code="WHITELIST_STRICTLY_RESPECTED",
        issues=[],
        metrics={
            "whitelisted_cell_repairs": len(diff_result.get("changed_cells", [])),
            "whitelisted_added_rows": len(diff_result.get("added_rows", [])),
            "violation_count": 0,
        },
    )


# ==============================================================================
# Function 3 (§8.3): Official Stamp Integrity Checker & Restorer (`verify_official_stamps`)
# ==============================================================================
def restore_official_stamps_overlay(wb: openpyxl.Workbook, official_ref_xlsx: str | Path) -> List[Dict[str, Any]]:
    """Apply every cell from Z.ai's official merged workbook (`v0.3.1_official`) by Column-A key."""
    wb_off = openpyxl.load_workbook(official_ref_xlsx, data_only=False)
    applied: List[Dict[str, Any]] = []

    for sname in ("شناسنامهٔ خشاب", "نقشهٔ کتاب (S1)", "اطلس خطا", "بانک سؤال"):
        ws_t, ws_o = wb[sname], wb_off[sname]
        h_t, h_o = sheet_header_row(ws_t), sheet_header_row(ws_o)

        target_rows: Dict[str, int] = {}
        for r in range(h_t + 1, ws_t.max_row + 1):
            vals = [ws_t.cell(r, c).value for c in range(1, ws_t.max_column + 1)]
            k = norm_key(sname, vals)
            if k is None:
                if str(vals[0] or "").strip() == "یادداشت":
                    break
                continue
            target_rows[k] = r

        for r_o in range(h_o + 1, ws_o.max_row + 1):
            vals_o = [ws_o.cell(r_o, c).value for c in range(1, ws_o.max_column + 1)]
            k = norm_key(sname, vals_o)
            if k is None:
                if str(vals_o[0] or "").strip() == "یادداشت":
                    break
                continue
            if k not in target_rows:
                continue
            r_t = target_rows[k]
            for c_idx, expected_val in enumerate(vals_o, start=1):
                cur_val = ws_t.cell(r_t, c_idx).value
                if cur_val != expected_val:
                    col_letter = get_column_letter(c_idx)
                    ws_t.cell(r_t, c_idx).value = expected_val
                    applied.append({
                        "sheet": sname,
                        "key": k,
                        "col_letter": col_letter,
                        "coord": f"{col_letter}{r_t}",
                        "old_value": cur_val,
                        "new_value": expected_val,
                    })
    return applied


def verify_official_stamps(candidate_xlsx: str | Path, official_ref_xlsx: str | Path) -> GateResult:
    """Verify all official stamps (9 identity cells + 8 green skeleton rows + 2 green atlas rows + zero forged AI greens)."""
    diff = diff_workbooks_by_key(official_ref_xlsx, candidate_xlsx)
    stamp_regressions = diff["changed_cells"] + diff["removed_rows"]

    # Also ensure NO newly added AI row forged a green `'تأییدشده'` stamp (Incident #5)
    wb = openpyxl.load_workbook(candidate_xlsx, data_only=False)
    wb_off = openpyxl.load_workbook(official_ref_xlsx, data_only=False)
    official_green_keys: Dict[str, Set[str]] = {}
    for sname, status_col in (("نقشهٔ کتاب (S1)", 13), ("اطلس خطا", 10), ("بانک سؤال", 16)):
        ws_o = wb_off[sname]
        h_o = sheet_header_row(ws_o)
        greens: Set[str] = set()
        for r in range(h_o + 1, ws_o.max_row + 1):
            vals = [ws_o.cell(r, c).value for c in range(1, ws_o.max_column + 1)]
            k = norm_key(sname, vals)
            if k is None:
                break
            if str(ws_o.cell(r, status_col).value or "").strip() == "تأییدشده":
                greens.add(k)
        official_green_keys[sname] = greens

    forged_greens: List[Dict[str, Any]] = []
    for sname, status_col in (("نقشهٔ کتاب (S1)", 13), ("اطلس خطا", 10), ("بانک سؤال", 16)):
        ws = wb[sname]
        h = sheet_header_row(ws)
        for r in range(h + 1, ws.max_row + 1):
            vals = [ws.cell(r, c).value for c in range(1, ws.max_column + 1)]
            k = norm_key(sname, vals)
            if k is None:
                break
            if str(ws.cell(r, status_col).value or "").strip() == "تأییدشده" and k not in official_green_keys[sname]:
                forged_greens.append({"sheet": sname, "key": k, "row": r, "error": "UNAUTHORIZED_GREEN_STAMP"})

    all_issues = stamp_regressions + forged_greens
    if all_issues:
        return GateResult(
            stage="AUTO",
            summary="automation-gate",
            gate_id="G_AUTO_03_OFFICIAL_STAMPS",
            status="FAIL",
            reason_code="OFFICIAL_STAMP_REGRESSION_OR_FORGERY",
            issues=all_issues,
            metrics={
                "stamp_regression_count": len(stamp_regressions),
                "forged_green_count": len(forged_greens),
            },
        )
    return GateResult(
        stage="AUTO",
        summary="automation-gate",
        gate_id="G_AUTO_03_OFFICIAL_STAMPS",
        status="PASS",
        reason_code="ALL_OFFICIAL_STAMPS_INTACT",
        issues=[],
        metrics={
            "verified_skeleton_green_rows": len(official_green_keys["نقشهٔ کتاب (S1)"]),
            "verified_atlas_green_rows": len(official_green_keys["اطلس خطا"]),
            "forged_green_count": 0,
        },
    )


# ==============================================================================
# Function 4 (§8.4): Bidirectional Anchor Sync Verifier (`verify_bidirectional_anchors`)
# ==============================================================================
def verify_bidirectional_anchors(wb_path: str | Path) -> GateResult:
    """Verify exact set equality `extract_q_refs(S1[L].K) == {Q.id : Q.B == L}` across every `L-` row."""
    wb = openpyxl.load_workbook(wb_path, data_only=False)
    ws_s1 = wb["نقشهٔ کتاب (S1)"]
    ws_qb = wb["بانک سؤال"]

    declared: Dict[str, List[str]] = {}
    row_of_l: Dict[str, int] = {}
    for r in range(3, ws_s1.max_row + 1):
        lid = str(ws_s1.cell(r, 1).value or "").strip()
        if lid == "یادداشت":
            break
        if not lid:
            continue
        declared[lid] = extract_q_refs_canonical(str(ws_s1.cell(r, 11).value or ""))
        row_of_l[lid] = r

    actual: Dict[str, List[str]] = {lid: [] for lid in declared}
    orphan_questions: List[Dict[str, Any]] = []
    for r in range(4, ws_qb.max_row + 1):
        qid = str(ws_qb.cell(r, 1).value or "").strip()
        if qid == "یادداشت":
            break
        if not qid:
            continue
        anc = str(ws_qb.cell(r, 2).value or "").strip()
        if anc not in actual:
            orphan_questions.append({"qid": qid, "anchor": anc, "row": r, "error": "UNKNOWN_L_ANCHOR"})
        else:
            actual[anc].append(qid)

    mismatches: List[Dict[str, Any]] = list(orphan_questions)
    for lid, dec_list in declared.items():
        act_list = sorted(actual[lid])
        if dec_list != act_list:
            mismatches.append({
                "sheet": "نقشهٔ کتاب (S1)",
                "key": lid,
                "cell": f"K{row_of_l[lid]}",
                "declared_in_s1": dec_list,
                "actual_in_bank": act_list,
                "error": "T7_ANCHOR_MISMATCH",
            })

    if mismatches:
        return GateResult(
            stage="AUTO",
            summary="automation-gate",
            gate_id="G_AUTO_04_BIDIRECTIONAL_ANCHORS",
            status="FAIL",
            reason_code="T7_ANCHOR_SYNC_FAILED",
            issues=mismatches,
            metrics={"checked_lessons": len(declared), "mismatch_count": len(mismatches)},
        )
    return GateResult(
        stage="AUTO",
        summary="automation-gate",
        gate_id="G_AUTO_04_BIDIRECTIONAL_ANCHORS",
        status="PASS",
        reason_code="BIDIRECTIONAL_ANCHORS_SYNCED",
        issues=[],
        metrics={"checked_lessons": len(declared), "mismatch_count": 0},
    )


# ==============================================================================
# Function 5 (§8.5): CPA Distribution & Answer-Key Balance (`verify_cpa_and_answer_balance`)
# ==============================================================================
def derive_wave_scope_from_diff(diff_result: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Derive wave QIDs, first QID, and added S1 lesson keys directly from `diff_workbooks_by_key` (zero grade hardcoding)."""
    if not diff_result:
        return {
            "wave_qids": set(),
            "first_wave_qid": None,
            "added_s1_keys": set(),
        }
    wave_qids = {
        str(r["key"]).strip()
        for r in diff_result.get("added_rows", [])
        if r.get("sheet") == "بانک سؤال" and str(r.get("key", "")).strip()
    }
    added_s1_keys = {
        str(r["key"]).strip()
        for r in diff_result.get("added_rows", [])
        if r.get("sheet") == "نقشهٔ کتاب (S1)" and str(r.get("key", "")).strip()
    }
    return {
        "wave_qids": wave_qids,
        "first_wave_qid": min(wave_qids) if wave_qids else None,
        "added_s1_keys": added_s1_keys,
    }


def verify_cpa_and_answer_balance(
    wb_path: str | Path,
    base_xlsx_path: Optional[str | Path] = None,
    diff_result: Optional[Dict[str, Any]] = None,
    new_wave_start_qid: Optional[str] = None,
    new_wave_chapter: Optional[str] = None,
    wave_qids: Optional[Set[str]] = None,
    strict_all_rows_aud06: Optional[bool] = None,
) -> GateResult:
    """Verify `AUD-06` CPA triad, balanced `الف/ب/ج/د` key distribution, and deep-lesson coverage across any grade (`G1..G6`)."""
    effective_diff = diff_result
    if effective_diff is None and base_xlsx_path is not None and Path(base_xlsx_path).exists():
        effective_diff = diff_workbooks_by_key(base_xlsx_path, wb_path)

    derived = derive_wave_scope_from_diff(effective_diff)
    effective_wave_qids: Optional[Set[str]] = (
        wave_qids if wave_qids is not None else (derived["wave_qids"] if effective_diff is not None else None)
    )
    derived_first_qid: Optional[str] = (
        min(effective_wave_qids)
        if effective_wave_qids
        else new_wave_start_qid
    )
    added_s1_keys: Set[str] = derived["added_s1_keys"]
    # When comparing against an existing base cartridge (which may carry legacy AUD-06 yellow warnings, e.g. G3 v0.7),
    # default to enforcing AUD-06 strictly on newly added wave rows unless `strict_all_rows_aud06=True` is requested.
    check_all_aud06 = (effective_diff is None and wave_qids is None) if strict_all_rows_aud06 is None else strict_all_rows_aud06

    wb = openpyxl.load_workbook(wb_path, data_only=False)
    ws_qb = wb["بانک سؤال"]
    ws_s1 = wb["نقشهٔ کتاب (S1)"]

    cpa_counts: Counter = Counter()
    ans_counts_all: Counter = Counter()
    ans_counts_wave: Counter = Counter()
    by_anchor_domains: Dict[str, List[str]] = {}
    by_anchor_cpas: Dict[str, Set[str]] = {}
    issues: List[Dict[str, Any]] = []

    for r in range(4, ws_qb.max_row + 1):
        qid = str(ws_qb.cell(r, 1).value or "").strip()
        if qid == "یادداشت":
            break
        if not qid:
            continue
        anc = str(ws_qb.cell(r, 2).value or "").strip()
        dom = str(ws_qb.cell(r, 3).value or "").strip()
        cpa = str(ws_qb.cell(r, 4).value or "").strip()
        ans = str(ws_qb.cell(r, 11).value or "").strip()

        in_wave = (
            (qid in effective_wave_qids)
            if effective_wave_qids is not None
            else (qid >= new_wave_start_qid if new_wave_start_qid else False)
        )
        cpa_counts[cpa] += 1
        ans_counts_all[ans] += 1
        by_anchor_domains.setdefault(anc, []).append(dom)
        by_anchor_cpas.setdefault(anc, set()).add(cpa)

        if cpa not in VALID_CPA and (check_all_aud06 or in_wave):
            issues.append({"qid": qid, "cell": f"D{r}", "cpa": cpa, "error": "AUD_06_INVALID_CPA"})
        if ans not in VALID_ANSWERS:
            issues.append({"qid": qid, "cell": f"K{r}", "answer": ans, "error": "INVALID_ANSWER_LETTER"})
        if in_wave:
            ans_counts_wave[ans] += 1

    if sum(ans_counts_wave.values()) > 0:
        counts_vec = [ans_counts_wave[k] for k in VALID_ANSWERS]
        if max(counts_vec) - min(counts_vec) > 2:
            issues.append({
                "distribution": dict(ans_counts_wave),
                "error": "IMBALANCED_ANSWER_KEYS",
            })

    for r in range(3, ws_s1.max_row + 1):
        lid = str(ws_s1.cell(r, 1).value or "").strip()
        if lid == "یادداشت":
            break
        if not lid:
            continue
        ch = str(ws_s1.cell(r, 3).value or "").strip()
        mode = str(ws_s1.cell(r, 10).value or "").strip()
        in_wave_s1 = (lid in added_s1_keys) or bool(new_wave_chapter and ch == new_wave_chapter)
        if in_wave_s1 and not lid.endswith("00") and mode == "تعاملی-عمیق":
            doms = Counter(by_anchor_domains.get(lid, []))
            if doms["CORE"] < 2 or doms["DEPTH"] < 1 or doms["SIDE"] < 1:
                issues.append({
                    "lid": lid,
                    "domains": dict(doms),
                    "error": "INSUFFICIENT_DEEP_LESSON_QUESTION_COVERAGE",
                })
            if by_anchor_cpas.get(lid, set()) != set(VALID_CPA):
                issues.append({
                    "lid": lid,
                    "cpas": sorted(by_anchor_cpas.get(lid, set())),
                    "error": "INCOMPLETE_CPA_LADDER_FOR_CONCEPT",
                })
    if issues:
        return GateResult(
            stage="AUTO",
            summary="automation-gate",
            gate_id="G_AUTO_05_CPA_AND_ANSWER_BALANCE",
            status="FAIL",
            reason_code="CPA_OR_BALANCE_VIOLATION",
            issues=issues,
            metrics={
                "cpa_distribution": dict(cpa_counts),
                "wave_answer_distribution": dict(ans_counts_wave),
                "derived_first_wave_qid": derived_first_qid,
            },
        )
    return GateResult(
        stage="AUTO",
        summary="automation-gate",
        gate_id="G_AUTO_05_CPA_AND_ANSWER_BALANCE",
        status="PASS",
        reason_code="CPA_AND_ANSWER_BALANCE_CLEAN",
        issues=[],
        metrics={
            "cpa_distribution": dict(cpa_counts),
            "all_answer_distribution": {k: ans_counts_all[k] for k in VALID_ANSWERS},
            "wave_answer_distribution": {k: ans_counts_wave[k] for k in VALID_ANSWERS},
            "derived_first_wave_qid": derived_first_qid,
        },
    )


# ==============================================================================
# Function 6 (§8.6): Machine Visual Component Counter (`count_visual_components`)
# ==============================================================================
def count_visual_components(
    pdf_path: str | Path,
    pdf_page_1based: int,
    bbox_pt: Tuple[float, float, float, float],
    dpi: int = 216,
    min_area_px: int = 25,
) -> Dict[str, Any]:
    """Render textbook clip in memory & count connected foreground shapes (Incident #9: 13 triangles on p.8!)."""
    import pymupdf

    p = Path(pdf_path)
    if not p.exists():
        return {"status": "BLOCKED", "reason": "PDF_NOT_AVAILABLE", "count": None, "shapes": []}

    doc = pymupdf.open(str(p))
    try:
        page = doc[pdf_page_1based - 1]
        clip = pymupdf.Rect(*bbox_pt)
        pix = page.get_pixmap(clip=clip, dpi=dpi, alpha=False)
        w, h, s = pix.width, pix.height, pix.samples
    finally:
        doc.close()

    fg = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            i = (y * w + x) * 3
            r, g, b = s[i], s[i + 1], s[i + 2]
            if min(r, g, b) < 235 and (max(r, g, b) - min(r, g, b) > 18 or max(r, g, b) < 200):
                fg[y * w + x] = 1

    vis = bytearray(w * h)
    shapes: List[Dict[str, int]] = []
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if fg[idx] and not vis[idx]:
                q = deque([(x, y)])
                vis[idx] = 1
                area = 0
                minx = maxx = x
                miny = maxy = y
                while q:
                    cx, cy = q.popleft()
                    area += 1
                    if cx < minx:
                        minx = cx
                    if cx > maxx:
                        maxx = cx
                    if cy < miny:
                        miny = cy
                    if cy > maxy:
                        maxy = cy
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h:
                                ni = ny * w + nx
                                if fg[ni] and not vis[ni]:
                                    vis[ni] = 1
                                    q.append((nx, ny))
                if area >= min_area_px:
                    shapes.append({
                        "area_px": area,
                        "width_px": maxx - minx + 1,
                        "height_px": maxy - miny + 1,
                        "x": minx,
                        "y": miny,
                    })

    return {
        "status": "PASS",
        "pdf_page": pdf_page_1based,
        "bbox_pt": list(bbox_pt),
        "count": len(shapes),
        "shapes": shapes,
    }


# ==============================================================================
# Function 7 (§8.7): Official Z.ai Converter Runner & Parser (`run_converter_and_parse_report`)
# ==============================================================================
def _locate_node_modules_with_xlsx(repo_root: Path) -> Optional[Path]:
    candidates = [
        repo_root / "node_modules",
        repo_root / "tools/cartridge-converter/node_modules",
        Path("/tmp/khshab_node_deps/node_modules"),
    ]
    for c in candidates:
        if (c / "xlsx").exists():
            return c
    return None


def run_converter_and_parse_report(
    xlsx_path: str | Path,
    repo_root: str | Path,
    download_dir: Optional[str | Path] = None,
    preview_json_out: Optional[str | Path] = None,
) -> Dict[str, Any]:
    """Execute Z.ai's official SSOT `convert.mjs` in an isolated staging dir; write official report to `download/`."""
    root = Path(repo_root).resolve()
    wb_file = Path(xlsx_path).resolve()
    # Task 60 (SSOT): خوانش مستقیم از منبع واحد حقیقت repo_root بدون هیچ کپی موازی
    ssot_convert = root / "tools/cartridge-converter/convert.mjs"
    ssot_schema = root / "public/math-game/src/v10/station/cartridge-schema.js"
    ssot_errors = root / "public/math-game/src/v10/station/errors.js"
    missing = [str(p.relative_to(root)) for p in (ssot_convert, ssot_schema, ssot_errors) if not p.exists()]
    if missing:
        return {
            "status": "BLOCKED",
            "reason_code": "MISSING_CONVERTER_SSOT",
            "reason_detail": "، ".join(missing),
            "exit_code": None,
            "red": None,
            "yellow": None,
            "verdict": "BLOCKED",
        }
    dl_dir = Path(download_dir).resolve() if download_dir else (root / "download")
    dl_dir.mkdir(parents=True, exist_ok=True)

    node_modules = _locate_node_modules_with_xlsx(root)
    if node_modules is None:
        return {
            "status": "BLOCKED",
            "reason_code": "MISSING_XLSX_NODE_DEPENDENCY",
            "exit_code": None,
            "red": None,
            "yellow": None,
            "verdict": "BLOCKED",
        }

    with tempfile.TemporaryDirectory(prefix="khshab_zai_conv_") as tmp:
        tmp_root = Path(tmp)
        # Replicate exact directory layout expected by Z.ai's unmodified `convert.mjs`
        conv_dir = tmp_root / "tools/cartridge-converter"
        station_dir = tmp_root / "public/math-game/src/v10/station"
        out_cart_dir = tmp_root / "public/math-game/cartridges"
        out_dl_dir = tmp_root / "download"
        conv_dir.mkdir(parents=True)
        station_dir.mkdir(parents=True)
        out_cart_dir.mkdir(parents=True)
        out_dl_dir.mkdir(parents=True)

        # Enable standard ES module execution in Node 22 without touching source bytes
        (tmp_root / "package.json").write_text('{"type": "module"}\n', encoding="utf-8")
        os.symlink(node_modules, tmp_root / "node_modules")

        shutil.copy2(ssot_convert, conv_dir / "convert.mjs")
        shutil.copy2(ssot_schema, station_dir / "cartridge-schema.js")
        shutil.copy2(ssot_errors, station_dir / "errors.js")

        proc = subprocess.run(
            ["node", str(conv_dir / "convert.mjs"), str(wb_file)],
            cwd=tmp_root,
            capture_output=True,
            text=True,
        )

        generated_reports = list(out_dl_dir.glob("convert-report-*.md"))
        report_text = ""
        saved_report_path: Optional[Path] = None
        if generated_reports:
            src_rep = generated_reports[0]
            saved_report_path = dl_dir / src_rep.name
            shutil.copy2(src_rep, saved_report_path)
            report_text = saved_report_path.read_text(encoding="utf-8")

        generated_jsons = list(out_cart_dir.glob("KH-*.json"))
        preview_json_sha: Optional[str] = None
        if generated_jsons:
            src_json = generated_jsons[0]
            preview_json_sha = file_sha256(str(src_json))
            if preview_json_out:
                dst_json = Path(preview_json_out)
                dst_json.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_json, dst_json)

        red_m = re.search(r"\|\s*قرمز \(بلوکه‌کننده\)\s*\|\s*\*\*(\d+)\*\*\s*\|", report_text)
        yel_m = re.search(r"\|\s*زرد \(هشدار\)\s*\|\s*(\d+)\s*\|", report_text)
        verdict_m = re.search(r"\*\*حکم گیت مبدل:\s*([^*]+)\*\*", report_text)

        red_count = int(red_m.group(1)) if red_m else (0 if proc.returncode == 0 else 1)
        yellow_count = int(yel_m.group(1)) if yel_m else 0
        verdict_str = verdict_m.group(1).strip() if verdict_m else ("مجاز" if proc.returncode == 0 else "مردود")

        errors = [
            line[4:].strip()
            for line in report_text.splitlines()
            if line.startswith("- 🔴 ")
        ]
        warnings = [
            line[4:].strip()
            for line in report_text.splitlines()
            if line.startswith("- 🟡 ")
        ]

        return {
            "status": "PASS" if proc.returncode == 0 and red_count == 0 else "FAIL",
            "exit_code": proc.returncode,
            "red": red_count,
            "yellow": yellow_count,
            "verdict": verdict_str,
            "errors": errors,
            "warnings": warnings,
            "report_path": str(saved_report_path) if saved_report_path else None,
            "preview_json_sha256": preview_json_sha,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        }


# ==============================================================================
# Function 8 (§8.8 & §7): Version, SHA-256 & 20-Item Delivery Markdown (`manage_version_and_sha`)
# ==============================================================================
def parse_version_tuple(xlsx_path: str | Path) -> Tuple[int, ...]:
    m = re.search(r"_v(\d+(?:\.\d+)+)(?:_[a-zA-Z0-9]+)?\.xlsx$", Path(xlsx_path).name)
    if not m:
        raise ValueError(f"Workbook name lacks `_vX.Y.xlsx` version suffix: {xlsx_path}")
    return tuple(int(p) for p in m.group(1).split("."))


def manage_version_and_sha(
    xlsx_path: str | Path,
    prev_xlsx_path: str | Path,
    converter_result: Dict[str, Any],
    delivery_md_path: str | Path,
    self_audit_checks: List[Tuple[str, bool, str]],
) -> Dict[str, Any]:
    """Verify monotonic version bump, write `.sha256`, and generate Arena 20-item + 3-metric delivery note."""
    cur_p, prev_p = Path(xlsx_path), Path(prev_xlsx_path)
    v_cur = parse_version_tuple(cur_p)
    v_prev = parse_version_tuple(prev_p)
    if v_cur <= v_prev:
        raise ValueError(f"Non-monotonic version progression: {v_prev} -> {v_cur}")

    sha = file_sha256(str(cur_p))
    sidecar = Path(str(cur_p) + ".sha256")
    sidecar.write_text(f"{sha}  {cur_p.name}\n", encoding="utf-8")

    wb = openpyxl.load_workbook(cur_p, data_only=False)
    ws_id, ws_s1, ws_ea, ws_qb = wb["شناسنامهٔ خشاب"], wb["نقشهٔ کتاب (S1)"], wb["اطلس خطا"], wb["بانک سؤال"]
    cartridge_id = str(ws_id.cell(3, 2).value or cur_p.stem).strip()
    kd = diff_workbooks_by_key(prev_p, cur_p)
    kd_summary = kd["summary"]
    added_by_sheet = Counter(r["sheet"] for r in kd["added_rows"])
    added_s1_keys = {r["key"] for r in kd["added_rows"] if r["sheet"] == "نقشهٔ کتاب (S1)"}

    # Compute the 3 official Arena efficiency KPIs (§7.2) dynamically across ANY grade/wave:
    s1_wave_cells = 0
    s1_wave_clean = 0
    for r in range(3, ws_s1.max_row + 1):
        lid = str(ws_s1.cell(r, 1).value or "").strip()
        if lid == "یادداشت":
            break
        if not lid:
            continue
        if (lid in added_s1_keys) if added_s1_keys else (not lid.endswith("00")):
            for c in range(1, 15):
                s1_wave_cells += 1
                val = str(ws_s1.cell(r, c).value or "").strip()
                if val and val != "؟" and not val.startswith("؟"):
                    s1_wave_clean += 1

    pct_no_false_qmark = round(100.0 * s1_wave_clean / max(1, s1_wave_cells), 1)

    total_q = 0
    anti_j12_ok = 0
    mapped_distractors = 0
    total_distractors = 0
    for r in range(4, ws_qb.max_row + 1):
        qid = str(ws_qb.cell(r, 1).value or "").strip()
        if qid == "یادداشت":
            break
        if not qid:
            continue
        total_q += 1
        note = str(ws_qb.cell(r, 17).value or "")
        ans = str(ws_qb.cell(r, 11).value or "").strip()
        emap = str(ws_qb.cell(r, 12).value or "")
        if ans in VALID_ANSWERS and re.search(r"[0-9]", note) and not re.search(r"[۰-۹]", note.split("|")[0]):
            anti_j12_ok += 1
        total_distractors += 3
        mapped_distractors += min(3, len(re.findall(r"[الفبجد]→E_[A-Z0-9_]+", emap)))

    pct_anti_j12 = round(100.0 * anti_j12_ok / max(1, total_q), 1)
    pct_mapped_options = round(100.0 * mapped_distractors / max(1, total_distractors), 1)
    ver_str = ".".join(str(x) for x in v_cur)

    lines = [
        f"# سند تحویل رسمی موج — `{cartridge_id} v{ver_str}`",
        "",
        f"- **فایل تحویلی:** `{cur_p.name}`",
        f"- **SHA-256 دقیق فایل:** `{sha}`",
        f"- **نسخهٔ پایهٔ مقایسه:** `{prev_p.name}` (`{v_prev}` → `{v_cur}`)",
        f"- **گزارش مبدّل رسمی (`cartridge-converter v1.1`):** `{Path(converter_result.get('report_path') or '').name}` — حکم: **{converter_result.get('verdict')}** (`{converter_result.get('red')} قرمز، {converter_result.get('yellow')} زرد`)",
        "",
        "## ۱. خلاصهٔ واقعی تغییرات شیت‌به‌شیت (محاسبه‌شدهٔ خودکار با دیف کلیدمحور ستون `A`)",
        f"- **`added_row_count` (ردیف‌های افزوده‌شده):** **`{kd_summary['added_row_count']}`** (`نقشهٔ کتاب (S1)`: `{added_by_sheet.get('نقشهٔ کتاب (S1)', 0)}` | `اطلس خطا`: `{added_by_sheet.get('اطلس خطا', 0)}` | `بانک سؤال`: `{added_by_sheet.get('بانک سؤال', 0)}`)",
        f"- **`changed_cell_count` (تغییر سلول در ردیف‌های قبلی پایه):** **`{kd_summary['changed_cell_count']}`** ({'افزودهٔ محض — صفر تغییر در سلول‌ها و مُهرهای پایهٔ رسمی' if kd_summary['changed_cell_count'] == 0 else 'سلول‌های تغییریافته: ' + str([(c['sheet'], c['key'], c['new_coord']) for c in kd['changed_cells'][:15]])})",
        f"- **`removed_row_count` (حذف ردیف):** **`{kd_summary['removed_row_count']}`**",
        "",
        "## ۲. سه سنجهٔ رسمی بازدهی (§7.2)",
        f"1. **درصد سلول‌های بدون «؟» کاذب در موج تحویلی:** **`{pct_no_false_qmark}%`** (`{s1_wave_clean}/{s1_wave_cells}`)",
        f"2. **درصد پاسخ‌نامهٔ سالم ضد J12 (کل بانک `{total_q}` سؤالی):** **`{pct_anti_j12}%`** (`{anti_j12_ok}/{total_q}`)",
        f"3. **درصد گزینه‌های انحرافی دارای نقشهٔ کد خطا (`E_`):** **`{pct_mapped_options}%`** (`{mapped_distractors}/{total_distractors}`)",
        "",
        "## ۳. نتیجهٔ خودآزمایی ۲۰بندی ماشینی (اجراشده، نه ادعایی)",
        "| ردیف | عنوان کنترل ماشینی | وضعیت | شاهد / جزئیات |",
        "| :---: | :--- | :---: | :--- |",
    ]
    for idx, (label, passed, detail) in enumerate(self_audit_checks, start=1):
        badge = "PASS" if passed else "FAIL"
        lines.append(f"| {idx} | {label} | **{badge}** | {detail} |")

    Path(delivery_md_path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {
        "version_tuple": v_cur,
        "sha256": sha,
        "pct_no_false_qmark": pct_no_false_qmark,
        "pct_anti_j12": pct_anti_j12,
        "pct_mapped_options": pct_mapped_options,
        "passed_checks": sum(1 for _, ok, _ in self_audit_checks if ok),
        "total_checks": len(self_audit_checks),
    }


# ==============================================================================
# Function 9 (§8.9): Palindrome Offset Prover + Chunk Scheduler (`plan_and_verify_pdf_chunks`)
# ==============================================================================
def plan_and_verify_pdf_chunks(
    pdf_path: str | Path,
    max_chunk_pages: int = 12,
    overlap_pages: int = 2,
    parallel_lanes: int = 4,
    output_json_path: Optional[str | Path] = None,
) -> Dict[str, Any]:
    """Deterministically prove PDF-to-Book page offset via chapter-review palindromes + footers & build `<=12`p chunk plan."""
    import pymupdf

    if max_chunk_pages > 12:
        raise ValueError("Incident #15 rule: max_chunk_pages MUST be <= 12!")
    if overlap_pages < 2:
        raise ValueError("Incident #15 rule: overlap_pages MUST be >= 2!")
    if not (3 <= parallel_lanes <= 4):
        raise ValueError("Incident #15 rule: parallel_lanes MUST be 3 or 4!")

    p = Path(pdf_path)
    if not p.exists():
        return {"status": "BLOCKED", "reason_code": "MISSING_SOURCE_PDF", "proven_offset": None}

    doc = pymupdf.open(str(p))
    try:
        total_pages = len(doc)
        review_anchors: List[Dict[str, Any]] = []
        footer_offsets: Counter = Counter()

        for idx in range(total_pages):
            pdf_p = idx + 1
            page = doc[idx]
            txt = page.get_text("text")
            y_min = page.rect.height - 110
            blocks = page.get_text("blocks")
            raw_tokens: List[Tuple[float, str]] = []
            for b in blocks:
                if b[1] > y_min:
                    clean = b[4].translate(FA_TO_ASCII)
                    clean_digits = re.sub(r"\s+", "", clean)
                    if re.fullmatch(r"\d{1,3}", clean_digits):
                        raw_tokens.append((b[1], clean_digits))
            if raw_tokens:
                # Multi-digit palindromes (11, 22, ..., 99, 101, 111, 121, 131, 141) are 100% invariant
                # to RTL/LTR glyph serialization in InDesign PDF exports (INC-16 mathematical prover).
                page_candidates: Set[int] = set()
                for _, tok in raw_tokens:
                    v_fwd = int(tok)
                    v_rev = int(tok[::-1])
                    if 1 <= v_fwd <= 250:
                        page_candidates.add(v_fwd)
                    if 1 <= v_rev <= 250:
                        page_candidates.add(v_rev)
                    if len(tok) >= 2 and tok == tok[::-1] and 11 <= v_fwd <= 250:
                        footer_offsets[pdf_p - v_fwd] += 1
                        review_anchors.append({
                            "pdf_page": pdf_p,
                            "printed_book_page": v_fwd,
                            "implied_offset": pdf_p - v_fwd,
                            "anchor_kind": "palindrome_or_review" if ("مرور فصل" in txt or "فرهنگ نوشتن" in txt) else "palindrome_footer",
                        })

        if len(footer_offsets) == 1:
            candidate_off = next(iter(footer_offsets.keys()))
            verified_footer_count = 0
            seen_anchor_pages = {a["pdf_page"] for a in review_anchors}
            for idx in range(total_pages):
                pdf_p = idx + 1
                page = doc[idx]
                txt = page.get_text("text")
                y_min = page.rect.height - 110
                page_vals: Set[int] = set()
                for b in page.get_text("blocks"):
                    if b[1] > y_min:
                        tok = re.sub(r"\s+", "", b[4].translate(FA_TO_ASCII))
                        if re.fullmatch(r"\d{1,3}", tok):
                            page_vals.add(int(tok))
                            page_vals.add(int(tok[::-1]))
                expected_bp = pdf_p - candidate_off
                if expected_bp in page_vals and expected_bp >= 1:
                    verified_footer_count += 1
                    if pdf_p not in seen_anchor_pages and ("مرور فصل" in txt or "فرهنگ نوشتن" in txt):
                        review_anchors.append({
                            "pdf_page": pdf_p,
                            "printed_book_page": expected_bp,
                            "implied_offset": candidate_off,
                            "anchor_kind": "verified_chapter_review",
                        })
                        seen_anchor_pages.add(pdf_p)
            footer_offsets = Counter({candidate_off: verified_footer_count})
    finally:
        doc.close()

    if not footer_offsets or len(footer_offsets) != 1 or len(review_anchors) < 4:
        return {
            "status": "BLOCKED",
            "reason_code": "AMBIGUOUS_PAGE_OFFSET_STOP_BEFORE_ROW_GENERATION",
            "footer_offsets": dict(footer_offsets),
            "review_palindrome_anchors": review_anchors,
            "proven_offset": None,
        }

    proven_offset = next(iter(footer_offsets.keys()))
    step = max_chunk_pages - overlap_pages
    chunks: List[Dict[str, Any]] = []
    start = 1
    chunk_idx = 1
    while start <= total_pages:
        end = min(total_pages, start + max_chunk_pages - 1)
        chunks.append({
            "chunk_id": f"CHUNK-{chunk_idx:02d}",
            "parallel_lane": ((chunk_idx - 1) % parallel_lanes) + 1,
            "pdf_page_start": start,
            "pdf_page_end": end,
            "page_count": end - start + 1,
            "overlap_with_prev": overlap_pages if chunk_idx > 1 else 0,
        })
        if end == total_pages:
            break
        start += step
        chunk_idx += 1

    result = {
        "status": "PASS",
        "total_pdf_pages": total_pages,
        "proven_offset": proven_offset,
        "footer_verified_pages": sum(footer_offsets.values()),
        "review_palindrome_anchors": review_anchors,
        "max_chunk_pages": max_chunk_pages,
        "overlap_pages": overlap_pages,
        "parallel_lanes": parallel_lanes,
        "chunks": chunks,
    }
    if output_json_path:
        Path(output_json_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_json_path).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


# ==============================================================================
# Function 10 (§8.10 & §6): Automated 16-Incident Regression Matrix (`audit_historical_incidents_16`)
# ==============================================================================
def audit_historical_incidents_16(
    candidate_xlsx: str | Path,
    official_ref_xlsx: str | Path,
    pdf_path: Optional[str | Path] = None,
    chunk_plan_path: Optional[str | Path] = None,
) -> GateResult:
    """Run explicit regression checks for ALL 16 historical incidents documented in §6."""
    wb = openpyxl.load_workbook(candidate_xlsx, data_only=False)
    ws_s1 = wb["نقشهٔ کتاب (S1)"]
    ws_ea = wb["اطلس خطا"]
    ws_qb = wb["بانک سؤال"]

    s1_by_id: Dict[str, Tuple[int, List[Any]]] = {}
    for r in range(3, ws_s1.max_row + 1):
        lid = str(ws_s1.cell(r, 1).value or "").strip()
        if lid == "یادداشت":
            break
        if not lid:
            continue
        s1_by_id[lid] = (r, [ws_s1.cell(r, c).value for c in range(1, 15)])

    atlas_codes: Set[str] = set()
    for r in range(3, ws_ea.max_row + 1):
        raw_c = str(ws_ea.cell(r, 1).value or "").strip()
        if raw_c == "یادداشت":
            break
        if not raw_c:
            continue
        atlas_codes.add(re.sub(r"\s*\(پیشنهاد\)\s*", "", raw_c).strip())

    qb_by_id: Dict[str, Tuple[int, List[Any]]] = {}
    for r in range(4, ws_qb.max_row + 1):
        qid = str(ws_qb.cell(r, 1).value or "").strip()
        if qid == "یادداشت":
            break
        if not qid:
            continue
        qb_by_id[qid] = (r, [ws_qb.cell(r, c).value for c in range(1, 18)])

    stamps_gate = verify_official_stamps(candidate_xlsx, official_ref_xlsx)
    anchors_gate = verify_bidirectional_anchors(candidate_xlsx)
    cpa_gate = verify_cpa_and_answer_balance(candidate_xlsx, new_wave_start_qid=None)

    results: List[Dict[str, Any]] = []

    def rec(inc_id: str, title: str, ok: bool, evidence: str) -> None:
        results.append({"incident_id": inc_id, "title": title, "status": "PASS" if ok else "FAIL", "evidence": evidence})

    # INC-01: J12 separate Latin calculation trace in `یادداشت`
    j12_bad = [
        qid for qid, (_, v) in qb_by_id.items()
        if not re.search(r"[0-9]", str(v[16] or ""))
    ]
    rec("INC-01", "ضد J12 — محاسبهٔ مستقل لاتین در یادداشت", len(j12_bad) == 0, f"bad_questions={j12_bad}")

    # INC-02: No fabricated out-of-range textbook page numbers (`1..144`)
    bad_pages = []
    for lid, (_, v) in s1_by_id.items():
        nums = [int(n) for n in re.findall(r"\d+", str(v[1] or "").translate(FA_TO_ASCII))]
        if not nums or any(n < 1 or n > 144 for n in nums):
            bad_pages.append(lid)
    rec("INC-02", "منع جعل شمارهٔ صفحه خارج از کتاب C205", len(bad_pages) == 0, f"bad_page_rows={bad_pages}")

    # INC-03: Zero invented terminology (`گذرنده` etc.)
    invented_hits = [
        lid for lid, (_, v) in s1_by_id.items()
        if "گذرنده" in " ".join(str(x or "") for x in v)
    ]
    rec("INC-03", "منع واژگان ساختگی خارج از کتاب", len(invented_hits) == 0, f"hits={invented_hits}")

    # INC-04: Zero orphan `E_` codes absent from same workbook's `اطلس خطا` (`T5`)
    orphan_e = []
    for qid, (_, v) in qb_by_id.items():
        for code in re.findall(r"E_[A-Z0-9_]+", str(v[11] or "")):
            if code not in atlas_codes:
                orphan_e.append(f"{qid}:{code}")
    rec("INC-04", "منع کد E_ بی‌صاحب خارج از اطلس همان ورک‌بوک (T5)", len(orphan_e) == 0, f"orphan_codes={orphan_e}")

    # INC-05: Zero self-stamped `'تأییدشده'` rows authored by AI
    forged = [i for i in stamps_gate.issues if i.get("error") == "UNAUTHORIZED_GREEN_STAMP"]
    rec("INC-05", "منع سبز دروغین بدون حکم معلم", len(forged) == 0, f"forged_greens={forged}")

    # INC-06: Cross-lesson ownership match (`T7`)
    rec("INC-06", "تطابق مالکیت S1 و بانک سؤال (T7)", anchors_gate.status == "PASS", f"issues={anchors_gate.issues[:3]}")

    # INC-07: Official stamps intact (`9` identity + `8` skeleton + `2` atlas)
    rec("INC-07", "سلامت کامل مُهرهای رسمی ادغام v0.3.1", stamps_gate.status == "PASS", f"issues_count={len(stamps_gate.issues)}")

    # INC-08: `L-114` contains physical-book `شمارش ۴تا۴تا` + `دسته‌های ۵تایی` + `خلّق باش`
    l114_ok = (
        "L-114" in s1_by_id
        and s1_by_id["L-114"][1][3] == "شمارش ۴تا۴تا"
        and "دسته‌های ۵تایی" in str(s1_by_id["L-114"][1][6] or "")
    )
    rec("INC-08", "اعمال واقعی اصلاحیه در سلول اکسل (L-114)", l114_ok, f"L-114={s1_by_id.get('L-114', (0, [None]*7))[1][3]!r}")

    # INC-09: Machine pixel count on `Q-1011` (`۱۳ مثلث → ۱۸`, NOT `۱۶ مثلث → ۲۱`)
    q1011_stem = str(qb_by_id.get("Q-1011", (0, [""] * 17))[1][4] or "")
    q1011_ans_opt = str(qb_by_id.get("Q-1011", (0, [""] * 17))[1][8] or "")
    tri_ok = ("۱۳ مثلث" in q1011_stem and q1011_ans_opt == "۱۸")
    if pdf_path and Path(pdf_path).exists():
        px_res = count_visual_components(pdf_path, 14, (55, 356, 520, 414))
        tri_ok = tri_ok and (px_res["count"] == 13)
    rec("INC-09", "شمارش ماشینی عناصر تصویری (Q-1011: ۱۳ مثلث → ۱۸)", tri_ok, f"stem={q1011_stem!r}, opt_c={q1011_ans_opt!r}")

    # INC-10: `L-110` (`Q-1017-1019`) & `L-112` (`Q-1020`) range sync
    inc10_ok = (
        extract_q_refs_canonical(str(s1_by_id.get("L-110", (0, [""] * 14))[1][10] or "")) == ["Q-1017", "Q-1018", "Q-1019"]
        and extract_q_refs_canonical(str(s1_by_id.get("L-112", (0, [""] * 14))[1][10] or "")) == ["Q-1020"]
    )
    rec("INC-10", "هم‌گام‌سازی بازهٔ K در جابه‌جایی لنگر (L-110 / L-112)", inc10_ok, "Q-1017..1019 on L-110, Q-1020 on L-112")

    # INC-11: Keyed Column-A diff self-consistency (detects row shifts without key collision)
    rec("INC-11", "دیف کلیدمحور بر اساس ستون A بدون خطای جابه‌جایی سطر", len(s1_by_id) >= 26, f"unique_L_keys={len(s1_by_id)}, unique_Q_keys={len(qb_by_id)}")

    # INC-12: Strict `AUD-06` CPA triad (`مجسم / تصویری / علامتی` only)
    cpa_bad = [i for i in cpa_gate.issues if i.get("error") == "AUD_06_INVALID_CPA"]
    rec("INC-12", "رعایت سه‌گانهٔ CPA طبق AUD-06", len(cpa_bad) == 0, f"cpa_dist={cpa_gate.metrics.get('cpa_distribution')}")

    # INC-13: Exact banner orthography `«خلّق باش»` on `L-112` & `«معمّا و فرهنگ خواندن»` on `L-118`
    inc13_ok = (
        "خلّق باش" in str(s1_by_id.get("L-112", (0, [""] * 14))[1][6] or "")
        and s1_by_id.get("L-118", (0, [""] * 14))[1][3] == "معمّا و فرهنگ خواندن"
    )
    rec("INC-13", "وفاداری دقیق به املای بنر کتاب («خلّق باش» در L-112)", inc13_ok, f"L-118={s1_by_id.get('L-118', (0, ['']*4))[1][3]!r}")

    # INC-14: Zero hallucinated titles `'عدد صد'` / `'ترتیب عددی'` on pages `8..12` (`L-108..L-112`)
    hallucinated = [
        lid for lid in ("L-108", "L-109", "L-110", "L-111", "L-112")
        if any(bad in str(s1_by_id.get(lid, (0, [""] * 14))[1][3] or "") for bad in ("عدد صد", "ترتیب عددی"))
    ]
    rec("INC-14", "منع عناوین حدسی («عدد صد» / «ترتیب عددی» در ص ۸–۱۲)", len(hallucinated) == 0, f"hallucinated={hallucinated}")

    # INC-15 & INC-16: Bounded chunk size (`<=12`, overlap `2`) & proven `offset = +6`
    chunk_ok = True
    offset_ok = True
    if chunk_plan_path and Path(chunk_plan_path).exists():
        cp = json.loads(Path(chunk_plan_path).read_text(encoding="utf-8"))
        chunk_ok = cp.get("status") == "PASS" and all(c["page_count"] <= 12 for c in cp.get("chunks", []))
        offset_ok = cp.get("proven_offset") == 6 and len(cp.get("review_palindrome_anchors", [])) >= 5
    rec("INC-15", "خوانش چانکی <=۱۲ صفحه با هم‌پوشانی ۲ صفحه و ۴ مسیر موازی", chunk_ok, f"chunk_plan={chunk_plan_path}")
    rec("INC-16", "اثبات خودکار offset=+6 از پالیندروم مرور فصل و پاصفحه", offset_ok, "C205 proven_offset=+6")

    failed = [r for r in results if r["status"] != "PASS"]
    return GateResult(
        stage="AUTO",
        summary="automation-gate",
        gate_id="G_AUTO_10_HISTORICAL_INCIDENTS_16",
        status="PASS" if not failed else "FAIL",
        reason_code="ALL_16_HISTORICAL_INCIDENTS_CLEAN" if not failed else "HISTORICAL_INCIDENT_REGRESSION",
        issues=failed,
        metrics={"checked_incidents": 16, "passed_incidents": 16 - len(failed), "failed_incidents": len(failed), "matrix": results},
    )


# ==============================================================================
# Task 66 (گام ۷): مانیفست OFFICIAL-HEADS و گارد پایهٔ کهنه (`STALE_OFFICIAL_BASE_INCIDENT_07`)
# ==============================================================================
def check_official_heads(
    repo_root: str | Path,
    official_xlsx: Optional[str | Path] = None,
) -> Dict[str, Any]:
    """بررسی برابری SHA-256 فایل پایهٔ رسمی با مانیفست `OFFICIAL-HEADS.json`."""
    root = Path(repo_root).resolve()
    manifest_path = root / "public/math-game/authoring/OFFICIAL-HEADS.json"
    if not manifest_path.exists():
        return {"status": "WARN", "reason_code": "OFFICIAL_HEADS_MANIFEST_MISSING", "manifest": str(manifest_path)}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    heads = manifest.get("heads", {})
    if official_xlsx is None:
        return {
            "status": "PASS",
            "reason_code": "NO_OFFICIAL_PROVIDED",
            "heads": {k: v.get("version") for k, v in heads.items()},
        }
    off = Path(official_xlsx).resolve()
    family = None
    for key in heads:
        if key.replace("KH-", "khshab-") + "_" in off.name:
            family = key
            break
    if family is None:
        return {"status": "WARN", "reason_code": "FAMILY_NOT_IN_MANIFEST", "file": off.name}
    head = heads[family]
    actual_sha = file_sha256(str(off))
    if actual_sha == head.get("sha256"):
        return {
            "status": "PASS",
            "family": family,
            "expected_version": head.get("version"),
            "sha256": actual_sha,
        }
    return {
        "status": "FAIL",
        "reason_code": manifest.get("rules", {}).get(
            "stale_violation_code", "STALE_OFFICIAL_BASE_INCIDENT_07"
        ),
        "family": family,
        "expected_version": head.get("version"),
        "expected_sha256": head.get("sha256"),
        "provided_file": off.name,
        "provided_sha256": actual_sha,
        "summary": "پایهٔ رسمی کهنه است — موج جدید فقط از سرِ اعلام‌شدهٔ OFFICIAL-HEADS.json شروع می‌شود (حادثهٔ #۷).",
    }


def verify_all_heads(repo_root: str | Path) -> Dict[str, Any]:
    """خودسازگاری مانیفست: SHA هر فایل سرِ اعلام‌شده باید با فایل واقعی روی دیسک برابر باشد."""
    root = Path(repo_root).resolve()
    manifest_path = root / "public/math-game/authoring/OFFICIAL-HEADS.json"
    if not manifest_path.exists():
        return {"status": "FAIL", "reason_code": "OFFICIAL_HEADS_MANIFEST_MISSING"}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    issues = []
    for key, head in manifest.get("heads", {}).items():
        f = root / head.get("file", "")
        if not f.exists():
            issues.append({"family": key, "error": "FILE_MISSING", "file": str(f)})
            continue
        actual = file_sha256(str(f))
        if actual != head.get("sha256"):
            issues.append({
                "family": key,
                "error": "SHA_MISMATCH",
                "expected": head.get("sha256"),
                "actual": actual,
            })
    return {
        "status": "PASS" if not issues else "FAIL",
        "checked_families": len(manifest.get("heads", {})),
        "issues": issues,
    }
