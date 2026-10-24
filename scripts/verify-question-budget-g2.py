#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""گیت ماشینی بودجهٔ رسمی سؤالات پایهٔ دوم + نقشهٔ مباحث G2 — fail-closed
هر آزمون قرمز = exit 1. هیچ عددی تصحیح نمی‌شود؛ فقط راستی‌آزمایی."""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUDGET = ROOT / "authoring" / "QUESTION-BUDGET-G2-v1.json"
TOPICS = ROOT / "authoring" / "G2-TOPIC-MAP-v1.json"
CALIB = ROOT / "authoring" / "G2-PRINTED-CALIBRATION-v1.json"

TIERS = ["دانشی", "کاربردی", "استدلالی"]
OWNER_RATIOS = {"دانشی": 32.6, "کاربردی": 46.2, "استدلالی": 21.2}
GRAND = {"min": 368, "max": 552}
LEVEL_BANDS = {"دانشی": [120, 180], "کاربردی": [170, 255], "استدلالی": [78, 117]}

fails = []


def check(name, ok, detail=""):
    print(("✓ " if ok else "✗ ") + name + ((" — " + detail) if detail else ""))
    if not ok:
        fails.append(name)


def main():
    b = json.loads(BUDGET.read_text(encoding="utf-8"))
    t = json.loads(TOPICS.read_text(encoding="utf-8"))
    c = json.loads(CALIB.read_text(encoding="utf-8"))

    chapters = b["chapters"]
    subs = [r for ch in chapters for r in ch["subTopics"]]

    # T1 — خودسازگاری ردیف‌های فرعی
    bad = []
    for r in subs:
        mn = sum(r["levels"][x][0] for x in TIERS)
        mx = sum(r["levels"][x][1] for x in TIERS)
        if [mn, mx] != list(r["total"]):
            bad.append(r["topic"])
    check("خودسازگاری ۳۲ ردیف فرعی (جمع سه سطح = جمع ردیف)", len(subs) == 32 and not bad,
          f"{len(subs)} ردیف" + (f"؛ مغایر: {bad}" if bad else ""))

    # T2 — جمع فرعی = اصلی در ۸ فصل × ۴ بُعد
    bad = []
    for ch in chapters:
        rows = ch["subTopics"]
        for dim in TIERS:
            mn = sum(r["levels"][dim][0] for r in rows)
            mx = sum(r["levels"][dim][1] for r in rows)
            if [mn, mx] != list(ch["levels"][dim]):
                bad.append(f"ف{ch['chapter']}:{dim}")
        if [sum(r["total"][0] for r in rows), sum(r["total"][1] for r in rows)] != [ch["min"], ch["max"]]:
            bad.append(f"ف{ch['chapter']}:total")
    check("جمع فرعی = اصلی در ۸ فصل × ۴ بُعد", not bad, "؛ ".join(bad) if bad else "")

    # T3 — کل‌ها
    gmin = sum(ch["min"] for ch in chapters)
    gmax = sum(ch["max"] for ch in chapters)
    check("کل پاکت = ۳۶۸–۵۵۲", [gmin, gmax] == [GRAND["min"], GRAND["max"]], f"دریافت: {gmin}–{gmax}")
    gt = {x: [sum(ch["levels"][x][0] for ch in chapters), sum(ch["levels"][x][1] for ch in chapters)] for x in TIERS}
    check("باند سه سطح = ۱۲۰–۱۸۰ / ۱۷۰–۲۵۵ / ۷۸–۱۱۷", gt == LEVEL_BANDS, str(gt))
    check("جمع سه سطح = کل پاکت (در هر دو سر)",
          sum(gt[x][0] for x in TIERS) == gmin and sum(gt[x][1] for x in TIERS) == gmax,
          f"{sum(gt[x][0] for x in TIERS)}–{sum(gt[x][1] for x in TIERS)}")

    # T4 — نسبت ۳۲٫۶/۴۶٫۲/۲۱٫۲ و یکسانی در دو سر پاکت
    rmin = {x: round(100 * gt[x][0] / gmin, 1) for x in TIERS}
    rmax = {x: round(100 * gt[x][1] / gmax, 1) for x in TIERS}
    ok = all(
        abs(rmin[x] - OWNER_RATIOS[x]) < 0.1 and abs(rmax[x] - OWNER_RATIOS[x]) < 0.1
        and abs(rmin[x] - rmax[x]) < 0.05
        for x in TIERS
    )
    check("نسبت ۳۲٫۶/۴۶٫۲/۲۱٫۲ — یکسان در حداقل و حداکثر", ok, f"min={rmin} max={rmax}")

    # T5 — بازهٔ صفحهٔ ۸ فصل بودجه = کالیبراسیون چاپی مالک
    calib = {int(x["no"]): (int(x["from"]), int(x["to"])) for x in c["chapters"]}
    bad = [ch["chapter"] for ch in chapters if (ch["pages"][0], ch["pages"][1]) != calib[ch["chapter"]]]
    check("بازهٔ صفحهٔ ۸ فصل = کالیبراسیون چاپی (۱–۱۸ … ۱۲۷–۱۴۴)", not bad, "؛ ".join(map(str, bad)) if bad else "")

    # T6 — نقشهٔ مباحث: شمارش‌ها و دامنهٔ صفحه‌ها و ارزش‌ها
    nA = sum(len(x["main"]) for x in t["chapters"])
    nB = sum(len(x["subsidiary"]) for x in t["chapters"])
    check("نقشهٔ مباحث = ۴۷ اصلی + ۱۶ فرعی = ۶۳", nA == 47 and nB == 16, f"{nA}/{nB}")
    bad = []
    for x in t["chapters"]:
        lo, hi = calib[x["chapter"]]
        for grp in ("main", "subsidiary"):
            for m in x[grp]:
                for a, bb in m["pages"]:
                    if not (lo <= a <= bb <= hi):
                        bad.append(f"ف{x['chapter']}:{m['topic']}:ص{a}-{bb}")
                vals = (4, 5) if grp == "main" else (3, 4)
                if m["value"] not in vals:
                    bad.append(f"ارزش ف{x['chapter']}:{m['topic']}")
    check("همهٔ صفحه‌ها داخل بازهٔ فصل + ارزش الف∈{۴,۵} و ب∈{۳,۴}", not bad, "؛ ".join(bad) if bad else "")

    # T7 — حکم ص۵۳: فقط در ف۳ (داخل الگوی فصل ۳)
    hits = []
    for x in t["chapters"]:
        for grp in ("main", "subsidiary"):
            for m in x[grp]:
                if any(a <= 53 <= bb for a, bb in m["pages"]):
                    hits.append((x["chapter"], grp, m["topic"]))
    ok = len(hits) == 1 and hits[0][0] == 3 and hits[0][1] == "subsidiary"
    alg = [r["topic"] for r in chapters[2]["subTopics"]]
    check("ص ۵۳ فقط در ف۳-فرعی (ساعت) — طبق حکم داخل «الگوی شکل و رابطه»", ok and "الگوی شکل و رابطه" in alg, str(hits))

    # T8 — ساختار ردیف‌ها به‌ازای هر فصل
    cnt = Counter(ch["chapter"] for ch in chapters for _ in ch["subTopics"])
    expc = {1: 4, 2: 5, 3: 3, 4: 4, 5: 4, 6: 5, 7: 4, 8: 3}
    check("ردیف‌های فرعی هر فصل = ۴/۵/۳/۴/۴/۵/۴/۳", dict(cnt) == expc, str(dict(cnt)))

    print()
    if fails:
        print(f"قرمز: {len(fails)} آزمون ناموفق")
        sys.exit(1)
    print("همهٔ آزمون‌ها سبز — بودجهٔ G2 و نقشهٔ مباحث سازگار و دو-منبعی تأیید شد.")


if __name__ == "__main__":
    main()
