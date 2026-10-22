"""conftest.py — فیکسچرهای ایزولهٔ pytest خط تولید خشاب (BP-001 T1).

اصول ایزولاسیون (درس حادثهٔ بازرسی Task 60):
  1. هیچ تستی به فضای کاری شاخه‌های arena/** یا مسیرهای /tmp محیط آرنا
     (مثل /tmp/v103_ref یا /tmp/c205_secure_vault) وابسته نیست.
  2. ریشهٔ مخزن فقط از موقعیت خود فایل تست محاسبه می‌شود و با متغیر محیطی
     KHSHAB_REPO_ROOT قابل override است (برای worktreeها).
  3. هر خروجی موقت در tmp_path خود pytest ساخته می‌شود و پس از تست پاک می‌شود.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

REPO_ROOT = Path(
    os.environ.get("KHSHAB_REPO_ROOT", str(Path(__file__).resolve().parents[2]))
).resolve()

OFFICIAL_DIR = REPO_ROOT / "public/math-game/authoring"
OFFICIAL_HEADS = OFFICIAL_DIR / "OFFICIAL-HEADS.json"


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def official_heads() -> dict:
    """مانیفست OFFICIAL-HEADS — بدون آن هیچ تست وابسته به سرهای رسمی اجرا نمی‌شود (skip شفاف)."""
    if not OFFICIAL_HEADS.exists():
        pytest.skip(f"OFFICIAL-HEADS.json در {OFFICIAL_DIR} نیست — محیط کامل مخزن نیست")
    return json.loads(OFFICIAL_HEADS.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def official_head_file(official_heads):
    """آدرس‌دهی امن فایل هر سر رسمی با کلید خانواده."""
    def _get(family: str) -> Path:
        info = official_heads["heads"][family]
        p = REPO_ROOT / info["file"]
        assert p.exists(), f"سر رسمی {family} در {p} یافت نشد"
        return p
    return _get
