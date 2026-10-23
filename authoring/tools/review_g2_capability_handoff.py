"""Consumer-side structural review of Z.ai's G2 engine capability reply.

Reads an immutable main commit with git show; does not merge or change the engine.
PASS of engine tests != book evidence, endorsement of limits, or teacher verdict.
Run: python authoring/tools/review_g2_capability_handoff.py --out-dir authoring/g2-completion
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

COMMIT = "8decb334f08cd7cdaddc72f7941c760aa983a1d4"
REQUEST = ROOT / "authoring/G2-ENGINE-CAPABILITY-REQUEST-v1.json"
REPLY_PATH = "reports/g2-capability-reply-v1.json"
CONTRACT_PATH = "public/math-game/authoring/OPERATION-CONTRACT.json"
TEST_PATH = "public/math-game/tests/v10.5-g2-capability-mapping.test.js"
SUPPORTED = {"SUPPORTED", "SUPPORTED_WITH_LIMITS", "NEEDS_IMPLEMENTATION", "NOT_SUPPORTED"}


def git_json(commit: str, path: str) -> dict:
    raw = subprocess.run(["git", "show", f"{commit}:{path}"], cwd=ROOT, capture_output=True, check=True).stdout
    return json.loads(raw)


def review(request: dict, reply: dict, contract: dict, commit: str) -> dict:
    if (not re.fullmatch(r"[0-9a-f]{40}", commit)
        or request.get("schema") != "g2-engine-capability-requests/v1"
        or request.get("origin") != "SYNTHETIC_INTERACTION_FIXTURES_NOT_PRINTED_EXERCISES"
        or request.get("book_evidence_status") != "UNVERIFIED"
        or request.get("teacher_verdict") != "NOT_GRANTED"
        or request.get("new_q_ids") != 0
        or reply.get("schema") != "g2-engine-capability-replies/v1"
        or contract.get("schema") != "khshab.operation-contract/v1"):
        raise ValueError("CONTRACT_IDENTITY_OR_TRUST_SCOPE_DRIFT")
    cases = request.get("cases")
    replies = reply.get("cases")
    if not isinstance(cases, list) or not isinstance(replies, list) or len(cases) != len(replies) or len(cases) != 9:
        raise ValueError("CASE_SET_COUNT_DRIFT")
    by_id = {c.get("case_id"): c for c in replies if isinstance(c, dict)}
    if len(by_id) != 9 or set(by_id) != {c.get("case_id") for c in cases}:
        raise ValueError("CASE_SET_ID_DRIFT")
    expected_schema = f"{contract['schema']}@{contract['version']}"
    issues = []
    if reply.get("engine_version_commit") != commit:
        issues.append("TOP_LEVEL_ENGINE_COMMIT_NOT_IMMUTABLY_PINNED")
    if reply.get("engine_schema_version") != expected_schema:
        issues.append("TOP_LEVEL_SCHEMA_VERSION_DRIFT")
    rows = []
    for original in cases:
        ident = original["case_id"]
        other = by_id[ident]
        if original.get("candidate_family") != other.get("candidate_family") or other.get("capability_status") not in SUPPORTED:
            raise ValueError(f"CASE_FAMILY_OR_VERDICT_DRIFT: {ident}")
        item_issues = []
        if other.get("engine_version_commit") != commit:
            item_issues.append("CASE_ENGINE_COMMIT_NOT_IMMUTABLY_PINNED")
        if other.get("engine_schema_version") != expected_schema:
            item_issues.append("CASE_SCHEMA_VERSION_MISSING_OR_DRIFT")
        for key in ("actual_payload_or_mapping_to_current_schema", "interaction_test_link", "limitations_and_next_action"):
            if not isinstance(other.get(key), str) or not other[key].strip():
                item_issues.append(f"MISSING_{key.upper()}")
        if not other.get("interaction_test_link", "").startswith("v10.5-g2-capability-mapping.test.js"):
            item_issues.append("TEST_REFERENCE_NOT_MAPPED")
        issues.extend(f"{ident}:{x}" for x in item_issues)
        if other["capability_status"] == "NEEDS_IMPLEMENTATION":
            use = "ENGINE_MISSING_REQUESTED_INTERACTION"
        elif ident in {"G2-CAP-01", "G2-CAP-02", "G2-CAP-03"}:
            use = "ENGINE_PARTIAL_BUT_G2_BOOK_LIMITS_BLOCK_AND_BOOK_UNVERIFIED"
        elif ident == "G2-CAP-06":
            use = "ENGINE_BAR_CHART_PLAYABLE_AUTHORING_AXIS_SCALE_GATE_NOT_PROVEN"
        else:
            use = "PARTIAL_INTERACTION_ONLY_BOOK_VARIANTS_UNVERIFIED"
        rows.append({"case_id": ident, "candidate_family": original["candidate_family"],
                     "reported_capability": other["capability_status"],
                     "content_lane_use": use,
                     "book_evidence_status": "UNVERIFIED", "teacher_verdict": "NOT_GRANTED",
                     "receipt_issues": item_issues})
    return {"schema": "G2_ZAI_CAPABILITY_CONSUMER_REVIEW_v1", "source_main_commit": commit,
            "request_candidate_sha256": request["candidate_sha256"],
            "status": "HOLD_PINNED_CONTRACT_RECEIPT" if issues else "STRUCTURAL_CONTRACT_OK_NOT_BOOK_ACCEPTANCE",
            "issues": sorted(set(issues)), "cases": rows,
            "engine_tests_replayed_here": False, "book_evidence_verified": False,
            "teacher_decisions_requested_now": 0,
            "note": "A self-resolving @GIT_HEAD@ passes producer CI even outside git ('unknown'); consumer requires an immutable per-case commit/schema receipt."}


def write(report: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "G2-ZAI-CAPABILITY-CONSUMER-REVIEW-v1.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    cases = report["cases"]
    lines = ["# بازبینی مصرف‌کنندهٔ نگاشت ۹ سناریوی موتور G2 — نه پذیرش محتوای کتاب", "",
             f"- main ثابت: `{report['source_main_commit']}`؛ نامزد G2: `{report['request_candidate_sha256']}`؛ حکم: `{report['status']}`.",
             "- CI main نگاشت موتور را اجرا کرده است؛ فایل پاسخ هنوز `@GIT_HEAD@` را به‌جای SHA غیرقابل‌تغییر هر case نگه می‌دارد و `engine_schema_version` را فقط در سطح فایل دارد. این دو شرط reply_contract برای رسیدِ قابل‌مصرف هنوز بسته نشده‌اند. اجرای گیت روی archive بدون `.git` نیز ۱۱/۱۱ پاس شد چون تست producer مقدار `unknown` را مجاز می‌داند؛ پس این تست، pin مستقل نیست.",
             "- پاسخ فنی موتور واقعی‌تر و صادقانه‌تر شده است؛ اما قابلیت موتور با مجوز آموزشی، صحت کتاب یا «کل بازی» یکی نیست. CAP-01/02/03 در حدهای پیش‌نویس G2 بلوکه‌اند؛ CAP-07/09 نیازمند تعامل جدیدند؛ CAP-04/05/08 فقط زیرمجموعهٔ انتخابی/متنی را پوشش می‌دهند؛ CAP-06 بازیپذیر است ولی گیت محور/مقیاس کتاب اینجا اثبات نشده.",
             "", "| سناریو | گزارش موتور | مصرف مجاز در خط محتوا |",
             "|---|---|---|",
            ]
    for row in cases:
        lines.append(f"| {row['case_id']} | `{row['reported_capability']}` | `{row['content_lane_use']}` |")
    lines += ["", "## جداسازی چهار تعارض از تصمیم‌های فوری مالک", "",
              "- الف `dispatch_count=0`: فقط snapshot یک‌نوبتی آرناست؛ حکم توقف یا ادامهٔ دیسپچ blueprint از آن استخراج نمی‌شود. این یک اصلاح دامنه/تطبیق فنی است، نه رأی تازه برای توقف پروژه.",
              "- ب حدهای G2: پیش‌نویس و سناریوهای مصنوعی‌اند؛ بدون شاهد همان چاپ و بستهٔ کم‌حجمِ دامنه/گزینه/اثر، نه سقف خودکار باز می‌شود و نه حکم جمعی از مالک می‌خواهیم.",
              "- ج میزبانی/هزینهٔ صف بادوام واقعاً تصمیم سیاستی مالک می‌خواهد؛ ابتدا Z.ai گزینه‌ها، هزینه، مسئول عملیات و آزمون demo را مشخص کند؛ تا آن زمان `NOT_DEPLOYED`.",
              "- د Excel↔JSON: انتخاب قرارداد منشأ و آزمون بازتولید نخست کار فنی Z.ai و خط محتواست؛ اگر سیاست سر رسمی/انتشار را عوض کند، آنگاه فقط آن اختلاف به مالک می‌رود. هیچ merge کلی مجاز نشده.",
              "", "## پروتکل و ایمنی اجرا", "",
              "- T14 رجیستری ماشینی، T15 واژگان شاهد حاکمیتی و T16 کلید پایدار job هنوز اصلاح قراردادند؛ تا آزمون و پذیرش متقابل، pilot را به استقرار ۲۴ساعته تعبیر نمی‌کنیم. هویت سرویس و صف بادوام در گزارش Z.ai `BLOCKED` مانده‌اند.",
              "- گیت منبع v2 و احراز توکن سمت سرور، رفع ایرادهای نسخهٔ قدیم را در سطح کد/CI نشان می‌دهند؛ بازآزمایی مستقل روی vault واقعی و ممیزی دامنهٔ `candidateSha`/هویت معلم/سیاست توکن هنوز انجام نشده است. ادعای نفوذ یا مُهر معتبر از این بازبینی نتیجه نمی‌شود.",
              "", "**کار بعدیِ مستقل:** Z.ai پاسخ را با commit کامل و schema per-case دوباره صادر و تست source-pin را بدون fallback `unknown` اجرا کند؛ آرنا همان artifact را مصرف و برای موارد واقعی G2 پس از شاهد چاپ/حدهای مجاز تست تعامل می‌کند. هیچ ACK پذیرش موتور، مُهر یا ادغام در این گزارش صادر نشده.", ""]
    (out_dir / "G2-ZAI-CAPABILITY-CONSUMER-REVIEW-v1.fa.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out-dir", type=Path, required=True)
    p.add_argument("--commit", default=COMMIT)
    args = p.parse_args()
    try:
        request = json.loads(REQUEST.read_text(encoding="utf-8"))
        response = git_json(args.commit, REPLY_PATH)
        contract = git_json(args.commit, CONTRACT_PATH)
        report = review(request, response, contract, args.commit)
        # The producer test exists at this commit; this is not a claim that we executed it here.
        subprocess.run(["git", "cat-file", "-e", f"{args.commit}:{TEST_PATH}"], cwd=ROOT, check=True, capture_output=True)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as exc:
        print("BLOCKED_CAPABILITY_REVIEW: " + str(exc), file=sys.stderr)
        return 2
    dest = args.out_dir if args.out_dir.is_absolute() else ROOT / args.out_dir
    write(report, dest)
    print(json.dumps({"status": report["status"], "issues": len(report["issues"]),
                      "cases": len(report["cases"]), "book_evidence_verified": False}, ensure_ascii=False))
    return 1 if report["status"] == "HOLD_PINNED_CONTRACT_RECEIPT" else 0


if __name__ == "__main__":
    sys.exit(main())
