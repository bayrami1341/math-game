"""Synthetic-PDF checks for C205 intake; no textbook material used."""
import hashlib
import tempfile
import unittest
from pathlib import Path

import pymupdf

from verify_c205_source import ROOT, verify


class C205SourceIntakeTest(unittest.TestCase):
    def make_pdf(self, folder: Path, pages: int = 2) -> Path:
        p = folder / "synthetic.pdf"
        d = pymupdf.open()
        for _ in range(pages):
            d.new_page()
        d.save(str(p))
        d.close()
        return p

    def test_missing_source_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(verify(Path(d) / "absent.pdf")["reason_code"], "SOURCE_PDF_UNAVAILABLE")

    def test_in_repo_source_blocks_even_if_valid_pdf(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as d:
            p = self.make_pdf(Path(d))
            self.assertEqual(verify(p)["reason_code"], "SOURCE_MUST_BE_OUTSIDE_REPOSITORY")

    def test_wrong_size_and_wrong_sha_block(self):
        with tempfile.TemporaryDirectory() as d:
            p = self.make_pdf(Path(d))
            actual_size = p.stat().st_size
            self.assertEqual(verify(p, expected_size=actual_size + 1)["reason_code"], "SOURCE_SIZE_MISMATCH")
            self.assertEqual(verify(p, expected_size=actual_size, expected_sha="0"*64)["reason_code"], "SOURCE_SHA_MISMATCH")

    def test_verified_bytes_do_not_claim_offset_or_visual_evidence(self):
        with tempfile.TemporaryDirectory() as d:
            p = self.make_pdf(Path(d))
            sha = hashlib.sha256(p.read_bytes()).hexdigest()
            good = verify(p, expected_sha=sha, expected_size=p.stat().st_size, expected_pages=2)
            self.assertEqual(good["status"], "PASS_SOURCE_BYTES_ONLY")
            self.assertEqual(good["offset_status"], "UNVERIFIED")
            self.assertEqual(good["visual_evidence_status"], "UNVERIFIED")
            self.assertEqual(good["teacher_verdict"], "NOT_GRANTED")
            wrong_pages = verify(p, expected_sha=sha, expected_size=p.stat().st_size, expected_pages=3)
            self.assertEqual(wrong_pages["reason_code"], "PDF_PAGE_COUNT_MISMATCH")


if __name__ == "__main__":
    unittest.main()
