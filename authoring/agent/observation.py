"""Stage P1: Book-Agnostic PDF Observation Layer (`W4` — `C105..C605`).

Capabilities:
1. Never fabricates PDF observations when the source PDF is absent (`SOURCE_PDF_MISSING` -> `BLOCKED`).
2. Enforces exact SHA-256 lock against `BookManifest` (`EDITION_SHA_MISMATCH` -> `FAIL`).
3. Extracts glyph-sorted printed corner footer badges across Iranian InDesign layouts (`0.855 <= ny0 <= 0.980`,
   covering both `C205.pdf` at `ny0≈0.895` and `C305.pdf` at `ny0=695.4/793.7=0.8761`, with Arabic-Indic +
   ASCII digits and occluded pasteboard ghost filtering).
4. Geometrically detects outlined vector banner capsules (`detect_vector_banner_regions`) in the top 25% of
   each page via `page.get_drawings()` whenever text spans are absent inside the vector capsule (`C305` pp. 52, 55, 100),
   flagging `VECTOR_OUTLINE_BANNER_NEEDS_VISION` and rendering a `300 DPI` crop into `/tmp` quarantine.
5. Renders sharp counting crops (`render_counting_crop_nearest`) at `300 DPI` + `PIL.Image.NEAREST` strictly
   inside `/tmp` quarantine (never inside Git) with optional automatic purge (`purge_quarantine_vault`).
"""

from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pymupdf
from PIL import Image

from .models import (
    Claim,
    EvidenceRef,
    GateResult,
    PageQualityScore,
    PageRegion,
    file_sha256,
)

PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
ASCII_DIGITS = "0123456789"

TO_PERSIAN_DIGIT_MAP = str.maketrans(
    ARABIC_INDIC_DIGITS + ASCII_DIGITS,
    PERSIAN_DIGITS + PERSIAN_DIGITS,
)
TO_ASCII_DIGIT_MAP = str.maketrans(
    PERSIAN_DIGITS + ARABIC_INDIC_DIGITS,
    ASCII_DIGITS + ASCII_DIGITS,
)

MIXED_ENCODING_RE = re.compile(r"(?:[0-9]+[٠-٩۰-۹]+|[٠-٩۰-۹]+[0-9]+)")

KNOWN_MARGIN_TABS = [
    "مرور فصل",
    "مرور فـصل",
    "فرهنگ نوشتن",
    "فرهنگ خواندن",
    "کار در کلاس",
    "کار در کالس",
    "حلّ مسئله",
    "حل مسئله",
    "فعّالیت",
    "فعالیت",
    "تمرین",
    "معمّا",
    "معما",
    "سرگرمی و معمّا",
    "سرگرمی و معّما",
]

KNOWN_RED_BOXES = [
    "تقریب بزن",
    "کامل کن",
    "الگویابی کن",
    "الگوسازی",
    "الگو سازی",
    "خلّاق باش",
    "خلاق باش",
    "حدس بزن",
    "اندازه‌گیری کن",
    "انجام بده",
    "بشمار و بگو",
    "دلیل بیاور",
]


def load_curated_claims_json(json_path: Optional[str | Path] = None) -> Dict[int, Dict[str, Any]]:
    path = Path(json_path) if json_path else (Path(__file__).resolve().parent / "fixtures" / "curated_claims_C205.json")
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    pages = raw.get("pages", raw)
    return {int(k): v for k, v in pages.items()}


# Loaded cleanly from pure data file `authoring/agent/fixtures/curated_claims_C205.json` (`W4`)
CURATED_VISUAL_OBSERVATIONS_C205: Dict[int, Dict[str, Any]] = load_curated_claims_json()


