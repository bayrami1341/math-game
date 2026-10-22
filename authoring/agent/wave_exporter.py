"""Grade-Agnostic Data-Driven Wave Cartridge Exporter (`W1` — `WaveSpec v2`).

Builds any wave `.xlsx` (`G1..G6`) cleanly from a pure JSON `WaveSpecV2` file:
1. Enforces `OFFICIAL-HEADS.json` SHA-256 lock (`STALE_OFFICIAL_BASE_INCIDENT_07` fail-closed)
   plus explicit `expected_official_base_sha256` and `verified_pagemap_sha256` verification.
2. Applies ONLY explicitly declared `authorized_patches[]` (verifying `expected_old_value` when set);
   otherwise `allowed_cell_triples == set()` (pure additive overlay, `0` legacy diffs).
3. Rejects any attempt by AI wave specs to self-stamp green (`'تأییدشده'`) (`UNAUTHORIZED_GREEN_STAMP`).
4. Inserts new rows deterministically above trailing blank separator / sentinel `یادداشت` rows so both
   OpenPyXL gates and Z.ai's `convert.mjs` (`!first || first === 'یادداشت'`) see 100% of active rows.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import openpyxl
from openpyxl.utils import column_index_from_string

from .automation_suite import (
    check_official_heads,
    diff_workbooks_by_key,
    norm_key,
    sheet_header_row,
    verify_bidirectional_anchors,
    verify_official_stamps,
    verify_wave_whitelist,
)
from .id_allocator import IDAllocator
from .models import GateResult, WaveSpecV2, file_sha256
from .paths import resolve_fixture, resolve_official_cartridge

AI_SOURCE_TAG = "پیشنهاد AI — موتور تألیف v۱.۰"
YELLOW_STATUS = "نیاز به تأیید"


def _format_wrong_spec(wrong_spec: List[List[Any]]) -> str:
    return repr([(item[0], item[1]) for item in wrong_spec])


def _find_key_row(ws, sheet_name: str, target_key: str) -> Optional[int]:
    h = sheet_header_row(ws)
    for r in range(h + 1, ws.max_row + 1):
        vals = [ws.cell(r, c).value for c in range(1, ws.max_column + 1)]
        k = norm_key(sheet_name, vals)
        if k is None:
            if str(vals[0] or "").strip() == "یادداشت":
                break
            continue
        if k == target_key:
            return r
    return None


def export_wave_cartridge(
    wave_spec_path: str | Path,
    repo_root: str | Path,
    out_xlsx_path: str | Path,
    out_registry_path: Optional[str | Path] = None,
    *,
    base_xlsx_override: Optional[str | Path] = None,
    historical_workbooks: Optional[Iterable[str | Path]] = None,
    patch_log_path: Optional[str | Path] = None,
    enforce_official_heads: bool = True,
) -> Tuple[GateResult, str, Dict[str, Any]]:
    """Export any multi-grade wave `.xlsx` from `WaveSpecV2` JSON with strict fail-closed guards."""
    from .excel_exporter import (
        insert_rows_above_sentinel,
        insert_rows_at_position,
        save_workbook_deterministically,
    )

    root = Path(repo_root).resolve()
    spec = WaveSpecV2.from_json_file(wave_spec_path)

    base_xlsx = (
        Path(base_xlsx_override).resolve()
        if base_xlsx_override is not None
        else resolve_official_cartridge(
            root,
            spec.base_cartridge_filename,
            fallback_authoring_name=spec.base_cartridge_filename.replace(".xlsx", "_official.xlsx"),
        )
    )
    if not base_xlsx.exists():
        return (
            GateResult(
                gate_id="G3_WAVE_EXPORT",
                stage="P3",
                status="BLOCKED",
                reason_code="MISSING_BASE_CARTRIDGE",
                summary=f"فایل پایهٔ رسمی `{spec.base_cartridge_filename}` یافت نشد.",
                metrics={"expected_path": str(base_xlsx)},
            ),
            "",
            {},
        )

    actual_base_sha = file_sha256(str(base_xlsx))
    if spec.expected_official_base_sha256 and actual_base_sha != spec.expected_official_base_sha256:
        return (
            GateResult(
                gate_id="G3_WAVE_EXPORT",
                stage="P3",
                status="FAIL",
                reason_code="STALE_OFFICIAL_BASE_INCIDENT_07",
                summary="هش SHA-256 فایل پایه با `expected_official_base_sha256` در WaveSpec مطابقت ندارد.",
                metrics={
                    "expected_sha256": spec.expected_official_base_sha256,
                    "actual_sha256": actual_base_sha,
                    "base_file": str(base_xlsx),
                },
            ),
            "",
            {},
        )

    if enforce_official_heads:
        head_check = check_official_heads(root, base_xlsx)
        if head_check.get("status") == "FAIL":
            return (
                GateResult(
                    gate_id="G3_WAVE_EXPORT",
                    stage="P3",
                    status="FAIL",
                    reason_code=head_check.get("reason_code", "STALE_OFFICIAL_BASE_INCIDENT_07"),
                    summary=head_check.get("summary", "پایهٔ رسمی نسبت به OFFICIAL-HEADS.json کهنه است."),
                    metrics=head_check,
                ),
                "",
                {},
            )

    if spec.verified_pagemap_path and spec.verified_pagemap_sha256:
        pm_candidate = root / spec.verified_pagemap_path
        if not pm_candidate.exists():
            pm_candidate = resolve_fixture(root, Path(spec.verified_pagemap_path).name, spec.verified_pagemap_path)
        if pm_candidate.exists():
            actual_pm_sha = file_sha256(str(pm_candidate))
            if actual_pm_sha != spec.verified_pagemap_sha256:
                return (
                    GateResult(
                        gate_id="G3_WAVE_EXPORT",
                        stage="P3",
                        status="FAIL",
                        reason_code="VERIFIED_PAGEMAP_SHA_MISMATCH",
                        summary="هش SHA-256 نقشهٔ مادر صفحات تغییر کرده است.",
                        metrics={"expected": spec.verified_pagemap_sha256, "actual": actual_pm_sha},
                    ),
                    "",
                    {},
                )

    # Forbid any forged green status inside AI wave spec (INC-05)
    for row_obj in [*spec.s1_rows, *spec.atlas_rows, *spec.question_rows]:
        if getattr(row_obj, "status", YELLOW_STATUS).strip() == "تأییدشده":
            return (
                GateResult(
                    gate_id="G3_WAVE_EXPORT",
                    stage="P3",
                    status="FAIL",
                    reason_code="UNAUTHORIZED_GREEN_STAMP",
                    summary="ممنوعیت مطلق ثبت وضعیت «تأییدشده» در WaveSpec هوش مصنوعی (INC-05).",
                ),
                "",
                {},
            )

    hist_wbs = list(historical_workbooks) if historical_workbooks is not None else [base_xlsx]
    allocator = IDAllocator.from_existing_workbooks(hist_wbs, spec.runtime_error_codes)

    s1_rows: List[List[Any]] = []
    for s in spec.s1_rows:
        lid = allocator.allocate_explicit("L", s.id, f"s1:ch={s.chapter}:page={s.page}:id={s.id}")
        s1_rows.append(
            [
                lid,
                s.page,
                s.chapter,
                s.title,
                s.objective,
                s.vocab,
                s.activity,
                s.figure,
                s.potential,
                s.engine,
                s.anchor,
                s.source or AI_SOURCE_TAG,
                s.status or YELLOW_STATUS,
                s.note,
            ]
        )

    atlas_rows: List[List[Any]] = []
    for e in spec.atlas_rows:
        allocator.allocate_explicit("E", e.code_raw, f"atlas:{e.code_raw}")
        atlas_rows.append(
            [
                e.cell_code,
                e.name_fa,
                e.category,
                e.description,
                e.sample_sign,
                e.diagnostic_prompt,
                e.intervention,
                e.priority,
                e.source or AI_SOURCE_TAG,
                e.status or YELLOW_STATUS,
                e.note,
            ]
        )

    bank_rows: List[List[Any]] = []
    for idx, q in enumerate(spec.question_rows, start=1):
        sem_key = q.semantic_key or f"{spec.semantic_prefix}:{q.anchor}:slot={idx:02d}"
        if q.qid:
            qid = allocator.allocate_explicit("Q", q.qid, sem_key)
        else:
            qid = allocator.next_question_id(sem_key, min_start=spec.min_question_id_start)
        note_str = q.note_override or (
            f"ضد J12 — کار دفترچه‌ای (لاتین): {q.trace}; "
            f"independently checked: answer={q.answer_val}; "
            f"wrong={_format_wrong_spec(q.wrong_spec)}. لنگر {q.page_ref}؛ پرسش خودساخته، نه نقل کتاب."
        )
        bank_rows.append(
            [
                qid,
                q.anchor,
                q.scope,
                q.cpa,
                q.stem,
                q.q_format,
                q.opts[0],
                q.opts[1],
                q.opts[2],
                q.opts[3],
                q.ans,
                q.map,
                q.level,
                q.rubric,
                q.source or AI_SOURCE_TAG,
                q.status or YELLOW_STATUS,
                note_str,
            ]
        )

    wb = openpyxl.load_workbook(base_xlsx)
    applied_patches: List[Dict[str, Any]] = []
    for p in spec.authorized_patches:
        if p.sheet not in wb.sheetnames:
            return (
                GateResult(
                    gate_id="G3_WAVE_EXPORT",
                    stage="P3",
                    status="FAIL",
                    reason_code="PATCH_TARGET_SHEET_NOT_FOUND",
                    summary=f"شیت هدف پچ `{p.sheet}` در فایل پایه وجود ندارد.",
                ),
                "",
                {},
            )
        ws_p = wb[p.sheet]
        target_r = _find_key_row(ws_p, p.sheet, p.key)
        if target_r is None:
            return (
                GateResult(
                    gate_id="G3_WAVE_EXPORT",
                    stage="P3",
                    status="FAIL",
                    reason_code="PATCH_TARGET_KEY_NOT_FOUND",
                    summary=f"کلید هدف پچ `{p.key}` در شیت `{p.sheet}` یافت نشد.",
                ),
                "",
                {},
            )
        c_idx = column_index_from_string(p.col_letter)
        cur_val = ws_p.cell(target_r, c_idx).value
        if p.expected_old_value is not None and str(cur_val or "").strip() != str(p.expected_old_value).strip():
            return (
                GateResult(
                    gate_id="G3_WAVE_EXPORT",
                    stage="P3",
                    status="FAIL",
                    reason_code="PATCH_EXPECTED_OLD_VALUE_MISMATCH",
                    summary=f"مقدار فعلی سلول ({p.sheet}!{p.key}.{p.col_letter}={cur_val!r}) با مقدار مورد انتظار ({p.expected_old_value!r}) مغایر است.",
                ),
                "",
                {},
            )
        ws_p.cell(target_r, c_idx).value = p.new_value
        applied_patches.append(
            {
                "sheet": p.sheet,
                "key": p.key,
                "col_letter": p.col_letter,
                "old_value": cur_val,
                "new_value": p.new_value,
                "reason": p.reason,
            }
        )

    ws_s1 = wb["نقشهٔ کتاب (S1)"]
    if spec.insert_s1_after_key:
        anchor_row = _find_key_row(ws_s1, "نقشهٔ کتاب (S1)", spec.insert_s1_after_key)
        if anchor_row is not None:
            insert_rows_at_position(ws_s1, anchor_row + 1, s1_rows)
        else:
            insert_rows_above_sentinel(ws_s1, s1_rows)
    else:
        insert_rows_above_sentinel(ws_s1, s1_rows)

    insert_rows_above_sentinel(wb["اطلس خطا"], atlas_rows)
    insert_rows_above_sentinel(wb["بانک سؤال"], bank_rows)

    out_path = Path(out_xlsx_path)
    sha = save_workbook_deterministically(wb, out_path)
    if out_registry_path is not None:
        allocator.save(out_registry_path)

    if patch_log_path is not None:
        pl = Path(patch_log_path)
        pl.parent.mkdir(parents=True, exist_ok=True)
        pl.write_text(
            json.dumps(
                {
                    "schema_version": "2.0.0",
                    "wave_id": spec.wave_id,
                    "family_id": spec.family_id,
                    "target_workbook": str(base_xlsx),
                    "target_workbook_sha256": actual_base_sha,
                    "applied_patches": applied_patches,
                    "deferred_pedagogical_proposals_awaiting_teacher": spec.deferred_proposals,
                    "proposals": spec.deferred_proposals,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    allowed_cell_triples = {(p["sheet"], p["key"], p["col_letter"]) for p in applied_patches}
    allowed_added_keys = (
        {("نقشهٔ کتاب (S1)", r[0]) for r in s1_rows}
        | {("اطلس خطا", norm_key("اطلس خطا", r)) for r in atlas_rows}
        | {("بانک سؤال", r[0]) for r in bank_rows}
    )
    kd = diff_workbooks_by_key(base_xlsx, out_path)
    wl_gate = verify_wave_whitelist(kd, allowed_cell_triples, allowed_added_keys)
    anc_gate = verify_bidirectional_anchors(out_path)
    legacy_diffs = len(wl_gate.issues)

    # Verify no green rows in base were altered unless explicitly patched with authorization
    stamps_gate = verify_official_stamps(out_path, base_xlsx)
    unpatched_stamp_errors = [
        i
        for i in stamps_gate.issues
        if (i.get("sheet"), i.get("key"), i.get("col_letter")) not in allowed_cell_triples
    ]

    ok = legacy_diffs == 0 and anc_gate.status == "PASS" and len(unpatched_stamp_errors) == 0
    details = {
        "wave_id": spec.wave_id,
        "family_id": spec.family_id,
        "base_xlsx": str(base_xlsx),
        "base_sha256": actual_base_sha,
        "output_xlsx": str(out_path),
        "output_sha256": sha,
        "applied_patches": applied_patches,
        "keyed_diff_summary": kd["summary"],
        "allocator": allocator,
    }
    gate = GateResult(
        gate_id="G3_WAVE_EXPORT",
        stage="P3",
        status="PASS" if ok else "FAIL",
        reason_code="WAVE_EXPORT_CLEAN" if ok else "WAVE_EXPORT_INVARIANT_FAILURE",
        summary=(
            f"موج `{spec.wave_id}` برای خانوادهٔ `{spec.family_id}` با {len(s1_rows)} ردیف S1، "
            f"{len(atlas_rows)} ردیف اطلس، {len(bank_rows)} سؤال و {len(applied_patches)} پچ مجاز ساخته شد "
            f"(تغییر خارج از لیست سفید: {legacy_diffs})."
        ),
        metrics={
            "family_id": spec.family_id,
            "wave_id": spec.wave_id,
            "legacy_cell_diffs": legacy_diffs,
            "scheduled_patch_diffs": len(kd["changed_cells"]),
            "added_s1_rows": len(s1_rows),
            "added_error_codes": len(atlas_rows),
            "added_questions": len(bank_rows),
            "output_sha256": sha,
            "id_counts": allocator.to_dict()["counts"],
        },
        issues=wl_gate.issues + anc_gate.issues + unpatched_stamp_errors,
    )
    return gate, sha, details
