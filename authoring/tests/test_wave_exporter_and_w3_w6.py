"""End-to-end verification of `W1`, `W3`, `W4`, `W5`, and `W6`."""

from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import openpyxl
import pymupdf
import pytest

from authoring.agent.automation_suite import (
    run_converter_and_parse_report,
    verify_c205_benchmark_incidents,
    verify_universal_wave_invariants,
)
from authoring.agent.models import file_sha256
from authoring.agent.observation import (
    observe_pdf,
    purge_quarantine_vault,
    render_counting_crop_nearest,
)
from authoring.agent.paths import resolve_fixture
from authoring.agent.reconcile import (
    GeminiVisionReaderAdapter,
    OpenAICompatibleReaderAdapter,
    enforce_agreement_evidence_rule,
    reconcile_chunk_directory,
    reconcile_field_claims,
)
from authoring.agent.validators import inspect_cartridge_workbook
from authoring.agent.viewer import create_viewer_handler
from authoring.agent.wave_exporter import export_wave_cartridge

REPO_ROOT = Path(__file__).resolve().parents[2]
V103_WORKTREE = Path("/tmp/v103_ref")


def _active_v103_root() -> Path | None:
    if (REPO_ROOT / "public/math-game/authoring/OFFICIAL-HEADS.json").exists():
        return REPO_ROOT
    if (V103_WORKTREE / "public/math-game/authoring/OFFICIAL-HEADS.json").exists():
        return V103_WORKTREE
    return None


def test_w1_g2_wave_spec_produces_bit_for_bit_identical_sha256(tmp_path: Path) -> None:
    spec_json = REPO_ROOT / "authoring/agent/fixtures/wave_spec_G2_ch4_v05.json"
    ref_v05 = resolve_fixture(REPO_ROOT, "khshab-G2-MATH_v0.5.xlsx", "authoring/khshab-G2-MATH_v0.5.xlsx")

    out_xlsx = tmp_path / "rebuilt_v05.xlsx"
    gate, sha, _ = export_wave_cartridge(
        spec_json,
        repo_root=REPO_ROOT,
        out_xlsx_path=out_xlsx,
        out_registry_path=tmp_path / "reg.json",
        enforce_official_heads=False,
    )
    assert gate.status == "PASS", gate.issues
    assert sha == file_sha256(str(ref_v05))
    assert sha == "f1f339a09a8cba3363c8c526e088063c2d733c62c5e7e4c236eba871f97d2656"


def test_w1_w3_g3_pilot_wave_and_all_six_official_heads(tmp_path: Path) -> None:
    ref_v05 = resolve_fixture(REPO_ROOT, "khshab-G2-MATH_v0.5.xlsx", "authoring/khshab-G2-MATH_v0.5.xlsx")
    c205_inc = verify_c205_benchmark_incidents(ref_v05)
    assert len(c205_inc) >= 6
    assert all(item["status"] == "PASS" for item in c205_inc), c205_inc

    v103 = _active_v103_root()
    if v103 is None:
        pytest.skip("v10.3-beta official head workbooks not mounted in this environment")

    heads = json.loads((v103 / "public/math-game/authoring/OFFICIAL-HEADS.json").read_text())["heads"]
    skeleton_flags = {}
    for fam, info in heads.items():
        wb_path = v103 / info["file"]
        u = verify_universal_wave_invariants(wb_path, official_xlsx=wb_path, base_xlsx=wb_path, repo_root=v103)
        assert u.status == "PASS", f"{fam} failed: {u.issues}"
        skeleton_flags[fam] = u.metrics["is_empty_skeleton"]

    assert skeleton_flags == {
        "KH-G1-MATH": True,
        "KH-G2-MATH": False,
        "KH-G3-MATH": False,
        "KH-G4-MATH": True,
        "KH-G5-MATH": True,
        "KH-G6-MATH": True,
    }

    out_g3 = tmp_path / "khshab-G3-MATH_v0.8.xlsx"
    g_exp, _, _ = export_wave_cartridge(
        REPO_ROOT / "authoring/agent/fixtures/wave_spec_G3_test_v08.json",
        repo_root=v103,
        out_xlsx_path=out_g3,
        out_registry_path=tmp_path / "g3_reg.json",
    )
    assert g_exp.status == "PASS"

    p4 = inspect_cartridge_workbook(
        out_g3,
        base_workbook_path=v103 / "public/math-game/authoring/khshab-G3-MATH_v0.7.xlsx",
        pagemap_xlsx_path=REPO_ROOT / "authoring/PAGE-MAP-KH-G3-MATH-v1_verified.xlsx",
    )
    assert all(gr.status == "PASS" for gr in p4.values()), {k: v.issues for k, v in p4.items()}

    conv = run_converter_and_parse_report(out_g3, v103, download_dir=tmp_path / "conv")
    assert conv["status"] == "PASS"
    assert conv["red"] == 0


