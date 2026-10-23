#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────────────────────
// production-robot.ts — ریزربات حلقهٔ تولید محتوای دامنه‌دار (BP-020)
//
// مأموریت: «بچ بعدی → تولید قاعده‌محور → گیت‌ها → گزارش» بدون LLM و بدون شبکه.
// تولید سؤال کاملاً rule-based با seed ثابت است (بازتولید‌پذیر؛ همان seed ⇒ همان بچ).
//
// صف دامنه‌ها (از DOMAIN-MATRIX.json + ترتیب BP-019):
//   G3: D4 → D3 → D8 → D5 → D2 → D6 → D1 → D7    سپس    G2: D1 → D6
//
// مصرف:
//   bun scripts/production-robot.ts --target G3-D4 --seed 1404     # یک بچ
//   bun scripts/production-robot.ts --all                          # تا رفع کامل حداقل‌های قانون
//   bun scripts/production-robot.ts --target G3-D4 --dry-run       # فقط نقشه — بدون نوشتن
//   bun scripts/production-robot.ts --self-test                    # اثبات fail-closed با بچ آلوده
//
// گیت‌های درون‌فرایندی (ترتیب BP-020 T2 — هر قرمز = بازگردانی فایل اصلی + خروج ۱):
//   ۱) اعتبارسنجی موتور واقعی (cartridge-schema.js از راه robot-validate-harness.mjs)
//   ۲) npm test  (public/math-game)
//   ۳) pytest    (authoring/tests)
//   ۴) coverage-report.ts  →  reports/coverage-current.md  (ردیف D4-G3: موجود ≥ حداقل، تأییدشده = ۰)
//   ۵) گیت ضد-ادعا scripts/check-domain-claims.sh
//
// سه ممنوعیت مطلق (سخت‌کدشده — گارد خودآزمایی در هر دور):
//   ۱) ربات هرگز وضعیت «تأییدشده» نمی‌سازد (مُهر فقط با دست معلم)
//   ۲) ربات هرگز v1.0 تگ نمی‌زند و OFFICIAL-HEADS.json / رجیستری را نمی‌نویسد
//   ۳) ربات هرگز عبارت «پایه آماده» تولید نمی‌کند (اسکن روی همهٔ خروجی‌های خودش)
//      — بنر DRAFT گزارش پوشش متعلق به ابزار رسمی گیت است و دست‌نخورده می‌ماند.
//
// مالکیت نوشتن ربات (whitelist): KH-G3-MATH.json، authoring/batches/<batchId>.json،
//   reports/coverage-current.md، reports/robot-log.md — جز این، هیچ.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  validateCartridge,
  extractQRefs,
  parsePlainMultiplication,
  parseOptionValue,
  ANSWER_FORMAT_VALUES,
  DOMAIN_CODE_PATTERN
} from "./robot-validate-harness.mjs";

// ── مسیرها ───────────────────────────────────────────────────────────────────
const ROOT = path.resolve(import.meta.dir, "..");
const MATRIX_PATH = path.join(ROOT, "public/math-game/authoring/DOMAIN-MATRIX.json");
const CARTRIDGE = {
  G3: path.join(ROOT, "public/math-game/cartridges/KH-G3-MATH.json"),
  G2: path.join(ROOT, "public/math-game/cartridges/KH-G2-MATH.json")
};
const BATCHES_DIR = path.join(ROOT, "authoring/batches");
const COVERAGE_MD = path.join(ROOT, "reports/coverage-current.md");
const ROBOT_LOG = path.join(ROOT, "reports/robot-log.md");
const MG_DIR = path.join(ROOT, "public/math-game");

// ── صف و seedهای پیش‌فرض هر دامنه (ثابت — بازتولید‌پذیر) ────────────────────
const QUEUE = [
  "G3-D4", "G3-D3", "G3-D8", "G3-D5", "G3-D2", "G3-D6", "G3-D1", "G3-D7",
  "G2-D1", "G2-D2", "G2-D3", "G2-D4", "G2-D5", "G2-D6"
];
const DEFAULT_SEEDS = {
  "G3-D4": 1404, "G3-D3": 1403, "G3-D8": 1408, "G3-D5": 1405,
  "G3-D2": 1402, "G3-D6": 1406, "G3-D1": 1401, "G3-D7": 1407,
  "G2-D1": 2401, "G2-D2": 2402, "G2-D3": 2403, "G2-D4": 2404, "G2-D5": 2405, "G2-D6": 2406
};

// ── سه ممنوعیت مطلق — سخت‌کدشده ──────────────────────────────────────────────
const FORBIDDEN_STATUS = "تأییدشده";      // ممنوعیت ۱: ربات هرگز این وضعیت نمی‌سازد
const REQUIRED_STATUS = "نیاز به تأیید";  // همهٔ سؤال‌های ربات
const FORBIDDEN_PHRASE = "پایه آماده";    // ممنوعیت ۳: هرگز در خروجی‌های ربات
const FORBIDDEN_VERSION_TAG = "v1.0";     // ممنوعیت ۲: هرگز تگ/برچسب نسخهٔ نهایی
const FORBIDDEN_WRITE_PATHS = [
  "public/math-game/authoring/OFFICIAL-HEADS.json",
  "authoring/teacher-stamps.json",
  "blueprints/registry.json",
  "public/math-game/cartridges/KH-G2-MATH.json",
  "public/math-game/cartridges/KH-DEMO-MATH.json",
  "worklog.md"
];
/** فایل‌هایی که ربات مجاز به نوشتن است (whitelist — ممنوعیت ۲ را ساختاراً قفل می‌کند) */
const WRITABLE_WHITELIST = [
  "public/math-game/cartridges/KH-G3-MATH.json",
  "reports/coverage-current.md",
  "reports/robot-log.md",
  "authoring/batches/" // پیشوند مجاز — فقط فایل بچ خودش
];

// ── ابزارها ──────────────────────────────────────────────────────────────────
const fa = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const nowIso = () => new Date().toISOString();

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const ri = (rng: Rng, a: number, b: number) => a + Math.floor(rng() * (b - a + 1)); // [a..b]
const pick = <T,>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function die(msg: string, code = 1): never {
  console.error(`⛔ [ریزربات ۲] ${msg}`);
  process.exit(code);
}
const log = (m: string) => console.log(`🤖 [ریزربات ۲] ${m}`);

// ── ماتریس قانون ─────────────────────────────────────────────────────────────
const MATRIX = JSON.parse(readFileSync(MATRIX_PATH, "utf-8"));
if (MATRIX.schema !== "khshab.domain-matrix/v1") die("ماتریس قانون با schema ناشناخته");

function familyOf(target: string) { return target.split("-")[0]; }
function domainOf(target: string) { return target.split("-")[1]; }

function matrixSpec(target: string) {
  const fam = MATRIX.families[`KH-${familyOf(target)}-MATH`];
  const dom = fam?.domains[domainOf(target)];
  if (!fam || !dom) die(`دامنهٔ ${target} در ماتریس قانون نیست`);
  return { fam, dom, chapter: dom.chapter, min: dom.min, qTypes: dom.qTypes };
}

/** شمارش پوشش یک کارتریج — دقیقاً هم‌قواعد coverage-report.ts */
function coverageOf(cart: any, target: string) {
  const { dom } = matrixSpec(target);
  const code = domainOf(target);
  let count = 0, confirmed = 0;
  for (const q of cart.questionBank ?? []) {
    const c = typeof q.domainCode === "string" ? q.domainCode.trim().toUpperCase() : null;
    if (c !== code) continue;
    count++;
    if (q.status === FORBIDDEN_STATUS) confirmed++;
  }
  return { count, confirmed, min: dom.min };
}

// ─────────────────────────────────────────────────────────────────────────────
// مولد قاعده‌محور D4-G3 «ضرب و تقسیم» — ده نوع تمرین ماتریس، سه فاز دشواری:
//   فاز ۱: جدول ۱..۵ | فاز ۲: جدول ۶..۹ | فاز ۳: دورقمی×تک‌رقمی و تقسیم بزرگ‌تر
// تقسیم‌ها همه بدون باقی‌مانده (با ساخت N = حاصل×شمارنده). قالب پاسخ فقط
// «گزینه‌ای» (۴ گزینه، دقیقاً یک درست) و «عدد» — طبق فاز الف و قانون D4.
// ─────────────────────────────────────────────────────────────────────────────

const NAMES = ["سارا", "امیر", "مریم", "رضا", "نرگس", "علی", "الهه", "کیان", "یاسمن", "پارسا", "شادی", "بهنام"];
const OBJS = ["مداد", "خودکار", "توپ", "شیرینی", "مهره", "کاشی", "کتاب", "گل", "فنجان", "برچسب", "ماشین‌بازی", "سنجاق"];
const ORDINAL = ["", "اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم", "دهم"];

type Draft = {
  qType: string;
  prompt: string;
  ans: number;
  ds: { v: number; why: string }[];      // گزینه‌های انحرافی با دلیل پداگوژیک
  key?: string;                          // کلید یکتایی ریاضی (اختیاری)
  textual?: { options: string[]; answerIndex: number }; // گزینه‌های متنی (غیرعددی)
  cpa: string;
  domain: "CORE" | "DEPTH";
  renderHint?: string;
};

type Ctx = { rng: Rng; phase: 1 | 2 | 3; fmt: "گزینه‌ای" | "عدد"; used: Set<string>; qType?: string };

function nameOf(ctx: Ctx) { return pick(ctx.rng, NAMES); }
function objOf(ctx: Ctx) { return pick(ctx.rng, OBJS); }

