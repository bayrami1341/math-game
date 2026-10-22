"""wave_registry.py — رزالور پروفایل موج‌های محتوایی (BP-001 / Task 60-bis T2).

قبلاً QID شروع موج و شمارهٔ فصلِ موج چهارمِ G2 به‌صورت هاردکد در پیش‌فرض توابع
گیت (`inspect_cartridge_workbook`, `verify_cpa_and_answer_balance`) نشسته بودند
که یک باگ دامنه بود: هر خانوادهٔ غیر از G2 هم با پروفایل موج ۴ G2 ارزیابی
می‌شد. اکنون گیت‌ها پیش‌فرض «بدون تفکیک موج» دارند و پروفایل هر خانواده/نسخه
فقط از مانیفست رسمی `wave_registry.json` خوانده می‌شود.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional

_REGISTRY_PATH = Path(__file__).resolve().parent / "wave_registry.json"
_SCHEMA = "khshab.wave-registry/v1"


def load_wave_registry(repo_root: Optional[str | Path] = None) -> Dict[str, Any]:
    """بارگذاری مانیفست موج‌ها؛ اگر مسیر مخزن داده شود از آن‌جا هم جست‌وجو می‌شود."""
    candidates = [_REGISTRY_PATH]
    if repo_root:
        candidates.insert(0, Path(repo_root) / "authoring/agent/wave_registry.json")
    for p in candidates:
        if p.exists():
            data = json.loads(p.read_text(encoding="utf-8"))
            if data.get("schema") != _SCHEMA:
                raise ValueError(f"اسکیمای مانیفست موج ناشناخته است: {data.get('schema')} در {p}")
            return data
    raise FileNotFoundError("مانیفست wave_registry.json یافت نشد")


def resolve_wave_profile(
    family: str,
    version: str,
    repo_root: Optional[str | Path] = None,
) -> Optional[Dict[str, Any]]:
    """پروفایل موج «خانواده@نسخه» را از مانیفست برمی‌گرداند؛ ناشناخته = None (هرگز حدس نمی‌زنیم).

    None یعنی گیت‌های نسل‌شمار بدون تفکیک موج کل بانک را می‌سنجند — رفتار امن
    و عام برای هر خانواده؛ تفکیک موج فقط با پروفایل ثبت‌شده فعال می‌شود.
    """
    reg = load_wave_registry(repo_root)
    return reg.get("waves", {}).get(f"{family}@{version}")


def wave_segment_params(
    family: str,
    version: str,
    repo_root: Optional[str | Path] = None,
) -> Dict[str, Optional[str]]:
    """خروجی آماده برای پاس‌دادن به گیت‌ها: {"new_wave_start_qid": ..., "new_wave_chapter": ...}.

    برای خانواده/نسخهٔ ثبت‌نشده هر دو مقدار None است (بدون تفکیک موج).
    """
    prof = resolve_wave_profile(family, version, repo_root)
    if not prof:
        return {"new_wave_start_qid": None, "new_wave_chapter": None}
    return {
        "new_wave_start_qid": prof.get("start_qid"),
        "new_wave_chapter": prof.get("chapter"),
    }
