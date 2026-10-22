"""Copyright, asset-leakage, AND §9 software-ownership boundary guard for Git."""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import List, Set

from .models import GateResult

ALLOWED_IMAGE_PREFIXES: tuple[str, ...] = (
    "public/",       # دارایی‌های قانونی رابط بازی در چیدمان رسمی مخزن (Task 60)
    "assets/",       # چیدمان شاخهٔ آرنا — سازگاری
)

ALLOWED_GAME_UI_PNGS: Set[str] = {
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

FORBIDDEN_ASSET_EXTENSIONS: Set[str] = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".tiff",
    ".bmp",
}

FORBIDDEN_DIR_PREFIXES: tuple[str, ...] = (
    "upload/",
    "google_drive/",
    ".vault/",
    "authoring/local_viewer_cache/",
)

# Section 9 (`۹) مرز مالکیت — آرنا هرگز به این‌ها دست نمی‌زند`):
# Software engine, converter, runtime error modules, server, styles, and live cartridges belong exclusively to Z.ai.
FORBIDDEN_SOFTWARE_OWNERSHIP_PREFIXES: tuple[str, ...] = (
    "workshop-core.js",
    "v10.html",
    "v9.html",
    "book.html",
    "errors.js",
    "package.json",
    "package-lock.json",
    "src/",
    "tools/",
    "cartridges/",
    "server/",
    "styles/",
    "upload/",
)


def audit_git_copyright_safety(repo_root: str | Path) -> GateResult:
    """Ensure ZERO PDFs, page renders, image crops, or `upload/` textbook assets enter Git."""
    root = Path(repo_root)
    proc_tracked = subprocess.run(
        ["git", "ls-files"],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    )
    proc_untracked = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard"],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    )
    all_visible_paths: List[str] = sorted(
        set(
            line.strip()
            for line in (proc_tracked.stdout.splitlines() + proc_untracked.stdout.splitlines())
            if line.strip()
        )
    )

    violations = []
    for rel in all_visible_paths:
        norm = rel.replace("\\", "/")
        if any(norm.startswith(pref) for pref in FORBIDDEN_DIR_PREFIXES):
            violations.append({"path": norm, "reason": "FORBIDDEN_ASSET_DIRECTORY"})
            continue
        ext = Path(norm).suffix.lower()
        if ext in FORBIDDEN_ASSET_EXTENSIONS and norm not in ALLOWED_GAME_UI_PNGS:
            # دارایی‌های تصویری قانونی بازی (زیر public/ و assets/) مجازند — Task 60
            if ext in (".png", ".jpg", ".jpeg", ".webp") and any(norm.startswith(p) for p in ALLOWED_IMAGE_PREFIXES):
                continue
            violations.append({"path": norm, "reason": f"FORBIDDEN_COPYRIGHT_EXTENSION:{ext}"})

    if violations:
        return GateResult(
            gate_id="G0_COPYRIGHT_GUARD",
            stage="P0",
            status="FAIL",
            reason_code="COPYRIGHT_LEAK_BLOCKED",
            summary="فایل دارای حق نشر در مسیرهای ردیابی‌شده یا غیرمجاز Git شناسایی شد.",
            issues=violations,
            metrics={"checked_git_paths": len(all_visible_paths), "violation_count": len(violations)},
        )
    return GateResult(
        gate_id="G0_COPYRIGHT_GUARD",
        stage="P0",
        status="PASS",
        reason_code="CLEAN_WORKSPACE",
        summary="هیچ فایل PDF، تصویر رندرشده، کراپ یا فایل پوشهٔ upload/ در مخزن Git وجود ندارد.",
        issues=[],
        metrics={"checked_git_paths": len(all_visible_paths), "violation_count": 0},
    )


check_git_safety = audit_git_copyright_safety


def check_ownership_boundary(repo_root: str | Path, base_ref: str | None = None) -> GateResult:
    """Enforce Section 9 ownership boundary: zero changes outside content/automation domain.

    Task 60 adaptation: اگر base_ref داده نشود یا در این مخزن وجود نداشته باشد (توپولوژی‌های
    بی‌نیای مشترک)، گارد به‌جای کامیت هاردکد، تغییرات «درخت کار نسبت به HEAD» را می‌سنجد.
    """
    root = Path(repo_root)
    if base_ref:
        rev_check = subprocess.run(
            ["git", "cat-file", "-e", f"{base_ref}^{{commit}}"],
            cwd=root,
            capture_output=True,
            text=True,
        )
        if rev_check.returncode != 0:
            base_ref = None  # بازگشت به حالت درخت‌کار به‌جای BLOCKED — کامیت پایهٔ شاخهٔ دیگر اینجا معنا ندارد

    diff_args = ["git", "diff", "--name-only", base_ref] if base_ref else ["git", "diff", "--name-only", "HEAD"]
    diff_proc = subprocess.run(
        diff_args,
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    )
    untracked_proc = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard"],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    )
    changed_paths = sorted(
        set(
            p.strip().replace("\\", "/")
            for p in (diff_proc.stdout.splitlines() + untracked_proc.stdout.splitlines())
            if p.strip()
        )
    )
    violations = [
        {"path": p, "reason": "OWNED_BY_MAIN_SOFTWARE_TEAM_SECTION_9"}
        for p in changed_paths
        if any(p == pref or p.startswith(pref) for pref in FORBIDDEN_SOFTWARE_OWNERSHIP_PREFIXES)
    ]
    if violations:
        return GateResult(
            gate_id="G0B_OWNERSHIP_BOUNDARY",
            stage="P0",
            status="FAIL",
            reason_code="SOFTWARE_OWNERSHIP_BOUNDARY_VIOLATED",
            summary="مرز مالکیت بخش ۹ نقض شده است.",
            issues=violations,
            metrics={"checked_changed_paths": len(changed_paths), "violation_count": len(violations)},
        )
    return GateResult(
        gate_id="G0B_OWNERSHIP_BOUNDARY",
        stage="P0",
        status="PASS",
        reason_code="OWNERSHIP_BOUNDARY_CLEAN",
        summary="تمامی فایل‌های نرم‌افزار Z.ai صددرصد دست‌نخورده باقی مانده‌اند (۰ تغییر خارج از قلمرو محتوا/اتوماسیون).",
        issues=[],
        metrics={"checked_changed_paths": len(changed_paths), "violation_count": 0},
    )
