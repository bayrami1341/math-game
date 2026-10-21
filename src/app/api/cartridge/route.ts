// GET /api/cartridge — خشاب منتشرشده + برچسب‌سنجی زندهٔ هر گزینه با موتور واقعی بازی
//
// اصل تک‌منبع حقیقت: موتور تشخیص از public/math-game دوباره import می‌شود —
// هیچ قاعدهٔ تشخیصی اینجا کپی نمی‌شود. فقط «لایهٔ تفسیر سؤال» (تبدیل متن سؤال
// به ورودی موتور) در همین route زندگی می‌کند؛ خود موتورها Pure می‌مانند.
//
// خروجی: { cartridge: {cartridgeId, generatedAt, source, validation, identity}, bank: [...] }
// هر سؤال بانک: verdicts برای گزینه‌های انحرافی (گزینهٔ پاسخ رد می‌شود):
//   { letter, value, engineCode, claim } — engineCode=null یعنی «بی‌الگو»
//   (اگر value=null باشد گزینهٔ متنی/غیرعددی است و اصلاً به موتور نرسیده).

import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { classifyAttempt } from "../../../../public/math-game/src/v10/station/errors.js";
import { classifyV103 } from "../../../../public/math-game/src/v10/station/errors-v103.js";
import {
  extractMultiplicationFactors,
  parseClaims,
  parseOptionValue,
} from "../../../../public/math-game/src/v10/station/cartridge-schema.js";

export const dynamic = "force-dynamic";

const OPTION_LETTERS = ["الف", "ب", "ج", "د"];
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** تبدیل ارقام فارسی به لاتین — برای regexهای عددی روی متن فارسی */
function toLatinDigits(s: string): string {
  return String(s ?? "").replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
}

function toInt(s: string): number | null {
  const t = toLatinDigits(s);
  return /^\d+$/.test(t) ? parseInt(t, 10) : null;
}

type DivisionSpec = { op: "div"; a: number; b: number; totalDivision: boolean };
type SumSpec = { op: "sum"; a: number; b: number };

/**
 * استخراج (a)÷(b) از متن سؤال — دو مسیر:
 *  ۱) صریح: «۱۵÷۳=؟» با regex روی ÷
 *  ۲) داستانی: لنگر «را» + «در … Xتایی» (نمونه: «۱۹ مهره را در جعبه‌های ۴تایی» → a=19,b=4)
 *     یا «را … بین M» (نمونه: «۱۲ شیرینی را … بین ۳ بشقاب» → a=12,b=3) با گارد a>b
 * totalDivision = !prompt.includes('کامل') — قرارداد موتور v10.3:
 * پرسش «چند جعبهٔ کامل؟» جواب floorش درست است → باقیمانده برچسب نمی‌گیرد.
 */
function extractDivision(prompt: string): DivisionSpec | null {
  const text = String(prompt ?? "");
  const totalDivision = !text.includes("کامل");
  if (text.includes("÷")) {
    const m = /([۰-۹0-9]+)\s*÷\s*([۰-۹0-9]+)/.exec(text);
    if (!m) return null;
    const a = toInt(m[1]);
    const b = toInt(m[2]);
    if (a === null || b === null || b < 1) return null;
    return { op: "div", a, b, totalDivision };
  }
  if (!text.includes("را")) return null;
  const inBoxes = /([۰-۹0-9]+)[^؟]*?را[^؟]*?در[^؟]*?([۰-۹0-9]+)\s*تایی/.exec(text);
  const between = inBoxes ? null : /([۰-۹0-9]+)[^؟]*?را[^؟]*?بین\s*([۰-۹0-9]+)/.exec(text);
  const m = inBoxes ?? between;
  if (!m) return null;
  const a = toInt(m[1]);
  const b = toInt(m[2]);
  if (a === null || b === null || b < 1 || a <= b) return null;
  return { op: "div", a, b, totalDivision };
}

/**
 * تحلیل عدد کلامی فارسی (تا ۹۹۹۹) — فقط برای گزینه‌های کلامی سؤال‌های خواندن/نوشتن.
 * سخت‌گیرانه و صادقانه: هر توکن ناشناخته/ترتیب نادرست → null (هرگز حدس نمی‌زند).
 * نمونه‌ها: «چهار هزار و هفت»→۴۰۰۷ | «چهار هزار و هفتاد»→۴۰۷۰ | «چهارصد و هفتاد»→۴۷۰
 */
const FA_ONES: Record<string, number> = {
  "یک": 1, "دو": 2, "سه": 3, "چهار": 4, "پنج": 5, "شش": 6, "شیش": 6, "هفت": 7, "هشت": 8, "نه": 9,
  "ده": 10, "یازده": 11, "دوازده": 12, "سیزده": 13, "چهارده": 14, "پانزده": 15, "پونزده": 15,
  "شانزده": 16, "شونزده": 16, "هفده": 17, "هجده": 18, "هژده": 18, "نوزده": 19,
  "بیست": 20, "سی": 30, "چهل": 40, "پنجاه": 50, "شصت": 60, "هفتاد": 70, "هشتاد": 80, "نود": 90,
};
const FA_HUNDREDS: Record<string, number> = {
  "صد": 100, "دویست": 200, "سیصد": 300, "چهارصد": 400,
  "پانصد": 500, "ششصد": 600, "هفتصد": 700, "هشتصد": 800, "نهصد": 900,
};
function parseVerbalNumber(text: string): number | null {
  const t = String(text ?? "").trim().replace(/\u200c/g, " ");
  if (!t || /[۰-۹0-9]/.test(t)) return null; // فقط کلامی خالص
  const tokens = t.split(/\s+و\s+|\s+/).map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) return null;
  let value = 0;
  let cur = 0;
  for (const tok of tokens) {
    if (tok === "هزار") {
      const mult = cur === 0 ? 1 : cur < 10 ? cur : null;
      if (mult === null) return null;
      value += mult * 1000;
      if (value > 9999) return null;
      cur = 0;
    } else if (tok in FA_HUNDREDS) {
      if (cur !== 0) return null; // صد باید پیش از ده‌ها/یک‌ها بیاید
      cur = FA_HUNDREDS[tok];
    } else if (tok in FA_ONES) {
      const v = FA_ONES[tok];
      if (cur % 10 !== 0) return null; // یک‌ها فقط پس از ضریب ده‌گانه
      cur += v;
      if (cur >= 1000) return null;
    } else {
      return null; // توکن ناشناخته — بی‌الگوی صادقانه
    }
  }
  return value + cur;
}

