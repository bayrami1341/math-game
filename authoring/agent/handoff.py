"""بستهٔ دسترسیِ ماشین‌خوان برای «مدلِ مادر» (موتور اصلی `Z.ai`).

هدف (بندِ «پایانِ واسطه‌گریِ پیام»):
  به‌جای ردوبدل‌کردنِ توضیحات در چت، مدلِ مادر می‌تواند یک فایلِ JSONِ
  امضاشدهٔ SHA-256 بخواند که *فهرستِ دقیقِ موتور* را دارد: ماژول‌ها،
  APIهایِ عمومی، زیرفرمان‌های CLI، گیت‌ها و کدهای `fail-closed`،
  فیکسچرهای غیرمحرمانه، سرهای رسمی و مرزهای مجوز.

اصل‌ها:
  1. فقط از *کدِ واقعی* استخراج می‌شود (`ast` روی ماژول‌ها، `build_parser()`
     روی CLI، `OFFICIAL-HEADS.json` روی مرجعِ رسمی) — هیچ فهرستِ دستی که
     بتواند کهنه شود.
  2. هیچ مادهٔ محرمانه‌ای وارد بسته نمی‌شود: PDF، تصویرِ صفحه، کراپ، توکنِ
     معلم و نقلِ کتاب. فقط مسیر + SHA-256ِ فایل‌های غیرمحرمانهٔ مخزن.
  3. بسته هیچ مجوزی صادر نمی‌کند: `not_granted` همیشه شاملِ رأیِ معلم،
     اجازهٔ انتشار، تغییرِ سرِ رسمی و اعلامِ نهایی‌بودن است.
"""

from __future__ import annotations

import ast
import datetime as dt
import json
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import file_sha256

SCHEMA_VERSION = "1.0.0"

#: ماژول‌های هستهٔ موتورِ آشیل (= `khshab-agent`) به‌ترتیبِ زنجیرهٔ داده
ENGINE_MODULES: List[str] = [
    "authoring/agent/models.py",
    "authoring/agent/paths.py",
    "authoring/agent/id_allocator.py",
    "authoring/agent/excel_exporter.py",
    "authoring/agent/observation.py",
    "authoring/agent/reconcile.py",
    "authoring/agent/concept_scope.py",
    "authoring/agent/content_pipeline.py",
    "authoring/agent/wave_exporter.py",
    "authoring/agent/validators.py",
    "authoring/agent/achilles_gate.py",
    "authoring/agent/automation_suite.py",
    "authoring/agent/governance.py",
    "authoring/agent/git_guard.py",
    "authoring/agent/viewer.py",
    "authoring/agent/autopilot.py",
    "authoring/agent/microbot_engine.py",
    "authoring/agent/cli.py",
    "authoring/agent/handoff.py",
]

#: فایل‌های نرم‌افزاریِ در مالکیتِ `Z.ai` — آرنا هرگز تغییرشان نمی‌دهد (§9)
ZAI_OWNED_PATHS: List[str] = [
    "public/math-game/src/v10/**",
    "public/math-game/workshop-core.js",
    "public/math-game/v10.html",
    "tools/cartridge-converter/**",
    "public/math-game/cartridges/*.json",
]

#: پسوندهایی که هرگز وارد بسته نمی‌شوند (حقِ نشر §9 + امنیت توکن)
FORBIDDEN_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
FORBIDDEN_NAME_PARTS = ("teacher_token", "secret", "credential", ".env")

#: مرزهای مجوز — آنچه این بسته و کلِ موتور *صادر نمی‌کنند*
NOT_GRANTED: List[str] = [
    "TEACHER_VERDICT",
    "RELEASE_AUTHORIZATION",
    "OFFICIAL_HEAD_CHANGE",
    "FINALITY_CLAIM",
    "AUTO_GREEN_PROMOTION",
    "GIT_PUSH_AUTOMATIC",
]