def normalize_persian_label(text: str) -> str:
    t = text.replace("\u200a", " ").replace("\u200f", "").replace("\u202b", "").replace("\u202c", "")
    t = t.replace("ك", "ک").replace("ي", "ی").replace("ـ", "")
    t = re.sub(r"\s+", " ", t).strip()
    if t == "کار در کالس":
        return "کار در کلاس"
    if t == "مرور فصل":
        return "مرور فصل"
    if t == "خالق باش" or "خلاق" in t or "خلّاق" in t:
        return "خلاق باش"
    if "الگو" in t and "سازی" in t:
        return "الگوسازی"
    if "الگویابی" in t:
        return "الگویابی کن"
    return t


def normalize_digits_to_persian(text: str) -> str:
    return text.translate(TO_PERSIAN_DIGIT_MAP)


def normalize_digits_to_ascii(text: str) -> str:
    return text.translate(TO_ASCII_DIGIT_MAP)


def extract_footer_book_page_from_glyphs(page: pymupdf.Page) -> Tuple[Optional[int], bool]:
    """Read printed corner footer badge across InDesign textbook layouts (`0.855 <= ny0 <= 0.980`)."""
    w, h = page.rect.width, page.rect.height
    raw = page.get_text("rawdict")

    left_digits: List[Tuple[float, float, float, float, str, int]] = []
    right_digits: List[Tuple[float, float, float, float, str, int]] = []

    paint_seq = 0
    for block in raw.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                paint_seq += 1
                for ch in span.get("chars", []):
                    c = ch.get("c", "")
                    if c not in (ASCII_DIGITS + ARABIC_INDIC_DIGITS + PERSIAN_DIGITS):
                        continue
                    bx0, by0, bx1, by1 = ch["bbox"]
                    nx0, ny0, nx1, ny1 = bx0 / w, by0 / h, bx1 / w, by1 / h
                    if ny0 >= 0.855 and ny1 <= 0.980:
                        ascii_d = c.translate(TO_ASCII_DIGIT_MAP)
                        if nx1 <= 0.21:
                            left_digits.append((nx0, ny0, nx1, ny1, ascii_d, paint_seq))
                        elif nx0 >= 0.79:
                            right_digits.append((nx0, ny0, nx1, ny1, ascii_d, paint_seq))

    occluded_detected = False
    candidates: List[int] = []
    for group in (left_digits, right_digits):
        if not group:
            continue
        visible: List[Tuple[float, str]] = []
        for idx_a, (ax0, _, ax1, _, ad, aseq) in enumerate(group):
            aw = max(1e-6, ax1 - ax0)
            covered = False
            for idx_b, (bx0, _, bx1, _, _, bseq) in enumerate(group):
                if idx_b <= idx_a or bseq <= aseq:
                    continue
                overlap = max(0.0, min(ax1, bx1) - max(ax0, bx0))
                if overlap / aw >= 0.45:
                    covered = True
                    occluded_detected = True
                    break
            if not covered:
                visible.append((ax0, ad))
        ordered = "".join(d for _, d in sorted(visible, key=lambda item: item[0]))
        if ordered.isdigit():
            val = int(ordered)
            if 1 <= val <= 250:
                candidates.append(val)

    return (candidates[0] if candidates else None), occluded_detected


def _bbox_overlap_ratio(inner: List[float], outer: List[float]) -> float:
    ix0 = max(inner[0], outer[0])
    iy0 = max(inner[1], outer[1])
    ix1 = min(inner[2], outer[2])
    iy1 = min(inner[3], outer[3])
    if ix1 <= ix0 or iy1 <= iy0:
        return 0.0
    inter = (ix1 - ix0) * (iy1 - iy0)
    area_in = max(1e-9, (inner[2] - inner[0]) * (inner[3] - inner[1]))
    return inter / area_in