/** زوج جدول ضرب بر فاز: ۱ → ۲..۵ | ۲ → دست‌کم یک عامل ۶..۹ | ۳ → با ۱۰ یا هر دو ۶..۹ */
function tablePair(ctx: Ctx): [number, number] {
  if (ctx.phase === 1) return [ri(ctx.rng, 2, 5), ri(ctx.rng, 2, 5)];
  if (ctx.phase === 2) return [ri(ctx.rng, 2, 5), ri(ctx.rng, 6, 9)];
  return ctx.rng() < 0.5 ? [ri(ctx.rng, 2, 9), 10] : [ri(ctx.rng, 6, 9), ri(ctx.rng, 6, 9)];
}
/** دورقمی × تک‌رقمی (حاصل ≤ ۹۹۹ — سقف موتور) */
function twoDigitPair(ctx: Ctx): [number, number] {
  return [ri(ctx.rng, 11, 49), ri(ctx.rng, 2, 9)];
}

// ── ده مولد نوع‌تمرین (هرکدام ۳+ قالب جمله — انتخاب با RNG بذردار) ───────────
const GENERATORS: Record<string, (c: Ctx) => Draft> = {
  "مفهوم: دسته‌های مساوی→ضرب": (c) => {
    const [n, k] = c.phase === 3 ? twoDigitPair(c) : tablePair(c);
    const who = nameOf(c), obj = objOf(c);
    const stem = c.rng();
    const whySum = "جمع به‌جای ضرب";
    if (stem < 0.2 && c.phase !== 3) {
      // گونهٔ متنی (شبیه Q-101 میراثی): شناسایی جمع تکراری — گزینه‌ها متنی‌اند
      const correct = `${fa(k)} را ${fa(n)} بار با هم جمع می‌کنیم`;
      const opts = [correct, `${fa(n)} را ${fa(n)} بار با هم جمع می‌کنیم`, `${fa(k)} را ${fa(k)} بار با هم جمع می‌کنیم`, `${fa(n)} و ${fa(k)} را با هم جمع می‌کنیم`];
      return { qType: "مفهوم: دسته‌های مساوی→ضرب", prompt: `${fa(n)} × ${fa(k)} با کدام جمع تکراری برابر است؟`, ans: n * k, ds: [], key: `s5|${n}x${k}`, textual: { options: opts, answerIndex: 0 }, cpa: "علامتی", domain: "CORE" };
    }
    const drafts = [
      { p: `${who} ${fa(n)} بستهٔ ${obj} خریده است؛ در هر بسته ${fa(k)} تا ${obj} هست. روی هم چند تا ${obj} خریده است؟`, w: whySum },
      { p: `روی میز ${fa(n)} بشقاب است و در هر بشقاب ${fa(k)} تا ${obj} گذاشته‌اند. روی هم چند تا ${obj} روی میز است؟`, w: whySum },
      { p: `${who} برای جشن ${fa(n)} ردیف صندلی چیده است؛ در هر ردیف ${fa(k)} صندلی. چند صندلی برای جشن آماده است؟`, w: "یک ردیف کم/زیاد شمرده شد" },
      { p: `در آرایش مستطیلیِ کاشی‌ها ${fa(n)} ردیف هست و در هر ردیف ${fa(k)} کاشی. چند کاشی در این آرایش به کار رفته است؟`, w: "خطای مرز جدول" }
    ];
    const d = pick(c.rng, drafts);
    return {
      qType: "مفهوم: دسته‌های مساوی→ضرب", prompt: d.p, ans: n * k, key: `m|${n},${k}`,
      ds: [
        { v: n + k, why: whySum },
        { v: (n - 1) * k, why: "یک دسته کم شمرده شد" },
        { v: n * (k + 1), why: "در هر دسته یکی زیاد شمرده شد" },
        { v: (n + 1) * k, why: "یک دسته زیاد شمرده شد" },
        { v: k * k, why: "دسته‌ها در هم ضرب شد" }
      ],
      cpa: "تصویری", domain: "CORE", renderHint: c.phase !== 3 ? `آرایش ${fa(n)} در ${fa(k)}` : undefined
    };
  },

  "محور پرشی": (c) => {
    const k = c.phase === 3 ? 10 : ri(c.rng, c.phase === 1 ? 2 : 6, c.phase === 1 ? 5 : 9);
    const n = ri(c.rng, 3, 9);
    const who = nameOf(c);
    const stem = c.rng();
    if (stem < 0.25) {
      // وارونه: از مقصد به تعداد پرش
      return {
        qType: "محور پرشی", prompt: `${who} با پرش‌های ${fa(k)}تایی از صفر روی محور اعداد به عدد ${fa(n * k)} رسیده است. او چند پرش برداشته است؟`,
        ans: n, key: `pr-rev|${k},${n}`,
        ds: [
          { v: n + 1, why: "یک پرش زیاد شمرده شد" },
          { v: Math.max(0, n - 1), why: "یک پرش کم شمرده شد" },
          { v: k, why: "اندازهٔ پرش به‌جای تعداد" },
          { v: n + k, why: "جمع اندازه و تعداد پرش" }
        ],
        cpa: "تصویری", domain: "CORE", renderHint: `محور اعداد ۰ تا ${fa(n * k)} با پرش ${fa(k)}تایی`
      };
    }
    if (stem < 0.5) {
      return {
        qType: "محور پرشی", prompt: `با شمارش پرشی ${fa(k)}تا${fa(k)}تا روی محور اعداد: ${fa(k)}، ${fa(2 * k)}، ${fa(3 * k)}، … ؛ عدد ${ORDINAL[n]}م این الگو کدام است؟`,
        ans: n * k, key: `pr-seq|${k},${n}`,
        ds: [
          { v: n * k + k, why: "یک پرش زیاد رفته است" },
          { v: Math.max(0, n * k - k), why: "یک پرش کم رفته است" },
          { v: n + k, why: "جمع به‌جای پرش" },
          { v: n * (k + 1), why: "پرش بلندتر از الگو" }
        ],
        cpa: "تصویری", domain: "CORE", renderHint: `محور اعداد با کمانک‌های پرش ${fa(k)}تایی`
      };
    }
    const actor = c.rng() < 0.5 ? `${who} روی خط اعداد از صفر شروع می‌کند و با پرش‌های ${fa(k)}تایی جلو می‌رود` : `یک قورباغه روی محور اعداد با هر پرش ${fa(k)} واحد جلو می‌پرد و از صفر شروع می‌کند`;
    return {
      qType: "محور پرشی", prompt: `${actor}. بعد از ${fa(n)} پرش روی کدام عدد است؟`,
      ans: n * k, key: `pr|${k},${n}`,
      ds: [
        { v: n + k, why: "جمع به‌جای پرش" },
        { v: n * k + k, why: "یک پرش اضافه" },
        { v: Math.max(0, n * k - k), why: "یک پرش کم" },
        { v: n * (k + 1), why: "پرش بلندتر" }
      ],
      cpa: "تصویری", domain: "CORE", renderHint: `محور اعداد ۰ تا ${fa((n + 1) * k)}`
    };
  },

  "جدول ۲..۱۰ درجهت": (c) => {
    const [a, b] = tablePair(c);
    if (c.fmt === "گزینه‌ای") {
      // فرم خام a×b — موتور کلید را بازحساب می‌کند (ضد J12)؛ گزینه‌ها همسایه‌های جدول‌اند
      return {
        qType: "جدول ۲..۱۰ درجهت", prompt: `${fa(a)} × ${fa(b)} = ؟`, ans: a * b, key: `t-mcq|${a},${b}`,
        ds: [
          { v: (a - 1) * b, why: "خطای مرز جدول (یک ردیف کم)" },
          { v: a * (b + 1), why: "خطای مرز جدول (یک ستون زیاد)" },
          { v: a + b, why: "جمع به‌جای ضرب" },
          { v: (a + 1) * b, why: "خطای مرز جدول (یک ردیف زیاد)" }
        ],
        cpa: "علامتی", domain: "CORE"
      };
    }
    const stems = [
      `در جدول ضرب، ${fa(a)} در ${fa(b)} چند می‌شود؟`,
      `حاصل ضرب ${fa(a)} در ${fa(b)} چند است؟`,
      `${fa(a)} تکهٔ شکلات در هر دسته هست و ${fa(b)} دسته داریم؛ چند تکه شکلات می‌شود؟ (کمک بگیر: ضرب ${fa(a)} در ${fa(b)})`
    ];
    return { qType: "جدول ۲..۱۰ درجهت", prompt: pick(c.rng, stems), ans: a * b, key: `t-num|${a},${b}`, ds: [], cpa: "علامتی", domain: "CORE" };
  },

  "جابه‌جایی (زوج a×b/b×a)": (c) => {
    const [a, b] = c.phase === 3 ? twoDigitPair(c) : tablePair(c);
    const stem = c.rng();
    if (c.fmt === "گزینه‌ای" && stem < 0.55) {
      return {
        qType: "جابه‌جایی (زوج a×b/b×a)", prompt: `کدام عبارت هم‌حاصلِ ${fa(a)} × ${fa(b)} است؟`, ans: a * b, key: `cm-mcq|${a},${b}`,
        ds: [
          { v: a + b, why: "جمع به‌جای ضرب" },
          { v: a * (b + 1), why: "یک واحد به عامل دوم اضافه شد" },
          { v: (a + 1) * b, why: "یک واحد به عامل اول اضافه شد" },
          { v: (a - 1) * b, why: "یک واحد از عامل اول کم شد" }
        ],
        textual: {
          options: [`${fa(b)} × ${fa(a)}`, `${fa(a)} + ${fa(b)}`, `${fa(a)} × ${fa(b + 1)}`, `${fa(a + 1)} × ${fa(b)}`],
          answerIndex: 0
        },
        cpa: "علامتی", domain: "CORE"
      };
    }
    if (stem < 0.8) {
      return {
        qType: "جابه‌جایی (زوج a×b/b×a)", prompt: `${fa(a)} × ${fa(b)} و ${fa(b)} × ${fa(a)} هم‌حاصل‌اند. این حاصل چند است؟`,
        ans: a * b, key: `cm-num|${a},${b}`, ds: [], cpa: "علامتی", domain: "CORE"
      };
    }
    const obj = objOf(c);
    return {
      qType: "جابه‌جایی (زوج a×b/b×a)", prompt: `آرایشی با ${fa(a)} ردیف ${fa(b)}تاییِ ${obj} را می‌چرخانیم تا ${fa(b)} ردیف ${fa(a)}تایی شود. تعداد ${obj}ها چند تا می‌ماند؟`,
      ans: a * b, key: `cm-rot|${a},${b}`, ds: [], cpa: "تصویری", domain: "CORE", renderHint: `آرایش چرخیدهٔ ${fa(a)}×${fa(b)}`
    };
  },

  "×۰ و ×۱": (c) => {
    const n = c.phase === 3 ? ri(c.rng, 20, 99) : ri(c.rng, 3, 9);
    const zero = c.rng() < 0.55;
    const who = nameOf(c), obj = objOf(c);
    if (zero) {
      if (c.fmt === "گزینه‌ای") {
        return {
          qType: "×۰ و ×۱", prompt: `${who} ${fa(n)} جعبه دارد که در هر جعبه ۰ تا ${obj} است. روی هم چند تا ${obj} در جعبه‌ها هست؟`,
          ans: 0, key: `z0|${n}`,
          ds: [
            { v: n, why: "ضرب در صفر نادیده گرفته شد" },
            { v: n + n, why: "دوبرابرِ تعداد جعبه‌ها" },
            { v: 1, why: "یک به‌جای حاصل صفر" }
          ],
          cpa: "مجسم", domain: "CORE"
        };
      }
      const stems = [
        `حاصل ضرب ${fa(n)} در صفر چند است؟`,
        `${who} ${fa(n)} جعبهٔ کاملاً خالی دارد. جمع ${obj}های داخل جعبه‌ها چند تا است؟`
      ];
      return { qType: "×۰ و ×۱", prompt: pick(c.rng, stems), ans: 0, key: `z0n|${n}`, ds: [], cpa: "مجسم", domain: "CORE" };
    }
    if (c.fmt === "گزینه‌ای") {
      return {
        qType: "×۰ و ×۱", prompt: `هر یک از ${fa(n)} قفسه‌های کتابخانه ۱ گلدان گل دارد. روی هم چند گلدان روی قفسه‌هاست؟`,
        ans: n, key: `x1|${n}`,
        ds: [
          { v: n * 10, why: "یک در هر قفسه به ده برابر تبدیل شد" },
          { v: Math.max(0, n - 1), why: "یک قفسه کم شمرده شد" },
          { v: n + 1, why: "یک قفسه زیاد شمرده شد" }
        ],
        cpa: "مجسم", domain: "CORE"
      };
    }
    const stems = [
      `حاصل ضرب ${fa(n)} در ۱ چند است؟`,
      `${who} ${fa(n)} سبد دارد؛ در هر سبد دقیقاً ۱ توپ هست. روی هم چند توپ در سبدهاست؟`
    ];
    return { qType: "×۰ و ×۱", prompt: pick(c.rng, stems), ans: n, key: `x1n|${n}`, ds: [], cpa: "مجسم", domain: "CORE" };
  },

  "دوبرابر/نصف": (c) => {
    const x = c.phase === 3 ? ri(c.rng, 13, 49) : ri(c.rng, 3, 20);
    const double = c.rng() < 0.5;
    const whoA = nameOf(c), whoB = nameOf(c), obj = objOf(c);
    if (double) {
      if (c.fmt === "گزینه‌ای") {
        return {
          qType: "دوبرابر/نصف", prompt: `${whoA} ${fa(x)} تا ${obj} دارد؛ ${whoB} دوبرابر ${whoA} دارد. ${whoB} چند تا ${obj} دارد؟`,
          ans: 2 * x, key: `db|${x}`,
          ds: [
            { v: x + 1, why: "یکی بیشتر به‌جای دوبرابر" },
            { v: x + x + 1, why: "دوبرابر با خطای ±۱" },
            { v: Math.max(0, 2 * x - 2), why: "دوبرابر با خطای کم‌کردن" },
            { v: x * x, why: "خودش در خودش ضرب شد" }
          ],
          cpa: "علامتی", domain: "CORE"
        };
      }
      const stems = [`دوبرابرِ ${fa(x)} چند است؟`, `عدد ${fa(x)} دو برابرش چند می‌شود؟`];
      return { qType: "دوبرابر/نصف", prompt: pick(c.rng, stems), ans: 2 * x, key: `dbn|${x}`, ds: [], cpa: "علامتی", domain: "CORE" };
    }
    const y = x; // نصفِ ۲y — همیشه زوج
    if (c.fmt === "گزینه‌ای") {
      return {
        qType: "دوبرابر/نصف", prompt: `${fa(2 * y)} تا ${obj} را به‌طور مساوی بین ۲ نفر تقسیم می‌کنیم؛ سهم هر نفر چند تا است؟`,
        ans: y, key: `hf|${2 * y}`,
        ds: [
          { v: 2 * y - y + 1, why: "سهم اشتباه (یکی بیشتر)" },
          { v: 2 * y, why: "همان کل به‌جای سهم" },
          { v: Math.max(0, y - 1), why: "یکی کمتر از نصف" }
        ],
        cpa: "مجسم", domain: "CORE"
      };
    }
    const stems = [`نصفِ ${fa(2 * y)} چند است؟`, `عدد ${fa(2 * y)} نصفش چند می‌شود؟`];
    return { qType: "دوبرابر/نصف", prompt: pick(c.rng, stems), ans: y, key: `hfn|${2 * y}`, ds: [], cpa: "علامتی", domain: "CORE" };
  },

  "لنگر ۵/۱۰": (c) => {
    const a = c.phase === 3 ? ri(c.rng, 11, 25) : ri(c.rng, 3, 9);
    const who = nameOf(c);
    const stem = c.rng();
    if (stem < 0.3) {
      const t = pick(c.rng, [8, 9]);
      return {
        qType: "لنگر ۵/۱۰", prompt: `${fa(a)} × ۱۰ = ${fa(10 * a)} است. با کمک این لنگر، حاصل ${fa(a)} × ${fa(t)} چند می‌شود؟`,
        ans: a * t, key: `an|${a},${t}`,
        ds: [
          { v: 10 * a, why: "لنگر دهگانی سر جایش ماند" },
          { v: 10 * a + a, why: "به‌جای کم‌کردن، اضافه شد" },
          { v: Math.max(0, a * (t - 1)), why: "یک گروه بیشتر کم شد" }
        ],
        cpa: "علامتی", domain: "CORE"
      };
    }
    if (stem < 0.6) {
      if (c.fmt === "گزینه‌ای") {
        return {
          qType: "لنگر ۵/۱۰", prompt: `${who} برای حل ${fa(a)} × ۹ از لنگر ${fa(a)} × ۱۰ = ${fa(10 * a)} کمک گرفت. حاصل ${fa(a)} × ۹ چند است؟`,
          ans: 9 * a, key: `an9|${a}`,
          ds: [
            { v: 10 * a, why: "لنگر جابه‌جا نشد" },
            { v: 10 * a + a, why: "یک گروه اضافه شد" },
            { v: 8 * a, why: "یک گروه زیاد کم شد" }
          ],
          cpa: "علامتی", domain: "CORE"
        };
      }
      return { qType: "لنگر ۵/۱۰", prompt: `حاصل ${fa(a)} × ۹ را با لنگرِ ${fa(a)} × ۱۰ = ${fa(10 * a)} پیدا کن: ${fa(a)} × ۹ چند می‌شود؟`, ans: 9 * a, key: `an9n|${a}`, ds: [], cpa: "علامتی", domain: "CORE" };
    }
    if (stem < 0.85) {
      return {
        qType: "لنگر ۵/۱۰", prompt: `حاصل ${fa(a)} × ۵ نصفِ حاصل ${fa(a)} × ۱۰ است. ${fa(a)} × ۵ چند می‌شود؟`,
        ans: 5 * a, key: `an5|${a}`,
        ds: [
          { v: 10 * a, why: "نصف‌کردن فراموش شد" },
          { v: Math.max(0, 10 * a - a), why: "لنگر ۹ به‌جای ۵" },
          { v: 5 * a + 5, why: "یک گروه ۵تایی زیاد" }
        ],
        cpa: "علامتی", domain: "CORE"
      };
    }
    return {
      qType: "لنگر ۵/۱۰", prompt: `برای حل ${fa(a)} × ۶ اول می‌دانیم ${fa(a)} × ۵ = ${fa(5 * a)}؛ حالا یک ${fa(a)} دیگر به آن اضافه کنیم، حاصل ${fa(a)} × ۶ چند می‌شود؟`,
      ans: 6 * a, key: `an6|${a}`,
      ds: [
        { v: 5 * a, why: "گروه آخر اضافه نشد" },
        { v: 5 * a + 10, why: "دو تا گروه زیاد اضافه شد" },
        { v: 6 * a + a, why: "یک گروه اضافه شد" }
      ],
      cpa: "علامتی", domain: "CORE"
    };
  },

  "تقسیم مفهومی (بخش‌کردن)": (c) => {
    const d = c.phase === 1 ? ri(c.rng, 2, 5) : ri(c.rng, 2, 9);
    const q = c.phase === 1 ? ri(c.rng, 2, 10) : c.phase === 2 ? ri(c.rng, 2, 9) : ri(c.rng, 11, 30);
    const N = d * q; // بدون باقی‌مانده — ساختار تضمین می‌کند
    const obj = objOf(c), who = nameOf(c);
    const stem = c.rng();
    if (stem < 0.15) {
      return {
        qType: "تقسیم مفهومی (بخش‌کردن)", prompt: `${fa(N)} ÷ ${fa(d)} = ؟`, ans: q, key: `dv-raw|${N},${d}`,
        ds: [
          { v: N - d, why: "تفریق به‌جای تقسیم" },
          { v: q + 1, why: "یک گروه زیاد" },
          { v: Math.max(0, q - 1), why: "یک گروه کم" },
          { v: d, why: "شمارنده به‌جای سهم" }
        ],
        cpa: "علامتی", domain: "CORE"
      };
    }
    if (c.fmt === "گزینه‌ای") {
      const drafts = [
        `${fa(N)} تا ${obj} را به‌طور مساوی بین ${fa(d)} نفر تقسیم می‌کنیم. سهم هر نفر چند تا است؟`,
        `${who} ${fa(N)} تا ${obj} دارد و می‌خواهد آن‌ها در بشقاب‌های مساویِ ${fa(d)}تایی بچیند. چند بشقاب کامل لازم دارد؟`,
        `${fa(N)} شیرینی در ${fa(d)} بشقاب به‌طور مساوی ریخته شده است. در هر بشقاب چند شیرینی است؟`
      ];
      return {
        qType: "تقسیم مفهومی (بخش‌کردن)", prompt: pick(c.rng, drafts), ans: q, key: `dv|${N},${d}`,
        ds: [
          { v: N - d, why: "تفریق به‌جای تقسیم" },
          { v: N + d, why: "جمع به‌جای تقسیم" },
          { v: q + 1, why: "یک گروه زیاد" },
          { v: Math.max(0, q - 1), why: "یک گروه کم" },
          { v: d, why: "شمارندهٔ دسته به‌جای سهم" }
        ],
        cpa: "مجسم", domain: "CORE"
      };
    }
    const draftsNum = [
      `${fa(N)} تا ${obj} را به‌طور مساوی بین ${fa(d)} نفر تقسیم می‌کنیم؛ سهم هر نفر چند تا می‌شود؟`,
      `${who} ${fa(N)} تا ${obj} را در جعبه‌های مساویِ ${fa(d)}تایی می‌چیند؛ چند جعبهٔ کامل لازم دارد؟`
    ];
    return { qType: "تقسیم مفهومی (بخش‌کردن)", prompt: pick(c.rng, draftsNum), ans: q, key: `dvn|${N},${d}`, ds: [], cpa: "مجسم", domain: "CORE" };
  },

  "خانوادهٔ ضرب-تقسیم": (c) => {
    const [a, b] = c.phase === 3 ? twoDigitPair(c) : tablePair(c);
    const ab = a * b;
    const stem = c.rng();
    if (c.fmt === "گزینه‌ای" && stem < 0.3) {
      const correct = `${fa(ab)} ÷ ${fa(a)} = ${fa(b)}`;
      return {
        qType: "خانوادهٔ ضرب-تقسیم", prompt: `کدام جمله از خانوادهٔ ضرب و تقسیمِ ${fa(a)} × ${fa(b)} = ${fa(ab)} درست است؟`, ans: b, key: `fm-mcq|${a},${b}`,
        ds: [],
        textual: {
          options: [correct, `${fa(ab)} ÷ ${fa(b)} = ${fa(b)}`, `${fa(ab)} ÷ ${fa(a)} = ${fa(a + b)}`, `${fa(a)} × ${fa(b)} = ${fa(a + b)}`],
          answerIndex: 0
        },
        cpa: "علامتی", domain: "DEPTH"
      };
    }
    if (stem < 0.65) {
      return {
        qType: "خانوادهٔ ضرب-تقسیم", prompt: `اگر ${fa(a)} × ${fa(b)} = ${fa(ab)} باشد، آنگاه ${fa(ab)} ÷ ${fa(a)} چند است؟`,
        ans: b, key: `fm|${a},${b}`, ds: [], cpa: "علامتی", domain: "DEPTH"
      };
    }
    return {
      qType: "خانوادهٔ ضرب-تقسیم", prompt: `سه عدد ${fa(a)}، ${fa(b)} و ${fa(ab)} با هم خانوادهٔ ضرب و تقسیم‌اند. ${fa(ab)} ÷ ${fa(b)} چند می‌شود؟`,
      ans: a, key: `fm2|${a},${b}`, ds: [], cpa: "علامتی", domain: "DEPTH"
    };
  },

  "مسئلهٔ متنی": (c) => {
    const twoStep = c.phase >= 2 && c.rng() < 0.5;
    const who = nameOf(c);
    if (twoStep) {
      const n = ri(c.rng, 2, 4), b = ri(c.rng, 3, 9), k = ri(c.rng, 3, 9);
      const ans = n * b * k;
      const mul = c.rng() < 0.5;
      const p = mul
        ? `هر جعبهٔ مداد ${fa(b)} بسته دارد و در هر بسته ${fa(k)} مداد هست؛ ${who} ${fa(n)} جعبه مداد خریده است. روی هم چند مداد خریده است؟`
        : `آقای کاوه برای مغازه‌اش ${fa(n)} قفسه خریده است؛ روی هر قفسه ${fa(b)} جعبه و در هر جعبه ${fa(k)} فنجان جا می‌شود. در همهٔ قفسه‌ها چند فنجان جا می‌شود؟`;
      return {
        qType: "مسئلهٔ متنی", prompt: p, ans, key: `w2|${n},${b},${k}`,
        ds: [
          { v: n * b + k, why: "گام دوم فراموش شد" },
          { v: b * k, why: "گام اول به‌جای کل" },
          { v: ans + b, why: "یک بسته زیاد شمرده شد" },
          { v: ans - k, why: "یک دسته کم شمرده شد" }
        ],
        cpa: "تصویری", domain: "DEPTH"
      };
    }
    const divQ = c.rng() < 0.45;
    if (divQ) {
      const d = c.phase === 1 ? ri(c.rng, 2, 5) : ri(c.rng, 2, 9);
      const q = c.phase === 1 ? ri(c.rng, 2, 10) : c.phase === 2 ? ri(c.rng, 2, 9) : ri(c.rng, 11, 30);
      const N = d * q;
      const obj = objOf(c);
      return {
        qType: "مسئلهٔ متنی", prompt: `مدیر مدرسه ${fa(N)} تا ${obj} خریده و می‌خواهد بین ${fa(d)} کلاس به‌طور مساوی تقسیم کند. سهم هر کلاس چند تا است؟`,
        ans: q, key: `wd|${N},${d}`,
        ds: [
          { v: N - d, why: "تفریق به‌جای تقسیم" },
          { v: q + 1, why: "یک گروه زیاد" },
          { v: Math.max(0, q - 1), why: "یک گروه کم" },
          { v: d, why: "شمارندهٔ کلاس به‌جای سهم" }
        ],
        cpa: "علامتی", domain: "DEPTH"
      };
    }
    const [n, k] = c.phase === 3 ? twoDigitPair(c) : tablePair(c);
    const obj = objOf(c);
    return {
      qType: "مسئلهٔ متنی", prompt: `برای جشن پایان سال هر میز ${fa(k)} تا ${obj} لازم است؛ ${nameOf(c)} ${fa(n)} میز چیده است. روی هم چند تا ${obj} لازم دارد؟`,
      ans: n * k, key: `w1|${n},${k}`,
      ds: [
        { v: n + k, why: "جمع به‌جای ضرب" },
        { v: (n - 1) * k, why: "یک میز کم شمرده شد" },
        { v: n * (k + 1), why: "در هر میز یکی زیاد" },
        { v: (n + 1) * k, why: "یک میز زیاد شمرده شد" }
      ],
      cpa: "علامتی", domain: "DEPTH"
    };
  }
};

