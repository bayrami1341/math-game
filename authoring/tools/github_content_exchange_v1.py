"""Fail-closed, read-only GitHub intake and redacted assessment package (M0).

No PR merge, push, claim of reviewer authentication, educational approval, or release.
Input must be a pinned commit reachable from an explicit remote branch and an
independently supplied workbook SHA. Git operations occur only in a temporary
bare repository outside the working tree; this module never changes Git refs in
this checkout. With no rights/reviewed Achilles receipt, do not run live intake.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path, PurePosixPath

from content_library_intake import ROOT, digest, ingest

GITHUB_REMOTE = "https://github.com/bayrami1341/math-game.git"
COMMIT = re.compile(r"[0-9a-f]{40}")
SHA256 = re.compile(r"[0-9a-f]{64}")
REF = re.compile(r"refs/heads/[A-Za-z0-9][A-Za-z0-9/_-]*")
MAX_WORKBOOK = 25 * 1024 * 1024
MAX_RECEIPT = 256 * 1024


def _git(*args: str, cwd: Path | None = None, data: bytes | None = None) -> bytes:
    result = subprocess.run(["git", *args], cwd=cwd, input=data, capture_output=True, check=False)
    if result.returncode:
        raise ValueError("GIT_SOURCE_UNAVAILABLE:" + result.stderr.decode("utf-8", "replace")[:300])
    return result.stdout


def _path(text: str, suffix: str) -> str:
    if not isinstance(text, str) or "\\" in text or ":" in text or "\x00" in text:
        raise ValueError("UNSAFE_SOURCE_PATH")
    path = PurePosixPath(text)
    if (path.is_absolute() or ".." in path.parts or "." in path.parts
            or not text.startswith("authoring/content-exchange/incoming/")
            or not text.endswith(suffix) or path.as_posix() != text):
        raise ValueError("UNSAFE_SOURCE_PATH")
    return text


def _sha(value: str, label: str) -> str:
    if not isinstance(value, str) or not SHA256.fullmatch(value):
        raise ValueError("INVALID_" + label)
    return value


def _blob(git_dir: Path, commit: str, path: str, limit: int) -> bytes:
    obj = f"{commit}:{path}"
    kind = _git("--git-dir=" + str(git_dir), "cat-file", "-t", obj).strip()
    if kind != b"blob":
        raise ValueError("NOT_A_FILE:" + path)
    size = int(_git("--git-dir=" + str(git_dir), "cat-file", "-s", obj).strip())
    if size > limit:
        raise ValueError("SOURCE_TOO_LARGE:" + path)
    return _git("--git-dir=" + str(git_dir), "show", obj)


def fetch_pinned(*, producer_ref: str, producer_commit: str, workbook_path: str,
                 receipt_path: str, expected_sha256: str, out_dir: Path,
                 rights_decision_ref: str, remote: str = GITHUB_REMOTE) -> dict:
    """Fetch immutable bytes; archive via existing standard-XLSX intake.

    `remote` is injectable for isolated synthetic tests; the CLI always fixes it
    to GITHUB_REMOTE. A receipt is an *attestation* even when its claims match
    the bytes: this does not authenticate reviewers or verify the textbook.
    """
    # Git fetch may TRANSFER workbook objects even before git show is called.
    # Require an independently supplied rights decision reference before fetch.
    # This compares declarations; human/organizational authentication is external.
    if not isinstance(rights_decision_ref, str) or not rights_decision_ref.strip():
        raise ValueError("EXTERNAL_RIGHTS_DECISION_REQUIRED_BEFORE_FETCH")
    if not isinstance(producer_ref, str) or not REF.fullmatch(producer_ref) or "//" in producer_ref:
        raise ValueError("INVALID_PRODUCER_REF")
    if not isinstance(producer_commit, str) or not COMMIT.fullmatch(producer_commit):
        raise ValueError("PINNED_FULL_COMMIT_REQUIRED")
    _sha(expected_sha256, "EXPECTED_SHA256")
    workbook_path = _path(workbook_path, "/extraction-snapshot.xlsx")
    receipt_path = _path(receipt_path, "/extraction-receipt.json")
    if PurePosixPath(workbook_path).parent != PurePosixPath(receipt_path).parent:
        raise ValueError("RECEIPT_WORKBOOK_DIRECTORY_MISMATCH")
    out_dir = out_dir.resolve()
    if out_dir == ROOT or ROOT in out_dir.parents:
        raise ValueError("PRIVATE_ARCHIVE_MUST_BE_OUTSIDE_REPOSITORY")
    with tempfile.TemporaryDirectory(prefix="github-content-intake-") as temp:
        work = Path(temp)
        bare = work / "source.git"
        _git("init", "--bare", "--quiet", str(bare))
        # Fetch one advertised ref, not HEAD. No working-tree/ref mutation in this checkout.
        _git("--git-dir=" + str(bare), "fetch", "--no-tags", "--quiet", remote,
             "+" + producer_ref + ":refs/heads/pinned-source")
        reachable = subprocess.run(["git", "--git-dir=" + str(bare), "merge-base", "--is-ancestor",
                                    producer_commit, "refs/heads/pinned-source"], capture_output=True)
        if reachable.returncode:
            raise ValueError("PINNED_COMMIT_NOT_REACHABLE_FROM_PRODUCER_REF")
        actual_commit = _git("--git-dir=" + str(bare), "rev-parse", "--verify",
                             producer_commit + "^{commit}").strip().decode("ascii")
        if actual_commit != producer_commit:
            raise ValueError("PINNED_COMMIT_MISMATCH")
        # Inspect rights/approval attestation before reading any workbook blob.
        receipt_raw = _blob(bare, producer_commit, receipt_path, MAX_RECEIPT)
        try:
            receipt = json.loads(receipt_raw)
        except (ValueError, UnicodeDecodeError) as exc:
            raise ValueError("INVALID_ACHILLES_RECEIPT_JSON") from exc
        if not isinstance(receipt, dict):
            raise ValueError("INVALID_ACHILLES_RECEIPT_JSON")
        # Matching text is not cryptographic proof of reviewer identity/rights.
        expected = {"schema": "achilles-extraction-bundle/v1", "producer": "ACHILLES",
                    "approval_status": "EXTRACTION_VERIFIED", "repo_path": workbook_path,
                    "workbook_sha256": expected_sha256,
                    "storage_rights_status": "REVIEWED_FOR_PRIVATE_REPO"}
        if any(receipt.get(k) != v for k, v in expected.items()) or receipt.get("rights_decision_ref") != rights_decision_ref:
            raise ValueError("ACHILLES_RECEIPT_OR_RIGHTS_MISMATCH")
        for key in ("extraction_scope", "decision_ref", "rights_decision_ref", "evidence_manifest_sha",
                    "book_source_sha256", "verified_by"):
            if not isinstance(receipt.get(key), str) or not receipt[key].strip():
                raise ValueError("MISSING_ACHILLES_RECEIPT_FIELD:" + key)
        _sha(receipt["evidence_manifest_sha"], "EVIDENCE_SHA")
        _sha(receipt["book_source_sha256"], "BOOK_SOURCE_SHA")
        expected_dir = f"authoring/content-exchange/incoming/G2/{receipt.get('book_id')}/{receipt.get('edition_id')}/{expected_sha256}"
        if str(PurePosixPath(workbook_path).parent) != expected_dir:
            raise ValueError("SOURCE_NOT_CONTENT_ADDRESSED")
        # A receipt committed with the workbook cannot name its OWN enclosing
        # Git commit (self-referential hash). The pinned commit lives in the
        # external intake lineage and downstream assessment manifest instead.
        if "git_commit" in receipt:
            raise ValueError("SELF_REFERENTIAL_RECEIPT_COMMIT")
        # Receipt assertion is not independent legal verification; no workbook
        # blob is read at all if it fails the declared rights/approval gate.
        raw = _blob(bare, producer_commit, workbook_path, MAX_WORKBOOK)
        sha = hashlib.sha256(raw).hexdigest()
        if sha != expected_sha256:
            raise ValueError("PINNED_WORKBOOK_SHA_MISMATCH")
        # Only within this private temp directory until receipt/hash/rights gates pass.
        workbook = work / "approved.xlsx"
        workbook.write_bytes(raw)
        result = ingest(workbook, receipt, out_dir)
    return {"schema": "arena-github-intake/v1", "producer_ref": producer_ref,
            "producer_commit": producer_commit, "repo_path": workbook_path,
            "receipt_path": receipt_path, "receipt_sha256": hashlib.sha256(receipt_raw).hexdigest(),
            "workbook_sha256": sha, "archive_status": result["status"],
            "approval_trust": "RECEIPT_ATTESTED_NOT_CRYPTOGRAPHICALLY_AUTHENTICATED",
            "rights_trust": "RECEIPT_ATTESTED_NOT_INDEPENDENTLY_VERIFIED",
            "content_acceptance": "PENDING_ARENA_ASSESSMENT_AND_HUMAN_DECISION",
            "release_authorization": "NOT_GRANTED", "book_id": result["book_id"],
            "edition_id": result["edition_id"], "achilles_receipt_id": result["achilles_receipt_id"],
            "assessment_file": result["assessment_file"]}


def redacted_package(lineage: dict, archive_dir: Path) -> tuple[dict, dict]:
    """Create a text-free sidecar + manifest; callers review before Git add/commit.

    This is NOT the six-factor assessment or a playable experience. No raw Excel,
    question text, guide text, or private archive path is serialized to GitHub.
    """
    if lineage.get("schema") != "arena-github-intake/v1" or lineage.get("release_authorization") != "NOT_GRANTED":
        raise ValueError("INVALID_INTAKE_LINEAGE")
    sha = _sha(lineage.get("workbook_sha256"), "WORKBOOK_SHA")
    for key in ("book_id", "edition_id"):
        if not isinstance(lineage.get(key), str) or not re.fullmatch(r"[A-Za-z0-9_-]+", lineage[key]):
            raise ValueError("UNSAFE_PACKAGE_NAMESPACE")
    name = lineage.get("assessment_file")
    if not isinstance(name, str) or not re.fullmatch(r"assessment-[0-9a-f]{64}\.json", name):
        raise ValueError("UNSAFE_ASSESSMENT_NAME")
    base = archive_dir.resolve() / lineage["book_id"] / lineage["edition_id"] / sha
    index_file = base / "index.json"
    assessment_file = base / name
    if (not index_file.is_file() or not assessment_file.is_file()
            or digest(assessment_file) != name.removeprefix("assessment-").removesuffix(".json")
            or digest(base / "approved.xlsx") != sha):
        raise ValueError("PRIVATE_ARCHIVE_MISSING_OR_DRIFTED")
    index = json.loads(index_file.read_text(encoding="utf-8"))
    assessment = json.loads(assessment_file.read_text(encoding="utf-8"))
    if (index.get("workbook_sha256") != sha or assessment.get("workbook_sha256") != sha
            or index.get("achilles_receipt_id") != lineage["achilles_receipt_id"]
            or index.get("release_authorization") != "NOT_GRANTED"
            or assessment.get("release_authorization") != "NOT_GRANTED"):
        raise ValueError("PRIVATE_ARCHIVE_LINEAGE_MISMATCH")
    counts: dict[str, int] = {}
    for card in assessment["assessments"]:
        status = card["assessment"]
        counts[status] = counts.get(status, 0) + 1
    summary = {"schema": "arena-redacted-assessment/v1", "book_id": lineage["book_id"],
               "edition_id": lineage["edition_id"], "workbook_sha256": sha,
               "source_index_sha256": digest(index_file), "source_assessment_sha256": digest(assessment_file),
               "items_count": len(index["items"]), "assessment_status_counts": counts,
               "scope_status": "NOT_RUN_IN_GITHUB_ADAPTER", "breadth_depth_status": "NOT_ASSESSED",
               "six_factor_status": "NOT_COMPUTED", "zai_capability_status": "NOT_NEGOTIATED",
               "release_authorization": "NOT_GRANTED"}
    summary_bytes = json.dumps(summary, sort_keys=True, ensure_ascii=False, indent=2).encode() + b"\n"
    manifest = {"schema": "arena-content-exchange-manifest/v1", "producer_commit": lineage["producer_commit"],
                "producer_ref": lineage["producer_ref"], "repo_path": lineage["repo_path"],
                "receipt_path": lineage["receipt_path"], "receipt_sha256": lineage["receipt_sha256"],
                "workbook_sha256": sha, "achilles_receipt_id": lineage["achilles_receipt_id"],
                "book_id": lineage["book_id"], "edition_id": lineage["edition_id"],
                "index_sha256": digest(index_file), "assessment_sha256": digest(assessment_file),
                "assessment_summary_sha256": hashlib.sha256(summary_bytes).hexdigest(),
                "assessment_summary_path": "assessment-summary.json", "content_status": "PROPOSED_YELLOW",
                "upstream_merge_status": "NOT_VERIFIED", "rights_trust": lineage["rights_trust"],
                "approval_trust": lineage["approval_trust"],
                "content_acceptance": "PENDING_ARENA_ASSESSMENT_AND_HUMAN_DECISION",
                "release": "NOT_GRANTED", "zai_consumer_receipt": "NOT_RECEIVED"}
    return manifest, summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--producer-ref", required=True)
    parser.add_argument("--producer-commit", required=True)
    parser.add_argument("--workbook-path", required=True)
    parser.add_argument("--receipt-path", required=True)
    parser.add_argument("--workbook-sha256", required=True)
    parser.add_argument("--rights-decision-ref", required=True,
                        help="Externally verified right to fetch/store XLSX in this private repo; text alone is not proof")
    parser.add_argument("--archive-out", type=Path, required=True)
    parser.add_argument("--package-out", type=Path, required=True,
                        help="Local staging only; review before adding to Git")
    args = parser.parse_args()
    if args.package_out.exists() or args.package_out.resolve() == ROOT or ROOT in args.package_out.resolve().parents:
        raise ValueError("PACKAGE_STAGING_MUST_BE_NEW_AND_OUTSIDE_REPOSITORY")
    lineage = fetch_pinned(producer_ref=args.producer_ref, producer_commit=args.producer_commit,
                           workbook_path=args.workbook_path, receipt_path=args.receipt_path,
                           expected_sha256=args.workbook_sha256, out_dir=args.archive_out,
                           rights_decision_ref=args.rights_decision_ref)
    manifest, summary = redacted_package(lineage, args.archive_out)
    args.package_out.mkdir(parents=True)
    for name, data in (("manifest.json", manifest), ("assessment-summary.json", summary)):
        (args.package_out / name).write_text(json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
                                                  encoding="utf-8")
    print(json.dumps({"status": "STAGED_FOR_REVIEW_NOT_PUBLISHED", "source_commit": lineage["producer_commit"],
                      "workbook_sha256": lineage["workbook_sha256"]}))


if __name__ == "__main__":
    main()
