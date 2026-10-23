"""Prepare actual C205 chapter-one page pixels outside Git after pinned byte gate.

This is *rendering*, NOT AI observation, independent comparison, or teacher seal.
Usage: python authoring/tools/prepare_g2_ch1_visual_pass.py --pdf /secure/vault/C205.pdf --out-dir /secure/vault/ch1-pass-A
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from verify_c205_source import ROOT, verify, _inside, sha256_file

# Book pages 1..18; PDF pages 7..24 are only a candidate +6 offset.
BOOK_PAGES = range(1, 19)
DPI = 150


def render_candidate_pages(pdf: Path, output: Path, gate: dict) -> dict:
    """Render only after a successful byte gate. Never infer printed-page offset."""
    if gate.get("status") != "PASS_SOURCE_BYTES_ONLY" or gate.get("pdf_pages") != 152:
        raise ValueError("SOURCE_BYTES_NOT_ACCEPTED")
    if _inside(ROOT.resolve(), output.resolve()) or _inside(ROOT.resolve(), pdf.resolve()):
        raise ValueError("SOURCE_OR_RENDER_INSIDE_REPOSITORY")
    if sha256_file(pdf) != gate.get("actual_pdf_sha256"):
        raise ValueError("SOURCE_CHANGED_AFTER_GATE")
    import pymupdf
    output.mkdir(parents=True, exist_ok=True)
    entries = []
    with pymupdf.open(str(pdf)) as doc:
        if len(doc) != 152 or doc.needs_pass:
            raise ValueError("PDF_CHANGED_AFTER_GATE")
        for book_page in BOOK_PAGES:
            pdf_page = book_page + 6
            page = doc[pdf_page - 1]
            pix = page.get_pixmap(matrix=pymupdf.Matrix(DPI / 72, DPI / 72), alpha=False)
            data = pix.tobytes("png")
            path = output / f"pdf-{pdf_page:03d}-candidate-book-{book_page:02d}.png"
            path.write_bytes(data)
            entries.append({"book_page_candidate": book_page, "pdf_page_candidate_1based": pdf_page,
                            "printed_page_observed": None, "offset_verified": False,
                            "pixel_image_sha256": hashlib.sha256(data).hexdigest(),
                            "pixel_width": pix.width, "pixel_height": pix.height,
                            "render_filename_private": path.name,
                            "visual_observation_status": "RENDERED_NOT_YET_INTERPRETED"})
    return {"schema": "G2_CH1_PRIVATE_RENDER_MANIFEST_v1", "status": "PRIVATE_RENDER_READY_NOT_SCANNED",
            "source_sha256": gate["actual_pdf_sha256"], "source_pages": gate["pdf_pages"],
            "dpi": DPI, "candidate_offset_not_verified": True,
            "images_count": len(entries), "images": entries,
            "book_claims_verified": 0, "teacher_approvals": 0}


def prepare(pdf: Path, output: Path) -> dict:
    if _inside(ROOT.resolve(), pdf.resolve()) or _inside(ROOT.resolve(), output.resolve()):
        return {"schema": "G2_CH1_PRIVATE_RENDER_MANIFEST_v1", "status": "BLOCKED",
                "reason_code": "SOURCE_OR_RENDER_INSIDE_REPOSITORY", "images_count": 0}
    gate = verify(pdf)  # CLI path cannot override pinned C205 bytes/size/152 pages.
    if gate["status"] != "PASS_SOURCE_BYTES_ONLY":
        return {"schema": "G2_CH1_PRIVATE_RENDER_MANIFEST_v1", "status": "BLOCKED",
                "reason_code": gate["reason_code"], "images_count": 0,
                "offset_verified": False, "visual_observation_status": "NOT_PERFORMED"}
    return render_candidate_pages(pdf, output, gate)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--pdf", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, required=True)
    args = p.parse_args()
    try:
        result = prepare(args.pdf, args.out_dir)
        if result["status"] == "PRIVATE_RENDER_READY_NOT_SCANNED":
            (args.out_dir / "manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, RuntimeError, ValueError) as exc:
        print("BLOCKED_CH1_RENDER: " + type(exc).__name__, file=sys.stderr)
        return 2
    print(json.dumps({k: result[k] for k in ("status", "images_count")}, ensure_ascii=False))
    if result["status"] == "BLOCKED":
        print(result["reason_code"], file=sys.stderr)
    return 0 if result["status"] == "PRIVATE_RENDER_READY_NOT_SCANNED" else 1


if __name__ == "__main__":
    sys.exit(main())
