"""test_official_g2_smoke.py — دودتست گیت‌های گیت‌ساز روی سر رسمی G2 (BP-001 T3).

هر تست فقط به سرهای رسمی داخل خودِ مخزن و tmp_path وابسته است؛ بدون هیچ مسیر
محیطی بیرونی. هدف: پس از هر تغییر ایجنت، رفتار گیت‌های کلیدی روی خشاب رسمی
ثابت بماند (کاهندهٔ ریسک رگرسیون در ادغام‌های آینده).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # authoring/

from agent.automation_suite import verify_bidirectional_anchors, verify_cpa_and_answer_balance  # noqa: E402
from agent.wave_registry import wave_segment_params  # noqa: E402


@pytest.fixture(scope="module")
def g2_official(official_head_file):
    return official_head_file("KH-G2-MATH")


def test_g2_anchors_gate_pass(g2_official):
    g = verify_bidirectional_anchors(g2_official)
    assert g.status == "PASS", f"گیت لنگر دوسویه روی سر رسمی G2 مردود شد: {g.issues[:3]}"


def test_g2_cpa_balance_generic_default_passes(g2_official):
    """با پیش‌فرض جدید (بدون تفکیک موج) گیت CPA/توازن روی سر رسمی باید سبز بماند."""
    g = verify_cpa_and_answer_balance(g2_official)
    assert g.status == "PASS", f"گیت CPA عام مردود شد: {g.issues[:3]}"


def test_g2_cpa_balance_with_wave4_profile_wave_distribution(g2_official):
    """با پروفایل موج ۴ (از مانیفست)، توزیع کلید موج باید ۶/۶/۶/۶ (۲۴ سؤال) باشد."""
    seg = wave_segment_params("KH-G2-MATH", "v0.5")
    g = verify_cpa_and_answer_balance(
        g2_official,
        new_wave_start_qid=seg["new_wave_start_qid"],
        new_wave_chapter=seg["new_wave_chapter"],
    )
    assert g.status == "PASS", f"گیت CPA با پروفایل موج ۴ مردود شد: {g.issues[:3]}"
    wave_dist = g.metrics.get("wave_answer_distribution", {})
    assert sum(wave_dist.values()) == 24, f"شمار موج = {sum(wave_dist.values())} ≠ 24"
    assert max(wave_dist.values()) - min(wave_dist.values()) <= 2, f"توازن ۶/۶/۶/۶ نقض شد: {wave_dist}"
