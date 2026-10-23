"""test_domain_matrix.py — تست لایهٔ دامنه D1..D8 (BP-015 T4).

اصول ایزولاسیون conftest رعایت می‌شود: فقط فایل‌های داخل مخزن + tmp_path.
سؤال‌های مصنوعی در tmp_path ساخته می‌شوند؛ کارتریج‌های رسمی فقط خواندنی‌اند.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # authoring/

from agent.domain_matrix import (  # noqa: E402
    compute_domain_coverage,
    coverage_gate,
    load_matrix,
    matrix_totals,
    validate_question,
)


@pytest.fixture(scope="module")
def matrix():
    return load_matrix()


@pytest.fixture(scope="module")
def g2_cartridge(repo_root):
    p = repo_root / "public/math-game/cartridges/KH-G2-MATH.json"
    if not p.exists():
        pytest.skip("کارتریج رسمی G2 در مخزن نیست")
    return json.loads(p.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def g3_cartridge(repo_root):
    p = repo_root / "public/math-game/cartridges/KH-G3-MATH.json"
    if not p.exists():
        pytest.skip("کارتریج رسمی G3 در مخزن نیست")
    return json.loads(p.read_text(encoding="utf-8"))


# ── ۱) ماتریس قانون — هم‌خوانی شمارشی ────────────────────────────────────────

def test_matrix_totals_match_decree(matrix):
    totals = matrix_totals(matrix)  # ناسازگاری → ValueError
    assert totals["KH-G3-MATH"] == 452, "جمع حداقل دامنه‌های G3 باید ۴۵۲ باشد (قانون Task 23)"
    assert totals["KH-G2-MATH"] == 242, "جمع حداقل دامنه‌های G2 باید ۲۴۲ باشد (قانون Task 23)"


def test_matrix_has_expected_domain_counts(matrix):
    assert set(matrix["families"]["KH-G3-MATH"]["domains"]) == {f"D{i}" for i in range(1, 9)}
    assert set(matrix["families"]["KH-G2-MATH"]["domains"]) == {f"D{i}" for i in range(1, 7)}
    assert matrix["status"].startswith("DRAFT"), "تا مُهر گام صفر معلم، ماتریس باید DRAFT بماند"


# ── ۲) موجودی واقعی — سؤال‌های میراثی بیرون از پوشش ─────────────────────────

def test_official_g2_is_all_legacy_and_gate_red(matrix, g2_cartridge):
    cov = compute_domain_coverage(g2_cartridge, matrix)
    assert cov is not None
    assert cov["total"] == 92
    assert cov["legacy"] == 92, "هر ۹۲ سؤال فعلی G2 بدون domainCode است (میراثی)"
    assert cov["pass"] is False
    fails = coverage_gate(cov)
    assert any(f.startswith("KH-G2-MATH/D") for f in fails)
    assert "KH-G2-MATH/کل: 92/242" in fails


def test_official_g3_after_first_robot_batch_d4(matrix, g3_cartridge):
    """واقعیت پس از بچ اول ربات (BP-019/BP-020): ۲۰ میراثی + ۱۰۰ سؤال دامنه‌دار D4.
    گیت همچنان قرمز است — صفر تأییدشدهٔ دامنه‌ای (مُهر فقط با دست معلم) و سایر دامنه‌ها صفر."""
    cov = compute_domain_coverage(g3_cartridge, matrix)
    assert cov is not None
    assert cov["total"] == 120, "۲۰ میراثی + ۱۰۰ بچ D4-G3-batch01 (seed 1404)"
    assert cov["legacy"] == 20
    assert cov["totalConfirmed"] == 13, "۱۳ سؤال تأییدشدهٔ میراثی G3 نباید گم شود"
    assert cov["pass"] is False, "گیت قرمز می‌ماند: ۱۰۰ موجود ≠ تأییدشده؛ سایر دامنه‌ها صفر؛ ۱۲۰ ≠ ۴۵۲"
    fails = coverage_gate(cov)
    assert any(f.startswith("KH-G3-MATH") for f in fails)


# ── ۳) سؤال دامنه‌دار — شمارش و گیت ─────────────────────────────────────────

def _cartridge_with_domain(family: str, n: int, code: str = "D4") -> dict:
    return {
        "cartridgeId": family,
        "questionBank": [
            {"id": f"Q-T{i:03d}", "domainCode": code, "qType": None,
             "status": "تأییدشده" if i % 2 == 0 else "نیاز به تأیید"}
            for i in range(n)
        ],
    }


def test_domain_questions_count_into_domain(matrix):
    c = _cartridge_with_domain("KH-G3-MATH", 100, "D4")
    cov = compute_domain_coverage(c, matrix)
    assert cov["domains"]["D4"]["count"] == 100
    assert cov["domains"]["D4"]["confirmed"] == 50
    assert cov["legacy"] == 0
    assert cov["domainsPass"] is False, "بقیهٔ دامنه‌ها صفرند — گیت هنوز قرمز"


def test_full_matrix_cartridge_passes_gate(matrix):
    fam = "KH-G2-MATH"
    spec = matrix["families"][fam]
    questions = []
    i = 0
    for code, d in spec["domains"].items():
        for _ in range(int(d["min"])):
            questions.append({"id": f"Q-F{i:03d}", "domainCode": code, "status": "تأییدشده"})
            i += 1
    c = {"cartridgeId": fam, "questionBank": questions}
    cov = compute_domain_coverage(c, matrix)
    assert cov["pass"] is True, "کارتریج کامل ماتریس باید گیت پوشش را سبز کند"
    assert coverage_gate(cov) == []


# ── ۴) اعتبارسنجی فیلدها ────────────────────────────────────────────────────

def test_unknown_domain_code_is_issue(matrix):
    q = {"id": "Q-X1", "domainCode": "D9"}
    issues = validate_question(q, matrix, "KH-G3-MATH")
    assert issues and "D9" in issues[0]


def test_unknown_qtype_is_issue(matrix):
    q = {"id": "Q-X2", "domainCode": "D5", "qType": "نوعِ ناموجود"}
    issues = validate_question(q, matrix, "KH-G3-MATH")
    assert issues and "qType" in issues[0]


def test_legacy_question_without_domain_has_no_issue(matrix):
    q = {"id": "Q-1001", "prompt": "..."}
    assert validate_question(q, matrix, "KH-G2-MATH") == []


def test_family_outside_matrix_is_silent(matrix):
    assert validate_question({"id": "Q-1", "domainCode": "D4"}, matrix, "KH-G1-MATH") == []