#: قانون‌های ثابتی که مدلِ مادر باید در هر تغییر رعایت کند
HARD_INVARIANTS: List[Dict[str, str]] = [
    {
        "id": "INV-01",
        "rule": "شناسه‌های L-/Q-/E_ بازتولیدناپذیر و غیرقابلِ بازیافتند (`id_allocator.ImmutableIDViolationError`).",
        "verify": "authoring/tests/test_wave_exporter_and_w3_w6.py",
    },
    {
        "id": "INV-02",
        "rule": "لنگرِ دوطرفهٔ S1.K ↔ Bank.B باید دوسویه بماند (`T7_ANCHOR_MISMATCH`).",
        "verify": "authoring/agent/validators.py: verify_bidirectional_anchors",
    },
    {
        "id": "INV-03",
        "rule": "موجِ جدید فقط از سرِ اعلام‌شدهٔ OFFICIAL-HEADS.json شروع می‌شود (`STALE_OFFICIAL_BASE_INCIDENT_07`).",
        "verify": "authoring/tests/test_achilles_boundaries.py::test_stale_official_base_is_rejected_and_gate_is_precise",
    },
    {
        "id": "INV-04",
        "rule": "هیچ ردیفِ AI بدون شاهدِ کراپ/BBOX/SHA سبز نمی‌شود؛ سبزِ بی‌شاهد = FAIL.",
        "verify": "authoring/agent/achilles_gate.py: verify_achilles_evidence_gate",
    },
    {
        "id": "INV-05",
        "rule": "پوششِ شاهد گیتِ *جدا* است؛ PASS هلوسه هیچ‌گاه «تکمیلِ مشاهده» یا «آمادگیِ انتشار» نیست.",
        "verify": "authoring/agent/achilles_gate.py: verify_evidence_coverage_gate",
    },
    {
        "id": "INV-06",
        "rule": "اتصالِ شاهد به SHA واقعیِ PDF + کد کتاب + manifest همان چاپ + آفستِ اثبات‌شده؛ ناسازگاری fail-closed.",
        "verify": "authoring/agent/achilles_gate.py: bind_evidence_to_source",
    },
    {
        "id": "INV-07",
        "rule": "مُهرِ معلم فقط با احراز هویتِ سمتِ سرور؛ رشتهٔ `actor_role` اعلامیِ فراخواننده کافی نیست.",
        "verify": "authoring/agent/governance.py: authenticate_teacher + record_verdict",
    },
    {
        "id": "INV-08",
        "rule": "`--approve-once` فقط اجازهٔ اجرای فنیِ محدود است (`TECHNICAL_EXECUTION_ONLY`).",
        "verify": "authoring/agent/autopilot.py: _roadmap_approval_proof",
    },
    {
        "id": "INV-09",
        "rule": "توافقِ دو خواننده بدون شاهد هرگز `EVIDENCE_MATCHED` نمی‌شود (`AGREED_UNVERIFIED`).",
        "verify": "authoring/agent/reconcile.py: enforce_agreement_evidence_rule",
    },
    {
        "id": "INV-10",
        "rule": "PDF، عکسِ کتاب، کراپِ صفحه و نقلِ بیش از ۱۰ واژه از کتاب هرگز در Git نیست.",
        "verify": "authoring/agent/git_guard.py: audit_git_copyright_safety",
    },
    {
        "id": "INV-11",
        "rule": "M13 MVP در M00/M01/M02 قرارداد منبع/قرنطینه/observation packet را می‌سنجد؛ coverage گیت مستقل است و PASS آن مجوز release نیست.",
        "verify": "authoring/agent/microbot_engine.py: run_microbot_preflight",
    },
    {
        "id": "INV-12",
        "rule": "M05 concept-scope فقط دو packet مقید به PDF/manifest/profile را می‌سنجد؛ شمارهٔ چاپیِ هر صفحه باید با شاهدِ source-bound با offset manifest بخواند؛ تعارض/ابهام BLOCKED و انحرافِ اولیهٔ توافق‌شده FAIL است؛ PASS هرگز رأی آموزشی، رنگ یا release نیست.",
        "verify": "authoring/agent/concept_scope.py: audit_concept_scope + authoring/tests/test_concept_scope.py",
    },
    {
        "id": "INV-13",
        "rule": "Source، offset-proof، extraction، valuation و game draft فقط به‌شکل artifactهای ساختاریافتهٔ hash-linked در مخزن نسخه‌دار می‌شوند؛ schema/runtime و حقوق ناسازگار fail-closed است؛ PDF/تصویر/raw text وارد Git نمی‌شود؛ PASS فقط traceability است و هیچ حکم/رنگ/release نمی‌سازد.",
        "verify": "authoring/agent/content_pipeline.py + authoring/tests/test_content_pipeline.py",
    },
]

