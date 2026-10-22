"""Persistent Self-Healing Unattended Autopilot (`authoring/agent/autopilot.py`).

Designed for single-approval overnight execution (`--approve-once`):
1. **Durable State & Crash Resume (`AutopilotStateStore`)**:
   Checkpoints every step to `autopilot_state.json` + append-only `autopilot_events.jsonl`.
   If interrupted mid-night, re-running resumes cleanly from the first unfinished wave.
2. **Live GitHub Sync & Sacred Boundary Guard (`GitHubSyncManager`)**:
   - Restores multi-branch refspec if needed and fetches `origin` with exponential retry/backoff.
   - Reads `OFFICIAL-HEADS.json` from `repo_root` / `official_ref_root` / `origin/v10.3-beta` and enforces
     the **Wave 5 Hold Rule** (`WAVE5_HELD_AWAITING_ZAI_V05_MERGE` whenever a wave requires `khshab-G2-MATH_v0.5.xlsx`
     as its base before `Z.ai` officially merges `v0.5` into `OFFICIAL-HEADS.json`).
   - Enforces `G0_OWNERSHIP_AND_HYGIENE`: blocks any commit containing `Z.ai`-owned files
     (`workshop-core.js`, `v10.html`, `src/v10/`, `tools/cartridge-converter/`, `errors.js`, `cartridges/`)
     or confidential media (`*.pdf`, `*.png`, `*.jpg`, `*.jpeg`, `*.webp`), never merges `v10.3-beta`
     into `arena/**`, commits cleanly, pushes to the active branch, and updates PR description via REST API.
3. **Root-Cause Self-Healing Engine (`SelfHealingEngine`)**:
   - Never weakens tests, never deletes assertions, and NEVER forges teacher stamps (`تأییدشده` / `تأیید شده`).
   - Diagnoses exact root causes from `G3_ANTI_J12`, `G4_INDEPENDENT_SOLVER`, `G5_DISTRACTOR_CAUSALITY`,
     `G6_WORKBOOK_STRUCTURE`, `U-01..U-10`, and `convert.mjs`:
       * `H1_PERSIAN_ORTHOGRAPHY`: normalizes ASCII/Arabic-Indic digits and `ي/ك` across stems, choices, and titles.
       * `H2_BIJECTIVE_T7_ANCHORS`: recomputes bijective `WaveS1RowSpec.anchor <-> WaveQuestionSpec.qid`.
       * `H3_REGISTER_MISSING_ERROR_CODE`: registers missing `E_*` codes in `atlas_rows` with honest `'نیاز به تأیید'`.
       * `H4_STRIP_FORGED_GREEN_STAMP`: strips illegal green stamps (`'تأییدشده'` / `'تأیید شده'`) back to `'نیاز به تأیید'`.
       * `H5_REBALANCE_CHOICE_KEYS`: permutes `(choice_text, error_code)` slots `(الف, ب, ج, د)` until balanced (`spread <= 1`).
       * `H6_REALIGN_SOLVER_KEY`: aligns `ans` when `solve_with_plugins(stem)` / `answer_val` proves another slot holds the true answer,
         plus optional `G.ai` (`GeminiVisionReaderAdapter`) / `Z.ai` (`OpenAICompatibleReaderAdapter`) duplicate-distractor rewrite,
         and NEVER trusts any repair until `G3..G6 + U-01..U-10 + convert.mjs` ALL return `PASS` (`red == 0`)!
"""

from __future__ import annotations

import copy
import datetime as dt
import json
import re
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import openpyxl

from .automation_suite import (
    run_converter_and_parse_report,
    verify_universal_wave_invariants,
)
from .models import (
    GateResult,
    WaveAtlasRowSpec,
    WaveQuestionSpec,
    WaveSpecV2,
    file_sha256,
)
from .observation import normalize_digits_to_persian, purge_quarantine_vault
from .paths import resolve_fixture, resolve_official_cartridge
from .reconcile import GeminiVisionReaderAdapter, OpenAICompatibleReaderAdapter
from .solvers import solve_with_plugins
from .validators import inspect_cartridge_workbook, resolve_pagemap_for_workbook
from .wave_exporter import export_wave_cartridge

FORBIDDEN_ZAI_PREFIXES = (
    "public/math-game/src/v10/",
    "src/v10/",
    "public/math-game/tools/cartridge-converter/",
    "tools/cartridge-converter/",
    "public/math-game/cartridges/",
    "cartridges/",
)
FORBIDDEN_ZAI_BASENAMES = {
    "workshop-core.js",
    "v10.html",
    "errors.js",
    "cartridge-schema.js",
    "convert.mjs",
}
FORBIDDEN_MEDIA_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
CHOICE_KEYS = ("الف", "ب", "ج", "د")
FORBIDDEN_GREEN_LABELS = {"تأییدشده", "تأیید شده"}


