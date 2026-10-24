"""Independent, fail-closed conceptual-scope audit of reviewed PAGE and QUESTION claims.

Pure sidecar: no OCR/LLM inference, no Excel mutation, no book-accuracy verdict.
A separately reviewed, SAME-EDITION profile and reviewed claim extraction are inputs.
UNKNOWN is not zero or approval; a main-goal drift blocks downstream candidacy.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

SCHEMA = "arena-concept-scope/v1"
PROFILE_SCHEMA = "concept-scope-profile/v1"
ROLES = {"MAIN", "PREREQUISITE", "INCIDENTAL", "BRIDGE"}
DECISIONS = {"ALIGNED", "UNKNOWN_REVIEW", "BLOCK_CRITICAL_SCOPE_DRIFT"}
SHA = re.compile(r"[0-9a-f]{64}\Z")


def _sha(value):
    return isinstance(value, str) and SHA.fullmatch(value) is not None


def _nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def validate_profile(profile):
    """Reject malformed declarations; a valid but unreviewed profile is held, not used."""
    if not isinstance(profile, dict) or profile.get("schema") != PROFILE_SCHEMA:
        raise ValueError("UNSUPPORTED_PROFILE_SCHEMA")
    for key in ("profile_id", "book_id", "edition_id", "reviewed_by", "source_locator"):
        if not _nonempty(profile.get(key)):
            raise ValueError("PROFILE_MISSING_" + key.upper())
    if profile.get("source_kind") not in {"OFFICIAL_TEACHER_GUIDE", "OFFICIAL_CURRICULUM", "HUMAN_SCOPED_VERDICT"}:
        raise ValueError("PROFILE_SOURCE_KIND_INVALID")
    if not _sha(profile.get("source_sha256")) or type(profile.get("revision")) is not int or profile["revision"] < 1:
        raise ValueError("PROFILE_VERSION_OR_SOURCE_INVALID")
    pages = profile.get("expected_pages")
    scopes = profile.get("page_scopes")
    if (not isinstance(pages, list) or not pages or any(type(p) is not int or p < 1 for p in pages)
            or len(set(pages)) != len(pages) or not isinstance(scopes, dict)
            or set(scopes) != {str(p) for p in pages}):
        raise ValueError("PROFILE_PAGE_COVERAGE_INVALID")
    for page in pages:
        scope = scopes[str(page)]
        if not isinstance(scope, dict) or not _nonempty(scope.get("locator")):
            raise ValueError("INVALID_PAGE_SCOPE")
        groups = ("primary", "prerequisite", "incidental", "outside")
        if any(not isinstance(scope.get(k), list) or any(not _nonempty(x) for x in scope[k]) for k in groups):
            raise ValueError("INVALID_OBJECTIVE_GROUP")
        combined = [x for k in groups for x in scope[k]]
        if not scope["primary"] or len(set(combined)) != len(combined):
            raise ValueError("OVERLAPPING_OR_EMPTY_OBJECTIVE_GROUPS")
        rules = scope.get("rules")
        if not isinstance(rules, dict) or set(rules) != set(combined):
            raise ValueError("MISSING_OBJECTIVE_RULES")
        for obj, rule in rules.items():
            if (not isinstance(rule, dict) or not _nonempty(rule.get("citation"))
                    or not isinstance(rule.get("operations"), list)
                    or not rule["operations"] or len(set(rule["operations"])) != len(rule["operations"])
                    or any(not _nonempty(op) for op in rule["operations"])):
                raise ValueError("INVALID_OPERATION_RULE:" + obj)
            domain = rule.get("number_domain")
            if domain is not None and (not isinstance(domain, dict) or set(domain) != {"min", "max"}
                                       or type(domain["min"]) is not int or type(domain["max"]) is not int
                                       or domain["min"] > domain["max"]):
                raise ValueError("INVALID_NUMBER_DOMAIN:" + obj)
        bridges = scope.get("bridges", [])
        if not isinstance(bridges, list) or any(
                not isinstance(b, dict) or set(b) != {"operation", "primary_objective_id"}
                or b["primary_objective_id"] not in scope["primary"] or not _nonempty(b["operation"])
                or b["operation"] not in rules[b["primary_objective_id"]]["operations"]
                for b in bridges):
            raise ValueError("INVALID_BRIDGE_RULE")
    return profile


def _claim_state(claim, scope, workbook_sha):
    """Return (reason, severity); severity CRITICAL applies ONLY to main objective drift."""
    if not isinstance(claim, dict) or claim.get("role") not in ROLES:
        return "CLAIM_UNREADABLE", "REVIEW"
    evidence = claim.get("evidence")
    if (not isinstance(evidence, dict) or evidence.get("status") != "REVIEWED"
            or evidence.get("kind") not in {"REVIEWED_WORKBOOK", "HUMAN_SCOPED_VERDICT"}
            or evidence.get("workbook_sha256") != workbook_sha
            or not _nonempty(evidence.get("locator")) or not _nonempty(evidence.get("reviewed_by"))):
        return "CLAIM_EVIDENCE_UNKNOWN", "REVIEW"
    role = claim["role"]
    obj, op = claim.get("objective_id"), claim.get("operation")
    if not _nonempty(obj) or not _nonempty(op):
        return "CLAIM_MEANING_UNKNOWN", "REVIEW"
    group = {"MAIN": "primary", "PREREQUISITE": "prerequisite", "INCIDENTAL": "incidental", "BRIDGE": "primary"}[role]
    if obj not in scope[group]:
        if role == "MAIN":
            return "MAIN_OBJECTIVE_OUTSIDE_PROFILE", "CRITICAL"
        return "SECONDARY_OBJECTIVE_UNRESOLVED", "REVIEW"
    rule = scope["rules"][obj]
    bridge = {"operation": op, "primary_objective_id": obj}
    if role == "BRIDGE":
        if bridge not in scope.get("bridges", []) or claim.get("bridge_to") != obj:
            return "BRIDGE_NOT_EVIDENCED_FOR_PRIMARY", "REVIEW"
    elif role == "MAIN" and bridge in scope.get("bridges", []):
        # A repeated-addition *bridge* cannot silently become a multiplication goal.
        return "MAIN_BRIDGE_MISLABELED", "CRITICAL"
    elif op not in rule["operations"]:
        return ("MAIN_OPERATION_DRIFT", "CRITICAL") if role == "MAIN" else ("SECONDARY_OPERATION_UNRESOLVED", "REVIEW")
    operands, results = claim.get("operands"), claim.get("results", [])
    domain = rule.get("number_domain")
    if domain is not None:
        if (not isinstance(operands, list) or not operands or any(type(n) is not int for n in operands)
                or not isinstance(results, list) or any(type(n) is not int for n in results)):
            return "NUMBER_DOMAIN_UNKNOWN", "REVIEW"
        if any(not domain["min"] <= n <= domain["max"] for n in operands + results):
            return ("MAIN_NUMBER_DOMAIN_DRIFT", "CRITICAL") if role == "MAIN" else ("SECONDARY_NUMBER_DOMAIN_REVIEW", "REVIEW")
    elif operands not in (None, []) or results not in (None, []):
        return "NUMBER_DOMAIN_NOT_SPECIFIED", "REVIEW"
    return {"MAIN": "MAIN_ALIGNED", "PREREQUISITE": "PREREQUISITE_ALLOWED",
            "INCIDENTAL": "INCIDENTAL_ALLOWED", "BRIDGE": "BRIDGE_ALLOWED"}[role], "OK"


def inventory_from_intake_index(index: dict) -> list[dict]:
    """Lossless UID inventory adapter for content_library_intake's private index.

    Chapter-range S1 rows remain visible as CHAPTER_ANCHOR, not fictitious pages.
    It does not infer concepts/operations from Persian text. The upstream intake
    receipt is an attestation, NOT a cryptographic Achilles authentication.
    """
    if index.get("schema") != "arena-content-library-index/v1" or not isinstance(index.get("items"), list):
        raise ValueError("UNSUPPORTED_INTAKE_INDEX")
    page_field, s1, q = "صفحه/گستره", "نقشهٔ کتاب (S1)", "بانک سؤال"
    digits = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
    raw = index["items"]
    by_uid = {x.get("uid"): x for x in raw if isinstance(x, dict)}
    if len(by_uid) != len(raw):
        raise ValueError("DUPLICATE_OR_INVALID_INTAKE_UID")
    def page_for(row):
        value = str(row.get("fields", {}).get(page_field) or "").strip().translate(digits)
        return int(value) if re.fullmatch(r"[1-9][0-9]*", value) else None
    inventory = []
    for row in raw:
        if row.get("sheet") not in {s1, q}:
            raise ValueError("UNEXPECTED_INTAKE_SHEET")
        anchor = by_uid.get(row.get("anchor_uid")) if row.get("sheet") == q else None
        page = page_for(anchor if anchor is not None else row)
        kind = "QUESTION" if row["sheet"] == q else "PAGE" if page is not None else "CHAPTER_ANCHOR"
        inventory.append({"uid": row["uid"], "kind": kind,
                          "book_id": index.get("book_id"), "edition_id": index.get("edition_id"),
                          "page": page, **({"anchor_uid": row.get("anchor_uid")} if kind == "QUESTION" else {})})
    return inventory


def assess(profile: dict, inventory: list[dict], claims_by_uid: dict[str, dict], *, workbook_sha256: str) -> dict:
    """Audit every inventoried page/question; never certify textbook fidelity or release.

    Inventory entries: uid, kind=PAGE|QUESTION|CHAPTER_ANCHOR, book_id, edition_id,
    page (integer for PAGE/QUESTION), anchor_uid for QUESTION. Claims sidecar:
    {uid: {claims: [...], presentation: {kind, affects_goal_or_behavior: bool|null}}}.
    A missing entry/claim is reported, never silently accepted. Chapter anchors
    are listed separately, not counted as pages. Never derive claims from titles.
    """
    validate_profile(profile)
    if not _sha(workbook_sha256) or not isinstance(inventory, list) or not isinstance(claims_by_uid, dict):
        raise ValueError("INVALID_AUDIT_INPUT")
    ids = [item.get("uid") for item in inventory if isinstance(item, dict)]
    if len(ids) != len(inventory) or any(not _nonempty(uid) for uid in ids) or len(set(ids)) != len(ids):
        raise ValueError("DUPLICATE_OR_INVALID_INVENTORY_UID")
    if set(claims_by_uid) - set(ids):
        raise ValueError("ORPHAN_CLAIM_UID")
    known = {x["uid"]: x for x in inventory}
    page_items = {x.get("page"): x for x in inventory if x.get("kind") == "PAGE" and type(x.get("page")) is int}
    if sum(x.get("kind") == "PAGE" for x in inventory) != len(page_items):
        raise ValueError("DUPLICATE_OR_INVALID_PAGE")
    equivalence = profile.get("equivalence_evidence")
    crosswalk_ready = (isinstance(equivalence, dict) and equivalence.get("status") == "REVIEWED"
                       and _sha(equivalence.get("source_sha256"))
                       and _nonempty(equivalence.get("locator"))
                       and _nonempty(equivalence.get("reviewed_by")))
    profile_ready = (profile.get("status") == "REVIEWED" and
                     (profile.get("edition_alignment") == "SAME_EDITION" or
                      (profile.get("edition_alignment") == "REVIEWED_EQUIVALENCE" and crosswalk_ready)))
    results = []
    for item in inventory:
        uid, kind, page = item["uid"], item.get("kind"), item.get("page")
        if kind not in {"PAGE", "QUESTION", "CHAPTER_ANCHOR"}:
            raise ValueError("INVALID_ITEM_KIND")
        outcome = {"uid": uid, "kind": kind, "page": page, "decision": "UNKNOWN_REVIEW",
                   "reasons": [], "presentation": "NOT_ASSESSED"}
        if kind == "CHAPTER_ANCHOR":
            outcome["reasons"] = ["CHAPTER_ANCHOR_NOT_A_PAGE"]
            results.append(outcome)
            continue
        if not profile_ready or item.get("book_id") != profile["book_id"] or item.get("edition_id") != profile["edition_id"]:
            outcome["reasons"] = ["PROFILE_OR_EDITION_UNREVIEWED"]
        elif type(page) is not int or str(page) not in profile["page_scopes"]:
            outcome["reasons"] = ["PAGE_PROFILE_MISSING"]
        elif kind == "QUESTION" and (item.get("anchor_uid") not in known
                                     or known[item["anchor_uid"]].get("kind") != "PAGE"
                                     or known[item["anchor_uid"]].get("page") != page):
            outcome["reasons"] = ["QUESTION_ANCHOR_UNRESOLVED"]
        else:
            bundle = claims_by_uid.get(uid)
            if not isinstance(bundle, dict) or not isinstance(bundle.get("claims"), list) or not bundle["claims"]:
                outcome["reasons"] = ["CLAIMS_MISSING"]
            else:
                states = [_claim_state(c, profile["page_scopes"][str(page)], workbook_sha256)
                          for c in bundle["claims"]]
                outcome["reasons"] = list(dict.fromkeys(reason for reason, _ in states))
                # No evidenced main concept means no approval, even with allowed prerequisites/bridges.
                if not any(reason == "MAIN_ALIGNED" for reason, _ in states):
                    outcome["reasons"].append("MAIN_OBJECTIVE_NOT_ESTABLISHED")
                if any(severity == "CRITICAL" for _, severity in states):
                    outcome["decision"] = "BLOCK_CRITICAL_SCOPE_DRIFT"
                elif (all(severity == "OK" for _, severity in states)
                      and "MAIN_OBJECTIVE_NOT_ESTABLISHED" not in outcome["reasons"]):
                    outcome["decision"] = "ALIGNED"
                presentation = bundle.get("presentation")
                if presentation is not None:
                    if (not isinstance(presentation, dict) or presentation.get("kind") not in {"BANNER", "STYLE"}
                            or type(presentation.get("affects_goal_or_behavior")) is not bool):
                        outcome["presentation"] = "PRESENTATION_UNKNOWN_REVIEW"
                    elif presentation["affects_goal_or_behavior"]:
                        outcome["presentation"] = "PRESENTATION_AFFECTS_LEARNING_REVIEW"
                    else:
                        outcome["presentation"] = "PRESENTATION_ONLY"
                if outcome["presentation"] in {"PRESENTATION_UNKNOWN_REVIEW", "PRESENTATION_AFFECTS_LEARNING_REVIEW"}:
                    if outcome["decision"] == "ALIGNED":
                        outcome["decision"] = "UNKNOWN_REVIEW"
                    outcome["reasons"].append(outcome["presentation"])
        results.append(outcome)
    missing_pages = sorted(set(profile["expected_pages"]) - set(page_items))
    extra_pages = sorted(set(page_items) - set(profile["expected_pages"]))
    return {"schema": SCHEMA, "profile_id": profile["profile_id"], "profile_revision": profile["revision"],
            "profile_source_sha256": profile["source_sha256"], "workbook_sha256": workbook_sha256,
            "results": results, "missing_pages": missing_pages, "extra_pages": extra_pages,
            "decision_counts": dict(Counter(x["decision"] for x in results if x["kind"] != "CHAPTER_ANCHOR")),
            "overall": "BLOCK_CRITICAL_SCOPE_DRIFT" if any(x["decision"] == "BLOCK_CRITICAL_SCOPE_DRIFT" for x in results)
                       else "UNKNOWN_REVIEW" if (missing_pages or extra_pages or any(x["decision"] != "ALIGNED" for x in results if x["kind"] != "CHAPTER_ANCHOR"))
                       else "ALIGNED_CANDIDATE_ONLY",
            "book_fidelity": "ACHILLES_SEPARATE_GATE", "release_authorization": "NOT_GRANTED"}


def binding_for(report: dict, uid: str) -> dict:
    """Build scorer input: a batch with ANY critical drift cannot proceed."""
    if report.get("schema") != SCHEMA:
        raise ValueError("UNSUPPORTED_SCOPE_REPORT")
    matches = [x for x in report.get("results", []) if x.get("uid") == uid and x.get("kind") != "CHAPTER_ANCHOR"]
    if len(matches) != 1:
        raise ValueError("SCOPE_ITEM_NOT_UNIQUE_OR_MISSING")
    overall = report.get("overall")
    decision = ("BLOCK_CRITICAL_SCOPE_DRIFT" if overall == "BLOCK_CRITICAL_SCOPE_DRIFT" else
                "ALIGNED" if overall == "ALIGNED_CANDIDATE_ONLY" and matches[0]["decision"] == "ALIGNED" else
                "UNKNOWN_REVIEW")
    return {"schema": SCHEMA, "decision": decision, "content_uid": uid,
            "workbook_sha256": report["workbook_sha256"], "profile_id": report["profile_id"],
            "profile_revision": report["profile_revision"],
            "profile_source_sha256": report["profile_source_sha256"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("index", "profile", "claims", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    repository = Path(__file__).resolve().parents[2]
    if args.output.resolve() == repository or repository in args.output.resolve().parents:
        raise ValueError("PRIVATE_SCOPE_REPORT_MUST_BE_OUTSIDE_REPOSITORY")
    index = json.loads(args.index.read_text(encoding="utf-8"))
    profile = json.loads(args.profile.read_text(encoding="utf-8"))
    claims = json.loads(args.claims.read_text(encoding="utf-8"))
    inventory = inventory_from_intake_index(index)
    report = assess(profile, inventory, claims, workbook_sha256=index.get("workbook_sha256"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"overall": report["overall"], "decision_counts": report["decision_counts"],
                      "missing_pages": len(report["missing_pages"]), "release": "NOT_GRANTED"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