#: کارهایی که فقط در مالکیتِ مدلِ مادر / مالکِ انسانی است
MOTHER_AI_ACTIONS: List[Dict[str, str]] = [
    {
        "id": "W7",
        "action": "W7 در snapshot رسمی موجود است (Python 3.11 + pytest + openpyxl پین‌شده)؛ حفظ و گزارش اجرای فعلی، نه پیاده‌سازی دوباره.",
        "owner": "Z.ai",
        "reference": ".github/workflows/khshab-gate.yml@v10.3-beta",
    },
    {
        "id": "W8",
        "action": "Z.ai گزارش کرده و main@4f48947e5e16d66aa6f93115294415c8f50ffcc1 مسیر M10 را به caller واقعی وصل کرده؛ تا وقتی v10.3-beta/PR #2 جداگانه بررسی و تصمیم انسانی ثبت نشده، Arena فقط read-only مصرف می‌کند.",
        "owner": "Z.ai / مالکِ مخزن",
        "reference": "https://github.com/bayrami1341/math-game/commit/4f48947e5e16d66aa6f93115294415c8f50ffcc1",
    },
    {
        "id": "PR2",
        "action": "گزارشِ conflict و پیشنهادِ برنامهٔ ادغام برای PR #2؛ تا مجوز صریح جداگانه merge/push انجام نشود و `v10.3-beta` هرگز با `arena/**` ادغام نشود.",
        "owner": "Z.ai / مالکِ مخزن",
        "reference": "https://github.com/bayrami1341/math-game/pull/2",
    },
    {
        "id": "CANDIDATE",
        "action": "نامزدِ واقعی فقط بیرون Git و پس از تکمیلِ مرزِ شواهد بررسی شود؛ این index هیچ candidate-ready، رأی انسانی یا مجوز انتشار صادر نمی‌کند.",
        "owner": "مالک / Z.ai",
        "reference": "authoring/USAGE-KHSHAB-AGENT-v24.fa.md §4",
    },
    {
        "id": "STAMP",
        "action": "صدورِ مُهرِ معلم برای ۴۸ سؤال و ۵۴ ردیفِ «پیشنهاد» و سپس به‌روزرسانیِ `OFFICIAL-HEADS.json`.",
        "owner": "معلمِ انسانی (انحصاری)",
        "reference": "authoring/MORNING-REPORT.fa.md + governance G7",
    },
    {
        "id": "C305",
        "action": "تهیهٔ `book_manifest_C305.json` و `observation_C305.json` از همان چاپ برای بازکردنِ اتصالِ پایهٔ سوم.",
        "owner": "آرنا پس از تحویلِ PDFِ قرنطینه",
        "reference": "authoring/USAGE-KHSHAB-AGENT-v24.fa.md §4",
    },
]


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _git(repo_root: Path, *args: str) -> str:
    try:
        out = subprocess.run(
            ["git", *args], cwd=str(repo_root), capture_output=True, text=True, timeout=30, check=False
        )
        return out.stdout.strip()
    except Exception:
        return ""


def _is_forbidden(path: Path) -> bool:
    name = path.name.lower()
    if path.suffix.lower() in FORBIDDEN_SUFFIXES:
        return True
    return any(part in name for part in FORBIDDEN_NAME_PARTS)


def _public_api(py_file: Path) -> List[str]:
    """نامِ توابع/کلاس‌های عمومیِ یک ماژول (بدون `_`) از راهِ `ast`."""
    try:
        tree = ast.parse(py_file.read_text(encoding="utf-8"))
    except Exception:
        return []
    names: List[str] = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if not node.name.startswith("_"):
                names.append(node.name)
    return sorted(set(names))


def _reason_codes(py_file: Path) -> List[str]:
    """استخراجِ کدهای `fail-closed` از خودِ کد (نه از فهرستِ دستی)."""
    try:
        text = py_file.read_text(encoding="utf-8")
    except Exception:
        return []
    codes = set(re.findall(r'reason_code\s*=\s*"([A-Z0-9_]{4,})"', text))
    codes |= set(re.findall(r'"error"\s*:\s*"([A-Z0-9_]{4,})"', text))
    codes |= set(re.findall(r"'error'\s*:\s*'([A-Z0-9_]{4,})'", text))
    return sorted(codes)