// نقشهٔ درس‌های ربات برای بچ D4 (bookMap — همه «نیاز به تأیید» با منبع صادقانه)
const LESSON_PLAN_D4 = [
  { id: "L-RB-D4-01", title: "دسته‌های مساوی و محور پرشی — بچ ربات (BP-019)", qTypes: ["مفهوم: دسته‌های مساوی→ضرب", "محور پرشی"] },
  { id: "L-RB-D4-02", title: "جدول ضرب، جابه‌جایی، لنگرها و ویژگی‌های صفر و یک — بچ ربات (BP-019)", qTypes: ["جدول ۲..۱۰ درجهت", "جابه‌جایی (زوج a×b/b×a)", "×۰ و ×۱", "دوبرابر/نصف", "لنگر ۵/۱۰"] },
  { id: "L-RB-D4-03", title: "تقسیم مفهومی و خانوادهٔ ضرب-تقسیم — بچ ربات (BP-019)", qTypes: ["تقسیم مفهومی (بخش‌کردن)", "خانوادهٔ ضرب-تقسیم"] },
  { id: "L-RB-D4-04", title: "مسئله‌های متنی ضرب و تقسیم — بچ ربات (BP-019)", qTypes: ["مسئلهٔ متنی"] }
];

/** ترکیب بچ: تعداد سؤال هر نوع‌تمرین — جمع دقیقاً = اندازهٔ بچ */
function qTypeQuota(target: string, size: number): Record<string, number> {
  const { qTypes } = matrixSpec(target);
  const base = Math.floor(size / qTypes.length);
  const quota: Record<string, number> = {};
  let left = size;
  qTypes.forEach((t, i) => {
    const n = i < qTypes.length - 1 ? base : left; // آخرین نوع باقیمانده را می‌گیرد
    quota[t] = n; left -= n;
  });
  return quota;
}

