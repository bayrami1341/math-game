"""Fail-closed tests for the design-only G2 microbot DAG."""
import unittest
from contextlib import redirect_stderr
from io import StringIO
from unittest.mock import patch

from g2_microbot_plan import BOTS, ROOT, plan, main, run_safe_batch
from g2_night_preflight import EXPECTED


class MicrobotPlanTest(unittest.TestCase):
    def inputs(self, source="BLOCKED_SOURCE_UNAVAILABLE"):
        return (
            {"status": "PASS_INPUTS_ONLY", "sha256": EXPECTED.copy(), "queue_rows": 108,
             "source_status": source},
            {"hashes": EXPECTED.copy(), "review_queue_total": 108,
             "s1_yellow_page_rows": 144, "q_total": 104, "q_green": 0,
             "chapter_summary": [{} for _ in range(8)]},
        )

    def test_missing_pdf_blocks_evidence_without_blocking_metadata_planning(self):
        result = plan(*self.inputs())
        states = {bot["bot_id"]: bot["state"] for bot in result["bots"]}
        self.assertEqual(result["evidence_gate"], "BLOCKED_SOURCE_EVIDENCE")
        self.assertEqual(states["M00"], "READY_FOR_MANUAL_ONE_SHOT")
        self.assertEqual(states["M03"], "READY_FOR_MANUAL_ONE_SHOT")
        for bot_id in ("M14", "M15", "M16"):
            self.assertEqual(states[bot_id], "READY_FOR_MANUAL_ONE_SHOT")
        self.assertEqual(states["M09"], "HANDOFF_TO_ZAI")
        self.assertEqual(states["M02"], "BLOCKED")
        self.assertEqual(states["M12"], "BLOCKED")
        self.assertEqual(states["M13"], "NOT_DEPLOYED")
        self.assertEqual(result["dispatch_count"], 0)
        self.assertTrue(all(bot["dispatch"] == "DISABLED_DESIGN_ONLY" for bot in result["bots"]))

    def test_pdf_hash_does_not_upgrade_offset_or_visual_evidence(self):
        result = plan(*self.inputs("SOURCE_SHA_VERIFIED_OFFSET_NOT_YET_VERIFIED"))
        states = {bot["bot_id"]: bot["state"] for bot in result["bots"]}
        self.assertEqual(result["evidence_gate"], "SOURCE_BYTES_ONLY_OFFSET_AND_VISUAL_UNVERIFIED")
        self.assertEqual(states["M01"], "READY_FOR_OFFSET_AND_VISUAL_CHECK")
        for bot_id in ("M02", "M04", "M05", "M06", "M08", "M10", "M11", "M12"):
            self.assertEqual(states[bot_id], "BLOCKED")

    def test_drift_blocks_everything_even_if_pdf_hash_claimed(self):
        preflight, content = self.inputs("SOURCE_SHA_VERIFIED_OFFSET_NOT_YET_VERIFIED")
        content["hashes"]["candidate"] = "0" * 64
        result = plan(preflight, content)
        self.assertEqual(result["evidence_gate"], "BLOCKED_INPUT_DRIFT")
        self.assertTrue(all(bot["state"] == "BLOCKED" for bot in result["bots"]))

    def test_deterministic_ids_and_acyclic_dependencies(self):
        left, right = plan(*self.inputs()), plan(*self.inputs())
        self.assertEqual(left, right)
        seen = set()
        for bot in left["bots"]:
            self.assertTrue(set(bot["depends_on"]) <= seen)
            seen.add(bot["bot_id"])
        self.assertEqual(len(left["bots"]), len(BOTS))
        self.assertEqual(len({bot["work_id"] for bot in left["bots"]}), len(BOTS))

    def test_safe_batch_rejects_drift_without_running(self):
        preflight, content = self.inputs()
        content["q_green"] = 1
        with self.assertRaisesRegex(ValueError, "BLOCKED_INPUT_DRIFT"):
            run_safe_batch(preflight, content, plan(preflight, content))

    def test_safe_batch_rejects_unsafe_draft(self):
        preflight, content = self.inputs()
        proposals = [{"proposal_family": f"family-{i % 23}"} for i in range(54)]
        drafts = [{"draft_id": f"draft-{i}", "q_id": None, "teacher_verdict": "NOT_GRANTED",
                   "book_page_evidence_id": None, "runtime_compatibility": "NOT_TESTED"} for i in range(32)]
        with patch("build_g2_variant_backlog.build", return_value=(proposals, content)), patch(
            "draft_g2_ch6_arithmetic.generate", return_value=drafts
        ):
            safe = run_safe_batch(preflight, content, plan(preflight, content))
            self.assertEqual(safe["status"], "PROVISIONAL_ONLY")
            self.assertEqual(safe["promotions"], 0)
            drafts[0]["teacher_verdict"] = "APPROVED"
            with self.assertRaisesRegex(ValueError, "UNSAFE_DRAFT_METADATA"):
                run_safe_batch(preflight, content, plan(preflight, content))

    def test_cli_rejects_output_inside_repo_before_running(self):
        with patch("sys.argv", ["g2_microbot_plan.py", "--output", str(ROOT / "bad-plan.json")]):
            with redirect_stderr(StringIO()), self.assertRaises(SystemExit) as ctx:
                main()
        self.assertEqual(ctx.exception.code, 2)
        self.assertFalse((ROOT / "bad-plan.json").exists())


if __name__ == "__main__":
    unittest.main()
