"""Data-driven loader for `authoring/agent/fixtures/wave_spec_G2_ch4_v05.json` (`W1`).

All Chapter 4 (`عددهای سه رقمی`, Book pp. 55–72 / PDF pp. 61–78) S1 rows, proposed error codes,
24 self-authored yellow diagnostic questions, and `v0.4` patch proposals live as pure data in
`authoring/agent/fixtures/wave_spec_G2_ch4_v05.json` rather than hardcoded Python arrays.
Exports identical symbol names for full backward compatibility across tests and callers.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

AI_SOURCE_TAG = "پیشنهاد AI — موتور تألیف v۱.۰"
YELLOW_STATUS = "نیاز به تأیید"

_SPEC_JSON_PATH = Path(__file__).resolve().parent / "fixtures" / "wave_spec_G2_ch4_v05.json"


def load_pilot_chapter4_wave_dict() -> Dict[str, Any]:
    return json.loads(_SPEC_JSON_PATH.read_text(encoding="utf-8"))


_RAW = load_pilot_chapter4_wave_dict()

CHAPTER4_NEW_ERROR_CODES: List[Dict[str, str]] = _RAW["atlas_rows"]
CHAPTER4_S1_SPECS: List[Dict[str, str]] = [
    {k: v for k, v in row.items() if k not in ("source", "status")}
    for row in _RAW["s1_rows"]
]
CHAPTER4_PILOT_QUESTIONS: List[Dict[str, Any]] = [
    {
        "anchor": q["anchor"],
        "scope": q["scope"],
        "cpa": q["cpa"],
        "level": q["level"],
        "stem": q["stem"],
        "opts": q["opts"],
        "ans": q["ans"],
        "map": q["map"],
        "trace": q["trace"],
        "answer_int": q["answer_val"],
        "wrong_spec": [tuple(pair) for pair in q["wrong_spec"]],
        "page_ref": q["page_ref"],
    }
    for q in _RAW["question_rows"]
]
V04_PATCH_PROPOSALS: List[Dict[str, Any]] = _RAW["deferred_proposals"]