/** فاز دشواری + قالب پاسخ هر سؤال — تعدادها قطعی، توزیع بذردار */
function phaseFormatPlan(rng: Rng, n: number): { phase: 1 | 2 | 3; fmt: "گزینه‌ای" | "عدد" }[] {
  const p1 = Math.round(n * 0.4), p2 = Math.round(n * 0.35), p3 = n - p1 - p2;
  const phases = shuffle(rng, ([...Array(p1).fill(1), ...Array(p2).fill(2), ...Array(p3).fill(3)] as (1 | 2 | 3)[]));
  const mcq = Math.ceil(n * 0.6);
  const fmts = shuffle(rng, ([...Array(mcq).fill("گزینه‌ای"), ...Array(n - mcq).fill("عدد")] as ("گزینه‌ای" | "عدد")[]));
  return phases.map((phase, i) => ({ phase, fmt: fmts[i] }));
}

/** ساخت سؤال نهایی کارتریجی از Draft — با گزینه‌های یکتا و نگارهٔ خطا */
function buildQuestion(draft: Draft, opts: { id: string; anchorId: string; seq: number; chapter: string; seed: number; batchId: string; tag: string }) {
  const { id, anchorId, seq, chapter, seed, batchId, tag } = opts;
  const q: any = {
    id,
    anchorId,
    domain: draft.domain,
    domainCode: domainOf(batchTagToTarget(batchId)),
    qType: draft.qType,
    chapter,
    lesson: anchorId,
    answerFormat: draft.textual ? "گزینه‌ای" : (draft as any).fmt,
    prompt: draft.prompt
  };
  if (draft.renderHint) q.renderHint = draft.renderHint;

  if (draft.textual) {
    q.options = draft.textual.options;
    q.answerIndex = draft.textual.answerIndex;
    q.optionErrorMap = "—"; // گزینه‌های متنی: بدون نگاشت خودکار
  } else {
    const fmt = (draft as any).fmt as "گزینه‌ای" | "عدد";
    q.answerFormat = fmt;
    if (fmt === "گزینه‌ای") {
      // پالایش انحرافی‌ها: ≠ درست، ≥۰، ≤۹۹۹۹، بدون تکرار
      const seen = new Set([draft.ans]);
      const chosen: { v: number; why: string }[] = [];
      for (const d of draft.ds) {
        if (chosen.length >= 3) break;
        if (d.v < 0 || d.v > 9999 || seen.has(d.v)) continue;
        seen.add(d.v); chosen.push(d);
      }
      let pad = 1;
      while (chosen.length < 3) {
        const v = draft.ans + pad;
        if (v <= 9999 && !seen.has(v)) { seen.add(v); chosen.push({ v, why: "خطای حساب ±۱" }); }
        pad++;
      }
      const vals = shuffle(mulberry32(seed * 7919 + seq), [draft.ans, ...chosen.map(c => c.v)]);
      q.options = vals.map(fa);
      q.answerIndex = vals.indexOf(draft.ans);
      const letters = ["الف", "ب", "ج", "د"];
      const whyByVal = new Map(chosen.map(c => [c.v, c.why]));
      q.optionErrorMap = vals
        .map((v, i) => ({ letter: letters[i], v }))
        .filter(x => x.v !== draft.ans)
        .map(x => `${x.letter}→${whyByVal.get(x.v) ?? "خطای حساب"}`)
        .join("؛ ");
    } else {
      q.answerValue = draft.ans;
    }
  }
  q.answerValue ??= draft.ans; // متادیتای صادقانهٔ حاصل برای همه
  q.level = (draft as any).phase === 1 ? "آسان" : (draft as any).phase === 2 ? "متوسط" : "سخت";
  q.cpa = draft.cpa;
  q.source = `ریزربات ۲ (BP-019/BP-020) — تولید قاعده‌محور، seed ${seed} — بدون LLM`;
  q.status = REQUIRED_STATUS;
  q.note = `برچسب بچ: ${tag}؛ منتظر مُهر معلم`;
  return q;
}
function batchTagToTarget(batchId: string) { return batchId.split("-batch")[0]; }

