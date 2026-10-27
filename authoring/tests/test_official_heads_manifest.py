"""test_official_heads_manifest.py — گیت مانیفست سرهای رسمی (BP-001 T1).

راستی‌آزمایی اینکه OFFICIAL-HEADS.json سالم، خودسازگار و منطبق بر فایل‌های
واقعی روی دیسک است. این تست جایگزین ماشینیِ «اعتماد به متن مانیفست» است.
"""

from __future__ import annotations

import hashlib


def _sha256(p) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def test_manifest_schema_and_families(official_heads):
    assert official_heads.get("formatVersion") == 1, "نسخهٔ قالب مانیفست رسمی"
    heads = official_heads["heads"]
    assert set(heads.keys()) == {f"KH-G{i}-MATH" for i in range(1, 7)}, "شش خانوادهٔ رسمی"
    for fam, info in heads.items():
        assert info.get("file"), f"{fam}: مسیر فایل خالی است"
        assert info.get("sha256"), f"{fam}: sha256 خالی است"


def test_every_head_file_exists_and_sha_matches(repo_root, official_heads):
    mismatches = []
    for fam, info in official_heads["heads"].items():
        p = repo_root / info["file"]
        if not p.exists():
            mismatches.append(f"{fam}: فایل نیست → {info['file']}")
            continue
        actual = _sha256(p)
        if actual != info["sha256"]:
            mismatches.append(f"{fam}: SHA مانیفست={info['sha256'][:12]} واقعی={actual[:12]}")
    assert not mismatches, "ناسازگاری مانیفست/دیسک: " + "؛ ".join(mismatches)


def test_g2_g3_are_content_heads(official_heads):
    """G2 و G3 باید خشاب محتوایی (اسکلت خالی نباشد) باشند — بر اساس اعلان مانیفست."""
    heads = official_heads["heads"]
    for fam, expected in (("KH-G2-MATH", "v0.5"), ("KH-G3-MATH", "v0.7")):
        assert heads[fam]["version"] == expected, f"{fam} باید سر رسمی {expected} باشد"
