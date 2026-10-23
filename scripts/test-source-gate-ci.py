#!/usr/bin/env python3
"""آزمون CI گیت منبع (BP-023): fail-closed روی بایت‌های مصنوعی — بدون هیچ بایت کتاب.

در CI بایت واقعی C205 وجود ندارد و نباید داشته باشد (حق نشر). این پوشش:
  ۱. یک PDF مصنوعی ۳صفحه‌ای با pymupdf می‌سازد و manifest معتبرِ همان بایت را پین می‌کند
  ۲. کل مجموعهٔ منفی (حذف/صفرکردن فیلدها، SHA غلط، فایل غایب، manifest خراب) + آزمون مثبت
     را روی همان بایت مصنوعی اجرا می‌کند
  ۳. exit 0 = مکانیزم گیت سالم؛ exit 1 = حفره یا خرابی

pin معتبرِ منبع واقعی (C205) جدا و فقط در محیط vault اجرا می‌شود:
  python3 scripts/test-source-gate-negative.py --pdf /home/z/vault/c205/C205.pdf \
      --manifest /home/z/vault/c205/vault-manifest.json
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import fitz  # pymupdf

REPO = Path(__file__).resolve().parent.parent


def main() -> int:
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        pdf = tmp / "synthetic-probe.pdf"
        doc = fitz.open()
        for _ in range(3):
            doc.new_page()
        doc.save(str(pdf))
        doc.close()

        data = pdf.read_bytes()
        manifest = {
            "schema": "khshab.source-vault/v1",
            "source_key": "SYNTHETIC-CI:mechanism-probe",
            "file": {"sha256": hashlib.sha256(data).hexdigest(), "size_bytes": len(data)},
            "pages": 3,
        }
        mp = tmp / "manifest.json"
        mp.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")

        proc = subprocess.run(
            [sys.executable, str(REPO / "scripts" / "test-source-gate-negative.py"),
             "--pdf", str(pdf), "--manifest", str(mp)],
            capture_output=True, text=True, timeout=300,
        )
        print(proc.stdout.strip()[-1600:])
        if proc.returncode != 0:
            print(proc.stderr[-500:])
        return proc.returncode


if __name__ == "__main__":
    sys.exit(main())