def test_w4_synthetic_c305_vector_banner_capsule_and_300dpi_nearest_crop(tmp_path: Path) -> None:
    """Synthesize a real InDesign-style PDF with vector-only top banner capsule + y0≈0.876 Arabic-Indic footer."""
    pdf_file = tmp_path / "synthetic_C305_sample.pdf"
    doc = pymupdf.open()
    p1 = doc.new_page(width=595.28, height=793.70)
    p1.insert_text((300, 300), "Chapter 1 Opener", fontsize=16)

    p2 = doc.new_page(width=595.28, height=793.70)
    shape = p2.new_shape()
    shape.draw_rect(pymupdf.Rect(340, 28, 545, 72))
    shape.finish(color=(0.85, 0.2, 0.2), fill=(0.98, 0.85, 0.70), width=1.5)
    shape.commit()
    p2.insert_text((180, 260), "Body exercise content with enough characters for page text layer analysis " * 2, fontsize=11)
    # Use a real TrueType font supporting Arabic-Indic glyph '٢' just like InDesign C305.pdf
    ttf = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    if ttf.exists():
        p2.insert_text((512, 709), "٢", fontsize=14, fontname="dv", fontfile=str(ttf))
    else:
        p2.insert_text((512, 709), "2", fontsize=14)
    doc.save(str(pdf_file))
    doc.close()

    manifest_path = tmp_path / "manifest_synth_C305.json"
    manifest_path.write_text(
        json.dumps(
            {
                "book_code": "C305_SYNTH",
                "source_pdf": {"sha256": file_sha256(str(pdf_file)), "pdf_page_count": 2},
                "pagination": {
                    "pdf_minus_book_offset": 0,
                    "body_pdf_page_start": 1,
                    "body_pdf_page_end": 2,
                    "pages_without_footer": [1],
                },
                "chapters": [{"chapter": 1, "pdf_start": 1}],
            }
        ),
        encoding="utf-8",
    )

    vault = "/tmp/test_w4_vector_vault"
    crop_path, crop_sha, crop_size = render_counting_crop_nearest(pdf_file, 2, [0.55, 0.03, 0.93, 0.10], vault_dir=vault)
    assert str(crop_path).startswith("/tmp/")
    assert len(crop_sha) == 64
    assert crop_size[0] > 400 and crop_size[1] > 80

    gate, obs = observe_pdf(manifest_path, pdf_file, vault_dir=vault, purge_vault_after_run=True)
    assert gate.status == "PASS", gate.issues
    assert gate.metrics["vector_outline_banner_pages"] == [2]
    q2 = obs["quality_scores"][1]
    assert q2["extracted_footer_book_page"] == 2
    assert q2["footer_alignment_status"] == "MATCH"
    assert "VECTOR_OUTLINE_BANNER_NEEDS_VISION" in q2["hazards"]
    assert not Path(vault).exists()
    purge_quarantine_vault(vault)


def test_w5_g3_overlap_reconciler_and_sacred_agreement_rule() -> None:
    v103 = _active_v103_root()
    live_chunks = (v103 / "authoring/page-map-chunks-g3") if v103 and (v103 / "authoring/page-map-chunks-g3").exists() else None
    chunks_dir = live_chunks or (REPO_ROOT / "authoring/agent/fixtures/g3_overlap_chunks")
    rep = reconcile_chunk_directory(chunks_dir)
    assert rep["compared_page_count"] == 20
    assert 100 in rep["disputed_pages"] and 130 in rep["disputed_pages"]
    # Sacred constitutional invariant: agreed fields WITHOUT visual evidence NEVER become EVIDENCE_MATCHED!
    assert rep["field_verdict_counts"]["AGREED_UNVERIFIED"] == 108
    assert rep["field_verdict_counts"]["EVIDENCE_MATCHED"] == 0
    assert rep["field_verdict_counts"]["DISAGREEMENT"] == 52
    assert rep["disputed_page_count"] == 20

    with pytest.raises(ValueError, match="UNVERIFIED_AGREEMENT_PROMOTION_FORBIDDEN"):
        enforce_agreement_evidence_rule("الف", "الف", [], {}, claimed_status="TEACHER_APPROVED")

    edge = reconcile_field_claims(
        {1: {"pdfPage": 1, "banner": "؟", "pageType": "غیره", "exerciseCount": 3}},
        {1: {"pdfPage": 1, "banner": "درس ۱", "pageType": "غیره", "exerciseCount": 3}},
    )
    assert edge["pages"][1]["fields"]["main_banner"]["verdict"] == "UNOBSERVABLE"
    assert edge["pages"][1]["fields"]["exercise_count"]["verdict"] == "LOGICAL_CONFLICT"

    gem = GeminiVisionReaderAdapter(api_key="")
    zai = OpenAICompatibleReaderAdapter(api_key="")
    assert not gem.is_configured and not zai.is_configured
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY_MISSING"):
        gem.generate_json("test")
    with pytest.raises(RuntimeError, match="ZAI_OR_OPENAI_API_KEY_MISSING"):
        zai.generate_json("test")


