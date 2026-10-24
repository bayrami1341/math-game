#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify-skeleton-handoff.py — گیت ماشینی بسته‌های اسکلت ساخت G2/G3 (fail-closed)
حکم مالک: trace 1a16dd37ae2509d9 — «اسکلت بنا قبل از هر تحلیل به دو بخش قبلی ارسال شود»
نسخهٔ ۲ گیت: همهٔ جداول «مالک-عیناً» هستند و گیت سازگاری درونی‌شان را رقم‌به‌رقم آزمون می‌کند.
هر تغییری در handoff/SKELETON-*-KH-v1.json فقط با exit 0 این گیت معتبر است.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
G2 = json.loads((ROOT / "handoff" / "SKELETON-G2-KH-v1.json").read_text(encoding="utf-8"))
G3 = json.loads((ROOT / "handoff" / "SKELETON-G3-KH-v1.json").read_text(encoding="utf-8"))

results = []


def check(name, cond, detail=""):
    results.append((bool(cond), name, detail))


# ---------- 1) G2 spine ----------
g2c = G2["spine"]["chapters"]
check("G2: تعداد فصل‌ها = ۸", len(g2c) == 8)
check("G2: آغاز فصل‌ها = ۱/۱۹/…/۱۲۷ (گام ۱۸، پایان ف۸=۱۴۴)",
      [c["printedStart"] for c in g2c] == [1, 19, 37, 55, 73, 91, 109, 127]
      and all(c["printedEnd"] - c["printedStart"] == 17 for c in g2c) and g2c[-1]["printedEnd"] == 144)
check("G2: قاعدهٔ فایل = چاپی+۶ در همهٔ فصل‌ها",
      all(c["fileStart"] - c["printedStart"] == 6 and c["fileEnd"] - c["printedEnd"] == 6 for c in g2c))
check("G2: پس‌صفحات ۱۴۵ شابلون / ۱۴۶ نظرسنجی",
      [(t["printed"], t["kind"]) for t in G2["spine"]["tailPages"]] == [(145, "شابلون"), (146, "نظرسنجی")])

# ---------- 2) G2 budget: owner verbatim ----------
b2 = G2["budget"]
check("G2: بودجه «مالک-عیناً» با trace 1a16db7148d48ae5",
      b2["prov"] == "OWNER" and b2["sourceTrace"] == "1a16db7148d48ae5")
check("G2: نام سه سطح = دانشی/کاربردی/استدلالی",
      b2["levels"] == ["دانشی", "کاربردی", "استدلالی"])
gt2 = b2["grandTotal"]
check("G2: کل پاکت = ۳۶۸–۵۵۲ و باند سه سطح کل = ۱۲۰–۱۸۰/۱۷۰–۲۵۵/۷۸–۱۱۷",
      gt2["min"] == 368 and gt2["max"] == 552
      and gt2["levels"] == {"دانشی": [120, 180], "کاربردی": [170, 255], "استدلالی": [78, 117]})
check("G2: جمع باند سه سطح = کل پاکت در هر دو سر",
      120 + 170 + 78 == 368 and 180 + 255 + 117 == 552)
check("G2: نسبت‌ها = ۳۲٫۶/۴۶٫۲/۲۱٫۲",
      b2["ratiosClaimed"] == {"دانشی": 0.326, "کاربردی": 0.462, "استدلالی": 0.212})
ch2 = b2["chapters"]
mins2 = [c["min"] for c in ch2]
maxs2 = [c["max"] for c in ch2]
check("G2: جدول اصلی عیناً = ۴۸/۶۰/۳۶/۴۸/۴۰/۶۰/۴۰/۳۶ × ۱٫۵",
      mins2 == [48, 60, 36, 48, 40, 60, 40, 36] and maxs2 == [72, 90, 54, 72, 60, 90, 60, 54])
check("G2: جمع فصل‌ها = ۳۶۸/۵۵۲", sum(mins2) == 368 and sum(maxs2) == 552)
check("G2: قاعدهٔ ۱٫۵× در هر ۸ فصل", all(m == 1.5 * n for n, m in zip(mins2, maxs2)))
check("G2: صفحات ۸ فصل = کالیبراسیون چاپی (۱–۱۸،…،۱۲۷–۱۴۴)",
      [c["pages"] for c in ch2] == [[1, 18], [19, 36], [37, 54], [55, 72], [73, 90], [91, 108], [109, 126], [127, 144]])

rows2 = [(ch, st) for ch in ch2 for st in ch["subTopics"]]
check("G2: جدول فرعی = ۳۲ ردیف با توزیع فصلی ۴/۵/۳/۴/۴/۵/۴/۳",
      len(rows2) == 32 and [len(ch["subTopics"]) for ch in ch2] == [4, 5, 3, 4, 4, 5, 4, 3])
ok_rows = all(
    sum(st["levels"][lv][0] for st in ch["subTopics"]) == ch["levels"][lv][0]
    and sum(st["levels"][lv][1] for st in ch["subTopics"]) == ch["levels"][lv][1]
    for ch in ch2 for lv in ("دانشی", "کاربردی", "استدلالی"))
