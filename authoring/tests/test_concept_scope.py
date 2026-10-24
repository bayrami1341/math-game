from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pytest
import pymupdf

from authoring.agent.concept_scope import (
    PASS_SCHEMA,
    PROFILE_SCHEMA,
    RENDER_SPEC,
    audit_concept_scope,
    compute_crop_image_sha256,
    compute_page_image_sha256,
)
from authoring.agent.cli import main as cli_main
from authoring.agent.models import file_sha256


def _write_json(path: Path, payload: dict[str, Any]) -> Path:
    path.write_text(json.dumps(payload, ensure_ascii=False, sort_keys=True), encoding="utf-8")
    return path


def _bundle(tmp_path: Path) -> dict[str, Any]:
    repo = tmp_path / "repo"
    repo.mkdir()
    vault = tmp_path / "private-vault"
    vault.mkdir(mode=0o700)
    os.chmod(vault, 0o700)

    pdf_path = vault / "SYNTHETIC-BOOK.pdf"
    doc = pymupdf.open()
    for page_number in range(1, 7):
        page = doc.new_page(width=240, height=320)
        page.insert_text((24, 48), f"Synthetic test page {page_number}")
        if page_number >= 5:
            page.insert_text((24, 290), str(page_number - 4))
    doc.save(pdf_path)
    doc.close()
    os.chmod(pdf_path, 0o600)

    manifest = {
        "schema_version": "1.0.0",
        "manifest_id": "SYNTH-PRINT-01",
        "book_code": "SYNTH",
        "edition_label_fa": "چاپ آزمایشی مصنوعی",
        "source_pdf": {
            "filename": pdf_path.name,
            "sha256": file_sha256(str(pdf_path)),
            "size_bytes": pdf_path.stat().st_size,
            "pdf_page_count": 6,
        },
        "pagination": {
            "front_matter_pdf_pages": [1, 2, 3, 4],
            "body_pdf_page_start": 5,
            "body_pdf_page_end": 6,
            "book_page_start": 1,
            "book_page_end": 2,
            "pdf_minus_book_offset": 4,
        },
        "chapters": [{
            "chapter": 2,
            "title_fa": "Synthetic chapter; not a real book claim",
            "book_start": 1,
            "book_end": 2,
            "pdf_start": 5,
            "pdf_end": 6,
        }],
    }
    manifest_path = _write_json(vault / "manifest.json", manifest)
    manifest_sha = file_sha256(str(manifest_path))
    source_sha = file_sha256(str(pdf_path))

    profile = {
        "schema_version": PROFILE_SCHEMA,
        "profile_id": "SYNTH-SCOPE-PROFILE-1",
        "section_id": "SYNTH-SECTION-2",
        "taxonomy_version": "synthetic-taxonomy-v1",
        "book_code": "SYNTH",
        "manifest_id": "SYNTH-PRINT-01",
        "manifest_sha256": manifest_sha,
        "source_pdf_sha256": source_sha,
        "section_selector": {"chapter_number": 2},
        "allowed_objective_ids": ["obj-whole-number-multiplication"],
        "allowed_primary_concepts": ["whole_number_multiplication"],
        "allowed_supporting_concepts": ["repeated_addition", "skip_counting"],
        "allowed_incidental_concepts": ["page_decoration"],
        "excluded_primary_concepts": [
            "standalone_addition",
            "standalone_subtraction",
            "decimal_arithmetic",
        ],
        "allowed_primary_operations": ["multiply"],
        "allowed_supporting_operations": ["add", "count"],
        "excluded_primary_operations": ["add", "subtract", "decimal_operation"],
        "allowed_primary_number_domains": ["whole_numbers"],
        "allowed_supporting_number_domains": ["whole_numbers"],
        "excluded_primary_number_domains": ["decimal_numbers"],
    }
    profile_path = _write_json(vault / "scope-profile.json", profile)
    profile_sha = file_sha256(str(profile_path))

    page_map = {5: 1, 6: 2}
    image_hashes = {
        pdf_page: compute_page_image_sha256(pdf_path, pdf_page)
        for pdf_page in page_map
    }

    def make_pass(reader_suffix: str, concepts_by_page: dict[int, list[dict[str, Any]]] | None = None) -> dict[str, Any]:
        ledger: dict[str, dict[str, Any]] = {}
        pages: list[dict[str, Any]] = []
        concepts_by_page = concepts_by_page or {}
        for pdf_page, book_page in page_map.items():
            render_id = f"EV-RENDER-{reader_suffix}-P{pdf_page}"
            ledger[render_id] = {
                "evidence_id": render_id,
                "book_code": "SYNTH",
                "source_sha256": source_sha,
                "manifest_sha256": manifest_sha,
                "pdf_page": pdf_page,
                "book_page": book_page,
                "evidence_kind": "pdf_page_render",
                "bbox_normalized": [0.0, 0.0, 1.0, 1.0],
                "page_image_sha256": image_hashes[pdf_page],
            }
            text_id = f"EV-TEXT-{reader_suffix}-P{pdf_page}"
            ledger[text_id] = {
                "evidence_id": text_id,
                "book_code": "SYNTH",
                "source_sha256": source_sha,
                "manifest_sha256": manifest_sha,
                "pdf_page": pdf_page,
                "book_page": book_page,
                "evidence_kind": "pdf_text_bbox",
                "bbox_normalized": [0.12, 0.12, 0.88, 0.42],
            }
            page_number_id = f"EV-PAGE-NUMBER-{reader_suffix}-P{pdf_page}"
            ledger[page_number_id] = {
                "evidence_id": page_number_id,
                "book_code": "SYNTH",
                "source_sha256": source_sha,
                "manifest_sha256": manifest_sha,
                "pdf_page": pdf_page,
                "book_page": book_page,
                "evidence_kind": "pdf_text_bbox",
                "evidence_purpose": "printed_page_number",
                "bbox_normalized": [0.05, 0.80, 0.25, 0.97],
            }
            concepts = concepts_by_page.get(pdf_page)
            if concepts is None:
                concepts = [{
                    "concept_id": "whole_number_multiplication",
                    "role": "PRIMARY",
                    "operation_id": "multiply",
                    "number_domain_id": "whole_numbers",
                    "objective_ids": ["obj-whole-number-multiplication"],
                    "confidence": "HIGH",
                    "evidence_modality": "TEXT",
                    "evidence_refs": [text_id],
                }]
            # Copy records so a test can edit one pass without mutating the other.
            concepts = [dict(c) for c in concepts]
            pages.append({
                "pdf_page": pdf_page,
                "book_page": book_page,
                "printed_page_number": book_page,
                "page_number_evidence_refs": [page_number_id],
                "page_image_sha256": image_hashes[pdf_page],
                "reading_status": "COMPLETE",
                "visual_scan_status": "NOT_APPLICABLE",
                "visual_regions_count": 0,
                "page_status": "CURRICULAR_CONTENT",
                "page_evidence_refs": [render_id],
                "concepts": concepts,
            })
        return {
            "schema_version": PASS_SCHEMA,
            "pass_id": f"pass-{reader_suffix}",
            "reader_id": f"reader-{reader_suffix}",
            "model_id": f"model-{reader_suffix}",
            "profile_id": profile["profile_id"],
            "profile_sha256": profile_sha,
            "section_id": profile["section_id"],
            "taxonomy_version": profile["taxonomy_version"],
            "render_spec": RENDER_SPEC,
            "source_binding": {
                "book_code": "SYNTH",
                "manifest_id": "SYNTH-PRINT-01",
                "manifest_sha256": manifest_sha,
                "source_pdf_sha256": source_sha,
            },
            "pages": pages,
            "evidence_ledger": ledger,
        }

    pass_a_path = _write_json(vault / "pass-a.json", make_pass("A"))
    pass_b_path = _write_json(vault / "pass-b.json", make_pass("B"))
    return {
        "repo": repo,
        "vault": vault,
        "pdf": pdf_path,
        "manifest": manifest_path,
        "profile": profile_path,
        "pass_a": pass_a_path,
        "pass_b": pass_b_path,
        "make_pass": make_pass,
        "page_map": page_map,
        "image_hashes": image_hashes,
        "profile_data": profile,
        "manifest_data": manifest,
    }


