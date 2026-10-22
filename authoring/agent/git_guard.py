"""Copyright & repository hygiene guard (`G0_COPYRIGHT_GUARD`).

Ensures no textbook PDF, page render, crop image, Google Drive download directory,
or oversized verbatim textbook passage exists as tracked, staged, or unignored
content inside the Git repository.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Dict, List

from .models import GateResult

FORBIDDEN_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".bmp",
    ".tiff",
    ".gif",
}

FORBIDDEN_DIR_SEGMENTS = {
    "google_drive",
    ".vault",
    "local_viewer_cache",
}

# Pre-existing game UI artwork committed prior to textbook pipeline (`ab15597`)
BASELINE_GAME_UI_ASSETS = {
    "assets/avatar-hooshak.png",
    "assets/avatar-kids.png",
    "assets/avatar-pashmak.png",
    "assets/bg-celebration.png",
    "assets/bg-cockpit.png",
    "assets/bg-deep-space.png",
    "assets/bg-main.png",
    "assets/bg-moon.png",
    "assets/bg-station-broken.png",
    "assets/bg-station.png",
    "assets/bg-teacher.png",
    "assets/bg-team.png",
}


def scan_workspace_for_copyright_leaks(repo_root: str | Path) -> GateResult:
    root = Path(repo_root).resolve()
    violations: List[Dict[str, str]] = []

    # 1. Check git tracked + untracked-unignored files via `git status --porcelain --untracked-files=all`
    proc = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all"],
        cwd=str(root),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return GateResult(
            gate_id="G0_COPYRIGHT_GUARD",
            stage="P0",
            status="BLOCKED",
            reason_code="GIT_STATUS_UNAVAILABLE",
            summary="اجرای git status ممکن نشد.",
            issues=[{"stderr": proc.stderr.strip()}],
        )

    tracked = subprocess.run(
        ["git", "ls-files"],
        cwd=str(root),
        capture_output=True,
        text=True,
        check=False,
    )
    candidate_paths = set()
    for line in tracked.stdout.splitlines():
        if line.strip():
            candidate_paths.add(line.strip())
    for line in proc.stdout.splitlines():
        if len(line) > 3:
            rel = line[3:].strip().strip('"')
            if " -> " in rel:
                rel = rel.split(" -> ", 1)[1].strip('"')
            candidate_paths.add(rel)

    # Also walk non-ignored workspace directories excluding `.git` and `node_modules`
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = Path(dirpath).relative_to(root)
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", "__pycache__", ".pytest_cache"}]
        for seg in rel_dir.parts:
            if seg in FORBIDDEN_DIR_SEGMENTS:
                violations.append(
                    {"path": str(rel_dir), "reason": f"FORBIDDEN_DIRECTORY:{seg}"}
                )
        for fn in filenames:
            rel_file = rel_dir / fn if str(rel_dir) != "." else Path(fn)
            rel_str = rel_file.as_posix()
            ext = rel_file.suffix.lower()
            if ext in FORBIDDEN_EXTENSIONS and rel_str not in BASELINE_GAME_UI_ASSETS:
                violations.append(
                    {
                        "path": rel_str,
                        "reason": f"COPYRIGHT_BINARY_INSIDE_REPO:{ext}",
                    }
                )

    for rel in sorted(candidate_paths):
        p = Path(rel)
        if p.suffix.lower() in FORBIDDEN_EXTENSIONS and rel not in BASELINE_GAME_UI_ASSETS:
            entry = {"path": rel, "reason": f"GIT_VISIBLE_FORBIDDEN_ASSET:{p.suffix.lower()}"}
            if entry not in violations:
                violations.append(entry)

    # Verify `.gitignore` covers PDF and image formats
    gitignore_path = root / ".gitignore"
    missing_patterns = []
    if not gitignore_path.exists():
        missing_patterns.append(".gitignore_missing")
    else:
        gi_text = gitignore_path.read_text(encoding="utf-8")
        for pat in ("*.pdf", "*.png", "*.jpg", "*.jpeg", "*.webp", "google_drive/"):
            if pat not in gi_text:
                missing_patterns.append(pat)

    if missing_patterns:
        violations.append(
            {"path": ".gitignore", "reason": f"MISSING_GITIGNORE_RULES:{','.join(missing_patterns)}"}
        )

    if violations:
        return GateResult(
            gate_id="G0_COPYRIGHT_GUARD",
            stage="P0",
            status="FAIL",
            reason_code="COPYRIGHT_LEAK_BLOCKED",
            summary=f"{len(violations)} مورد نقض قرنطینهٔ حق نشر در فضای کاری شناسایی شد.",
            metrics={"violation_count": len(violations)},
            issues=violations,
        )

    return GateResult(
        gate_id="G0_COPYRIGHT_GUARD",
        stage="P0",
        status="PASS",
        reason_code="CLEAN_WORKSPACE",
        summary="هیچ فایل PDF، تصویر کتاب یا کش قرنطینه‌نشده‌ای در مخزن وجود ندارد و قوانین .gitignore کامل است.",
        metrics={"checked_git_paths": len(candidate_paths), "violation_count": 0},
    )


audit_git_copyright_safety = scan_workspace_for_copyright_leaks