def _module_entry(repo_root: Path, rel: str) -> Optional[Dict[str, Any]]:
    p = repo_root / rel
    if not p.exists():
        return None
    text = p.read_text(encoding="utf-8", errors="ignore")
    doc = ast.get_docstring(ast.parse(text)) if text.strip().startswith(('"', "'", "from", "import", "#")) else None
    try:
        doc = ast.get_docstring(ast.parse(text))
    except Exception:
        doc = None
    return {
        "path": rel,
        "sha256": file_sha256(str(p)),
        "bytes": p.stat().st_size,
        "lines": len(text.splitlines()),
        "public_api": _public_api(p),
        "fail_closed_reason_codes": _reason_codes(p),
        "docstring_first_line": (doc or "").strip().splitlines()[0] if doc else "",
    }


def _cli_entry(repo_root: Path) -> Dict[str, Any]:
    """فهرستِ زیرفرمان‌ها و گزینه‌ها از `build_parser()` واقعیِ CLI."""
    import argparse

    from .cli import build_parser

    parser = build_parser()
    subs: List[Dict[str, Any]] = []
    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            help_by_name = {
                getattr(pseudo, "dest", ""): (getattr(pseudo, "help", "") or "")
                for pseudo in getattr(action, "_choices_actions", [])
            }
            for name, sub in sorted(action.choices.items()):
                opts: List[str] = []
                for a in sub._actions:
                    strings = list(getattr(a, "option_strings", []) or [])
                    if strings:
                        opts.extend(strings)
                    elif a.dest not in ("help",):
                        opts.append(f"<{a.dest}>")
                subs.append({
                    "name": name,
                    "help": (help_by_name.get(name) or sub.description or "").strip()[:200],
                    "options": sorted(set(opts)),
                })
    return {
        "console_script": "khshab-agent = authoring.agent.cli:main",
        "module_invocation": "python3 -m authoring.agent.cli <subcommand>",
        "subcommands": subs,
    }


def _official_heads(official_ref_root: Optional[Path]) -> Dict[str, Any]:
    if official_ref_root is None:
        return {"available": False, "reason": "NO_OFFICIAL_REF_ROOT_GIVEN"}
    manifest = Path(official_ref_root) / "public/math-game/authoring/OFFICIAL-HEADS.json"
    if not manifest.exists():
        return {"available": False, "reason": "OFFICIAL_HEADS_MANIFEST_MISSING", "expected_path": str(manifest)}
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except Exception as exc:
        return {"available": False, "reason": f"OFFICIAL_HEADS_UNREADABLE: {exc}"}
    heads = {
        fam: {
            "version": info.get("version"),
            "sha256": info.get("sha256"),
            "file": info.get("file"),
            "teacher_note": info.get("teacherNote", ""),
        }
        for fam, info in (data.get("heads") or {}).items()
    }
    return {
        "available": True,
        "manifest_path": str(manifest),
        "manifest_sha256": file_sha256(str(manifest)),
        "updated_at": data.get("updatedAt"),
        "updated_by": data.get("updatedBy"),
        "rules": data.get("rules"),
        "heads": heads,
    }


def _fixtures(repo_root: Path) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    fx = repo_root / "authoring/agent/fixtures"
    if not fx.exists():
        return out
    for p in sorted(fx.rglob("*")):
        if not p.is_file() or _is_forbidden(p):
            continue
        rel = p.relative_to(repo_root).as_posix()
        out.append({"path": rel, "sha256": file_sha256(str(p)), "bytes": p.stat().st_size})
    return out


def _tests(repo_root: Path) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for base in ("authoring/tests", "tests"):
        d = repo_root / base
        if not d.exists():
            continue
        for p in sorted(d.glob("test_*.py")):
            try:
                tree = ast.parse(p.read_text(encoding="utf-8"))
            except Exception:
                continue
            funcs = [n.name for n in tree.body if isinstance(n, ast.FunctionDef) and n.name.startswith("test_")]
            out.append({"path": p.relative_to(repo_root).as_posix(), "sha256": file_sha256(str(p)), "test_count": len(funcs), "tests": funcs})
    return out


