"""Mandatory content-lane fail-closed protocol checks (not server authorization)."""
import copy
import unittest

from g2_microbot_plan import plan
from g2_microbot_protocol_gate import assess
from g2_night_preflight import EXPECTED


class ProtocolGateTest(unittest.TestCase):
    def snapshot(self, source="BLOCKED_SOURCE_UNAVAILABLE"):
        preflight = {"status": "PASS_INPUTS_ONLY", "sha256": EXPECTED.copy(), "queue_rows": 108,
                     "source_status": source}
        content = {"hashes": EXPECTED.copy(), "review_queue_total": 108, "s1_yellow_page_rows": 144,
                   "q_total": 104, "q_green": 0, "chapter_summary": [{} for _ in range(8)]}
        return plan(preflight, content)

    def assert_denied(self, snapshot, reason):
        verdict = assess(snapshot)
        self.assertEqual(verdict["status"], "FAIL_PROTOCOL")
        self.assertIn(reason, verdict["violations"])
        self.assertEqual(verdict["readiness"], "NOT_READY")

    def test_normal_snapshot_passes_protocol_but_not_readiness(self):
        verdict = assess(self.snapshot())
        self.assertEqual(verdict["status"], "PASS_PROTOCOL_LOCAL_PILOT")
        self.assertEqual(verdict["readiness"], "NOT_READY")

    def test_pdf_hash_is_not_visual_or_teacher_evidence(self):
        s = self.snapshot("SOURCE_SHA_VERIFIED_OFFSET_NOT_YET_VERIFIED")
        self.assertEqual(assess(s)["status"], "PASS_PROTOCOL_LOCAL_PILOT")
        s["evidence_gate"] = "EVIDENCE_COMPLETE"
        self.assert_denied(s, "SOURCE_BYTES_MISREPRESENTED_AS_VISUAL_EVIDENCE")

    def test_forged_dispatch_runner_and_owner_decision_fail(self):
        for field, value, reason in (
            ("dispatch_count", 1, "DISPATCH_NOT_AUTHORIZED"),
            ("runner", "DEPLOYED", "FALSE_READINESS_OR_DEPLOYMENT"),
            ("overall", "READY_FOR_OWNER_DECISION", "FALSE_READINESS_OR_DEPLOYMENT"),
        ):
            with self.subTest(field=field):
                s = self.snapshot()
                s[field] = value
                self.assert_denied(s, reason)
        s = self.snapshot()
        next(bot for bot in s["bots"] if bot["bot_id"] == "M12")["state"] = "PASS"
        self.assert_denied(s, "UNSUPPORTED_STATE_M12")

    def test_identity_text_and_dependency_cannot_shift_role(self):
        s = self.snapshot()
        next(bot for bot in s["bots"] if bot["bot_id"] == "M02")["owner"] = "human_teacher"
        self.assert_denied(s, "BOT_OWNER_OR_DEPENDENCY_DRIFT")
        s = self.snapshot()
        next(bot for bot in s["bots"] if bot["bot_id"] == "M08")["depends_on"] = []
        self.assert_denied(s, "BOT_OWNER_OR_DEPENDENCY_DRIFT")

    def test_provisional_batch_cannot_promote_or_claim_runtime(self):
        s = self.snapshot()
        s["safe_batch"] = {
            "execution_mode": "ONE_SHOT_IN_MEMORY_NOT_DEPLOYED",
            "executed": ["M00", "M03", "M14", "M15", "M16"], "input_sha256": EXPECTED.copy(),
            "queue_rows": 108, "yellow_pages": 144, "proposed_pages": 54,
            "proposed_families": 23, "synthetic_drafts": 32,
            "book_evidence_verified": False, "runtime_tested": False,
            "workbook_changed": False, "promotions": 0, "status": "PROVISIONAL_ONLY",
        }
        self.assertEqual(assess(s)["status"], "PASS_PROTOCOL_LOCAL_PILOT")
        for field, value in (("promotions", 1), ("book_evidence_verified", True), ("runtime_tested", True),
                             ("workbook_changed", True), ("status", "APPROVED")):
            with self.subTest(field=field):
                bad = copy.deepcopy(s)
                bad["safe_batch"][field] = value
                self.assert_denied(bad, "SAFE_BATCH_PROMOTION_OR_FALSE_EXECUTION")

    def test_schema_extra_and_unknown_source_fail_closed(self):
        s = self.snapshot()
        s["publish"] = True
        self.assert_denied(s, "UNKNOWN_TOP_LEVEL_FIELDS")
        s = self.snapshot()
        s["source_status"] = "FULLY_VERIFIED"
        self.assert_denied(s, "UNKNOWN_SOURCE_STATUS")
        s = self.snapshot()
        s["bots"] = s["bots"][:-1]
        self.assert_denied(s, "BOT_SET_INCOMPLETE")
        self.assert_denied({}, "SCHEMA_OR_AUTHORITY_DRIFT")


if __name__ == "__main__":
    unittest.main()
