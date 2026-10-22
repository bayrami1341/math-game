"""Registry of all 5 Multi-Grade Domain Solver & Causal Distractor Plugins (`W2`)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

from .base import AnswerValue, DomainSolverPlugin, parse_exact_value, values_equal
from .data_prob import DataProbSolverPlugin
from .fractions import FractionsSolverPlugin
from .geometry_measure import GeometryMeasureSolverPlugin
from .mult_div import MultDivSolverPlugin
from .number_ops import NumberOpsSolverPlugin

SOLVER_PLUGINS: List[DomainSolverPlugin] = [
    FractionsSolverPlugin(),
    GeometryMeasureSolverPlugin(),
    DataProbSolverPlugin(),
    MultDivSolverPlugin(),
    NumberOpsSolverPlugin(),
]

PLUGINS_BY_ID: Dict[str, DomainSolverPlugin] = {p.domain_id: p for p in SOLVER_PLUGINS}


def solve_with_plugins(stem: str) -> Tuple[Optional[AnswerValue], Dict[str, Any]]:
    for plugin in SOLVER_PLUGINS:
        ans, meta = plugin.solve_from_stem(stem)
        if ans is not None:
            return ans, {"plugin": plugin.domain_id, **meta}
    return None, {}


def simulate_mechanisms_with_plugins(
    stem: str,
    note: str,
    correct_val: AnswerValue,
    wrong_val: AnswerValue,
) -> Set[str]:
    matched: Set[str] = set()
    for plugin in SOLVER_PLUGINS:
        matched |= plugin.simulate_mechanisms_from_stem(stem, note, correct_val, wrong_val)
    return matched


__all__ = [
    "AnswerValue",
    "DomainSolverPlugin",
    "NumberOpsSolverPlugin",
    "MultDivSolverPlugin",
    "FractionsSolverPlugin",
    "GeometryMeasureSolverPlugin",
    "DataProbSolverPlugin",
    "SOLVER_PLUGINS",
    "PLUGINS_BY_ID",
    "parse_exact_value",
    "values_equal",
    "solve_with_plugins",
    "simulate_mechanisms_with_plugins",
]
