"""Base protocol and shared exact-arithmetic helpers for Multi-Grade Domain Solvers (`W2`)."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from fractions import Fraction
from typing import Any, Dict, List, Optional, Set, Tuple, Union

AnswerValue = Union[int, Fraction, str]

PERSIAN_TO_ASCII_MAP = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
ASCII_TO_PERSIAN_MAP = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")

FRACTION_WORDS: Dict[str, Fraction] = {
    "نصف": Fraction(1, 2),
    "یک دوم": Fraction(1, 2),
    "یک‌دوم": Fraction(1, 2),
    "ثلث": Fraction(1, 3),
    "یک سوم": Fraction(1, 3),
    "یک‌سوم": Fraction(1, 3),
    "دو سوم": Fraction(2, 3),
    "دوسوم": Fraction(2, 3),
    "ربع": Fraction(1, 4),
    "یک چهارم": Fraction(1, 4),
    "یک‌چهارم": Fraction(1, 4),
    "سه چهارم": Fraction(3, 4),
    "سه‌چهارم": Fraction(3, 4),
    "یک پنجم": Fraction(1, 5),
    "دو پنجم": Fraction(2, 5),
    "سه پنجم": Fraction(3, 5),
    "چهار پنجم": Fraction(4, 5),
    "یک ششم": Fraction(1, 6),
    "یک هشتم": Fraction(1, 8),
}


def norm_ascii(text: str) -> str:
    t = str(text or "").translate(PERSIAN_TO_ASCII_MAP)
    t = t.replace("−", "-").replace("×", "*").replace("÷", "/").replace("؍", "/")
    return t


def parse_exact_value(raw: Any) -> Optional[AnswerValue]:
    """Parse integer (`۶۰۴`), fraction (`۳/۸`), or 24h time (`۱۵:۳۰`) into exact Python value."""
    if isinstance(raw, Fraction):
        return raw
    if isinstance(raw, int) and not isinstance(raw, bool):
        return raw
    s = norm_ascii(str(raw or "")).strip()
    if not s:
        return None
    if re.fullmatch(r"\d{1,2}:\d{2}", s):
        hh, mm = s.split(":")
        return f"{int(hh):02d}:{int(mm):02d}"
    m_frac = re.fullmatch(r"(-?\d+)\s*/\s*(\d+)", s)
    if m_frac and int(m_frac.group(2)) != 0:
        return Fraction(int(m_frac.group(1)), int(m_frac.group(2)))
    if re.fullmatch(r"-?\d+", s):
        return int(s)
    return None


def values_equal(a: Any, b: Any) -> bool:
    pa = parse_exact_value(a)
    pb = parse_exact_value(b)
    if pa is not None and pb is not None:
        if isinstance(pa, (int, Fraction)) and isinstance(pb, (int, Fraction)):
            return Fraction(pa) == Fraction(pb)
        return pa == pb
    return str(a) == str(b)


class DomainSolverPlugin(ABC):
    domain_id: str = "base"

    @abstractmethod
    def solve(self, params: Dict[str, Any]) -> AnswerValue:
        """Deterministically solve structured `params` without any LLM or heuristic guesswork."""

    @abstractmethod
    def generate_causal_distractors(self, params: Dict[str, Any]) -> Dict[str, Set[AnswerValue]]:
        """Map cognitive error code `E_*` -> set of exact wrong answers caused by that error."""

    def solve_from_stem(self, stem: str) -> Tuple[Optional[AnswerValue], Dict[str, Any]]:
        """Optional natural-language stem parser returning `(exact_answer, metadata)`."""
        return None, {}

    def simulate_mechanisms_from_stem(
        self,
        stem: str,
        note: str,
        correct_val: AnswerValue,
        wrong_val: AnswerValue,
    ) -> Set[str]:
        """Return all `E_*` codes whose causal model produces `wrong_val` on `(stem, note)`."""
        return set()
