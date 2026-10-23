"""The one-shot status reporter may never equate a provisional artifact to readiness."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import g2_supervisor_once as supervisor


class SupervisorStatusTest(unittest.TestCase):
    def setUp(self):
        self.hashes = {"candidate": "a", "official": "b", "pagemap": "c", "priority_queue": "d"}
        self.preflight = {"status": "PASS_INPUTS_ONLY", "sha256": self.hashes,
                          "source_status": "BLOCKED_SOURCE_UNAVAILABLE"}
        self.inventory = {"hashes": self.hashes,
                          "chapter_summary": [{"existing_q_count": 0}] * 8}

    def test_no_source_never_ready(self):
        with patch.object(supervisor, "BACKLOG", Path("/nonexistent/g2-backlog.json")), \
             patch.object(supervisor, "DRAFTS", Path("/nonexistent/g2-drafts.json")):
            res = supervisor.summarize(self.preflight, self.inventory)
        self.assertEqual(res["status"], "NOT_READY")
        self.assertIn("G1_C205_SOURCE: BLOCKED_SOURCE_UNAVAILABLE", res["blockers"])
        self.assertEqual(res["runner_status"], "NOT_DEPLOYED_THIS_IS_ONE_SHOT_ONLY")

    def test_mismatched_sha_blocks(self):
        different = {**self.preflight, "sha256": {**self.hashes, "candidate": "changed"}}
        self.assertEqual(supervisor.summarize(different, self.inventory)["status"], "HOLD_INPUT_DRIFT")

    def test_provisional_work_cannot_promote_itself(self):
        with tempfile.TemporaryDirectory() as folder:
            back = Path(folder) / "back.json"
            draft = Path(folder) / "draft.json"
            back.write_text(json.dumps({"input_sha256": self.hashes, "pages_provisionally_classified": 54,
                                        "question_rows_authored": 0}))
            draft.write_text(json.dumps({"draft_count": 32, "ready_for_workbook": False,
                                         "book_evidence_verified": False,
                                         "drafts": [{"q_id": None, "teacher_verdict": "NOT_GRANTED"}]*32}))
            with patch.object(supervisor, "BACKLOG", back), patch.object(supervisor, "DRAFTS", draft):
                res = supervisor.summarize(self.preflight, self.inventory)
                self.assertEqual(res["status"], "NOT_READY")
                self.assertEqual(next(t for t in res["tasks"] if t["id"] == "G5_YELLOW_CONTENT")["status"], "PROVISIONAL_ONLY")
                draft.write_text(json.dumps({"draft_count": 32, "ready_for_workbook": True,
                                             "drafts": [{"q_id": "Q-FORGED", "teacher_verdict": "GRANTED"}]*32}))
                unsafe = supervisor.summarize(self.preflight, self.inventory)
                self.assertEqual(unsafe["status"], "NOT_READY")
                self.assertIn("G5_YELLOW_CONTENT: BLOCKED_UNSAFE_DRAFT_METADATA", unsafe["blockers"])


if __name__ == "__main__":
    unittest.main()
