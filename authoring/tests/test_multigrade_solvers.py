"""Comprehensive tests for Multi-Grade Solver Plugins (`W2` — `G1..G6`)."""

from __future__ import annotations

from fractions import Fraction
from pathlib import Path

from authoring.agent.paths import resolve_fixture
from authoring.agent.solvers import (
    PLUGINS_BY_ID,
    DataProbSolverPlugin,
    FractionsSolverPlugin,
    GeometryMeasureSolverPlugin,
    MultDivSolverPlugin,
    NumberOpsSolverPlugin,
    simulate_mechanisms_with_plugins,
    solve_with_plugins,
)
from authoring.agent.validators import load_chapter_bounds_from_pagemap

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_all_five_multigrade_solver_plugins_registered() -> None:
    assert set(PLUGINS_BY_ID.keys()) == {
        "number_ops",
        "mult_div",
        "fractions",
        "geometry_measure",
        "data_prob",
    }


def test_number_ops_multidigit_place_value_column_ops_and_rounding() -> None:
    s = NumberOpsSolverPlugin()
    assert s.solve({"op": "place_value", "number": 2047, "place_power": 3}) == 2000
    assert s.solve({"op": "place_value", "number": 2047, "place_power": 1, "digit_only": True}) == 4
    assert s.solve({"op": "column_add", "operands": [2485, 1769]}) == 4254
    assert s.solve({"op": "column_sub", "a": 5002, "b": 1687}) == 3315
    assert s.solve({"op": "round", "number": 3680, "place_power": 2}) == 3700

    dists = s.generate_causal_distractors({"op": "column_add", "operands": [485, 267]})
    assert (485 + 267 - 10) in dists["E_CARRY_MISS"]
    assert all(485 + 267 not in vals for vals in dists.values())


def test_mult_div_exact_remainder_invariants_and_prose_solver() -> None:
    s = MultDivSolverPlugin()
    assert s.solve({"op": "multiply", "a": 14, "b": 3}) == 42
    assert s.solve({"op": "distributive", "a": 6, "b1": 10, "b2": 4}) == 84
    assert s.solve({"op": "divide", "dividend": 38, "divisor": 5, "target": "quotient"}) == 7
    assert s.solve({"op": "divide", "dividend": 38, "divisor": 5, "target": "remainder"}) == 3
    assert s.solve({"op": "divide", "dividend": 38, "divisor": 5, "target": "ceiling_containers"}) == 8

    dists = s.generate_causal_distractors({"op": "multiply", "a": 14, "b": 3})
    assert 34 in dists["E_DISTRIBUTIVE_LEAK"]

    ans_rem, _ = solve_with_plugins("باقی‌ماندهٔ تقسیم ۳۸ بر ۵ چند است؟")
    ans_mul, _ = solve_with_plugins("حاصل ۷ × ۸ چند است؟")
    assert ans_rem == 3
    assert ans_mul == 56


def test_exact_fractions_solver_and_misconception_simulators_zero_float_error() -> None:
    s = FractionsSolverPlugin()
    assert s.solve({"op": "part_whole", "shaded": 3, "total": 8}) == Fraction(3, 8)
    assert s.solve({"op": "equivalent_numerator", "num": 2, "den": 3, "target_den": 12}) == 8
    assert s.solve({"op": "add", "f1": (1, 6), "f2": (1, 3)}) == Fraction(1, 2)
    assert s.solve({"op": "sub", "f1": (5, 8), "f2": (1, 4)}) == Fraction(3, 8)
    assert s.solve({"op": "of_quantity", "fraction": (3, 5), "quantity": 40}) == 24

    dists_eq = s.generate_causal_distractors({"op": "equivalent_numerator", "num": 2, "den": 3, "target_den": 12})
    assert 11 in dists_eq["E_FRAC_ADDITIVE_EQUIVALENCE"]


def test_geometry_compound_measurement_and_clock_solvers() -> None:
    s = GeometryMeasureSolverPlugin()
    assert s.solve({"op": "perimeter_rect", "width": 5, "height": 8}) == 26
    assert s.solve({"op": "area_rect", "width": 5, "height": 8}) == 40
    assert s.solve({"op": "compound_to_minor", "unit_pair": "kg_g", "major": 2, "minor": 700}) == 2700
    assert s.solve({"op": "clock_to_24h", "hour_12": 4, "minute": 0, "period": "pm"}) == 16
    assert s.solve({"op": "clock_elapsed", "hour": 9, "minute": 40, "delta_minutes": 35}) == "10:15"

    dists = s.generate_causal_distractors({"op": "perimeter_rect", "width": 5, "height": 8})
    assert 40 in dists["E_PERIMETER_AREA_CONFUSION"]
    assert 13 in dists["E_HALF_PERIMETER"]

    mechs = simulate_mechanisms_with_plugins("محیط مستطیلی به طول ۸ و عرض ۵ چند است؟", "", 26, 40)
    assert "E_PERIMETER_AREA_CONFUSION" in mechs


def test_data_prob_pictograph_crate_scale_and_spinner_probability() -> None:
    s = DataProbSolverPlugin()
    # Real C305 p.130 milk crate lesson: each symbol = 6 bottles!
    assert s.solve({"op": "pictograph_value", "symbol_count": 4, "scale_per_symbol": 6, "half_symbol_count": 1}) == 27
    dists_pic = s.generate_causal_distractors({"op": "pictograph_value", "symbol_count": 4, "scale_per_symbol": 6})
    assert 4 in dists_pic["E_SCALE_IGNORED"]

    assert s.solve({"op": "probability", "favorable": 2, "total": 6}) == Fraction(1, 3)
    dists_prob = s.generate_causal_distractors({"op": "probability", "favorable": 2, "total": 6})
    assert Fraction(1, 2) in dists_prob["E_PROB_PART_TO_REST"]


def test_dynamic_pagemap_bounds_g2_and_g3_zero_hardcoded_offsets() -> None:
    g2_pm = resolve_fixture(REPO_ROOT, "PAGE-MAP-KH-G2-MATH-v1_verified.xlsx", "authoring/PAGE-MAP-KH-G2-MATH-v1_audited.xlsx")
    g2_info = load_chapter_bounds_from_pagemap(g2_pm)
    assert g2_info["proven_offset"] == 6
    assert g2_info["chapters"][1] == (1, 18)
    assert g2_info["chapters"][4] == (55, 72)
    assert g2_info["chapters"][8] == (127, 144)

    g3_pm = REPO_ROOT / "authoring/PAGE-MAP-KH-G3-MATH-v1_verified.xlsx"
    if g3_pm.exists():
        g3_info = load_chapter_bounds_from_pagemap(g3_pm)
        assert g3_info["proven_offset"] == 0
        assert g3_info["chapters"][1] == (7, 24)
        assert g3_info["chapters"][2] == (25, 42)
        assert g3_info["chapters"][7] == (115, 132)
        assert g3_info["chapters"][8] == (133, 150)