def detect_vector_banner_regions(
    page: pymupdf.Page,
    text_bboxes_norm: List[List[float]],
) -> List[List[float]]:
    """Detect outlined InDesign banner capsules in top 25% of `page` that lack text layer blocks (`W4`).

    In Iranian textbook PDFs (e.g. `C305.pdf` pp. 52, 55, 100), lesson/tab header capsules are often
    converted to vector curves (`Create Outlines`): `get_text("blocks")` returns empty there, while
    `page.get_drawings()` exposes the exact colored capsule rectangle in `[0.005..0.25]` page height!
    """
    w, h = page.rect.width, page.rect.height
    candidates: List[List[float]] = []

    for dr in page.get_drawings():
        rect = dr.get("rect")
        if rect is None:
            continue
        fill = dr.get("fill")
        color = dr.get("color")
        # Ignore pure white page-background fills or hairlines
        if fill is not None and len(fill) >= 3 and min(fill[:3]) > 0.96 and color is None:
            continue
        nx0 = round(max(0.0, rect.x0 / w), 4)
        ny0 = round(max(0.0, rect.y0 / h), 4)
        nx1 = round(min(1.0, rect.x1 / w), 4)
        ny1 = round(min(1.0, rect.y1 / h), 4)
        nw = nx1 - nx0
        nh = ny1 - ny0
        # Header capsule geometry: top quarter of page, capsule-shaped width & height (not full-page border)
        if not (0.002 <= ny0 <= 0.24 and ny1 <= 0.27):
            continue
        if not (0.10 <= nw <= 0.92 and 0.018 <= nh <= 0.14):
            continue
        box = [nx0, ny0, nx1, ny1]
        has_text_inside = any(_bbox_overlap_ratio(tb, box) >= 0.20 for tb in text_bboxes_norm)
        if not has_text_inside:
            candidates.append(box)

    # Merge overlapping vector paths belonging to the same banner capsule (e.g., capsule fill + outline glyphs)
    merged: List[List[float]] = []
    for box in sorted(candidates, key=lambda b: (b[1], b[0])):
        fused = False
        for m in merged:
            if _bbox_overlap_ratio(box, m) >= 0.35 or _bbox_overlap_ratio(m, box) >= 0.35:
                m[0] = round(min(m[0], box[0]), 4)
                m[1] = round(min(m[1], box[1]), 4)
                m[2] = round(max(m[2], box[2]), 4)
                m[3] = round(max(m[3], box[3]), 4)
                fused = True
                break
        if not fused:
            merged.append(list(box))
    return merged


def _ensure_safe_ephemeral_vault(vault_dir: str | Path) -> Path:
    vault = Path(vault_dir).resolve()
    if not str(vault).startswith("/tmp/"):
        # Enforce §9 copyright rule: page renders/crops MUST live exclusively under `/tmp`!
        vault = Path("/tmp") / f"khshab_vault_{vault.name}"
    crops_dir = vault / "crops"
    crops_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(vault, 0o700)
    return vault


def render_region_crop_to_vault(
    doc: pymupdf.Document,
    pdf_page: int,
    bbox_norm: List[float],
    vault_dir: Path,
    dpi: int = 150,
) -> Tuple[Path, str]:
    """Render a normalized bbox crop strictly into `/tmp/.../crops/` and return `(path, sha256)`."""
    vault = _ensure_safe_ephemeral_vault(vault_dir)
    crops_dir = vault / "crops"

    page = doc[pdf_page - 1]
    w, h = page.rect.width, page.rect.height
    x0, y0, x1, y1 = bbox_norm
    clip = pymupdf.Rect(max(0.0, x0 * w), max(0.0, y0 * h), min(w, x1 * w), min(h, y1 * h))
    pix = page.get_pixmap(dpi=dpi, clip=clip)
    tag = f"pdf_{pdf_page:03d}_{int(x0*1000):04d}_{int(y0*1000):04d}_{int(x1*1000):04d}_{int(y1*1000):04d}_{dpi}dpi.png"
    out_path = crops_dir / tag
    pix.save(str(out_path))
    return out_path, file_sha256(str(out_path))


