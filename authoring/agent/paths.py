"""Canonical dual-layout path resolver (`v10.3-beta` primary SSOT + `authoring/agent/fixtures/`).

Priority order:
  1. Official `v10.3-beta` cartridge root: `public/math-game/authoring/`
  2. Portable non-confidential test & audit fixtures: `authoring/agent/fixtures/`
  3. Standalone authoring workspace fallback: `authoring/`
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional


def resolve_official_cartridge(
    repo_root: str | Path,
    filename: str,
    fallback_authoring_name: Optional[str] = None,
) -> Path:
    """Resolve an official merged `.xlsx` cartridge, preferring `public/math-game/authoring/`."""
    root = Path(repo_root)
    candidates = [root / "public/math-game/authoring" / filename]
    if fallback_authoring_name:
        candidates.append(root / "authoring" / fallback_authoring_name)
    candidates.append(root / "authoring" / filename)
    candidates.append(root / "authoring/agent/fixtures" / filename)
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]


def resolve_fixture(
    repo_root: str | Path,
    fixture_name: str,
    legacy_rel_path: Optional[str] = None,
) -> Path:
    """Resolve a non-confidential test/audit fixture from `authoring/agent/fixtures/` first."""
    root = Path(repo_root)
    candidates = [root / "authoring/agent/fixtures" / fixture_name]
    if legacy_rel_path:
        candidates.append(root / legacy_rel_path)
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]


def resolve_confidential_pdf(repo_root: str | Path, book_code: str) -> Optional[Path]:
    """Locate confidential local textbook PDF (`C205`, `C305`, ...) without tracking it in Git."""
    code = book_code.upper()
    env_val = os.environ.get(f"KHSHAB_{code}_PDF", "").strip()
    if env_val:
        p = Path(env_val)
        if p.exists():
            return p

    root = Path(repo_root)
    candidates = [
        root / "upload" / f"{code}-152.pdf",
        root / "upload" / f"{code}.pdf",
        root / "upload" / f"{code.lower()}.pdf",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None
