"""domain_matrix.py — لایهٔ دامنهٔ D1..D8 خط تولید خشاب (BP-015 T4).

منبع حقیقت: public/math-game/authoring/DOMAIN-MATRIX.json — ترجمهٔ ماشینی
سند قانون «تعریف آمادگی پایهٔ درسی» (DRAFT تا مُهر گام صفر معلم).

وظایف این ماژول («در همان گذر» مبدل رسمی):
  1) بارگذاری و راستی‌آزمایی ساختار ماتریس
  2) اعتبارسنجی فیلدهای دامنه‌دار سؤال (domainCode / qType)
  3) شمارش پوشش ماتریس (دامنه × حداقل) + حکم گیت

هم‌راستا با scripts/coverage-report.ts — همان قواعد شمارش:
  - سؤال با domainCode معتبر → همان دامنه؛ بدون آن → «میراثی» (بیرون از پوشش)
  - «تأییدشده» فقط با status دقیق فارسی (هم‌نام با cartridge-schema.js)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_MATRIX_PATH = (
    Path(__file__).resolve().parents[2]
    / "public" / "math-game" / "authoring" / "DOMAIN-MATRIX.json"
)

STATUS_CONFIRMED = "تأییدشده"  # هم‌نام با STATUS_CONFIRMED در cartridge-schema.js


def load_matrix(path: Optional[Path] = None) -> Dict[str, Any]:
    """بارگذاری ماتریس دامنه + راستی‌آزمایی ساختار حداقلی."""
    p = Path(path) if path else DEFAULT_MATRIX_PATH
    m = json.loads(p.read_text(encoding="utf-8"))
    if m.get("schema") != "khshab.domain-matrix/v1":
        raise ValueError(f"schema ماتریس ناشناخته: {m.get('schema')!r}")
    for fam, spec in m.get("families", {}).items():
        if "minTotal" not in spec or "domains" not in spec:
            raise ValueError(f"خانوادهٔ {fam} فاقد minTotal/domains است")
        for code, d in spec["domains"].items():
            if not code.startswith("D") or code[1:] not in {"1", "2", "3", "4", "5", "6", "7", "8"}:
                raise ValueError(f"کد دامنهٔ نامعتبر: {fam}/{code}")
            if "min" not in d:
                raise ValueError(f"دامنهٔ {fam}/{code} فاقد حداقل است")
    return m


def matrix_totals(matrix: Dict[str, Any]) -> Dict[str, int]:
    """جمع حداقل دامنه‌ها در برابر minTotal — ناسازگاری = خطای ماتریس."""
    out: Dict[str, int] = {}
    for fam, spec in matrix["families"].items():
        s = sum(int(d["min"]) for d in spec["domains"].values())
        out[fam] = s
        if s != int(spec["minTotal"]):
            raise ValueError(
                f"ماتریس {fam} ناسازگار: جمع دامنه‌ها {s} ≠ minTotal {spec['minTotal']}"
            )
    return out


def validate_question(q: Dict[str, Any], matrix: Dict[str, Any], family: str) -> List[str]:
    """اعتبارسنجی فیلدهای دامنه‌دار یک سؤال — فهرست ایرادها (خالی = سالم).

    سؤال بدون domainCode ایراد ندارد (سازگاری پسین با ۹۲ سؤال میراثی G2).
    """
    issues: List[str] = []
    spec = matrix["families"].get(family)
    if spec is None:
        return issues  # خانوادهٔ خارج از ماتریس فعلی (مثل G1) — بازرسی دامنه ندارد
    code = q.get("domainCode")
    qid = q.get("id", "<بی‌شناسه>")
    if code is None:
        return issues
    code = str(code).strip().upper()
    if code not in spec["domains"]:
        issues.append(f"{qid}: domainCode «{code}» در ماتریس {family} تعریف نشده")
        return issues
    qtype = q.get("qType")
    if qtype:
        allowed = spec["domains"][code].get("qTypes") or []
        if allowed and str(qtype) not in allowed:
            issues.append(f"{qid}: qType «{qtype}» در فهرست نوع‌های {family}/{code} نیست")
    return issues


def compute_domain_coverage(cartridge: Dict[str, Any], matrix: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """شمارش پوشش ماتریس یک کارتریج — هم‌شکل خروجی coverage-report.ts.

    برای خانوادهٔ خارج از ماتریس (مثل G1) مقدار None برمی‌گردد.
    """
    family = cartridge.get("cartridgeId")
    spec = matrix["families"].get(family)
    if spec is None:
        return None
    questions = cartridge.get("questionBank") or []
    cov: Dict[str, Any] = {
        "family": family,
        "title": spec.get("title"),
        "total": len(questions),
        "minTotal": int(spec["minTotal"]),
        "totalConfirmed": 0,
        "legacy": 0,
        "legacyConfirmed": 0,
        "domains": {},
    }
    for code, d in spec["domains"].items():
        cov["domains"][code] = {
            "title": d.get("title"),
            "min": int(d["min"]),
            "count": 0,
            "confirmed": 0,
        }
    for q in questions:
        confirmed = q.get("status") == STATUS_CONFIRMED
        if confirmed:
            cov["totalConfirmed"] += 1
        code = q.get("domainCode")
        code = str(code).strip().upper() if code else None
        if code and code in cov["domains"]:
            cov["domains"][code]["count"] += 1
            if confirmed:
                cov["domains"][code]["confirmed"] += 1
        else:
            cov["legacy"] += 1
            if confirmed:
                cov["legacyConfirmed"] += 1
    cov["domainsPass"] = all(d["count"] >= d["min"] for d in cov["domains"].values())
    cov["totalPass"] = cov["total"] >= cov["minTotal"]
    cov["pass"] = bool(cov["domainsPass"] and cov["totalPass"])
    return cov


def coverage_gate(cov: Dict[str, Any]) -> List[str]:
    """فهرست خانه‌های زیر حداقل — خالی = گیت سبز."""
    fails: List[str] = []
    fam = cov.get("family", "?")
    for code, d in cov.get("domains", {}).items():
        if d["count"] < d["min"]:
            fails.append(f"{fam}/{code}: {d['count']}/{d['min']}")
    if cov.get("total", 0) < cov.get("minTotal", 0):
        fails.append(f"{fam}/کل: {cov['total']}/{cov['minTotal']}")
    return fails