// ── مولد بچ کامل یک دامنه ────────────────────────────────────────────────────
function generateBatch(target: string, seed: number, size: number) {
  const { qTypes, chapter } = matrixSpec(target);
  const registryKey = target;
  if (!GENERATOR_REGISTRY[registryKey]) die(`مولد قاعده‌محور برای ${target} هنوز پیاده‌سازی نشده — بچ این دامنه به آرنا/شیفت بعدی`);
  const rng = mulberry32(seed);
  const quota = qTypeQuota(target, size);
  const lessons = target === "G3-D4" ? LESSON_PLAN_D4 : die(`نقشهٔ درس برای ${target} تعریف نشده`);
  const questions: any[] = [];
  const used = new Set<string>();
  let seq = 0;
  for (const qt of qTypes) {
    const n = quota[qt] ?? 0;
    if (!n) continue;
    const plan = phaseFormatPlan(mulberry32(seed * 131 + qt.length * 17 + n), n);
    const lesson = lessons.find(l => l.qTypes.includes(qt)) ?? lessons[0];
    for (let i = 0; i < n; i++) {
      const { phase, fmt } = plan[i];
      let draft: Draft | null = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        const ctx: Ctx = { rng, phase, fmt, used, qType: qt };
        const d = GENERATOR_REGISTRY[registryKey](ctx);
        d.qType = qt;
        (d as any).phase = phase; (d as any).fmt = fmt;
        const key = d.key ?? d.prompt;
        if (!used.has(key)) { used.add(key); draft = d; break; }
      }
      if (!draft) die(`تولید سؤال یکتا برای ${qt} ناکام ماند (seed ${seed})`);
      seq++;
      const id = idFor(target, seq);
      const tag = `${target}-${String(seq).padStart(2, "0")}`;
      questions.push(buildQuestion(draft!, {
        id, anchorId: lesson.id, seq, chapter, seed, batchId: batchIdFor(target, 1), tag
      }));
    }
  }
  return { questions, quota, lessons };
}

// رجیستری مولدها — امروز فقط D4-G3؛ دامنه‌های بعدی در شیفت‌های بعد اضافه می‌شوند
const GENERATOR_REGISTRY: Record<string, (c: Ctx) => Draft> = {
  "G3-D4": (c) => {
    // کلیدهای مولد دقیقاً همان qTypeهای ماتریس دامنه‌اند — جست‌وجوی مستقیم
    const g = GENERATORS[(c as any).qType as string];
    if (!g) die(`مولد برای qType «${(c as any).qType}» پیاده نشده است`);
    return g(c);
  }
};
const GENERATOR_KEYS: string[] = []; // پر می‌شود زیر — ترتیب مولدها

// بازچینش: کلیدهای GENERATORS را به‌ترتیب ثبت کن
for (const k of Object.keys(GENERATORS)) GENERATOR_KEYS.push(k);