/** چهاررقمی کلامی: «کدام خواندن برای عدد ۴۰۷۰ درست است؟» → {op:'read', a:4070} */
function extractFourDigitRead(prompt: string): { op: "read"; a: number } | null {
  const text = String(prompt ?? "");
  if (!/(خواندن|نوشتن)/.test(text)) return null;
  const m = /(?:عدد\s*)?(\d{4})/.exec(toLatinDigits(text));
  if (!m) return null;
  const a = parseInt(m[1], 10);
  if (a < 1000 || a > 9999) return null;
  return { op: "read", a };
}

/** جمع ستونی دقیقاً به فرم «a + b = ؟» (روی ارقام فارسی/لاتین) — نمونه: «۳۵۸ + ۲۴۶ = ؟» */
function extractColumnSum(prompt: string): SumSpec | null {
  const m = /^\s*([۰-۹0-9]+)\s*\+\s*([۰-۹0-9]+)\s*=\s*؟\s*$/.exec(
    String(prompt ?? "").trim()
  );
  if (!m) return null;
  const a = toInt(m[1]);
  const b = toInt(m[2]);
  if (a === null || b === null) return null;
  return { op: "sum", a, b };
}

export async function GET() {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "math-game",
      "cartridges",
      "KH-G3-MATH.json"
    );
    const raw = await readFile(filePath, "utf8");
    const cartridge = JSON.parse(raw);

    const bookMap = Array.isArray(cartridge?.bookMap) ? cartridge.bookMap : [];
    const bank = Array.isArray(cartridge?.questionBank) ? cartridge.questionBank : [];
    if (bank.length === 0) {
      return NextResponse.json(
        { error: "ساختار خشاب نامعتبر است — بانک سؤال یافت نشد." },
        { status: 500 }
      );
    }

    const anchorTitle = new Map<string, string>();
    for (const l of bookMap) {
      if (l && typeof l.id === "string") anchorTitle.set(l.id, String(l.title ?? l.id));
    }

    const enrichedBank = bank.map((q: any) => {
      const prompt = String(q?.prompt ?? "");
      const options = Array.isArray(q?.options) ? q.options.map((o: any) => String(o ?? "")) : [];
      const answerIndex =
        Number.isInteger(q?.answerIndex) && q.answerIndex >= 0 && q.answerIndex <= 3
          ? q.answerIndex
          : -1;
      const claims = parseClaims(q?.optionErrorMap);

      // لایهٔ تفسیر سؤال — یک‌بار در سطح سؤال، نه در هر گزینه
      const factors = extractMultiplicationFactors(prompt);
      const division = factors ? null : extractDivision(prompt);
      const colSum = factors || division ? null : extractColumnSum(prompt);
      const readSpec =
        factors || division || colSum ? null : extractFourDigitRead(prompt);

      const verdicts: {
        letter: string;
        value: number | null;
        engineCode: string | null;
        claim: string | null;
      }[] = [];
      for (let i = 0; i < options.length && i < 4; i++) {
        if (i === answerIndex) continue; // گزینهٔ پاسخ رد می‌شود
        const letter = OPTION_LETTERS[i];
        const value = parseOptionValue(options[i]) ?? (readSpec ? parseVerbalNumber(options[i]) : null);
        let engineCode: string | null = null;
        if (value !== null) {
          if (factors) {
            engineCode = classifyAttempt({ f1: factors.f1, f2: factors.f2, submitted: value });
          } else if (division) {
            engineCode = classifyV103(division, value);
          } else if (colSum) {
            engineCode = classifyV103(colSum, value);
          } else if (readSpec) {
            engineCode = classifyV103(readSpec, value);
          }
        }
        const claim = claims.find((c: { letter: string }) => c.letter === letter)?.claim ?? null;
        verdicts.push({ letter, value, engineCode: engineCode ?? null, claim });
      }

      return {
        id: String(q?.id ?? ""),
        anchorId: String(q?.anchorId ?? ""),
        anchorTitle: anchorTitle.get(String(q?.anchorId ?? "")) ?? null,
        cpa: q?.cpa ?? null,
        domain: q?.domain ?? null,
        status: String(q?.status ?? ""),
        prompt,
        options,
        answerIndex,
        optionErrorMap: q?.optionErrorMap ?? null,
        verdicts,
      };
    });

    return NextResponse.json({
      cartridge: {
        cartridgeId: cartridge?.cartridgeId ?? null,
        generatedAt: cartridge?.generatedAt ?? null,
        source: cartridge?.source ?? null,
        validation: cartridge?.validation ?? null,
        identity: Array.isArray(cartridge?.identity) ? cartridge.identity : [],
      },
      bank: enrichedBank,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `خواندن یا تحلیل خشاب منتشرشده ناموفق بود: ${
          err instanceof Error ? err.message : "خطای ناشناخته"
        }`,
      },
      { status: 500 }
    );
  }
}