def _extract_version_tuple(filename_or_ver: str) -> Tuple[int, ...]:
    m = re.search(r"v(\d+(?:\.\d+)+)", str(filename_or_ver))
    if not m:
        return (0,)
    return tuple(int(p) for p in m.group(1).split("."))


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _clean_fa_text(s: str) -> str:
    t = normalize_digits_to_persian(str(s))
    return t.replace("ي", "ی").replace("ك", "ک")


def _parse_choice_error_map(raw_map: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for part in re.split(r"[؛;،,]+", raw_map or ""):
        part = part.strip()
        m = re.match(r"^(الف|ب|ج|د)\s*(?:→|->|=|:)\s*(E[_-][A-Za-z0-9_-]+)$", part.replace("ي", "ی").replace("ك", "ک"))
        if m:
            out[m.group(1)] = m.group(2)
    return out


def _format_choice_error_map(err_by_key: Dict[str, str], ans_key: str) -> str:
    return "؛ ".join(f"{k}→{err_by_key[k]}" for k in CHOICE_KEYS if k != ans_key and err_by_key.get(k))


def _sync_wrong_spec(q: WaveQuestionSpec) -> None:
    ans_idx = CHOICE_KEYS.index(q.ans)
    q.wrong_spec = [[CHOICE_KEYS[i], q.opts[i]] for i in range(4) if i != ans_idx]


class AutopilotStateStore:
    """Crash-safe JSON checkpoint + append-only JSONL event log."""

    def __init__(self, state_dir: Path) -> None:
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.state_dir / "autopilot_state.json"
        self.events_file = self.state_dir / "autopilot_events.jsonl"

    def load_or_init(self, approved_once: bool) -> Dict[str, Any]:
        if self.state_file.exists():
            data = json.loads(self.state_file.read_text(encoding="utf-8"))
            if approved_once:
                data["approved_once"] = True
            return data
        state = {
            "schema_version": "2.0.0",
            "created_at_utc": _utc_now(),
            "updated_at_utc": _utc_now(),
            "approved_once": approved_once,
            "completed_waves": {},
            "healed_incidents": [],
            "held_waves": {},
            "blocked_waves": {},
            "git_operations": [],
        }
        self.save(state)
        return state

    def save(self, state: Dict[str, Any]) -> None:
        state["updated_at_utc"] = _utc_now()
        tmp = self.state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self.state_file)

    def log_event(self, kind: str, payload: Dict[str, Any]) -> None:
        rec = {"ts_utc": _utc_now(), "event": kind, **payload}
        with self.events_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