def test_w6_live_viewer_http_loupe_signature_and_sha256_invalidation(tmp_path: Path) -> None:
    src_pm = resolve_fixture(REPO_ROOT, "PAGE-MAP-KH-G2-MATH-v1_verified.xlsx", "authoring/PAGE-MAP-KH-G2-MATH-v1_audited.xlsx")
    src_wb = resolve_fixture(REPO_ROOT, "khshab-G2-MATH_v0.5.xlsx", "authoring/khshab-G2-MATH_v0.5.xlsx")
    pm_copy = tmp_path / "pagemap.xlsx"
    wb_copy = tmp_path / "cartridge.xlsx"
    pm_copy.write_bytes(src_pm.read_bytes())
    wb_copy.write_bytes(src_wb.read_bytes())
    verdicts_file = tmp_path / "verdicts.json"

    handler = create_viewer_handler(
        REPO_ROOT,
        tmp_path / "missing.pdf",
        pagemap_path=pm_copy,
        cartridge_path=wb_copy,
        verdicts_path=verdicts_file,
    )
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        html = urllib.request.urlopen(f"http://127.0.0.1:{port}/").read().decode("utf-8")
        assert "loupeCanvas" in html and "imageSmoothingEnabled = false" in html

        # 1. AI self-approval via HTTP API must fail with HTTP 403 (no token + AI role)!
        bad_req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/verdict",
            data=json.dumps(
                {"scope": "ROW_APPROVED", "actor": "ai_bot", "actor_role": "ai_agent", "target_ids": ["L-401"]}
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with pytest.raises(urllib.error.HTTPError) as exc_info:
            urllib.request.urlopen(bad_req)
        assert exc_info.value.code == 403

        # 1b. Human teacher WITHOUT server-side token must also fail (proves role claim alone is not enough)
        no_token_req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/verdict",
            data=json.dumps(
                {"scope": "ROW_APPROVED", "actor": "استاد راهنما", "actor_role": "human_teacher", "target_ids": ["L-401"]}
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with pytest.raises(urllib.error.HTTPError) as exc_info2:
            urllib.request.urlopen(no_token_req)
        assert exc_info2.value.code == 403

        # 2. Human teacher signs verdict via HTTP POST with server-side token -> active_verdicts == 1
        ok_req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/verdict",
            data=json.dumps(
                {"scope": "ROW_APPROVED", "actor": "استاد راهنما", "actor_role": "human_teacher", "target_ids": ["L-401"]}
            ).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Teacher-Token": "dev-teacher-token-2026"},
            method="POST",
        )
        res = json.loads(urllib.request.urlopen(ok_req).read().decode("utf-8"))
        assert res["ok"] is True

        summary1 = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/api/summary").read().decode("utf-8"))
        assert summary1["active_verdicts"] == 1
        assert summary1["invalidated_verdicts"] == 0

        # 3. Mutate 1 cell of `cartridge.xlsx` -> GET /api/summary MUST invalidate the stale verdict automatically!
        wb = openpyxl.load_workbook(wb_copy)
        wb.worksheets[0].cell(2, 2, "0.5-modified")
        wb.save(wb_copy)
        wb.close()

        summary2 = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/api/summary").read().decode("utf-8"))
        assert summary2["active_verdicts"] == 0
        assert summary2["invalidated_verdicts"] == 1
        assert any(r.startswith("INVALIDATED_STALE_VERDICTS") for r in summary2["blocker_reasons"])
    finally:
        server.shutdown()
        server.server_close()