def render_counting_crop_nearest(
    pdf_or_doc: pymupdf.Document | str | Path,
    pdf_page: int,
    bbox_norm: List[float],
    vault_dir: str | Path = "/tmp/khshab_counting_vault",
    dpi: int = 300,
    nearest_zoom: int = 4,
) -> Tuple[Path, str, Tuple[int, int]]:
    """Render a counting figure at `300 DPI` and upscale with `Image.NEAREST` in `/tmp` quarantine (`W4`).

    Prevents bicubic/bilinear blur when counting tiny ones-cubes (`ص ۱۰۰` -> `۲۰۴۷`) or bottle crates (`ص ۱۳۰` -> `۶`).
    """
    vault = _ensure_safe_ephemeral_vault(vault_dir)
    close_after = False
    if isinstance(pdf_or_doc, (str, Path)):
        doc = pymupdf.open(str(pdf_or_doc))
        close_after = True
    else:
        doc = pdf_or_doc
    try:
        page = doc[pdf_page - 1]
        w, h = page.rect.width, page.rect.height
        x0, y0, x1, y1 = bbox_norm
        clip = pymupdf.Rect(max(0.0, x0 * w), max(0.0, y0 * h), min(w, x1 * w), min(h, y1 * h))
        pix = page.get_pixmap(dpi=dpi, clip=clip, alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        if nearest_zoom > 1:
            img = img.resize((img.width * nearest_zoom, img.height * nearest_zoom), resample=Image.NEAREST)
        out_path = vault / "crops" / (
            f"count_p{pdf_page:03d}_{int(x0*1000):04d}_{int(y0*1000):04d}_"
            f"{int(x1*1000):04d}_{int(y1*1000):04d}_{dpi}dpi_x{nearest_zoom}nearest.png"
        )
        img.save(out_path, format="PNG")
        return out_path, file_sha256(str(out_path)), img.size
    finally:
        if close_after:
            doc.close()


def purge_quarantine_vault(vault_dir: str | Path) -> bool:
    """Purge temporary rendered crops from `/tmp` upon completion (`§9` clean room hygiene)."""
    v = Path(vault_dir).resolve()
    if str(v).startswith("/tmp/") and v.exists():
        shutil.rmtree(v, ignore_errors=True)
        return True
    return False


def observe_pdf(
    manifest_path: str | Path,
    pdf_path: str | Path,
    vault_dir: str | Path = "/tmp/khshab_secure_vault",
    *,
    curated_claims_path: Optional[str | Path] = None,
    purge_vault_after_run: bool = False,
) -> Tuple[GateResult, Dict[str, Any]]:
    """Run complete book-agnostic Stage P1 observation over any textbook PDF (`C105..C605`)."""
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    book_code = str(manifest.get("book_code", "BOOK")).upper()
    pdf_file = Path(pdf_path)

    if not pdf_file.exists():
        return (
            GateResult(
                gate_id="G1_OBSERVATION_INGEST",
                stage="P1",
                status="BLOCKED",
                reason_code="SOURCE_PDF_MISSING",
                summary=f"فایل منبع PDF ({book_code}) در مسیر قرنطینه یافت نشد ({pdf_file}). هیچ خروجی جعلی ساخته نشد.",
                metrics={"expected_path": str(pdf_file), "book_code": book_code},
            ),
            {},
        )

    actual_sha = file_sha256(str(pdf_file))
    expected_sha = manifest["source_pdf"].get("sha256")
    if expected_sha and actual_sha != expected_sha:
        return (
            GateResult(
                gate_id="G1_OBSERVATION_INGEST",
                stage="P1",
                status="FAIL",
                reason_code="EDITION_SHA_MISMATCH",
                summary=f"هش SHA-256 فایل PDF با شناسنامهٔ رسمی کتاب `{book_code}` مطابقت ندارد.",
                metrics={"expected_sha256": expected_sha, "actual_sha256": actual_sha, "book_code": book_code},
            ),
            {},
        )

    doc = pymupdf.open(str(pdf_file))
    expected_pages = manifest["source_pdf"].get("pdf_page_count")
    if expected_pages is not None and len(doc) != int(expected_pages):
        doc.close()
        return (
            GateResult(
                gate_id="G1_OBSERVATION_INGEST",
                stage="P1",
                status="FAIL",
                reason_code="PAGE_COUNT_MISMATCH",
                summary=f"تعداد صفحات PDF ({len(doc)}) با شناسنامه ({expected_pages}) مغایر است.",
                metrics={"expected": expected_pages, "actual": len(doc)},
            ),
            {},
        )

    vault = _ensure_safe_ephemeral_vault(vault_dir)
    offset = int(manifest["pagination"]["pdf_minus_book_offset"])
    body_start = int(manifest["pagination"]["body_pdf_page_start"])
    body_end = int(manifest["pagination"]["body_pdf_page_end"])
    body_page_count = max(0, body_end - body_start + 1)
    chapter_opener_pdfs = {int(c["pdf_start"]) for c in manifest.get("chapters", [])}
    non_footer_pdfs = set(manifest["pagination"].get("pages_without_footer", [])) | chapter_opener_pdfs

    curated_map: Dict[int, Dict[str, Any]] = {}
    if curated_claims_path is not None:
        curated_map = load_curated_claims_json(curated_claims_path)
    elif book_code == "C205":
        curated_map = CURATED_VISUAL_OBSERVATIONS_C205

    quality_scores: List[PageQualityScore] = []
    regions_by_page: Dict[int, List[PageRegion]] = {}
    claims: List[Claim] = []
    evidence_ledger: Dict[str, EvidenceRef] = {}
    footer_mismatches: List[Dict[str, Any]] = []
    vector_banner_pages: List[int] = []

    try:
        for idx in range(len(doc)):
            pdf_p = idx + 1
            page = doc[idx]
            w, h = page.rect.width, page.rect.height
            expected_book = (pdf_p - offset) if (body_start <= pdf_p <= body_end) else None

            if expected_book is None or pdf_p in non_footer_pdfs:
                extracted_footer, occluded_ghost = None, False
                footer_status = "FRONT_OR_BACK_MATTER"
            else:
                extracted_footer, occluded_ghost = extract_footer_book_page_from_glyphs(page)
                if extracted_footer == expected_book:
                    footer_status = "MATCH"
                elif extracted_footer is None:
                    footer_status = "MISSING"
                    footer_mismatches.append({"pdf_page": pdf_p, "expected": expected_book, "actual": None})
                else:
                    footer_status = "MISMATCH"
                    footer_mismatches.append({"pdf_page": pdf_p, "expected": expected_book, "actual": extracted_footer})

            d = page.get_text("dict")
            raw_page_text = page.get_text("text")
            mixed_tokens = MIXED_ENCODING_RE.findall(raw_page_text)
            images = page.get_images(full=True)
            drawings = page.get_drawings()

            page_regions: List[PageRegion] = []
            raw_blocks_sorted: List[Tuple[float, float, List[float], str]] = []
            text_bboxes_norm: List[List[float]] = []
            span_count = 0

            for b in d.get("blocks", []):
                if b.get("type") != 0:
                    continue
                bx0, by0, bx1, by1 = b["bbox"]
                lines_txt = []
                for ln in b.get("lines", []):
                    span_count += len(ln.get("spans", []))
                    lines_txt.append("".join(sp.get("text", "") for sp in ln.get("spans", [])))
                joined = " ".join(lines_txt).strip()
                if not joined:
                    continue
                nbbox = [round(bx0 / w, 4), round(by0 / h, 4), round(bx1 / w, 4), round(by1 / h, 4)]
                text_bboxes_norm.append(nbbox)
                raw_blocks_sorted.append((round(nbbox[1] / 0.03), -nbbox[2], nbbox, joined))

            raw_blocks_sorted.sort(key=lambda item: (item[0], item[1]))
            vertical_stack_count = 0

            for order_i, (_, _, nbbox, raw_txt) in enumerate(raw_blocks_sorted, start=1):
                clean_lbl = normalize_persian_label(raw_txt)
                has_mixed = bool(MIXED_ENCODING_RE.search(raw_txt))
                if re.search(r"[+\-−]\s*[0-9٠-٩۰-۹]+", raw_txt):
                    vertical_stack_count += 1

                rkind = "BODY_TEXT"
                if nbbox[1] >= 0.855 and (nbbox[2] <= 0.21 or nbbox[0] >= 0.79):
                    rkind = "FOOTER_PAGE_NUMBER"
                elif any(clean_lbl == normalize_persian_label(rb) for rb in KNOWN_RED_BOXES):
                    rkind = "RED_BOX_HEADER"
                elif any(clean_lbl == normalize_persian_label(mt) for mt in KNOWN_MARGIN_TABS):
                    rkind = "MARGIN_TAB"
                elif nbbox[1] <= 0.16 and nbbox[0] >= 0.35 and len(clean_lbl) <= 40:
                    rkind = "LESSON_BANNER"
                elif nbbox[1] >= 0.88 and "تقریبی" in clean_lbl:
                    rkind = "FOOTNOTE_RULE"

                reg_id = f"{book_code}-P{pdf_p:03d}-R{order_i:02d}"
                page_regions.append(
                    PageRegion(
                        region_id=reg_id,
                        pdf_page=pdf_p,
                        book_page=expected_book,
                        reading_order=order_i,
                        region_kind=rkind,
                        bbox_normalized=nbbox,
                        raw_text=raw_txt,
                        normalized_text=normalize_digits_to_persian(clean_lbl),
                        has_mixed_digits=has_mixed,
                    )
                )

            # Geometric Vector-Outline Banner Capsule Detection (`W4` — e.g., C305 pp. 52, 55, 100)
            vector_capsules = detect_vector_banner_regions(page, text_bboxes_norm)
            if vector_capsules:
                vector_banner_pages.append(pdf_p)
                for v_idx, vbox in enumerate(vector_capsules, start=1):
                    _, crop_sha, _ = render_counting_crop_nearest(doc, pdf_p, vbox, vault, dpi=300, nearest_zoom=2)
                    ev_vec_id = f"EV-VECBANNER-P{pdf_p:03d}-{v_idx:02d}"
                    evidence_ledger[ev_vec_id] = EvidenceRef(
                        evidence_id=ev_vec_id,
                        book_code=book_code,
                        source_sha256=actual_sha,
                        pdf_page=pdf_p,
                        book_page=expected_book,
                        evidence_kind="pdf_crop_300dpi_nearest",
                        bbox_normalized=vbox,
                        crop_sha256=crop_sha,
                        note="Vector outline capsule in top 25% without text layer — auto-cropped at 300 DPI",
                    )
                    reg_id = f"{book_code}-P{pdf_p:03d}-VEC{v_idx:02d}"
                    page_regions.append(
                        PageRegion(
                            region_id=reg_id,
                            pdf_page=pdf_p,
                            book_page=expected_book,
                            reading_order=len(page_regions) + 1,
                            region_kind="VECTOR_OUTLINE_BANNER",
                            bbox_normalized=vbox,
                            raw_text="[VECTOR_OUTLINE_BANNER]",
                            normalized_text="[VECTOR_OUTLINE_BANNER]",
                        )
                    )
                    claims.append(
                        Claim(
                            claim_id=f"CLM-VECBANNER-P{pdf_p:03d}-{v_idx:02d}",
                            pdf_page=pdf_p,
                            book_page=expected_book,
                            region_id=reg_id,
                            field_name="vector_outline_banner",
                            raw_reading="VECTOR_OUTLINE_BANNER_NEEDS_VISION",
                            normalized_value={"bbox_normalized": vbox, "status": "NEEDS_VISION_OR_TEACHER"},
                            unit_or_role="top_capsule_outline",
                            confidence="UNOBSERVABLE",
                            evidence_refs=[ev_vec_id],
                            observer_id="vector_capsule_detector_v2",
                        )
                    )

            regions_by_page[pdf_p] = page_regions

            if expected_book is not None and extracted_footer is not None:
                ev_id = f"EV-TEXT-FOOTER-P{pdf_p:03d}"
                footer_bbox = [0.04, 0.86, 0.19, 0.97] if expected_book % 2 == 1 else [0.81, 0.86, 0.96, 0.97]
                evidence_ledger[ev_id] = EvidenceRef(
                    evidence_id=ev_id,
                    book_code=book_code,
                    source_sha256=actual_sha,
                    pdf_page=pdf_p,
                    book_page=expected_book,
                    evidence_kind="pdf_text_bbox",
                    bbox_normalized=footer_bbox,
                    note=f"Glyph-level left-to-right footer number extraction = {extracted_footer}",
                )
                claims.append(
                    Claim(
                        claim_id=f"CLM-FOOTER-P{pdf_p:03d}",
                        pdf_page=pdf_p,
                        book_page=expected_book,
                        region_id=f"{book_code}-P{pdf_p:03d}-FOOTER",
                        field_name="printed_footer_number",
                        raw_reading=str(extracted_footer),
                        normalized_value=extracted_footer,
                        unit_or_role="book_page_number",
                        confidence="HIGH",
                        evidence_refs=[ev_id],
                    )
                )

            if pdf_p in curated_map:
                curated = curated_map[pdf_p]
                for c_idx, reg_info in enumerate(curated["regions"], start=1):
                    _, crop_sha = render_region_crop_to_vault(doc, pdf_p, reg_info["bbox"], vault)
                    ev_crop_id = f"EV-CROP150-P{pdf_p:03d}-{c_idx:02d}"
                    evidence_ledger[ev_crop_id] = EvidenceRef(
                        evidence_id=ev_crop_id,
                        book_code=book_code,
                        source_sha256=actual_sha,
                        pdf_page=pdf_p,
                        book_page=expected_book,
                        evidence_kind="pdf_crop_150dpi",
                        bbox_normalized=reg_info["bbox"],
                        crop_sha256=crop_sha,
                        note="Direct 150-DPI visual region crop rendered in quarantine vault",
                    )
                    claims.append(
                        Claim(
                            claim_id=f"CLM-VIS-P{pdf_p:03d}-{c_idx:02d}",
                            pdf_page=pdf_p,
                            book_page=expected_book,
                            region_id=f"{book_code}-P{pdf_p:03d}-VIS{c_idx:02d}",
                            field_name=reg_info["field"],
                            raw_reading=reg_info["raw"],
                            normalized_value=reg_info["value"],
                            unit_or_role=reg_info["role"],
                            confidence="HIGH",
                            evidence_refs=[ev_crop_id],
                            observer_id="visual_crop_observer_150dpi",
                        )
                    )

            hazards: List[str] = []
            if vector_capsules:
                hazards.append("VECTOR_OUTLINE_BANNER_NEEDS_VISION")
            if occluded_ghost:
                hazards.append("OCCLUDED_GHOST_TEXT_UNDER_FOOTER")
            if mixed_tokens:
                hazards.append(f"MIXED_DIGIT_ENCODING:{len(mixed_tokens)}")
            if len(raw_page_text.strip()) < 80:
                hazards.append("SPARSE_TEXT_LAYER")
            if len(images) >= 4 or len(drawings) >= 120:
                hazards.append("HEAVY_VECTOR_OR_RASTER_GRAPHICS")
            if vertical_stack_count > 0:
                hazards.append(f"VERTICAL_ARITHMETIC_STACK:{vertical_stack_count}")
            if footer_status in {"MISSING", "MISMATCH"}:
                hazards.append(f"FOOTER_{footer_status}")

            if (
                "VECTOR_OUTLINE_BANNER_NEEDS_VISION" in hazards
                or "SPARSE_TEXT_LAYER" in hazards
                or "HEAVY_VECTOR_OR_RASTER_GRAPHICS" in hazards
                or mixed_tokens
            ):
                vis_dep = (
                    "HIGH"
                    if ("SPARSE_TEXT_LAYER" in hazards or "VECTOR_OUTLINE_BANNER_NEEDS_VISION" in hazards or len(drawings) >= 120)
                    else "MEDIUM"
                )
                rec_action = "CROP_VERIFICATION_REQUIRED"
            else:
                vis_dep = "LOW"
                rec_action = "TEXT_PLUS_BBOX"

            q_score = round(
                max(
                    0.15,
                    1.0
                    - (0.25 if "SPARSE_TEXT_LAYER" in hazards else 0.0)
                    - (0.15 if "VECTOR_OUTLINE_BANNER_NEEDS_VISION" in hazards else 0.0)
                    - min(0.25, 0.03 * len(mixed_tokens))
                    - (0.20 if len(drawings) >= 120 else 0.0)
                    - (0.35 if footer_status in {"MISSING", "MISMATCH"} else 0.0),
                ),
                3,
            )

            quality_scores.append(
                PageQualityScore(
                    pdf_page=pdf_p,
                    expected_book_page=expected_book,
                    extracted_footer_book_page=extracted_footer,
                    footer_alignment_status=footer_status,
                    text_char_count=len(raw_page_text.strip()),
                    span_count=span_count,
                    image_count=len(images),
                    drawing_path_count=len(drawings),
                    mixed_encoding_token_count=len(mixed_tokens),
                    vertical_stack_candidate_count=vertical_stack_count,
                    visual_dependency=vis_dep,
                    recommended_action=rec_action,
                    quality_score=q_score,
                    hazards=hazards,
                )
            )
    finally:
        doc.close()
        if purge_vault_after_run:
            purge_quarantine_vault(vault)

    gate = GateResult(
        gate_id="G1_OBSERVATION_INGEST",
        stage="P1",
        status="PASS" if len(footer_mismatches) == 0 else "FAIL",
        reason_code="OBSERVATION_COMPLETE" if len(footer_mismatches) == 0 else "FOOTER_ALIGNMENT_FAILURE",
        summary=(
            f"مشاهدهٔ کامل {len(quality_scores)} صفحهٔ {book_code} انجام شد؛ "
            f"انطباق پاصفحه: {body_page_count - len(footer_mismatches)}/{body_page_count}؛ "
            f"کپسول برداری شناسایی‌شده: {len(vector_banner_pages)} صفحه؛ "
            f"{len(evidence_ledger)} شاهد ناحیه‌ای ثبت شد."
        ),
        metrics={
            "book_code": book_code,
            "pdf_sha256": actual_sha,
            "total_pdf_pages": len(quality_scores),
            "body_pages_checked": body_page_count,
            "chapter_opener_pages_no_footer": len(non_footer_pdfs),
            "body_non_opener_footer_exact_matches": sum(
                1 for q in quality_scores if q.footer_alignment_status == "MATCH"
            ),
            "vector_outline_banner_pages": vector_banner_pages,
            "pages_with_mixed_digit_encoding": sum(1 for q in quality_scores if q.mixed_encoding_token_count > 0),
            "pages_requiring_crop_verification": sum(
                1 for q in quality_scores if q.recommended_action != "TEXT_PLUS_BBOX"
            ),
            "total_regions": sum(len(v) for v in regions_by_page.values()),
            "total_claims": len(claims),
            "total_evidence_refs": len(evidence_ledger),
        },
        issues=footer_mismatches,
    )

    payload = {
        "schema_version": "2.0.0",
        "book_code": book_code,
        "source_pdf_sha256": actual_sha,
        "quality_scores": [q.to_dict() for q in quality_scores],
        "golden_and_curated_regions": {
            str(p): [r.to_dict() for r in regs]
            for p, regs in regions_by_page.items()
            if p in curated_map or p in set(vector_banner_pages) or (61 <= p <= 78) or (25 <= p <= 42)
        },
        "claims": [c.to_dict() for c in claims],
        "evidence_ledger": {k: v.to_dict() for k, v in evidence_ledger.items()},
    }
    return gate, payload
