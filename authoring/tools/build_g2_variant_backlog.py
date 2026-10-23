"""Provisional game-family backlog for G2 chapters 6–8 with ZERO existing Q.

This is a proposal based on the yellow candidate workbook, NOT verified textbook
page evidence, playable engine content, authored questions, or a teacher verdict.
Usage: python authoring/tools/build_g2_variant_backlog.py --out-dir authoring/g2-completion
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from audit_g2_completion import PINNED, ROOT, inventory

# Proposed families/axes need a per-page evidence check against C205 before authoring.
# Range groups never substitute for per-page witness or approval.
FAMILIES = [
    (91, 91, "CH6_INTRO_THREE_DIGITS", "context_to_place_value", "context;place-value", "book_image"),
    (92, 94, "CH6_COMPARE_PLACE_VALUES", "compare_and_explain", "2_or_3_digits;hundreds_tens_ones;comparison_sign;expression_comparison", "base_ten_diagram"),
    (95, 99, "CH6_DECOMPOSE_ADD_SUB", "decompose_and_word_problem", "hundreds_tens_ones;add_vs_sub;one_vs_two_steps;unit_in_context", "wording_and_numbers"),
    (100, 102, "CH6_ADD_REGROUP", "build_and_regroup", "ones_to_tens;tens_to_hundreds;expanded_vs_column;word_problem", "place_value_blocks"),
    (103, 105, "CH6_SUB_REGROUP", "unbundle_and_subtract", "no_borrow;ten_to_ones;hundred_to_tens;remaining_in_context", "place_value_blocks"),
    (106, 107, "CH6_MIXED_REVIEW", "choose_strategy_and_check", "compare;add;subtract;place_value_expansion;boundary_cases", "book_exercises"),
    (108, 108, "CH6_PIECE_PUZZLE", "manipulative_puzzle", "piece_placement;area_coverage", "physical_pieces"),
    (109, 109, "CH7_PART_WHOLE_INTRO", "part_of_whole", "equal_parts;spoken_fraction", "book_image"),
    (110, 112, "CH7_TENTHS_EQUAL_PARTS", "measure_partition", "equal_vs_unequal_parts;tenths;measurement;place_value", "ruler_and_shapes"),
    (113, 115, "CH7_FRACTION_REPRESENTATIONS", "fold_color_locate", "paper_folding;colored_parts;whole_unit;line_segment", "partitioned_figures"),
    (116, 117, "CH7_SIMPLER_PROBLEM", "plan_then_solve", "estimate_then_exact;small_to_large_case;nonvisual_reasoning", "problem_text_and_figures"),
    (118, 120, "CH7_BAG_CHANCE", "predict_draw_record", "possible_outcomes;relative_likelihood;draw_with_replacement;sample_variance", "bag_and_tokens"),
    (121, 123, "CH7_SPINNER_CHANCE", "compare_spin_record", "equal_regions;relative_likelihood;record_trails;sample_variance", "spinner_regions"),
    (124, 125, "CH7_FRACTION_CHANCE_REVIEW", "represent_and_justify", "fraction_of_parts;fraction_of_set;probability_comparison", "book_figures"),
    (126, 126, "CH7_SPATIAL_TRANSLATION", "translate_without_rotation", "position_only;rotation_as_negative_example", "puzzle_shapes"),
    (127, 127, "CH8_INTRO_DATA", "notice_data_question", "collect_data;interpret_purpose", "book_image"),
    (128, 130, "CH8_TALLY_AND_COUNT", "collect_tally_summarize", "data_collection;tally_groups;total;most_vs_least", "tables_and_classroom_data"),
    (131, 133, "CH8_BAR_CHART", "plot_read_compare", "axis_scale;one_unit_per_box;interval;missing_entry;compare", "charts_and_tables"),
    (134, 135, "CH8_UNKNOWN_AND_ROUTE", "solve_unknown_or_route", "missing_addend;reasoned_trial;graph_paths", "diagram_and_values"),
    (136, 138, "CH8_PICTOGRAPH", "round_symbolize_read", "round_to_tens;symbol_key;bar_vs_picture;remainder_representation", "pictographs"),
    (139, 141, "CH8_SELECT_REPRESENTATION", "compare_chart_purpose", "time_table;bar_chart;spinner_result;representation_choice", "printed_charts"),
    (142, 143, "CH8_SUMMARY_REPRESENT", "collect_and_convert", "tally_to_chart;round_then_symbolize;explain_choice", "classroom_data"),
    (144, 144, "CH8_SYMMETRY_TILING", "tessellate_reflect", "piece_fit;line_of_symmetry", "physical_pieces"),
]


def build() -> tuple[list[dict], dict]:
    baseline = inventory()
    indexed = {item["book_page"]: item for item in baseline["pages"]}
    if set(indexed) != set(range(1, 145)):
        raise ValueError("PAGE_INVENTORY_INCOMPLETE")
    grouped: dict[int, tuple] = {}
    for item in FAMILIES:
        start, end = item[:2]
        for page in range(start, end + 1):
            if page in grouped or not 91 <= page <= 144:
                raise ValueError(f"OVERLAPPING_OR_OUT_OF_SCOPE_PROPOSAL: {page}")
            grouped[page] = item
    if set(grouped) != set(range(91, 145)):
        raise ValueError(f"MISSING_PROPOSAL_PAGES: {sorted(set(range(91,145))-set(grouped))}")
    rows = []
    for page in sorted(grouped):
        i = indexed[page]
        if i["existing_q_count"]:
            raise ValueError(f"EXPECTED_ZERO_Q_CH6_TO_CH8: {page}")
        start, end, code, proposed_game, axes, visual = grouped[page]
        rows.append({
            "book_page": page, "expected_pdf_page": page + 6,
            "chapter": i["chapter"], "s1_id": i["s1_id"],
            "proposal_family": code, "proposed_game_mechanic": proposed_game,
            "proposed_variant_axes": axes, "visual_or_text_check_required": visual,
            "s1_candidate_sha256": PINNED["candidate"],
            "existing_q_count": 0, "queue_priority": i["queue_priority"],
            "source_witness_status": "BLOCKED_PDF_NOT_VERIFIED",
            "pedagogical_status": "PROPOSED_FROM_YELLOW_S1_NOT_BOOK_VERIFIED",
            "runtime_status": "CAPABILITY_NOT_TESTED", "teacher_status": "NOT_GRANTED",
        })
    return rows, baseline


def write(rows: list[dict], baseline: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "G2-CH6-8-VARIANT-BACKLOG-v1.csv"
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    groups = []
    for a, b, code, mechanic, axes, visual in FAMILIES:
        groups.append({"pages": f"{a}-{b}" if a != b else str(a), "family": code,
                       "proposed_mechanic": mechanic, "variant_axes_to_verify": axes,
                       "book_region_to_verify": visual})
    report = {
        "schema": "G2_CH6_8_PROVISIONAL_VARIANTS_v1",
        "input_sha256": baseline["hashes"], "pages_provisionally_classified": len(rows),
        "question_rows_authored": 0, "new_approvals": 0,
        "source_status": "BLOCKED_PDF_NOT_VERIFIED",
        "claim": "Planning from existing yellow S1 only. No page image or curriculum variant is independently confirmed.",
        "families": groups,
    }
    (out_dir / "G2-CH6-8-VARIANT-BACKLOG-v1.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    lines = [
        "# G2 فصل‌های ۶ تا ۸ — قرارداد پیشنهادیِ گونه‌های تمرین (نه محتوای تأییدشده)", "",
        f"- {len(rows)} صفحه از ۹۱ تا ۱۴۴؛ {len(groups)} خانوادهٔ پیشنهادی؛ **صفر سؤال تازه و صفر مُهر**.",
        "- این دسته‌بندی فقط از S1 زردِ نامزد v1.2 آمده؛ متن/تصویر کتاب در این اجرا independently تأیید نشده است.",
        "- قبل از تألیف: SHA فایل واقعی C205، صفحه/بخش، انواع مجاز کتاب، محاسبهٔ مستقل و قابلیت واقعی موتور را بررسی کنید.",
        "- آزمایش تصادفی (کیسه/چرخنده) نتیجهٔ ازپیش‌تعیین‌شده ندارد؛ نمودار داده‌محور باید مقیاس/کلید درست داشته باشد.",
        "", "| صفحات چاپی | خانوادهٔ پیشنهادی | سازوکار پیشنهادی | محورهای عمقِ نیازمند بررسی |",
        "|---|---|---|---|",
    ]
    for x in groups:
        lines.append(f"| {x['pages']} | `{x['family']}` | `{x['proposed_mechanic']}` | `{x['variant_axes_to_verify']}` |")
    lines.extend(["", "**وضعیت:** `PROPOSED_FROM_YELLOW_S1_NOT_BOOK_VERIFIED`؛ ادعای پوشش کتاب/بازی اجراشده/مجوز انتشار ممنوع.\n"])
    (out_dir / "G2-CH6-8-VARIANT-BACKLOG-v1.fa.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        rows, baseline = build()
    except (ValueError, KeyError, OSError) as exc:
        print(f"BLOCKED_PROVISIONAL_BACKLOG: {exc}", file=sys.stderr)
        return 1
    out = args.out_dir if args.out_dir.is_absolute() else ROOT / args.out_dir
    write(rows, baseline, out)
    print(json.dumps({"status": "PROVISIONAL_ONLY", "pages": len(rows),
                      "families": len(FAMILIES), "questions_authored": 0}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