/** بازهٔ شناسه‌های Q- هر دامنه (سازگار با extractQRefs — قاعدهٔ T7 نقشهٔ کتاب) */
function idFor(target: string, seq: number): string {
  const blocks: Record<string, number> = { "G3-D4": 4000, "G3-D3": 3000, "G3-D8": 8000, "G3-D5": 5000, "G3-D2": 2000, "G3-D6": 6000, "G3-D1": 1000, "G3-D7": 7000 };
  const base = blocks[target];
  if (!base) die(`بازهٔ شناسه برای ${target} تعریف نشده`);
  return `Q-${base + seq}`;
}
function batchIdFor(target: string, idx: number) {
  return `${target}-batch${String(idx).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// گاردهای ربات — سه ممنوعیت + قواعد کیفی (همه fail-closed)
// ─────────────────────────────────────────────────────────────────────────────
function selfCheckBatch(batch: { questions: any[]; lessons: any[] }, target: string, seed: number): string[] {
  const errors: string[] = [];
  const { chapter, qTypes } = matrixSpec(target);
  const ids = new Set<string>();
  const prompts = new Set<string>();
  for (const q of batch.questions) {
    // ممنوعیت ۱ — ربات هرگز «تأییدشده» نمی‌سازد
    if (q.status === FORBIDDEN_STATUS) errors.push(`${q.id}: ممنوعیت ۱ — ربات وضعیت «${FORBIDDEN_STATUS}» ساخته است`);
    if (q.status !== REQUIRED_STATUS) errors.push(`${q.id}: وضعیت سؤال ربات باید «${REQUIRED_STATUS}» باشد`);
    // ممنوعیت ۳ — عبارت ممنوعه در هیچ فیلدی
    for (const [f, v] of Object.entries(q)) {
      if (typeof v === "string") {
        if (v.includes(FORBIDDEN_PHRASE)) errors.push(`${q.id}: ممنوعیت ۳ — عبارت ممنوعه در فیلد ${f}`);
        if (/v1\.0|v۱\.۰/.test(v)) errors.push(`${q.id}: ممنوعیت ۲ — برچسب نسخهٔ نهایی در فیلد ${f}`);
      }
    }
    if (ids.has(q.id)) errors.push(`شناسهٔ تکراری: ${q.id}`);
    ids.add(q.id);
    if (prompts.has(q.prompt)) errors.push(`${q.id}: متن سؤال تکراری است`);
    prompts.add(q.prompt);
    if (!/^\d+$/.test(q.id.replace(/^Q-/, ""))) errors.push(`${q.id}: شناسه باید Q-<عدد> باشد (سازگاری T7/extractQRefs)`);
    if (q.domainCode !== domainOf(target) || !DOMAIN_CODE_PATTERN.test(q.domainCode)) errors.push(`${q.id}: domainCode نامعتبر: ${q.domainCode}`);
    if (!qTypes.includes(q.qType)) errors.push(`${q.id}: qType «${q.qType}» در فهرست ماتریس دامنه نیست`);
    if (q.chapter !== chapter) errors.push(`${q.id}: فصل ناهم‌خوان ماتریس (${q.chapter} ≠ ${chapter})`);
    if (!ANSWER_FORMAT_VALUES.includes(q.answerFormat)) errors.push(`${q.id}: answerFormat خارج از واژه‌نامهٔ ۶-قالبی`);
    // ضد J12 — قالب مستقیم «عدد» هرگز صورت خام a×b=؟ ندارد
    if (q.answerFormat === "عدد") {
      if (parsePlainMultiplication(q.prompt)) errors.push(`${q.id}: J12 — صورت خام a×b=؟ در قالب پاسخ مستقیم ممنوع است`);
      const v = Number(q.answerValue);
      if (!Number.isSafeInteger(v) || v < 0 || v > 9999) errors.push(`${q.id}: answerValue خارج از دامنهٔ کتاب ۰..۹۹۹۹`);
    }
    if (q.answerFormat === "گزینه‌ای") {
      if (!Array.isArray(q.options) || q.options.length !== 4) { errors.push(`${q.id}: گزینه‌ها ≠ ۴`); continue; }
      if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) errors.push(`${q.id}: پاسخ‌نام خارج از بازه`);
      const vals = q.options.map(parseOptionValue);
      const textual = vals.some(v => v === null); // سؤال متنی (مثل «کدام جمع تکراری...») — گزینه‌ها عبارت‌اند، نه عدد
      const correct = vals[q.answerIndex];
      // قاعدهٔ سخت فقط برای MCQ عددی: موتور واقعی (cartridge-schema) گزینهٔ متنی را مجاز می‌داند (null → continue)
      if (correct === null && !textual) errors.push(`${q.id}: گزینهٔ پاسخ قابل تفسیر نیست`);
      if (textual && typeof q.options[q.answerIndex] !== "string") errors.push(`${q.id}: سؤال متنی، ولی گزینهٔ پاسخ متن نیست`);
      if (textual && q.options.some((o: any, i: number) => i !== q.answerIndex && parseOptionValue(o) !== null)) errors.push(`${q.id}: MCQ متنی آمیخته با گزینهٔ عددی است`);
      // طبق قانون D4، درستِ عددی باید با متادیتا هم‌خوان باشد
      if (typeof correct === "number" && correct !== q.answerValue) errors.push(`${q.id}: گزینهٔ پاسخ (${correct}) ≠ answerValue (${q.answerValue})`);
      const nonNull = vals.filter(v => v !== null);
      const uniq = new Set(nonNull);
      if (uniq.size !== nonNull.length) errors.push(`${q.id}: دو گزینه هم‌ارزند (پاسخ مبهم)`);
      for (let i = 0; i < 4; i++) {
        const v = vals[i];
        if (typeof v === "number" && (v < 0 || v > 9999)) errors.push(`${q.id} گ${["الف","ب","ج","د"][i]}: مقدار بیرون دامنهٔ کتاب`);
      }
      // صورت خام a×b=؟ ⇒ کلید باید حاصل باشد (انطباق با بازحساب موتور)
      const plain = parsePlainMultiplication(q.prompt);
      if (plain && correct !== plain.f1 * plain.f2) errors.push(`${q.id}: ضد J12 — گزینهٔ پاسخ ≠ حاصل ${plain.f1}×${plain.f2}`);
      // کمیت منفی ممنوع
      if (typeof correct === "number" && correct < 0) errors.push(`${q.id}: حاصل منفی ممنوع است`);
    }
  }
  // T7 — مالکیت نقشهٔ کتاب ↔ بانک، پیش از نوشتن
  for (const l of batch.lessons) {
    const refs = [...new Set(extractQRefs(l.anchorsRaw))].sort();
    const owners = batch.questions.filter(q => q.anchorId === l.id).map(q => q.id).sort();
    if (JSON.stringify(refs) !== JSON.stringify(owners)) {
      errors.push(`درس ${l.id}: لنگرهای سلول ≠ مالکان واقعی (${refs.join("،")} ≠ ${owners.join("،")})`);
    }
  }
  return errors;
}

/** نگاشت خطاها → پیام «ادغام ممنوع» با شمارهٔ ممنوعیت */
function prohibitionReport(batch: { questions: any[] }): string[] {
  const out: string[] = [];
  for (const q of batch.questions) {
    if (q.status === FORBIDDEN_STATUS) out.push(`ممنوعیت ۱ نقض شد در ${q.id}: وضعیت «${FORBIDDEN_STATUS}»`);
    for (const [f, v] of Object.entries(q)) {
      if (typeof v === "string" && v.includes(FORBIDDEN_PHRASE)) out.push(`ممنوعیت ۳ نقض شد در ${q.id}.${f}: عبارت «${FORBIDDEN_PHRASE}»`);
      if (typeof v === "string" && /(^|\s)v1\.0(\s|$)/.test(v)) out.push(`ممنوعیت ۲ نقض شد در ${q.id}.${f}: برچسب ${FORBIDDEN_VERSION_TAG}`);
    }
  }
  return out;
}

// ── ادغام (خالص — روی نسخهٔ کلون) ────────────────────────────────────────────
function mergeBatch(orig: any, batch: { questions: any[]; lessons: any[] }, batchId: string, seed: number) {
  const merged = JSON.parse(JSON.stringify(orig));
  const existingIds = new Set((merged.questionBank ?? []).map((q: any) => q.id));
  for (const q of batch.questions) if (existingIds.has(q.id)) die(`شناسهٔ ${q.id} در خشاب موجود است — ادغام دوبارهٔ همان بچ ممنوع`);
  merged.bookMap = [...(merged.bookMap ?? []), ...batch.lessons];
  merged.questionBank = [...(merged.questionBank ?? []), ...batch.questions];
  merged.generatedAt = nowIso();
  merged.source = merged.source ?? {};
  merged.source.robotBatches = [...(merged.source.robotBatches ?? []), {
    batchId, target: batchTagToTarget(batchId), seed, count: batch.questions.length,
    mergedAt: nowIso(), status: `${REQUIRED_STATUS} — منتظر مُهر معلم`, generator: "rule-based بدون LLM (BP-020)"
  }];
  merged.auditTrail = merged.auditTrail ?? { entries: [] };
  merged.auditTrail.entries = merged.auditTrail.entries ?? [];
  merged.auditTrail.entries.push({
    finding: "BP-019/BP-020",
    place: `بانک سؤال — بچ ${batchId}`,
    verdict: `ادغام ${batch.questions.length} سؤال دامنه‌دار ${batchTagToTarget(batchId)} (همه «${REQUIRED_STATUS}»؛ صفر مُهر — تأیید فقط با دست معلم)`,
    fix: "—",
    status: "منتظر مُهر معلم"
  });
  return merged;
}

// ── گیت‌های بیرونی ───────────────────────────────────────────────────────────
function gateNpmTest(): { ok: boolean; detail: string } {
  const r = spawnSync("npm", ["test"], { cwd: MG_DIR, encoding: "utf8", timeout: 300_000 });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const pass = /ℹ pass (\d+)/.exec(out);
  const fail = /ℹ fail (\d+)/.exec(out);
  const tests = /ℹ tests (\d+)/.exec(out);
  if (r.status !== 0 || !pass || !fail) return { ok: false, detail: `npm test — کد ${r.status}؛ خروجی نامشخص` };
  return { ok: Number(fail[1]) === 0, detail: `npm test ${pass[1]}/${tests?.[1] ?? "?"} سبز، ${fail[1]} قرمز` };
}
function gatePytest(): { ok: boolean; detail: string } {
  const r = spawnSync("python3", ["-m", "pytest", "authoring/tests/", "-q"], { cwd: ROOT, encoding: "utf8", timeout: 300_000 });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const m = /(\d+) passed/.exec(out);
  if (r.status !== 0) return { ok: false, detail: `pytest قرمز — ${out.split("\n").slice(-3).join(" | ")}` };
  return { ok: true, detail: `pytest ${m ? m[1] : "?"} passed` };
}
function gateCoverage(target: string): { ok: boolean; detail: string } {
  const r = spawnSync("bun", ["scripts/coverage-report.ts",
    "--cartridge", "public/math-game/cartridges/KH-G2-MATH.json",
    "--cartridge", "public/math-game/cartridges/KH-G3-MATH.json",
    "--markdown", "reports/coverage-current.md"], { cwd: ROOT, encoding: "utf8", timeout: 120_000 });
  if (r.status !== 0) return { ok: false, detail: `coverage-report خروج ${r.status}` };
  if (!existsSync(COVERAGE_MD)) return { ok: false, detail: "coverage-current.md ساخته نشد" };
  const md = readFileSync(COVERAGE_MD, "utf-8");
  if (!md.includes("🟡 **DRAFT**")) return { ok: false, detail: "بنر DRAFT گزارش پوشش نباید از بین برود" };
  const sec = md.split("## KH-G3-MATH")[1] ?? "";
  const row = /^\| D4 \|[^\n]*$/m.exec(sec);
  if (!row) return { ok: false, detail: "ردیف D4 در گزارش G3 یافت نشد" };
  const cols = row[0].split("|").map(s => s.trim());
  const count = Number(cols[5]), confirmed = Number(cols[6]);
  const { min } = matrixSpec(target);
  if (!(count >= min)) return { ok: false, detail: `D4-G3 موجود ${count} < حداقل قانون ${min}` };
  if (confirmed !== 0) return { ok: false, detail: `تأییدشدهٔ D4-G3 = ${confirmed} ≠ ۰ — ربات حق مُهر ندارد` };
  return { ok: true, detail: `D4-G3: موجود ${count}/${min}، تأییدشده ۰` };
}
function gateAntiClaim(): { ok: boolean; detail: string } {
  const r = spawnSync("bash", ["scripts/check-domain-claims.sh"], { cwd: ROOT, encoding: "utf8", timeout: 120_000 });
  return r.status === 0 ? { ok: true, detail: "گیت ضد-ادعا سبز — هیچ ادعای بی‌پشتوانه‌ای ساخته نشد" } : { ok: false, detail: "گیت ضد-ادعا قرمز" };
}

// ── گزارش ربات (append — صادقانه در هر دور) ──────────────────────────────────
function robotLog(lines: string[]) {
  if (!existsSync(ROBOT_LOG)) {
    mkdirSync(path.dirname(ROBOT_LOG), { recursive: true });
    appendFileSync(ROBOT_LOG, "# دفتر حلقهٔ تولید — ریزربات ۲ (BP-020)\n\n> هر دور: هدف، seed، شمارش‌ها، نتیجهٔ گیت‌ها و تصمیم — بدون هیچ ادعای آمادگی؛ «آماده» اندازه‌گیری می‌شود، اعلام نمی‌شود.\n", "utf8");
  }
  appendFileSync(ROBOT_LOG, lines.join("\n") + "\n", "utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// اجرا
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs() {
  const a = process.argv.slice(2);
  const argOf = (f: string) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  return {
    target: argOf("--target"),
    seed: argOf("--seed") ? Number(argOf("--seed")) : undefined,
    all: a.includes("--all"),
    dryRun: a.includes("--dry-run"),
    selfTest: a.includes("--self-test")
  };
}

function loadCartridgeSafe(p: string) {
  if (!existsSync(p)) die(`کارتریج یافت نشد: ${p}`);
  return JSON.parse(readFileSync(p, "utf-8"));
}

/** یک دور کامل: تولید → خودبازرسی → ادغام → گیت‌ها. خروج: تصمیم */
function runOne(target: string, seed: number, dryRun: boolean): { decision: string; detail: string } {
  const fam = familyOf(target);
  const cartPath = (CARTRIDGE as any)[fam];
  if (!cartPath) return { decision: "skip", detail: `کارتریج ${fam} در مالکیت این ربات نیست` };
  const cart = loadCartridgeSafe(cartPath);
  const cov = coverageOf(cart, target);
  const needed = Math.max(0, cov.min - cov.count);
  const existingBatches = ((cart.source?.robotBatches ?? []) as any[]).filter(b => b.target === target).length;
  const batchId = batchIdFor(target, existingBatches + 1);

  log(`هدف ${target} — موجود ${cov.count}/${cov.min} (تأییدشده: ${cov.confirmed}) — نیاز ${needed} — بچ ${batchId} — seed ${seed}`);
  if (needed === 0) return { decision: "skip", detail: "حداقل قانون این دامنه برآورده است — بچ لازم نیست" };
  if (!GENERATOR_REGISTRY[target]) return { decision: "skip", detail: "مولد قاعده‌محور این دامنه هنوز پیاده‌سازی نشده — برای آرنا/شیفت بعد" };

  const size = needed;
  const batch = generateBatch(target, seed, size);
  const fmtCount = { "گزینه‌ای": 0, "عدد": 0 } as Record<string, number>;
  const levelCount = { "آسان": 0, "متوسط": 0, "سخت": 0 } as Record<string, number>;
  for (const q of batch.questions) { fmtCount[q.answerFormat]++; levelCount[q.level]++; }
  log(`بچ ساخته شد: ${batch.questions.length} سؤال | گزینه‌ای ${fmtCount["گزینه‌ای"]} / عدد ${fmtCount["عدد"]} | آسان ${levelCount["آسان"]}، متوسط ${levelCount["متوسط"]}، سخت ${levelCount["سخت"]}`);

  // درس‌های نقشهٔ کتاب با لنگرهای دقیق (T7)
  batch.lessons = batch.lessons.map((l: any) => ({
    id: l.id,
    title: l.title,
    chapter: "۴",
    objective: "تمرین قاعده‌محور دامنهٔ D4 (ضرب و تقسیم) — مکمل موج دامنه‌دار BP-019",
    engineCompat: undefined,
    anchorsRaw: batch.questions.filter(q => q.anchorId === l.id).map(q => q.id).join("، "),
    source: `ریزربات ۲ (BP-019/BP-020) — بچ ${batchId}، seed ${seed}`,
    status: REQUIRED_STATUS,
    note: "درس تولیدی ربات — ساختار و لنگرها مطابق ماتریس قانون؛ مُهر با دست معلم"
  }));
  // engineCompat خالی نباشد → کلید را حذف کن (هشدار AUD-07 نسازد)
  batch.lessons.forEach((l: any) => { delete l.engineCompat; });

  const qc = selfCheckBatch(batch, target, seed);
  const prohib = prohibitionReport(batch);
  if (qc.length || prohib.length) {
    return { decision: "refuse", detail: `خودبازرسی قرمز — ${[...prohib, ...qc].join(" | ")}` };
  }
  log("خودبازرسی: سه ممنوعیت + قواعد کیفی + T7 — سبز");

  const origBytes = readFileSync(cartPath);
  const merged = mergeBatch(JSON.parse(JSON.stringify(cart)), batch, batchId, seed);

  // گیت ۱ — اعتبارسنجی موتور واقعی، پیش از هر نوشتنی
  const before = validateCartridge(cart);
  const v = validateCartridge(merged);
  if (!before.ok) return { decision: "refuse", detail: `خشاب پایه از ابتدا قرمز است — ${before.errors.join(" | ")}` };
  if (!v.ok) return { decision: "refuse", detail: `اعتبارسنج موتور قرمز — ${v.errors.join(" | ")}` };
  if (v.warnings.length !== before.warnings.length) {
    return { decision: "refuse", detail: `هشدار تازه پدید آمد (${before.warnings.length} → ${v.warnings.length}) — بچ باید صفر هشدار schema داشته باشد: ${v.warnings.slice(before.warnings.length).join(" | ")}` };
  }
  log(`گیت ۱ (اعتبارسنج موتور): سبز — قرمز ۰، زرد بدون رشد (${v.warnings.length})، سؤال‌ها ${v.stats.questions}`);

  // متادیتای اعتبارسنجیِ تازه در کارتریج (پنل معلم صادقانه بماند)
  merged.validation = { ok: v.ok, warnings: v.warnings, stats: v.stats, gate: v.gate };

  if (dryRun) {
    const perType: Record<string, number> = {};
    for (const q of batch.questions) perType[q.qType] = (perType[q.qType] ?? 0) + 1;
    log("--dry-run — هیچ فایلی نوشته نشد. نقشهٔ بچ:");
    for (const [t, n] of Object.entries(perType)) log(`  • ${t}: ${n}`);
    log(`  • درس‌ها: ${batch.lessons.map((l: any) => l.id).join("، ")}`);
    return { decision: "dry-run", detail: `نقشه چاپ شد؛ بدون نوشتن (بچ ${batchId}: ${batch.questions.length} سؤال)` };
  }

  // نوشتن بچ خام + ادغام
  mkdirSync(BATCHES_DIR, { recursive: true });
  const batchPath = path.join(BATCHES_DIR, `${batchId}.json`);
  const batchFile = {
    batchId, target, family: `KH-${fam}-MATH`, domainCode: domainOf(target), chapter: matrixSpec(target).chapter,
    generator: "rule-based — بدون LLM، بدون شبکه (BP-020)", seed, createdAt: nowIso(),
    targetMin: cov.min, count: batch.questions.length,
    answerFormatBreakdown: fmtCount, difficultyBreakdown: levelCount,
    qTypeBreakdown: Object.fromEntries(Object.entries(batch.questions.reduce((m: any, q) => (m[q.qType] = (m[q.qType] ?? 0) + 1, m), {})).sort()),
    idNote: "شناسهٔ سؤال‌ها Q-<عدد> است تا قاعدهٔ T7 (extractQRefs نقشهٔ کتاب) سازگار بماند؛ برچسب توالی بچ در فیلد note هر سؤال (G3-D4-<seq>).",
    lessons: batch.lessons, questions: batch.questions
  };
  writeFileSync(batchPath, JSON.stringify(batchFile, null, 2) + "\n", "utf8");
  log(`بچ خام ذخیره شد: ${path.relative(ROOT, batchPath)}`);
  writeFileSync(cartPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  log(`ادغام نوشته شد: ${path.relative(ROOT, cartPath)} (اکنون ${merged.questionBank.length} سؤال)`);

  // گیت ۱-دیسک: فایل روی دیسک دوباره اعتبارسنجی شود
  const onDisk = loadCartridgeSafe(cartPath);
  const vd = validateCartridge(onDisk);
  if (!vd.ok) {
    writeFileSync(cartPath, origBytes);
    return { decision: "rollback", detail: `اعتبارسنجی پس از نوشتن قرمز شد — بازگردانی شد: ${vd.errors.join(" | ")}` };
  }

  // گیت ۲..۵
  const gates: { name: string; ok: boolean; detail: string }[] = [];
  const npm = gateNpmTest(); gates.push({ name: "npm test", ...npm });
  const py = gatePytest(); gates.push({ name: "pytest", ...py });
  const covG = gateCoverage(target); gates.push({ name: "coverage", ...covG });
  const ac = gateAntiClaim(); gates.push({ name: "ضد-ادعا", ...ac });
  for (const g of gates) log(`گیت (${g.name}): ${g.ok ? "🟢" : "⛔"} ${g.detail}`);

  if (gates.some(g => !g.ok)) {
    writeFileSync(cartPath, origBytes);
    const ok2 = JSON.parse(readFileSync(cartPath, "utf-8"));
    log(`بازگردانی انجام شد — سؤال‌ها: ${ok2.questionBank.length}`);
    return { decision: "rollback", detail: `گیت قرمز → بازگردانی فایل اصلی: ${gates.filter(g => !g.ok).map(g => `${g.name}: ${g.detail}`).join(" | ")}` };
  }

  return { decision: "merged", detail: `بچ ${batchId} ادغام شد — ${batch.questions.length} سؤال، همهٔ گیت‌ها سبز، همه «${REQUIRED_STATUS}»` };
}

// ── حالت سلف‌تست: بچ آلوده → اثبات ردِ قطعی (fail-closed) ───────────────────
function selfTest() {
  const target = "G3-D4";
  const seed = DEFAULT_SEEDS[target];
  log(`سلف‌تست fail-closed — هدف ${target}، seed ${seed} — تزریق ۵ سؤال معیوب`);
  const batch = generateBatch(target, seed, 100);
  const lessons = batch.lessons.map((l: any) => ({ ...l }));
  // ۵ آلودگی عمدی — انتخاب پویا: دو آلودگی (گزینهٔ ۳تایی و ضد-J12) به سؤال چهارگزینه‌ای واقعی نیاز دارند
  const corrupt = JSON.parse(JSON.stringify(batch));
  const mcqIdxs: number[] = [];
  for (let i = 0; i < corrupt.questions.length && mcqIdxs.length < 2; i++) {
    const q = corrupt.questions[i];
    if (Array.isArray(q.options) && q.options.length === 4) mcqIdxs.push(i);
  }
  if (mcqIdxs.length < 2) die("سلف‌تست: دو سؤال چهارگزینه‌ای برای آلودگی یافت نشد");
  const dup = JSON.parse(JSON.stringify(corrupt.questions[5])); dup.qType = corrupt.questions[4].qType; dup.anchorId = corrupt.questions[4].anchorId; // شناسهٔ تکراری
  const three = JSON.parse(JSON.stringify(corrupt.questions[mcqIdxs[0]])); three.options = three.options.slice(0, 3); // گزینه ≠ ۴
  const range = JSON.parse(JSON.stringify(corrupt.questions[20])); range.answerFormat = "عدد"; delete range.options; delete range.answerIndex; delete range.optionErrorMap; range.answerValue = 99999; // بیرون دامنهٔ کتاب
  const confirmed = JSON.parse(JSON.stringify(corrupt.questions[30])); confirmed.status = FORBIDDEN_STATUS; confirmed.source = "شبیه‌سازی ممنوع — سلف‌تست"; // ممنوعیت ۱
  const j12 = JSON.parse(JSON.stringify(corrupt.questions[mcqIdxs[1]])); j12.answerFormat = "عدد"; delete j12.options; delete j12.answerIndex; delete j12.optionErrorMap; j12.prompt = "۶ × ۷ = ؟"; j12.answerValue = 43; // ضد J12
  corrupt.questions.push(dup, three, range, confirmed, j12);

  const findings: string[] = [];
  let allRefused = true;

  // ۱) گارد ممنوعیت‌های ربات — باید وضعیت «تأییدشده» را بلعد
  const prohib = prohibitionReport(corrupt);
  if (prohib.some(p => p.includes("ممنوعیت ۱"))) findings.push("✓ گارد ممنوعیت ۱: وضعیت «تأییدشده» تزریقی رد شد");
  else { allRefused = false; findings.push("✗ گارد ممنوعیت ۱ آلودگی را ندید!"); }

  // ۲) خودبازرسی کامل بچ آلوده
  const qc = selfCheckBatch(corrupt, target, seed);
  if (qc.length >= 3) findings.push(`✓ خودبازرسی: ${qc.length} ایراد گرفت (نمونه: ${qc.slice(0, 3).join(" | ")})`);
  else { allRefused = false; findings.push("✗ خودبازرسی کم‌گرفت!"); }

  // ۳) اعتبارسنج موتور واقعی روی ادغامِ آلوده (در حافظه — بدون نوشتن در مخزن)
  const orig = loadCartridgeSafe(CARTRIDGE.G3);
  const bad = mergeBatch(orig, corrupt, `${target}-batchXX-selftest`, seed);
  const v = validateCartridge(bad);
  const caught = ["شناسهٔ تکراری", "گزینه‌ها", "BP-016", "ضد J12"].map(frag => ({ frag, hit: v.errors.some(e => e.includes(frag)) }));
  for (const c of caught) findings.push(`${c.hit ? "✓" : "✗"} اعتبارسنج موتور «${c.frag}» ${c.hit ? "را قرمز کرد" : "را از دست داد!"}`);
  if (!v.ok && caught.every(c => c.hit)) findings.push(`✓ اعتبارسنج موتور: ok=false با ${v.errors.length} خطا — بچ آلوده هرگز وارد موتور نمی‌شود`);
  else allRefused = false;

  // ۴) مسیر بازگردانی روی نسخهٔ موقت (خارج از مخزن) — اثبات restore بایت‌به‌بایت
  const tmp = path.join(require("node:os").tmpdir(), `robot-selftest-${Date.now()}.json`);
  const origBytes = readFileSync(CARTRIDGE.G3);
  try {
    writeFileSync(tmp, JSON.stringify(bad, null, 2), "utf8");
    writeFileSync(tmp, origBytes); // rollback همان‌که در گیت قرمز اجرا می‌شود
    const same = Buffer.compare(readFileSync(tmp), origBytes) === 0;
    findings.push(same ? "✓ بازگردانی بایت‌به‌بایت: فایل اصلی سالم ماند" : "✗ بازگردانی ناقص بود!");
    if (!same) allRefused = false;
  } finally { require("node:fs").unlinkSync(tmp); }

  console.log("\n——— نتیجهٔ سلف‌تست ———");
  for (const f of findings) console.log("  " + f);
  if (allRefused) {
    console.log("\n🟢 سلف‌تست: بچ آلوده در هر چهار لایه رد شد — ربات ادغام نکرد و فایل اصلی دست‌نخورده ماند.");
    console.log("   رفتار ربات در حالت واقعی همین بچ = «refuse» با کد خروج ۱ و بازگردانی کامل (fail-closed).");
    console.log("   (کد خروج ۱ این سلف‌تست عمدی است — همان کدی که ربات در برخورد با بچ قرمز برمی‌گرداند.)");
    robotLog([
      "————————————————————————————————",
      `## ${nowIso()} — سلف‌تست fail-closed (BP-020)`,
      `- هدف: ${target} | seed: ${seed} | تزریق: ۵ سؤال معیوب (شناسهٔ تکراری، گزینهٔ ۳تایی، پاسخ ۹۹۹۹۹، وضعیت ممنوع «تأییدشده»، ضد-J12 با کلید غلط)`,
      `- نتیجه: هر چهار لایه (گارد ممنوعیت‌ها، خودبازرسی، اعتبارسنج موتور، بازگردانی بایت‌به‌بایت) قرمزِ مورد انتظار را ساخت؛ ادغام انجام نشد`,
      `- تصمیم: fail-closed سالم است — بچ آلوده هرگز ادغام نمی‌شود (رفتار واقعی: خروج ۱)`,
      ""
    ]);
    process.exit(1); // همان کدِ «ادغام ممنوع» — عمدی و مستند
  }
  console.error("\n⛔ سلف‌تست مردود: بخشی از بچ آلوده از گیت‌ها گذشت — ربات در وضعیت ناامن است (خروج ۲)");
  robotLog([
    "————————————————————————————————",
    `## ${nowIso()} — سلف‌تست fail-closed (BP-020)`,
    "- نتیجه: ⛔ مردود — بخشی از آلودگی از گیت‌ها گذشت؛ ادغام هیچ بچی تا رفع ایراد مجاز نیست",
    ""
  ]);
  process.exit(2);
}