def _run(bundle: dict[str, Any]) -> dict[str, Any]:
    return audit_concept_scope(
        pdf_path=bundle["pdf"],
        manifest_path=bundle["manifest"],
        profile_path=bundle["profile"],
        pass_a_path=bundle["pass_a"],
        pass_b_path=bundle["pass_b"],
        repo_root=bundle["repo"],
    )


def _codes(report: dict[str, Any]) -> set[str]:
    return {item["code"] for item in report["issues"]}


def _off_scope_decimal_claim(evidence_ref: str) -> dict[str, Any]:
    return {
        "concept_id": "decimal_arithmetic",
        "role": "PRIMARY",
        "operation_id": "decimal_operation",
        "number_domain_id": "decimal_numbers",
        "objective_ids": ["obj-decimal-arithmetic"],
        "confidence": "HIGH",
        "evidence_modality": "TEXT",
        "evidence_refs": [evidence_ref],
    }


def _set_visual_claim(bundle: dict[str, Any], pass_key: str, suffix: str) -> None:
    payload = json.loads(bundle[pass_key].read_text(encoding="utf-8"))
    bbox = [0.05, 0.05, 0.95, 0.95]
    crop_id = f"EV-CROP-{suffix}-P5"
    payload["evidence_ledger"][crop_id] = {
        "evidence_id": crop_id,
        "book_code": "SYNTH",
        "source_sha256": file_sha256(str(bundle["pdf"])),
        "manifest_sha256": file_sha256(str(bundle["manifest"])),
        "pdf_page": 5,
        "book_page": 1,
        "evidence_kind": "pdf_crop_150dpi",
        "bbox_normalized": bbox,
        "crop_sha256": compute_crop_image_sha256(bundle["pdf"], 5, bbox, dpi=150),
    }
    payload["pages"][0]["visual_scan_status"] = "COMPLETE"
    payload["pages"][0]["visual_regions_count"] = 1
    payload["pages"][0]["concepts"][0]["evidence_modality"] = "VISUAL"
    payload["pages"][0]["concepts"][0]["evidence_refs"] = [crop_id]
    _write_json(bundle[pass_key], payload)