def build_handoff_index(
    repo_root: str | Path,
    official_ref_root: Optional[str | Path] = None,
    include_fixtures: bool = True,
    include_tests: bool = True,
) -> Dict[str, Any]:
    """ساختِ بستهٔ دسترسیِ ماشین‌خوان برای مدلِ مادر (فقط از کدِ واقعی)."""
    root = Path(repo_root).resolve()
    engine = [e for e in (_module_entry(root, rel) for rel in ENGINE_MODULES) if e is not None]
    achilles = root / "authoring/agent/achilles_gate.py"
    schema_dir = root / "authoring/agent/schemas"
    contract_schemas = []
    for schema_path in sorted(schema_dir.glob("*.schema.json")):
        try:
            schema_payload = json.loads(schema_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError):
            schema_payload = {}
        contract_schemas.append({
            "schema_id": schema_payload.get("$id"),
            "path": schema_path.relative_to(root).as_posix(),
            "sha256": file_sha256(str(schema_path)),
            "bytes": schema_path.stat().st_size,
        })
    bundle: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at_utc": _utc_now(),
        "generated_by": "khshab-agent v2.4 — authoring/agent/handoff.py: build_handoff_index",
        "purpose": (
            "دسترسیِ مستقیمِ مدلِ مادر به موتورِ آشیل بدون واسطه‌گریِ پیام: "
            "فهرستِ ماژول‌ها، APIها، گیت‌ها و مرزهای مجوز با SHA-256 برای راستی‌آزمایی."
        ),
        "repository": {
            "remote": _git(root, "remote", "get-url", "origin"),
            "branch": _git(root, "rev-parse", "--abbrev-ref", "HEAD"),
            "head_sha_at_generation": _git(root, "rev-parse", "HEAD"),
            "head_subject": _git(root, "log", "-1", "--pretty=%s"),
            "head_sha_caveat": (
                "این شماره در لحظهٔ تولیدِ بسته ثبت شده است؛ خودِ بسته در commitِ بعدی "
                "منتشر می‌شود، پس شمارهٔ شاخه یک شماره جلوتر خواهد بود. معیارِ "
                "راستی‌آزماییِ محتوا، SHA-256ِ ماژول‌هاست (engine.modules) نه شمارهٔ commit."
            ),
            "tags": [t for t in _git(root, "tag", "--list").splitlines() if t.strip()],
            "pull_request": {
                "number": 2,
                "head_branch": _git(root, "rev-parse", "--abbrev-ref", "HEAD"),
                "base_branch": "v10.3-beta",
                "note": "آخرین وضعیت ثبت‌شده در 2026-10-23: OPEN و CONFLICTING/DIRTY؛ این بسته مجوز merge/push نمی‌دهد و ادغامِ v10.3-beta در arena/** ممنوع است.",
            },
            "official_reference_hint": "origin/v10.3-beta (فقط‌خواندنی برای آرنا)",
        },
        "engine": {
            "name": "khshab-agent (آشیل = حالتِ سخت‌گیرِ همین ایجنت، نه رباتِ جدا)",
            "entry_points": [
                "authoring/agent/cli.py:main()",
                "pyproject.toml [project.scripts] khshab-agent",
            ],
            "modules": engine,
        },
        "contract_schemas": contract_schemas,
        "cli": _cli_entry(root),
        "gates": {
            "hallucination_gate": {
                "function": "authoring/agent/achilles_gate.py: verify_achilles_evidence_gate",
                "gate_id": "G_ACHILLES_EVIDENCE",
                "fail_closed_reason_codes": _reason_codes(achilles),
                "semantics": "سبزِ بی‌شاهد = FAIL؛ PASS آن ادعایِ پوشش یا انتشار نیست.",
            },
            "coverage_gate": {
                "function": "authoring/agent/achilles_gate.py: verify_evidence_coverage_gate",
                "gate_id": "G_ACHILLES_COVERAGE",
                "cli": "khshab-agent coverage",
                "metrics": [
                    "rows_with_evidence",
                    "rows_without_evidence",
                    "rows_mismatch",
                    "coverage_ratio",
                    "without_evidence_ids",
                    "proven_offset",
                    "ledger_size",
                    "observation_pdf_sha256",
                    "manifest_edition",
                ],
                "semantics": "ردیفِ بی‌شاهد زرد می‌ماند؛ هیچ ارتقای خودکار به سبز.",
            },
            "content_pipeline_trace": {
                "function": "authoring/agent/content_pipeline.py: audit_content_pipeline",
                "cli": "khshab-agent content-pipeline-audit",
                "stages": ["source", "versioned manifest", "external PDF SHA/size/page count", "offset-proof", "extraction", "valuation", "game draft"],
                "schemas": [
                    "khshab.content-source/v1",
                    "khshab.offset-proof/v1",
                    "khshab.extraction-ledger/v1",
                    "khshab.valuation-bundle/v1",
                    "khshab.game-content-pack/v1",
                    "khshab.verdict-ledger/v1",
                ],
                "semantics": (
                    "Draft 2020-12 schemas + manifest-file/PDF-byte/hash/page-anchor lineage fail-closed. "
                    "AUTHORIZED sources require the exact PDF outside Git; synthetic fixtures may omit it. "
                    "PASS فقط traceability است؛ verdict نمی‌سازد و release نمی‌دهد. "
                    "احراز هویت ledger را رمزنگارانه دوباره بررسی نمی‌کند؛ فقط metadata ثبت‌شده را می‌سنجد."
                ),
                "excel_export_cli": "khshab-agent export-extraction-xlsx",
                "fixture": "authoring/agent/fixtures/content_pipeline_synthetic/README.fa.md",
            },
            "source_binding": {
                "function": "authoring/agent/achilles_gate.py: bind_evidence_to_source",
                "anchors": [
                    "SHA-256 واقعیِ فایل PDF ورودی",
                    "book_code یکسان در observation/manifest/ledger",
                    "manifest همان چاپ (edition + source_pdf.sha256)",
                    "آفستِ اثبات‌شدهٔ صفحهٔ چاپی ↔ PDF",
                ],
            },
            "universal_invariants": "authoring/agent/automation_suite.py: verify_universal_wave_invariants (U-01..U-10)",
            "official_head_lock": "authoring/agent/automation_suite.py: check_official_heads (STALE_OFFICIAL_BASE_INCIDENT_07)",
            "zai_converter": "tools/cartridge-converter/convert.mjs (فقط‌خواندنی؛ SSOT در مالکیتِ Z.ai)",
            "release_gate": "authoring/agent/governance.py: evaluate_release_readiness (G7)",
        },
        "hard_invariants": HARD_INVARIANTS,
        "zai_owned_paths_do_not_modify": ZAI_OWNED_PATHS,
        "not_granted": NOT_GRANTED,
        "mother_ai_actions": MOTHER_AI_ACTIONS,
        "confidentiality_policy": {
            "never_in_bundle_or_git": [
                "PDF کتاب‌ها",
                "عکسِ صفحه/کراپِ تصویر",
                "نقلِ بیش از ۱۰ واژه از کتاب",
                "توکنِ معلم",
            ],
            "quarantine_locations": ["/tmp/khshab_secure_vault", "/tmp/khshab_counting_vault", "upload/"],
            "forbidden_suffixes": sorted(FORBIDDEN_SUFFIXES),
        },
        "official_heads": _official_heads(Path(official_ref_root) if official_ref_root else None),
        "documents": [
            {"path": "authoring/USAGE-KHSHAB-AGENT-v24.fa.md", "role": "راهنمای هم‌تراز با CLI (ماشین‌سنجیده)"},
            {"path": "authoring/G2-V12-CONNECTION-DRYRUN.fa.md", "role": "گزارش dry-run اتصالِ G2 v1.2"},
            {"path": "authoring/MOTHER-AI-HANDOFF-v24.fa.md", "role": "گزارشِ جامعِ تغییرات و تحلیل برای مدلِ مادر"},
            {"path": "authoring/ACHILLES-ARCHITECTURE.fa.md", "role": "معماریِ پاشنهٔ آشیل"},
            {"path": "authoring/ROADMAP-KHSHAB-AGENT-v2.fa.md", "role": "نقشهٔ فنیِ مصوبِ مالک"},
            {"path": "authoring/ZAI-HANDOFF-W7-W8.fa.md", "role": "هندآف W7/W8 به Z.ai"},
        ],
        "verification": {
            "test_command": "python -m pytest -q",
            "expected_layout_note": "شاخهٔ محتواییِ آرنا + مرجعِ فقط‌خواندنیِ v10.3-beta",
            "verify_any_file": "sha256sum <path> و مقایسه با همین بسته",
        },
    }
    if include_fixtures:
        bundle["fixtures_non_confidential"] = _fixtures(root)
    if include_tests:
        bundle["tests"] = _tests(root)
    return bundle


def write_handoff_index(
    repo_root: str | Path,
    out_path: str | Path,
    official_ref_root: Optional[str | Path] = None,
) -> Dict[str, Any]:
    """ساختِ بسته و نوشتنِ آن روی دیسک؛ `sha256` و `path` فایل را برمی‌گرداند."""
    bundle = build_handoff_index(repo_root, official_ref_root=official_ref_root)
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(bundle, ensure_ascii=False, indent=2) + "\n"
    out.write_text(payload, encoding="utf-8")
    return {"path": str(out), "sha256": file_sha256(str(out)), "bytes": out.stat().st_size}
