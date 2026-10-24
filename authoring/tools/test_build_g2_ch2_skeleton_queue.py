import copy
import unittest

from build_g2_ch2_skeleton_queue import build


class G2Ch2SkeletonQueueTests(unittest.TestCase):
    def setUp(self):
        self.skeleton = {"schema": "khshab.skeleton-handoff/v1", "cartridge": "KH-G2-MATH",
                         "spine": {"chapters": [{}, {"printedStart": 19, "printedEnd": 36}]},
                         "budget": {"chapters": [{}, {"pages": [19, 36], "min": 60, "max": 90,
                                                  "levels": {"دانشی": [18, 27]},
                                                  "subTopics": [{"topic": n, "total": [12, 18], "levels": {}}
                                                                for n in ("الف", "ب", "پ", "ت", "ث")]}]},
                         "topicMap": {"chapters": [{}, {"pages": [19, 36],
                                                     "main": [{"no": i, "topic": t,
                                                               "pages": [[19+i, 19+i]], "value": 5}
                                                              for i, t in enumerate(("الف", "ج", "چ", "ح", "خ", "د", "ذ"))],
                                                     "subsidiary": [{"no": i, "topic": t,
                                                                     "pages": [[25+i, 25+i]], "value": 3}
                                                                    for i, t in enumerate(("ر", "ز"))]}]}}
        self.inventory = {"schema": "G2_CONTENT_INVENTORY_v1", "hashes": {
            "candidate": "18e6b4fa4957e968eca2b3b8066387858a627a99d7d52340064a1e8d8880c618"},
            "chapter_summary": [{"chapter": 2, "existing_q_count": 1}],
            "pages": [{"chapter": 2, "book_page": p, "s1_id": f"L-{p}",
                       "s1_status": "نیاز به تأیید", "existing_q_count": int(p == 20),
                       "existing_q_ids": "Q-1" if p == 20 else ""} for p in range(19, 37)]}

    def test_preserves_uncertainty_and_page_membership(self):
        result = build(self.skeleton, self.inventory)
        self.assertEqual(len(result["page_queue"]), 18)
        self.assertEqual(len(result["topics"]), 9)
        self.assertEqual(len(result["budget"]["rows"]), 5)
        self.assertEqual(result["accepted_q_total"], 0)
        self.assertEqual(result["candidate_q_total_not_accepted"], 1)
        self.assertEqual(result["exact_title_hints_only"][0]["status"], "LEXICAL_HINT_NOT_REVIEWED")
        self.assertEqual(result["page_queue"][1]["topic_hints"][0]["title"], "ج")
        self.assertTrue(all(t["budget_mapping"].startswith("UNMAPPED") for t in result["topics"]))
        self.assertTrue(all(p["educational_acceptance"] == "NOT_GRANTED" for p in result["page_queue"]))

    def test_rejects_drift_and_forged_approval(self):
        for fixture, target, error in (("skeleton", ("budget", "chapters", 1, "max"), "CHAPTER_BUDGET_OR_TOPIC_DRIFT"),
                                       ("inventory", ("pages", 0, "s1_status"), "CANDIDATE_CHAPTER_INVENTORY_DRIFT"),
                                       ("inventory", ("hashes", "candidate"), "SOURCE_SCHEMA_OR_EDITION_MISMATCH")):
            with self.subTest(fixture=fixture, target=target):
                s, inv = copy.deepcopy(self.skeleton), copy.deepcopy(self.inventory)
                d = s if fixture == "skeleton" else inv
                for key in target[:-1]:
                    d = d[key]
                d[target[-1]] = "forged"
                with self.assertRaisesRegex(ValueError, error):
                    build(s, inv)
        self.inventory["pages"][1]["existing_q_ids"] = "Q-1;Q-2"
        with self.assertRaisesRegex(ValueError, "CANDIDATE_Q_COUNT_DRIFT"):
            build(self.skeleton, self.inventory)


if __name__ == '__main__':
    unittest.main()
