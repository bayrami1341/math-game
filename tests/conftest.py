"""Centralized path & environment fixtures for `v10.3-beta` (`public/math-game/authoring/`) and CI.

Sync baseline: `origin/v10.3-beta` commit `f36533b9d7dc3de320a532cb271e029affc7694d`.
- Official merged cartridges resolve from `public/math-game/authoring/` first.
- Portable non-confidential test & audit fixtures resolve from `authoring/agent/fixtures/`.
- Confidential textbook PDFs (`C205.pdf`, `C305.pdf`) NEVER enter Git (§9) and trigger an explicit `pytest.skip(reason=...)` when absent in clean CI.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict

import pytest

from authoring.agent.paths import (
    resolve_confidential_pdf,
    resolve_fixture,
    resolve_official_cartridge,
)

REPO_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def fixture_paths(repo_root: Path) -> Dict[str, Path]:
    return {
        "book_manifest_c205": resolve_fixture(repo_root, "book_manifest_C205.json", "authoring/data/book_manifest_C205.json"),
        "id_registry": resolve_fixture(repo_root, "id_registry.json", "authoring/data/id_registry.json"),
        "chunk_plan_c205": resolve_fixture(repo_root, "chunk_plan_C205.json", "authoring/audit/chunk_plan_C205.json"),
        "decisions_c205": resolve_fixture(repo_root, "decisions_C205.json", "authoring/audit/decisions_C205.json"),
        "issue_queue_c205": resolve_fixture(repo_root, "issue_queue_C205.json", "authoring/audit/issue_queue_C205.json"),
        "observation_c205": resolve_fixture(repo_root, "observation_C205.json", "authoring/audit/observation_C205.json"),
        "snapshot_c205": resolve_fixture(repo_root, "snapshot_C205.json", "authoring/snapshots/master-map-C205-v2.0/snapshot.json"),
        "pagemap_g2_verified": resolve_fixture(repo_root, "PAGE-MAP-KH-G2-MATH-v1_verified.xlsx", "authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx"),
        "v04_raw_buggy": resolve_fixture(repo_root, "khshab-G2-MATH_v0.4_raw_buggy.xlsx", "authoring/khshab-G2-MATH_v0.4.xlsx"),
        "v05_candidate": resolve_fixture(repo_root, "khshab-G2-MATH_v0.5.xlsx", "authoring/khshab-G2-MATH_v0.5.xlsx"),
        "v031_official": resolve_official_cartridge(
            repo_root,
            "khshab-G2-MATH_v0.3.1.xlsx",
            fallback_authoring_name="khshab-G2-MATH_v0.3.1_official.xlsx",
        ),
        "v04_official": resolve_official_cartridge(
            repo_root,
            "khshab-G2-MATH_v0.4.xlsx",
            fallback_authoring_name="khshab-G2-MATH_v0.4_official.xlsx",
        ),
        "g3_v07_official": resolve_official_cartridge(
            repo_root,
            "khshab-G3-MATH_v0.7.xlsx",
        ),
    }


@pytest.fixture
def c205_pdf_path(repo_root: Path) -> Path:
    pdf = resolve_confidential_pdf(repo_root, "C205")
    if pdf is None:
        pytest.skip(
            reason="فایل محرمانهٔ C205.pdf در این محیط نصب نیست (طبق قانون حق نشر §9 در گیت ذخیره نمی‌شود؛ در اجرای محلی از upload/C205.pdf یا KHSHAB_C205_PDF خوانده می‌شود)."
        )
    return pdf


@pytest.fixture
def c305_pdf_path(repo_root: Path) -> Path:
    pdf = resolve_confidential_pdf(repo_root, "C305")
    if pdf is None:
        pytest.skip(
            reason="فایل محرمانهٔ C305.pdf در این محیط نصب نیست (طبق قانون حق نشر §9 در گیت ذخیره نمی‌شود؛ در اجرای محلی از upload/C305.pdf یا KHSHAB_C305_PDF خوانده می‌شود)."
        )
    return pdf


@pytest.fixture
def require_converter_ssot(repo_root: Path) -> Path:
    conv = repo_root / "tools/cartridge-converter/convert.mjs"
    schema = repo_root / "public/math-game/src/v10/station/cartridge-schema.js"
    errors = repo_root / "public/math-game/src/v10/station/errors.js"
    if not (conv.exists() and schema.exists() and errors.exists()):
        pytest.skip(
            reason="مبدل رسمی SSOT (tools/cartridge-converter/convert.mjs) در شاخهٔ محتوایی آرنا حضور ندارد و فقط در شاخهٔ رسمی v10.3-beta اجرا می‌شود."
        )
    return conv