check("G2: جمع سه سطح ردیف‌های هر فصل = باند سه سطح فصل (۸×۳ بُعد)", ok_rows)
ok_tot = all(
    sum(st["total"][0] for st in ch["subTopics"]) == ch["min"]
    and sum(st["total"][1] for st in ch["subTopics"]) == ch["max"]
    for ch in ch2)
check("G2: جمع ردیف‌های فرعی هر فصل = عدَد فصل در جدول اصلی (هر دو سر)", ok_tot)
ok_self = all(
    st["total"][0] == st["levels"]["دانشی"][0] + st["levels"]["کاربردی"][0] + st["levels"]["استدلالی"][0]
    and st["total"][1] == st["levels"]["دانشی"][1] + st["levels"]["کاربردی"][1] + st["levels"]["استدلالی"][1]
    for _, st in rows2)
check("G2: خودسازگاری ۳۲ ردیف (جمع سه سطح = جمع ردیف)", ok_self)
check("G2: جمع هر ردیف ∈ {۱۲–۱۸، ۱۰–۱۵}",
      all(st["total"] in ([12, 18], [10, 15]) for _, st in rows2))
check("G2: قاعدهٔ ص۵۳ در فایل عیناً ثبت است",
      "۵۳" in b2["foldingRule"] and "الگوی شکل و رابطه" in b2["foldingRule"])

# ---------- 3) G2 topic map: owner verbatim 63 rows ----------
tm2 = G2["topicMap"]
check("G2: نقشهٔ مباحث «مالک-عیناً» با trace 1a16db7db7f678a5",
      tm2["prov"] == "OWNER" and tm2["sourceTrace"] == "1a16db7db7f678a5")
tc = tm2["counts"]
tch = tm2["chapters"]
main_n = sum(len(c["main"]) for c in tch)
sub_n = sum(len(c["subsidiary"]) for c in tch)
check("G2: ۴۷ الف + ۱۶ ب = ۶۳ مبحث",
      tc == {"main": 47, "subsidiary": 16, "total": 63} and main_n == 47 and sub_n == 16 and main_n + sub_n == 63)
check("G2: توزیع فصلی = ۷+۲/۷+۲/۵+۱/۷+۱/۵+۲/۶+۲/۵+۳/۵+۳",
      [(len(c["main"]), len(c["subsidiary"])) for c in tch]
      == [(7, 2), (7, 2), (5, 1), (7, 1), (5, 2), (6, 2), (5, 3), (5, 3)])
ok_vals = all(r["value"] in (4, 5) for c in tch for r in c["main"]) and \
          all(r["value"] in (3, 4) for c in tch for r in c["subsidiary"])
check("G2: ارزش‌ها ∈ الف{۴،۵} و ب{۳،۴} در هر ۶۳ ردیف", ok_vals)
ok_pages = all(
    all(ch["pages"][0] <= p <= ch["pages"][1] for span in r["pages"] for p in span)
    for ch in tch for r in (ch["main"] + ch["subsidiary"]))
check("G2: همهٔ صفحات نقشه داخل بازهٔ فصل خودش است", ok_pages)
f3sub = tch[2]["subsidiary"]
check("G2: ص۵۳ فقط در ف۳-فرعی (ساعت با دقیقه، ربع و نیم) با حکم مالک",
      any(53 in span for r in f3sub for span in r["pages"])
      and not any(53 in span for i, c in enumerate(tch) if i != 2
                  for r in (c["main"] + c["subsidiary"]) for span in r["pages"]))
check("G2: چارچوب مالک (راهنمای دوم / الف-ب / شماره از ۱ / صفحهٔ چاپ) ثبت است",
      len(tm2.get("ownerFraming", [])) >= 3)

# ---------- 4) G3 spine ----------
g3c = G3["spine"]["chapters"]
check("G3: ۸ فصل با آغازهای ۸/۲۶/…/۱۳۴ (گام ۱۸) و ۶ سطر درون‌فصلی هر فصل",
      len(g3c) == 8 and [c["printedStart"] for c in g3c] == [8, 26, 44, 62, 80, 98, 116, 134]
      and all(len(c["toc"]) == 6 and c["toc"][0]["kind"] == "حلّ مسئله"
              and all(k["kind"] == "درس" for k in c["toc"][1:5]) and c["toc"][5]["kind"] == "مرور فصل"
              for c in g3c))
check("G3: عناوین فهرست کتاب",
      [c["bookTitle"] for c in g3c] == ["الگوها", "عددهای چهار رقمی", "عددهای کسری", "ضرب و تقسیم",
                                        "محیط و مساحت", "جمع و تفریق", "آمار و احتمال", "ضرب عددها"])
check("G3: هشدار اسکن C305 ثبت است (شیفت فایل/چاپ)",
      "pdf140" in G3["pageReferenceRule"]["fileRule"] or "pdf14" in G3["pageReferenceRule"]["fileRule"])

# ---------- 5) G3 budget: owner verbatim ----------
b3 = G3["budget"]
check("G3: بودجه «مالک-عیناً» با trace 1a16d58b643cc6b5",
      b3["prov"] == "OWNER" and b3["sourceTrace"] == "1a16d58b643cc6b5")