def test_two_complete_source_bound_passes_allow_scope_only_pass(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_b = json.loads(bundle["pass_b"].read_text(encoding="utf-8"))
    # Banner metadata is intentionally outside the scope signature.
    pass_b["pages"][0]["banner_present"] = True
    pass_b["pages"][1]["banner_present"] = False
    _write_json(bundle["pass_b"], pass_b)

    report = _run(bundle)

    assert report["status"] == "PASS"
    assert report["reason_code"] == "CONCEPT_SCOPE_MATCHED_TECHNICAL_ONLY"
    assert report["metrics"]["expected_pages"] == 2
    assert report["metrics"]["matched_pages"] == 2
    assert report["metrics"]["offset_pages_matched"] == 2
    assert report["scope"]["offset_validation"] == "TWO_READER_PRINTED_PAGE_LABELS_MATCH_MANIFEST"
    assert report["source"]["source_pdf_sha256"] == file_sha256(str(bundle["pdf"]))
    assert report["safeguards"]["scope_only"] is True
    assert report["safeguards"]["color_change_authorized"] is False
    assert report["safeguards"]["release_authorized"] is False


def test_visual_crop_hash_is_recomputed_from_source_pdf(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    _set_visual_claim(bundle, "pass_a", "A")
    _set_visual_claim(bundle, "pass_b", "B")

    report = _run(bundle)

    assert report["status"] == "PASS"
    assert report["metrics"]["matched_pages"] == 2


def test_mixed_claim_requires_both_text_and_source_bound_visual_crop(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    for key, suffix in (("pass_a", "A"), ("pass_b", "B")):
        payload = json.loads(bundle[key].read_text(encoding="utf-8"))
        payload["pages"][0]["concepts"][0]["evidence_modality"] = "MIXED"
        payload["pages"][0]["concepts"][0]["evidence_refs"] = [f"EV-TEXT-{suffix}-P5"]
        _write_json(bundle[key], payload)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "MIXED_CLAIM_TEXT_AND_CROP_EVIDENCE_REQUIRED" in _codes(report)


def test_tampered_visual_crop_hash_blocks(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    _set_visual_claim(bundle, "pass_a", "A")
    _set_visual_claim(bundle, "pass_b", "B")
    pass_b = json.loads(bundle["pass_b"].read_text(encoding="utf-8"))
    pass_b["evidence_ledger"]["EV-CROP-B-P5"]["crop_sha256"] = "0" * 64
    _write_json(bundle["pass_b"], pass_b)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "EVIDENCE_CROP_SHA_MISMATCH" in _codes(report)


def test_text_bbox_must_intersect_text_in_source_pdf(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_a = json.loads(bundle["pass_a"].read_text(encoding="utf-8"))
    pass_a["evidence_ledger"]["EV-TEXT-A-P5"]["bbox_normalized"] = [0.75, 0.75, 0.95, 0.95]
    _write_json(bundle["pass_a"], pass_a)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "EVIDENCE_TEXT_REGION_NOT_FOUND" in _codes(report)


def test_supporting_repeated_addition_is_allowed_but_not_a_new_primary_target(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    for key in ("pass_a", "pass_b"):
        payload = json.loads(bundle[key].read_text(encoding="utf-8"))
        text_id = next(eid for eid in payload["evidence_ledger"] if eid.startswith("EV-TEXT") and eid.endswith("P5"))
        payload["pages"][0]["concepts"].append({
            "concept_id": "repeated_addition",
            "role": "SUPPORTING",
            "operation_id": "add",
            "number_domain_id": "whole_numbers",
            "objective_ids": ["obj-whole-number-multiplication"],
            "confidence": "HIGH",
            "evidence_modality": "TEXT",
            "evidence_refs": [text_id],
        })
        _write_json(bundle[key], payload)

    report = _run(bundle)

    assert report["status"] == "PASS"
    assert report["metrics"]["supporting_claims"] == 1


def test_agreed_decimal_primary_target_is_critical_fail(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    for key, suffix in (("pass_a", "A"), ("pass_b", "B")):
        payload = json.loads(bundle[key].read_text(encoding="utf-8"))
        text_id = f"EV-TEXT-{suffix}-P5"
        payload["pages"][0]["concepts"] = [_off_scope_decimal_claim(text_id)]
        _write_json(bundle[key], payload)

    report = _run(bundle)

    assert report["status"] == "FAIL"
    assert report["reason_code"] == "CONFIRMED_OUT_OF_SCOPE_PRIMARY"
    assert "CONFIRMED_OUT_OF_SCOPE_PRIMARY" in _codes(report)
    assert report["safeguards"]["human_verdict_created"] is False


def test_one_reader_detecting_off_scope_content_blocks_as_potential_crisis(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_b = json.loads(bundle["pass_b"].read_text(encoding="utf-8"))
    pass_b["pages"][0]["concepts"] = [_off_scope_decimal_claim("EV-TEXT-B-P5")]
    _write_json(bundle["pass_b"], pass_b)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "OBSERVER_PAGE_CONCEPT_DISAGREEMENT" in _codes(report)
    assert "POTENTIAL_OUT_OF_SCOPE_PRIMARY_CONFLICT" in _codes(report)


def test_missing_page_in_one_pass_is_not_hidden_by_intersection(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_b = json.loads(bundle["pass_b"].read_text(encoding="utf-8"))
    pass_b["pages"] = [row for row in pass_b["pages"] if row["pdf_page"] != 6]
    _write_json(bundle["pass_b"], pass_b)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "READER_PAGE_MISSING" in _codes(report)
    assert report["metrics"]["matched_pages"] == 1


def test_printed_page_number_mismatch_blocks_manifest_offset(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_b = json.loads(bundle["pass_b"].read_text(encoding="utf-8"))
    pass_b["pages"][0]["printed_page_number"] = 2
    _write_json(bundle["pass_b"], pass_b)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "READER_PRINTED_PAGE_NUMBER_MISMATCH" in _codes(report)


def test_printed_page_number_witness_must_contain_expected_number(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_a = json.loads(bundle["pass_a"].read_text(encoding="utf-8"))
    pass_a["evidence_ledger"]["EV-PAGE-NUMBER-A-P5"]["bbox_normalized"] = [0.12, 0.12, 0.88, 0.42]
    _write_json(bundle["pass_a"], pass_a)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "EVIDENCE_PRINTED_PAGE_NUMBER_TEXT_MISMATCH" in _codes(report)


def test_visual_page_number_crop_can_bind_source_offset(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    bbox = [0.05, 0.80, 0.25, 0.97]
    for key, suffix in (("pass_a", "A"), ("pass_b", "B")):
        payload = json.loads(bundle[key].read_text(encoding="utf-8"))
        pdf_page = 5
        book_page = 1
        crop_id = f"EV-PAGE-NUMBER-CROP-{suffix}-P{pdf_page}"
        payload["evidence_ledger"][crop_id] = {
            "evidence_id": crop_id,
            "book_code": "SYNTH",
            "source_sha256": file_sha256(str(bundle["pdf"])),
            "manifest_sha256": file_sha256(str(bundle["manifest"])),
            "pdf_page": pdf_page,
            "book_page": book_page,
            "evidence_kind": "pdf_crop_150dpi",
            "evidence_purpose": "printed_page_number",
            "bbox_normalized": bbox,
            "crop_sha256": compute_crop_image_sha256(bundle["pdf"], pdf_page, bbox),
        }
        payload["pages"][0]["page_number_evidence_refs"] = [crop_id]
        _write_json(bundle[key], payload)

    report = _run(bundle)

    assert report["status"] == "PASS"
    assert report["safeguards"]["reader_independence_cryptographically_verified"] is False


def test_evidence_and_page_render_must_bind_to_exact_pdf_print_and_offset(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_b = json.loads(bundle["pass_b"].read_text(encoding="utf-8"))
    pass_b["evidence_ledger"]["EV-TEXT-B-P5"]["book_page"] = 2
    pass_b["pages"][0]["page_image_sha256"] = "0" * 64
    _write_json(bundle["pass_b"], pass_b)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "EVIDENCE_BOOK_PAGE_MISMATCH" in _codes(report)
    assert "READER_PAGE_IMAGE_NOT_BOUND_TO_PDF" in _codes(report)


def test_manifest_and_pdf_hash_mismatch_fail_closed(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    with bundle["pdf"].open("ab") as stream:
        stream.write(b"changed source bytes")

    report = _run(bundle)

    assert report["status"] == "FAIL"
    assert report["reason_code"] == "PDF_SOURCE_SHA_MISMATCH"


def test_same_model_or_different_profile_cannot_count_as_independent_passes(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_b = json.loads(bundle["pass_b"].read_text(encoding="utf-8"))
    pass_b["model_id"] = "model-A"
    _write_json(bundle["pass_b"], pass_b)

    report = _run(bundle)
    assert report["status"] == "BLOCKED"
    assert "MODEL_IDS_NOT_DISTINCT" in _codes(report)

    # Restore a distinct model and break taxonomy/profile binding.
    pass_b["model_id"] = "model-B"
    pass_b["taxonomy_version"] = "wrong-taxonomy"
    _write_json(bundle["pass_b"], pass_b)
    report = _run(bundle)
    assert report["status"] == "BLOCKED"
    assert "READER_SCOPE_PROFILE_MISMATCH" in _codes(report)


def test_profile_sha_change_after_reader_passes_blocks(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    changed_profile = json.loads(bundle["profile"].read_text(encoding="utf-8"))
    changed_profile["allowed_supporting_concepts"].append("new-supporting-id")
    _write_json(bundle["profile"], changed_profile)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "READER_PROFILE_SHA_MISMATCH" in _codes(report)


def test_profile_must_declare_primary_operations_and_number_domains(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    changed_profile = json.loads(bundle["profile"].read_text(encoding="utf-8"))
    changed_profile["allowed_primary_operations"] = []
    _write_json(bundle["profile"], changed_profile)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "PROFILE_REQUIRED_SCOPE_LIST_EMPTY" in _codes(report)


def test_reader_packets_inside_git_are_rejected(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    copied_pass = bundle["repo"] / "pass-a.json"
    copied_pass.write_bytes(bundle["pass_a"].read_bytes())

    report = audit_concept_scope(
        pdf_path=bundle["pdf"],
        manifest_path=bundle["manifest"],
        profile_path=bundle["profile"],
        pass_a_path=copied_pass,
        pass_b_path=bundle["pass_b"],
        repo_root=bundle["repo"],
    )

    assert report["status"] == "FAIL"
    assert report["reason_code"] == "READER_PASSES_MUST_REMAIN_OUTSIDE_GIT"


def test_unobservable_visual_scan_never_passes(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_b = json.loads(bundle["pass_b"].read_text(encoding="utf-8"))
    pass_b["pages"][0]["visual_scan_status"] = "UNOBSERVABLE"
    _write_json(bundle["pass_b"], pass_b)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert "READER_VISUAL_SCAN_INCOMPLETE" in _codes(report)


def test_raw_text_or_image_payload_is_blocked_without_echoing_content(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_b = json.loads(bundle["pass_b"].read_text(encoding="utf-8"))
    pass_b["pages"][0]["concepts"][0]["raw_reading"] = "synthetic private quotation"
    _write_json(bundle["pass_b"], pass_b)

    report = _run(bundle)
    serialized = json.dumps(report, ensure_ascii=False)

    assert report["status"] == "BLOCKED"
    assert report["reason_code"] == "RAW_TEXT_OR_IMAGE_FIELD_FORBIDDEN"
    assert "synthetic private quotation" not in serialized


def test_long_free_text_in_unknown_field_is_blocked_without_echoing(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    pass_b = json.loads(bundle["pass_b"].read_text(encoding="utf-8"))
    long_text = "one two three four five six seven eight nine ten eleven"
    pass_b["reviewer_comment"] = long_text
    _write_json(bundle["pass_b"], pass_b)

    report = _run(bundle)

    assert report["status"] == "BLOCKED"
    assert report["reason_code"] == "RAW_TEXT_OR_IMAGE_FIELD_FORBIDDEN"
    assert long_text not in json.dumps(report, ensure_ascii=False)


def test_pdf_inside_repository_is_rejected(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    report = audit_concept_scope(
        pdf_path=bundle["pdf"],
        manifest_path=bundle["manifest"],
        profile_path=bundle["profile"],
        pass_a_path=bundle["pass_a"],
        pass_b_path=bundle["pass_b"],
        repo_root=bundle["vault"].parent,
    )

    assert report["status"] == "FAIL"
    assert report["reason_code"] == "PDF_MUST_REMAIN_OUTSIDE_GIT"


def test_cli_dispatch_emits_scope_only_json(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    bundle = _bundle(tmp_path)
    rc = cli_main([
        "concept-scope-audit",
        "--repo-root", str(bundle["repo"]),
        "--pdf", str(bundle["pdf"]),
        "--book-manifest", str(bundle["manifest"]),
        "--scope-profile", str(bundle["profile"]),
        "--pass-a", str(bundle["pass_a"]),
        "--pass-b", str(bundle["pass_b"]),
    ])
    report = json.loads(capsys.readouterr().out)

    assert rc == 0 and report["status"] == "PASS"
    assert report["safeguards"]["color_change_authorized"] is False
    assert report["safeguards"]["release_authorized"] is False