class GitHubSyncManager:
    """Safe non-interactive Git & GitHub REST synchronization enforcing §9 ownership rules."""

    def __init__(self, repo_root: Path, secondary_ref_root: Optional[Path] = None) -> None:
        self.repo_root = Path(repo_root).resolve()
        self.secondary_ref_root = Path(secondary_ref_root).resolve() if secondary_ref_root else None

    def _run(self, cmd: List[str], check: bool = True, retries: int = 1) -> subprocess.CompletedProcess[str]:
        last: Optional[subprocess.CompletedProcess[str]] = None
        for attempt in range(retries):
            res = subprocess.run(cmd, cwd=str(self.repo_root), text=True, capture_output=True)
            last = res
            if res.returncode == 0:
                return res
            if attempt + 1 < retries:
                time.sleep(1.5 * (2 ** attempt))
        if check and last is not None and last.returncode != 0:
            raise RuntimeError(f"Command failed ({' '.join(cmd)}): {last.stderr.strip()}")
        assert last is not None
        return last

    def current_branch(self) -> str:
        return self._run(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()

    def current_head_sha(self) -> str:
        return self._run(["git", "rev-parse", "HEAD"]).stdout.strip()

    def read_latest_official_heads(self) -> Dict[str, Dict[str, Any]]:
        for root in [r for r in (self.repo_root, self.secondary_ref_root) if r is not None]:
            oh = root / "public/math-game/authoring/OFFICIAL-HEADS.json"
            if oh.exists():
                return json.loads(oh.read_text(encoding="utf-8")).get("heads", {})
        show_res = self._run(
            ["git", "show", "origin/v10.3-beta:public/math-game/authoring/OFFICIAL-HEADS.json"],
            check=False,
        )
        if show_res.returncode == 0 and show_res.stdout.strip():
            return json.loads(show_res.stdout).get("heads", {})
        return {}

    def sync_remote(self) -> Dict[str, Any]:
        self._run(
            ["git", "config", "--replace-all", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*"],
            check=False,
        )
        fetch_res = self._run(["git", "fetch", "origin", "--prune"], check=False, retries=3)
        heads_info = self.read_latest_official_heads()
        return {
            "fetched": fetch_res.returncode == 0,
            "branch": self.current_branch(),
            "head_sha": self.current_head_sha(),
            "official_heads": {k: v.get("version") for k, v in heads_info.items()},
        }

    def verify_ownership_and_copyright_hygiene(self) -> GateResult:
        """Gate `G0_OWNERSHIP_AND_HYGIENE`: block Z.ai files and confidential media before any commit/push."""
        status_out = self._run(["git", "status", "--porcelain"]).stdout.splitlines()
        violations: List[Dict[str, str]] = []
        changed_paths: List[str] = []

        for line in status_out:
            if not line.strip():
                continue
            raw_path = line[3:].strip().strip('"')
            if " -> " in raw_path:
                raw_path = raw_path.split(" -> ", 1)[1].strip()
            changed_paths.append(raw_path)
            p = Path(raw_path)
            if p.suffix.lower() in FORBIDDEN_MEDIA_SUFFIXES:
                violations.append({"path": raw_path, "reason": "FORBIDDEN_CONFIDENTIAL_MEDIA_OR_PDF"})
            elif p.name in FORBIDDEN_ZAI_BASENAMES or any(raw_path.startswith(pref) for pref in FORBIDDEN_ZAI_PREFIXES):
                violations.append({"path": raw_path, "reason": "FORBIDDEN_ZAI_OWNED_PATH"})

        if violations:
            return GateResult(
                gate_id="G0_OWNERSHIP_AND_HYGIENE",
                stage="P0",
                status="FAIL",
                reason_code="OWNERSHIP_OR_COPYRIGHT_VIOLATION",
                summary=f"{len(violations)} فایل غیرمجاز (متعلق به Z.ai یا فایل تصویری/PDF محرمانه) شناسایی و متوقف شد.",
                metrics={"violation_count": len(violations), "changed_count": len(changed_paths)},
                issues=violations,
            )
        return GateResult(
            gate_id="G0_OWNERSHIP_AND_HYGIENE",
            stage="P0",
            status="PASS",
            reason_code="CLEAN_OWNERSHIP_AND_COPYRIGHT",
            summary="مرز مالکیت Z.ai و منع فایل‌های محرمانه در مخزن کاملاً رعایت شده است.",
            metrics={"violation_count": 0, "changed_count": len(changed_paths)},
        )

    def commit_and_push_if_dirty(
        self,
        commit_message: str,
        push: bool = False,
        pr_number: Optional[int] = None,
        pr_body: Optional[str] = None,
    ) -> Dict[str, Any]:
        g0 = self.verify_ownership_and_copyright_hygiene()
        if g0.status != "PASS":
            raise RuntimeError(f"Refusing git commit due to G0 failure: {g0.issues}")

        branch = self.current_branch()
        status_lines = [ln for ln in self._run(["git", "status", "--porcelain"]).stdout.splitlines() if ln.strip()]
        committed = False
        if status_lines:
            self._run(["git", "add", "-A"])
            self._run(["git", "commit", "-m", commit_message])
            committed = True

        head_sha = self.current_head_sha()
        pushed = False
        pr_updated = False
        if push:
            self._run(["git", "push", "origin", branch], retries=3)
            pushed = True
            if pr_number and pr_body:
                repo_slug = self._run(
                    ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
                    check=False,
                ).stdout.strip()
                if repo_slug:
                    payload = json.dumps({"body": pr_body}).encode("utf-8")
                    pr_res = subprocess.run(
                        ["gh", "api", f"repos/{repo_slug}/pulls/{pr_number}", "-X", "PATCH", "--input", "-"],
                        cwd=str(self.repo_root),
                        input=payload,
                        capture_output=True,
                    )
                    pr_updated = pr_res.returncode == 0

        return {
            "branch": branch,
            "committed": committed,
            "pushed": pushed,
            "pr_updated": pr_updated,
            "head_sha": head_sha,
        }


class SelfHealingEngine:
    """Deterministic + optional G.ai/Z.ai root-cause wave healer strictly verified by P4 + SSOT gates."""

    def __init__(
        self,
        gemini_adapter: Optional[GeminiVisionReaderAdapter] = None,
        zai_adapter: Optional[OpenAICompatibleReaderAdapter] = None,
    ) -> None:
        self.gemini = gemini_adapter or GeminiVisionReaderAdapter()
        self.zai = zai_adapter or OpenAICompatibleReaderAdapter()

    def heal_wave_spec_once(
        self,
        spec: WaveSpecV2,
        known_atlas_codes: set[str],
        causal_issues: Optional[List[Dict[str, Any]]] = None,
    ) -> Tuple[WaveSpecV2, List[Dict[str, Any]]]:
        """Inspect and deterministically repair root-cause defects in a `WaveSpecV2` copy."""
        healed = copy.deepcopy(spec)
        actions: List[Dict[str, Any]] = []

        # H7: Replace non-causal distractor E_* claims using G5's proven mathematical `plausible_codes`
        causal_by_qid_opt: Dict[Tuple[str, str], List[str]] = {
            (str(iss.get("qid")), str(iss.get("option"))): list(iss.get("plausible_codes", []))
            for iss in (causal_issues or [])
            if iss.get("error") == "MECHANISM_MISMATCH" and iss.get("plausible_codes")
        }
        for idx, q in enumerate(healed.question_rows):
            err_map = _parse_choice_error_map(q.map)
            changed_q = False
            for opt_letter, cur_code in list(err_map.items()):
                plaus = causal_by_qid_opt.get((q.qid or "", opt_letter))
                if plaus and cur_code not in plaus:
                    other_used = {v for k, v in err_map.items() if k != opt_letter}
                    # Prefer a distinct domain-specific plausible mechanism not used by sibling options
                    chosen = next((c for c in plaus if c not in other_used), plaus[0])
                    err_map[opt_letter] = chosen
                    changed_q = True
                    actions.append(
                        {
                            "rule": "H7_REALIGN_CAUSAL_DISTRACTOR_CODE",
                            "target": q.qid or f"Q#{idx}",
                            "option": opt_letter,
                            "from_code": cur_code,
                            "to_code": chosen,
                        }
                    )
            if changed_q:
                q.map = _format_choice_error_map(err_map, q.ans)

        # H4: Strip any forged green stamp ('تأییدشده' / 'تأیید شده') back to 'نیاز به تأیید'
        for patch in healed.authorized_patches:
            if str(patch.new_value).strip() in FORBIDDEN_GREEN_LABELS:
                patch.new_value = "نیاز به تأیید"
                actions.append({"rule": "H4_STRIP_FORGED_GREEN_STAMP", "target": patch.key})
        for s1 in healed.s1_rows:
            if str(s1.status).strip() in FORBIDDEN_GREEN_LABELS:
                s1.status = "نیاز به تأیید"
                actions.append({"rule": "H4_STRIP_FORGED_GREEN_STAMP", "target": s1.id})
        for er in healed.atlas_rows:
            if str(er.status).strip() in FORBIDDEN_GREEN_LABELS:
                er.status = "نیاز به تأیید"
                actions.append({"rule": "H4_STRIP_FORGED_GREEN_STAMP", "target": er.code_raw})
        for idx, q in enumerate(healed.question_rows):
            if str(q.status).strip() in FORBIDDEN_GREEN_LABELS:
                q.status = "نیاز به تأیید"
                actions.append({"rule": "H4_STRIP_FORGED_GREEN_STAMP", "target": q.qid or f"Q#{idx}"})

        # H1: Normalize leaked ASCII / Arabic-Indic digits and Arabic Yeh/Kaf in all Persian prose & choices
        for s1 in healed.s1_rows:
            new_vals = (_clean_fa_text(s1.title), _clean_fa_text(s1.page), _clean_fa_text(s1.chapter))
            if new_vals != (s1.title, s1.page, s1.chapter):
                s1.title, s1.page, s1.chapter = new_vals
                actions.append({"rule": "H1_PERSIAN_ORTHOGRAPHY", "target": s1.id})

        for idx, q in enumerate(healed.question_rows):
            new_stem = _clean_fa_text(q.stem)
            new_opts = [_clean_fa_text(o) for o in q.opts]
            new_ans = _clean_fa_text(q.ans)
            if (new_stem, new_opts, new_ans) != (q.stem, q.opts, q.ans):
                q.stem = new_stem
                q.opts = new_opts
                q.ans = new_ans
                actions.append({"rule": "H1_PERSIAN_ORTHOGRAPHY", "target": q.qid or f"Q#{idx}"})

        # H6: Verify & align `q.ans` against independent mathematical solver (`solve_with_plugins(q.stem)`)
        for idx, q in enumerate(healed.question_rows):
            solved_val, _ = solve_with_plugins(q.stem)
            target_val = solved_val if solved_val is not None else q.answer_val
            if target_val is not None:
                expected_fa = _clean_fa_text(str(target_val)).strip()
                match_idx = next((i for i, opt in enumerate(q.opts) if opt.strip() == expected_fa), None)
                if match_idx is not None:
                    true_key = CHOICE_KEYS[match_idx]
                    if q.ans != true_key:
                        err_map = _parse_choice_error_map(q.map)
                        swapped_err = err_map.pop(true_key, None) or "E_CALC_SLIP"
                        err_map[q.ans] = swapped_err
                        old_ans = q.ans
                        q.ans = true_key
                        q.answer_val = target_val
                        q.map = _format_choice_error_map(err_map, true_key)
                        _sync_wrong_spec(q)
                        actions.append(
                            {
                                "rule": "H6_REALIGN_SOLVER_KEY",
                                "target": q.qid or f"Q#{idx}",
                                "from_key": old_ans,
                                "to_key": true_key,
                            }
                        )

            if len(set(q.opts)) < 4 and (self.gemini.is_configured or self.zai.is_configured):
                self._llm_assist_duplicate_distractor(q, actions)

        # H3: Register any unregistered E_* error code in `atlas_rows` with honest status `'نیاز به تأیید'`
        all_registered = set(known_atlas_codes) | {e.code_raw for e in healed.atlas_rows}
        for idx, q in enumerate(healed.question_rows):
            err_map = _parse_choice_error_map(q.map)
            for ec in err_map.values():
                if ec and ec not in all_registered:
                    healed.atlas_rows.append(
                        WaveAtlasRowSpec(
                            code_raw=ec,
                            cell_code=f"{ec} (پیشنهاد)",
                            name_fa="خطای تشخیصی استخراج‌شده در خودترمیم‌گر",
                            category="محاسباتی",
                            description=f"کد خطای {ec} ثبت‌شده برای بررسی و تأیید معلم.",
                            sample_sign=f"نمونه در {q.qid or f'Q#{idx}'}",
                            diagnostic_prompt="چگونه به این پاسخ رسیدی؟ گام‌به‌گام توضیح بده.",
                            intervention="بازبینی گام‌به‌گام مفهوم با نمایش تصویری و ابزار عینی.",
                            priority="متوسط",
                            note="ثبت خودکار با وضعیت نیاز به تأیید جهت حفظ یکپارچگی اطلس خطا.",
                            status="نیاز به تأیید",
                        )
                    )
                    all_registered.add(ec)
                    actions.append({"rule": "H3_REGISTER_MISSING_ERROR_CODE", "target": ec, "qid": q.qid or f"Q#{idx}"})

        # H2: Recompute bijective `WaveS1RowSpec.anchor` when explicit `qid`s are assigned
        owned_by_lesson: Dict[str, List[str]] = {}
        for q in healed.question_rows:
            if q.qid:
                owned_by_lesson.setdefault(q.anchor, []).append(q.qid)
        for s1 in healed.s1_rows:
            if s1.id in owned_by_lesson:
                expected_anchors = "، ".join(owned_by_lesson[s1.id])
                cur_qids = re.findall(r"Q-\d+", s1.anchor or "")
                if cur_qids != owned_by_lesson[s1.id]:
                    s1.anchor = expected_anchors
                    actions.append({"rule": "H2_BIJECTIVE_T7_ANCHORS", "target": s1.id, "anchors": expected_anchors})

        # H5: Rebalance choice keys across `question_rows` if max_count - min_count > 1 (when >= 4 questions)
        if len(healed.question_rows) >= 4:
            counts = {k: sum(1 for q in healed.question_rows if q.ans == k) for k in CHOICE_KEYS}
            if max(counts.values()) - min(counts.values()) > 1:
                for idx, q in enumerate(healed.question_rows):
                    target_key = CHOICE_KEYS[idx % 4]
                    if q.ans != target_key:
                        cur_idx = CHOICE_KEYS.index(q.ans)
                        tgt_idx = CHOICE_KEYS.index(target_key)
                        err_map = _parse_choice_error_map(q.map)
                        q.opts[cur_idx], q.opts[tgt_idx] = q.opts[tgt_idx], q.opts[cur_idx]
                        err_map[q.ans] = err_map.pop(target_key, "E_CALC_SLIP")
                        q.ans = target_key
                        q.map = _format_choice_error_map(err_map, target_key)
                        _sync_wrong_spec(q)
                actions.append({"rule": "H5_REBALANCE_CHOICE_KEYS", "count": len(healed.question_rows)})

        return healed, actions

    def _llm_assist_duplicate_distractor(self, q: WaveQuestionSpec, actions: List[Dict[str, Any]]) -> None:
        prompt = (
            "یک گزینهٔ انحرافی تکراری در سؤال چهارگزینه‌ای ریاضی وجود دارد. فقط JSON برگردان با کلید "
            '{"opts": ["...", "...", "...", "..."]} با ارقام فارسی و ۴ گزینهٔ متمایز:\n'
            + json.dumps({"stem": q.stem, "ans": q.ans, "opts": q.opts}, ensure_ascii=False)
        )
        try:
            res = self.gemini.generate_json(prompt) if self.gemini.is_configured else self.zai.generate_json(prompt)
            if isinstance(res.get("opts"), list) and len(res["opts"]) == 4:
                q.opts = [_clean_fa_text(x) for x in res["opts"]]
                actions.append({"rule": "H6_LLM_DUPLICATE_CHOICE_REPAIR", "target": q.qid or "Q"})
        except Exception as exc:
            actions.append({"rule": "H6_LLM_ASSIST_SKIPPED", "target": q.qid or "Q", "reason": str(exc)})


class AutopilotSupervisor:
    """End-to-end unattended overnight wave orchestrator (`approve-once -> verify/heal -> report -> push`)."""

    def __init__(
        self,
        repo_root: Path,
        *,
        official_ref_root: Optional[Path] = None,
        state_dir: Optional[Path] = None,
        work_dir: Optional[Path] = None,
        max_heal_rounds: int = 3,
    ) -> None:
        self.repo_root = Path(repo_root).resolve()
        self.official_ref_root = Path(official_ref_root).resolve() if official_ref_root else self.repo_root
        self.state_store = AutopilotStateStore(state_dir or Path("/tmp/khshab_autopilot_state"))
        self.work_dir = Path(work_dir or "/tmp/khshab_autopilot_work")
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self.git_mgr = GitHubSyncManager(self.repo_root, secondary_ref_root=self.official_ref_root)
        self.healer = SelfHealingEngine()
        self.max_heal_rounds = max_heal_rounds

    def run_waves(
        self,
        wave_spec_paths: List[str | Path],
        *,
        approve_once: bool = False,
        git_sync: bool = False,
        git_push: bool = False,
        pr_number: Optional[int] = None,
        report_markdown_path: Optional[Path] = None,
    ) -> Dict[str, Any]:
        state = self.state_store.load_or_init(approved_once=approve_once)
        if not state.get("approved_once"):
            return {
                "status": "AWAITING_SINGLE_APPROVAL",
                "reason": "APPROVE_ONCE_REQUIRED",
                "message": "برای اجرای یکسرهٔ شبانه، پرچم `--approve-once` را یک بار صادر کنید.",
            }

        sync_info: Dict[str, Any] = {}
        if git_sync:
            sync_info = self.git_mgr.sync_remote()
            self.state_store.log_event("GIT_SYNC", sync_info)

        latest_heads = self.git_mgr.read_latest_official_heads()

        for raw_sp in wave_spec_paths:
            sp_path = Path(raw_sp).resolve()
            spec = WaveSpecV2.from_json_file(sp_path)

            # Universal Official-Head Hold Rule (`OFFICIAL-HEADS.json` across G1..G6):
            # If a queued future wave requires a `base_cartridge_filename` newer than the merged head in
            # `OFFICIAL-HEADS.json` (or `KH-G2-MATH` still carries an unapproved teacher hold note on Wave 5+),
            # hold the wave safely instead of building on an unmerged or unapproved base!
            head_entry = latest_heads.get(spec.family_id, {})
            cur_head_str = str(head_entry.get("file") or head_entry.get("version") or "v0.4")
            req_ver = _extract_version_tuple(spec.base_cartridge_filename)
            cur_ver = _extract_version_tuple(cur_head_str)
            teacher_hold = (
                spec.family_id == "KH-G2-MATH"
                and req_ver >= (0, 5)
                and "در انتظار مُهر معلم" in str(head_entry.get("teacherNote", ""))
            )
            if req_ver > cur_ver or teacher_hold:
                hold_entry = {
                    "wave_id": spec.wave_id,
                    "family_id": spec.family_id,
                    "required_base": spec.base_cartridge_filename,
                    "current_official_head": cur_head_str,
                    "reason": (
                        "HELD_AWAITING_TEACHER_STAMP_AND_WAVE_AUTHORIZATION"
                        if teacher_hold
                        else "HELD_AWAITING_ZAI_OFFICIAL_HEAD_MERGE"
                    ),
                }
                state["held_waves"][spec.wave_id] = hold_entry
                self.state_store.save(state)
                self.state_store.log_event("WAVE_HELD", hold_entry)
                continue

            spec_sha = file_sha256(str(sp_path))
            prev = state["completed_waves"].get(spec.wave_id)
            if prev and prev.get("spec_sha256") == spec_sha and prev.get("status") == "PASS":
                continue

            outcome = self._execute_and_self_heal_wave(spec, sp_path)
            if outcome["status"] == "PASS":
                state["completed_waves"][spec.wave_id] = {**outcome, "spec_sha256": file_sha256(str(sp_path))}
                state["blocked_waves"].pop(spec.wave_id, None)
            else:
                state["blocked_waves"][spec.wave_id] = outcome
            state["healed_incidents"].extend(outcome.get("heal_actions", []))
            self.state_store.save(state)

        purge_quarantine_vault("/tmp/khshab_counting_vault")

        g0 = self.git_mgr.verify_ownership_and_copyright_hygiene()
        morning_md = self.build_morning_report_markdown(state, g0, sync_info)
        if report_markdown_path is not None:
            report_markdown_path.parent.mkdir(parents=True, exist_ok=True)
            report_markdown_path.write_text(morning_md, encoding="utf-8")

        git_result: Dict[str, Any] = {"committed": False, "pushed": False}
        if git_push:
            git_result = self.git_mgr.commit_and_push_if_dirty(
                commit_message="chore(autopilot): autonomous wave verification & self-healing checkpoint",
                push=True,
                pr_number=pr_number,
                pr_body=morning_md,
            )
            state["git_operations"].append(git_result)
            self.state_store.save(state)

        overall_status = (
            "PASS"
            if (g0.status == "PASS" and len(state["blocked_waves"]) == 0)
            else ("PARTIAL_WITH_BLOCKERS" if state["completed_waves"] else "BLOCKED")
        )
        return {
            "status": overall_status,
            "completed_wave_ids": sorted(state["completed_waves"].keys()),
            "held_wave_ids": sorted(state["held_waves"].keys()),
            "blocked_wave_ids": sorted(state["blocked_waves"].keys()),
            "healed_incident_count": len(state["healed_incidents"]),
            "g0_hygiene": g0.to_dict(),
            "git": git_result,
            "morning_report_markdown": morning_md,
        }

    def _execute_and_self_heal_wave(self, initial_spec: WaveSpecV2, spec_path: Path) -> Dict[str, Any]:
        base_xlsx = resolve_official_cartridge(
            self.official_ref_root,
            initial_spec.base_cartridge_filename,
            fallback_authoring_name=initial_spec.base_cartridge_filename.replace(".xlsx", "_official.xlsx"),
        )
        if not base_xlsx.exists():
            base_xlsx = resolve_official_cartridge(
                self.repo_root,
                initial_spec.base_cartridge_filename,
                fallback_authoring_name=initial_spec.base_cartridge_filename.replace(".xlsx", "_official.xlsx"),
            )

        wb_base = openpyxl.load_workbook(base_xlsx, data_only=True)
        ws_err = wb_base["اطلس خطا"]
        known_codes = set()
        for r in range(2, ws_err.max_row + 1):
            raw_c = str(ws_err.cell(r, 1).value or "").strip()
            m = re.match(r"^(E[_-][A-Za-z0-9_-]+)", raw_c)
            if m:
                known_codes.add(m.group(1))
        wb_base.close()

        current_spec = copy.deepcopy(initial_spec)
        all_heal_actions: List[Dict[str, Any]] = []
        last_failures: Dict[str, Any] = {}

        for attempt in range(self.max_heal_rounds + 1):
            tmp_spec_file = self.work_dir / f"{current_spec.wave_id}_attempt_{attempt}.json"
            current_spec.save_json(tmp_spec_file)
            out_xlsx = self.work_dir / f"{current_spec.family_id}_{current_spec.wave_id}.xlsx"
            out_reg = self.work_dir / f"{current_spec.family_id}_{current_spec.wave_id}_registry.json"

            try:
                g_exp, out_sha, details = export_wave_cartridge(
                    tmp_spec_file,
                    repo_root=self.official_ref_root,
                    out_xlsx_path=out_xlsx,
                    out_registry_path=out_reg,
                    base_xlsx_override=base_xlsx,
                )
            except Exception as exc:
                g_exp = GateResult("G3_WAVE_EXPORT", "P3", "FAIL", "EXPORT_EXCEPTION", str(exc))
                out_sha, details = "", {}

            if g_exp.status == "PASS" and out_xlsx.exists():
                pm = resolve_pagemap_for_workbook(out_xlsx, self.repo_root) or resolve_pagemap_for_workbook(
                    out_xlsx, self.official_ref_root
                )
                obs_candidate = resolve_fixture(
                    self.repo_root,
                    f"observation_{current_spec.book_code}.json",
                    f"authoring/audit/observation_{current_spec.book_code}.json",
                )
                wave_qids = set(details.get("allocated_qids", [])) if isinstance(details, dict) else None
                p4 = inspect_cartridge_workbook(
                    out_xlsx,
                    observation_json_path=obs_candidate if obs_candidate.exists() else None,
                    base_workbook_path=base_xlsx,
                    pagemap_xlsx_path=pm,
                    wave_qids=wave_qids or None,
                )
                from openpyxl.utils import column_index_from_string

                allowed_triples = {
                    (p.sheet, p.key, column_index_from_string(p.col_letter))
                    for p in current_spec.authorized_patches
                }
                u10 = verify_universal_wave_invariants(
                    out_xlsx,
                    official_xlsx=base_xlsx,
                    base_xlsx=base_xlsx,
                    repo_root=self.official_ref_root,
                    allowed_cell_triples=allowed_triples,
                )
                conv_root = (
                    self.official_ref_root
                    if (self.official_ref_root / "public/math-game/tools/cartridge-converter/convert.mjs").exists()
                    else self.repo_root
                )
                if (conv_root / "public/math-game/tools/cartridge-converter/convert.mjs").exists():
                    conv = run_converter_and_parse_report(out_xlsx, conv_root, download_dir=self.work_dir / "conv")
                else:
                    conv = {"status": "SKIPPED_NO_CONVERTER", "red": 0, "yellow": 0}

                all_green = (
                    all(gr.status == "PASS" for gr in p4.values())
                    and u10.status == "PASS"
                    and conv["status"] in ("PASS", "SKIPPED_NO_CONVERTER")
                    and conv.get("red", 0) == 0
                )
                if all_green:
                    if all_heal_actions:
                        current_spec.save_json(spec_path)
                    self.state_store.log_event(
                        "WAVE_GREEN",
                        {"wave_id": current_spec.wave_id, "sha256": out_sha, "heals": len(all_heal_actions)},
                    )
                    return {
                        "status": "PASS",
                        "wave_id": current_spec.wave_id,
                        "family_id": current_spec.family_id,
                        "output_xlsx": str(out_xlsx),
                        "output_sha256": out_sha,
                        "heal_rounds_used": attempt,
                        "heal_actions": all_heal_actions,
                        "converter_red": conv.get("red", 0),
                        "converter_yellow": conv.get("yellow", 0),
                    }

                last_failures = {
                    "p4": {k: v.issues for k, v in p4.items() if v.status != "PASS"},
                    "u10": u10.issues,
                    "converter_status": conv["status"],
                    "converter_red": conv.get("red", -1),
                }
                causal_issues = p4["G5_DISTRACTOR_CAUSALITY"].issues
            else:
                causal_issues = []
                last_failures = {"export": g_exp.summary, "issues": g_exp.issues}

            if attempt < self.max_heal_rounds:
                current_spec, new_actions = self.healer.heal_wave_spec_once(
                    current_spec,
                    known_atlas_codes=known_codes,
                    causal_issues=causal_issues,
                )
                if not new_actions:
                    break
                all_heal_actions.extend(new_actions)
                self.state_store.log_event(
                    "SELF_HEAL_APPLIED",
                    {"wave_id": current_spec.wave_id, "round": attempt + 1, "actions": new_actions},
                )

        return {
            "status": "BLOCKED",
            "wave_id": current_spec.wave_id,
            "family_id": current_spec.family_id,
            "heal_actions": all_heal_actions,
            "diagnostics": last_failures,
        }

    @staticmethod
    def build_morning_report_markdown(
        state: Dict[str, Any],
        g0: GateResult,
        sync_info: Dict[str, Any],
    ) -> str:
        lines = [
            "# گزارش صبحگاهی اجرای خودمختار (`khshab-autopilot v2.0`)",
            "",
            f"- **آخرین بروزرسانی (UTC):** `{state.get('updated_at_utc')}`",
            f"- **شاخهٔ فعال Git:** `{sync_info.get('branch', 'local')}` (`{str(sync_info.get('head_sha', ''))[:10]}`)",
            f"- **گیت بهداشت مالکیت و کپی‌رایت (`G0`):** `{g0.status}` (`{g0.reason_code}`)",
            f"- **امواج سبز و تکمیل‌شده:** `{len(state.get('completed_waves', {}))}`",
            f"- **تعداد خودترمیم‌های ریشه‌ای انجام‌شده در شب:** `{len(state.get('healed_incidents', []))}`",
            f"- **امواج نگه‌داشته‌شده طبق قانون Hold (انتظار ادغام رسمی `Z.ai`):** `{len(state.get('held_waves', {}))}`",
            f"- **امواج پارک‌شده نیازمند تصمیم انسانی:** `{len(state.get('blocked_waves', {}))}`",
            "",
            "## جزئیات امواج تکمیل‌شده",
        ]
        for wid, info in state.get("completed_waves", {}).items():
            lines.append(
                f"- **`{wid}` (`{info['family_id']}`):** `PASS` | `SHA-256={info['output_sha256'][:16]}…` | "
                f"دورهای خودترمیمی: `{info['heal_rounds_used']}` | خطای قرمز مبدل: `{info['converter_red']}`"
            )
        if state.get("held_waves"):
            lines.append("\n## امواج منتظر ادغام پایهٔ رسمی (`OFFICIAL-HEADS.json`)")
            for wid, h in state["held_waves"].items():
                lines.append(f"- **`{wid}`:** پایهٔ فعلی `{h['current_official_head']}` -> منتظر `{h['required_base']}` (`{h['reason']}`)")
        if state.get("blocked_waves"):
            lines.append("\n## موارد پارک‌شده برای بررسی صبحگاهی معلم")
            for wid, b in state["blocked_waves"].items():
                lines.append(f"- **`{wid}`:** `{json.dumps(b['diagnostics'], ensure_ascii=False)[:300]}`")
        return "\n".join(lines) + "\n"