check("G3: تعریف سه سطح (دانشی/کاربردی/استدلالی) عیناً موجود است",
      set(b3["levels"]) == {"دانشی", "کاربردی", "استدلالی"}
      and all("definition" in v for v in b3["levels"].values()))
gt3 = b3["grandTotal"]
check("G3: کل پاکت = ۴۵۶–۶۸۴ و باند سه سطح کل = ۱۵۰–۲۲۶/۲۱۲–۳۱۸/۹۴–۱۴۰",
      gt3["min"] == 456 and gt3["max"] == 684
      and gt3["levels"] == {"دانشی": [150, 226], "کاربردی": [212, 318], "استدلالی": [94, 140]})
check("G3: جمع باند سه سطح = کل پاکت در هر دو سر",
      150 + 212 + 94 == 456 and 226 + 318 + 140 == 684)
check("G3: نسبت‌ها = ۳۳/۴۶/۲۱",
      b3["ratiosClaimed"] == {"دانشی": 0.33, "کاربردی": 0.46, "استدلالی": 0.21})
ch3 = b3["chapters"]
mins3 = [c["min"] for c in ch3]
maxs3 = [c["max"] for c in ch3]
check("G3: جدول اصلی عیناً = ۴۰/۴۸/۶۰/۱۰۰/۴۸/۶۰/۴۰/۶۰ × ۱٫۵ (ف۴=۱۰۰–۱۵۰)",
      mins3 == [40, 48, 60, 100, 48, 60, 40, 60] and maxs3 == [60, 72, 90, 150, 72, 90, 60, 90])
check("G3: جمع فصل‌ها = ۴۵۶/۶۸۴ و قاعدهٔ ۱٫۵× در هر ۸ فصل",
      sum(mins3) == 456 and sum(maxs3) == 684 and all(m == 1.5 * n for n, m in zip(mins3, maxs3)))
rows3 = [(ch, t) for ch in ch3 for t in ch["topics"]]
check("G3: جدول موضوعی = ۳۶ ردیف با توزیع فصلی ۴/۴/۵/۵/۴/۵/۴/۵",
      len(rows3) == 36 and [len(ch["topics"]) for ch in ch3] == [4, 4, 5, 5, 4, 5, 4, 5])
ok_rows3 = all(
    sum(t["levels"][lv][0] for t in ch["topics"]) == ch["levels"][lv][0]
    and sum(t["levels"][lv][1] for t in ch["topics"]) == ch["levels"][lv][1]
    for ch in ch3 for lv in ("دانشی", "کاربردی", "استدلالی"))
check("G3: جمع سه سطح ردیف‌های هر فصل = باند سه سطح فصل (۸×۳ بُعد)", ok_rows3)
ok_tot3 = all(
    sum(t["total"][0] for t in ch["topics"]) == ch["min"]
    and sum(t["total"][1] for t in ch["topics"]) == ch["max"]
    for ch in ch3)
check("G3: جمع ردیف‌های موضوعی هر فصل = عدَد فصل (هر دو سر)", ok_tot3)
check("G3: قاعدهٔ ارزش-۳ عیناً ثبت است",
      "ارزش ۳" in b3["foldingRule"] and "نزدیک‌ترین موضوع اصلی" in b3["foldingRule"])
check("G3: یادداشت ف۳ (کسر = اصلاح رأی معلم) و تطبیق ماتریس عیناً ثبت است",
      any("رأی معلم" in (ch.get("note") or "") for ch in ch3)
      and b3.get("reconciliation", {}).get("gap", "").startswith("۴۵۲"))

# ---------- 6) package integrity ----------
for name, pkg in (("G2", G2), ("G3", G3)):
    ok = (pkg["schema"] == "khshab.skeleton-handoff/v1"
          and {u["id"] for u in pkg["recipients"]} == {"ACHILLES-BOT", "ARENA"}
          and pkg["orderTrace"] == "1a16dd37ae2509d9"
          and pkg["sourceAnchors"]["repo"] == "/home/z/math-game-repo"
          and all(len(pkg["usageProtocol"][u]) >= 5 for u in ("ACHILLES-BOT", "ARENA"))
          and len(pkg.get("history", [])) >= 2)
    check(f"{name}: شِما/گیرندگان/trace/زنجیرهٔ امانت/پروتکل سالم", ok)

# ---------- verdict ----------
fails = [(n, d) for ok, n, d in results if not ok]
w = max(len(n) for _, n, _ in results)
for ok, n, d in results:
    print(("✅" if ok else "❌") + f" | {n.ljust(w)}" + (f" | {d}" if d else ""))
print(f"\nجمع: {len(results)} آزمون | سبز: {len(results) - len(fails)} | قرمز: {len(fails)}")
if fails:
    print("FAIL-CLOSED: بسته معتبر نیست.")
    sys.exit(1)
print("ALL-GREEN: اسکلت‌های G2/G3 (دادهٔ عیناً مالک) با گیت سازگارند (exit 0).")
sys.exit(0)