// ── حالت dry-run / target / all ──────────────────────────────────────────────
function main() {
  const args = parseArgs();
  if (args.selfTest) selfTest();

  const targets = args.all ? QUEUE : (args.target ? [args.target] : die("یکی از --target <grade>-<domain> یا --all یا --self-test را بده"));
  for (const t of targets) {
    if (!QUEUE.includes(t)) die(`هدف نامعتبر: ${t} — صف مجاز: ${QUEUE.join("، ")}`);
  }

  const results: { target: string; decision: string; detail: string }[] = [];
  let exitCode = 0;
  for (const t of targets) {
    const seed = args.seed ?? DEFAULT_SEEDS[t] ?? die(`seed پیش‌فرض برای ${t} تعریف نشده`);
    let r: { decision: string; detail: string };
    try { r = runOne(t, seed, args.dryRun); }
    catch (e: any) { r = { decision: "error", detail: String(e?.stack ?? e) }; }
    results.push({ target: t, ...r });
    log(`نتیجهٔ ${t}: ${r.decision} — ${r.detail}`);
    if (["refuse", "rollback", "error"].includes(r.decision)) exitCode = 1;
    if (args.dryRun) break; // dry-run فقط اولین هدف صف را نقشه می‌کشد (هیچ نوشتنی)
  }

  if (!args.dryRun) {
    robotLog([
      "————————————————————————————————",
      `## ${nowIso()} — دور تولید ریزربات ۲ (BP-019/BP-020)`,
      ...results.map(r => {
        const seedUsed = args.seed ?? DEFAULT_SEEDS[r.target];
        return `- هدف: ${r.target} | seed: ${seedUsed} | تصمیم: ${r.decision} | ${r.detail}`;
      }),
      args.dryRun ? "- حالت: dry-run (بدون نوشتن)" : "- حالت: تولید واقعی",
      ""
    ]);
  } else {
    robotLog([
      "————————————————————————————————",
      `## ${nowIso()} — dry-run ریزربات ۲ (بدون نوشتن)`,
      ...results.map(r => `- هدف: ${r.target} | تصمیم: ${r.decision} | ${r.detail}`),
      ""
    ]);
  }

  log(exitCode === 0 ? "دور تولید با گیت‌های سبز کامل شد" : "دور تولید با قرمزی متوقف شد (fail-closed) — فایل اصلی بازگردانی شده است");
  process.exit(exitCode);
}

main();
