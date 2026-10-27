"""test_wave_registry.py — گیت رزالور پروفایل موج‌ها (BP-001 T1/T2).

تضمین می‌کند: (۱) پروفایل موج ۴ G2 از مانیفست می‌آید نه از کد؛ (۲) خانوادهٔ
ناشناخته هرگز پروفایل حدسی نمی‌گیرد (None = بدون تفکیک موج)؛ (۳) توابع گیت با
پیش‌فرض جدید (بدون هاردکد) درست کار می‌کنند.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # authoring/

from agent.wave_registry import load_wave_registry, resolve_wave_profile, wave_segment_params  # noqa: E402


def test_registry_schema(repo_root):
    reg = load_wave_registry(repo_root)
    assert reg["schema"] == "khshab.wave-registry/v1"
    assert isinstance(reg["waves"], dict) and reg["waves"], "فهرست موج‌ها خالی نیست"


def test_g2_wave4_profile_resolved_from_manifest(repo_root):
    prof = resolve_wave_profile("KH-G2-MATH", "v0.5", repo_root)
    assert prof is not None, "پروفایل موج ۴ G2 باید در مانیفست ثبت شده باشد"
    assert prof["start_qid"] == "Q-1069"
    assert prof["chapter"] == "۴"
    assert prof["question_count"] == 24


def test_unknown_family_yields_no_profile(repo_root):
    assert resolve_wave_profile("KH-G9-MATH", "v9.9", repo_root) is None
    seg = wave_segment_params("KH-G9-MATH", "v9.9", repo_root)
    assert seg == {"new_wave_start_qid": None, "new_wave_chapter": None}


def test_segment_params_for_g2(repo_root):
    seg = wave_segment_params("KH-G2-MATH", "v0.5", repo_root)
    assert seg["new_wave_start_qid"] == "Q-1069"
    assert seg["new_wave_chapter"] == "۴"


def test_gate_functions_have_no_hardcoded_default():
    """امضای گیت‌ها نباید پیش‌فرض QID/فصل خانواده‌محور داشته باشد (بازرسی سورس)."""
    import inspect

    from agent.automation_suite import verify_cpa_and_answer_balance
    from agent.validators import inspect_cartridge_workbook

    for fn in (inspect_cartridge_workbook, verify_cpa_and_answer_balance):
        for name, param in inspect.signature(fn).parameters.items():
            if name.startswith("new_wave_"):
                assert param.default is None, (
                    f"{fn.__name__}.{name} پیش‌فرض None ندارد — هاردکد برگشته است"
                )
