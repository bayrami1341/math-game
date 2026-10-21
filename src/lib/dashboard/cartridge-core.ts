// هستهٔ سروری «کارگاه خشاب» — خواندن، فهرست و نصب خشاب‌های منتشرشده
//
// اصل تک‌منبع حقیقت:
//  • پوشهٔ public/math-game/cartridges = تنها محل زندگی خشاب‌ها (بازی و داشبورد هر دو همان را می‌خوانند)
//  • موتور تشخیص و اعتبارسنجی از خود بازی import می‌شود — هیچ قاعدهٔ تشخیصی اینجا کپی نمی‌شود
//  • نصب fail-closed است: خشابی که گیت را نگذراند (حتی یک قرمز) روی دیسک نوشته نمی‌شود

import { readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import { classifyAttempt } from "../../../public/math-game/src/v10/station/errors.js";
import { classifyV103 } from "../../../public/math-game/src/v10/station/errors-v103.js";
import {
  extractMultiplicationFactors,
  parseClaims,
  parseOptionValue,
  validateCartridge,
} from "../../../public/math-game/src/v10/station/cartridge-schema.js";

export const CARTRIDGES_DIR = path.join(
  process.cwd(),
  "public",
  "math-game",
  "cartridges"
);

/** الگوی شناسهٔ مجاز خشاب — هم گارد مسیر (path traversal) هم قاعدهٔ نام‌گذاری */
const CARTRIDGE_ID_PATTERN = /^KH-[A-Za-z0-9_-]+$/;

const OPTION_LETTERS = ["الف", "ب", "ج", "د"];
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

// ─── تفسیر لایهٔ سؤال (مشترک بین همهٔ APIهای خشاب) ───

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

/** استخراج (a)÷(b) از متن سؤال — صریح («۱۵÷۳=؟») یا داستانی («۱۹ مهره را در جعبه‌های ۴تایی») */
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

/** تحلیل عدد کلامی فارسی (تا ۹۹۹۹) — سخت‌گیرانه و صادقانه؛ توکن ناشناخته = null */
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

/** چهاررقمی کلامی: «کدام خواندن برای عدد ۴۰۷۰ درست است؟» */
function extractFourDigitRead(prompt: string): { op: "read"; a: number } | null {
  const text = String(prompt ?? "");
  if (!/(خواندن|نوشتن)/.test(text)) return null;
  const m = /(?:عدد\s*)?(\d{4})/.exec(toLatinDigits(text));
  if (!m) return null;
  const a = parseInt(m[1], 10);
  if (a < 1000 || a > 9999) return null;
  return { op: "read", a };
}

/** جمع ستونی دقیقاً به فرم «a + b = ؟» */
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

// ─── برچسب‌سنجی زندهٔ بانک سؤال ───

interface RawQuestion {
  id?: unknown;
  anchorId?: unknown;
  prompt?: unknown;
  options?: unknown;
  answerIndex?: unknown;
  optionErrorMap?: unknown;
  cpa?: unknown;
  domain?: unknown;
  status?: unknown;
}

/** هر سؤال بانک + حکم زندهٔ موتور برای گزینه‌های انحرافی (گزینهٔ پاسخ رد می‌شود) */
function enrichBank(cartridge: Record<string, unknown>): Record<string, unknown>[] {
  const bookMap = Array.isArray(cartridge?.bookMap) ? cartridge.bookMap : [];
  const bank = Array.isArray(cartridge?.questionBank) ? cartridge.questionBank : [];

  const anchorTitle = new Map<string, string>();
  for (const l of bookMap as Record<string, unknown>[]) {
    if (l && typeof l.id === "string") anchorTitle.set(l.id, String(l.title ?? l.id));
  }

  return bank.map((q: RawQuestion) => {
    const prompt = String(q?.prompt ?? "");
    const options = Array.isArray(q?.options) ? q.options.map((o) => String(o ?? "")) : [];
    const answerIndex =
      Number.isInteger(q?.answerIndex) && (q?.answerIndex as number) >= 0 && (q?.answerIndex as number) <= 3
        ? (q?.answerIndex as number)
        : -1;
    const claims = parseClaims(q?.optionErrorMap);

    // لایهٔ تفسیر سؤال — یک‌بار در سطح سؤال، نه در هر گزینه
    const factors = extractMultiplicationFactors(prompt);
    const division = factors ? null : extractDivision(prompt);
    const colSum = factors || division ? null : extractColumnSum(prompt);
    const readSpec = factors || division || colSum ? null : extractFourDigitRead(prompt);

    const verdicts: {
      letter: string;
      value: number | null;
      engineCode: string | null;
      claim: string | null;
    }[] = [];
    for (let i = 0; i < options.length && i < 4; i++) {
      if (i === answerIndex) continue; // گزینهٔ پاسخ رد می‌شود
      const letter = OPTION_LETTERS[i];
      const value =
        parseOptionValue(options[i]) ?? (readSpec ? parseVerbalNumber(options[i]) : null);
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
      const claim =
        claims.find((c: { letter: string }) => c.letter === letter)?.claim ?? null;
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
}

// ─── شناسنامهٔ مشترک ───

export interface CartridgeMetaPayload {
  cartridgeId: string | null;
  generatedAt: string | null;
  source: { file?: string; tool?: string } | null;
  validation: ReturnType<typeof validateCartridge> | null;
  identity: Record<string, unknown>[];
}

function buildMeta(cartridge: Record<string, unknown>, validation: ReturnType<typeof validateCartridge>): CartridgeMetaPayload {
  return {
    cartridgeId: typeof cartridge?.cartridgeId === "string" ? cartridge.cartridgeId : null,
    generatedAt: typeof cartridge?.generatedAt === "string" ? cartridge.generatedAt : null,
    source:
      cartridge?.source && typeof cartridge.source === "object"
        ? (cartridge.source as { file?: string; tool?: string })
        : null,
    validation,
    identity: Array.isArray(cartridge?.identity) ? (cartridge.identity as Record<string, unknown>[]) : [],
  };
}

// ─── فهرست خشاب‌های نصب‌شده ───

export interface CartridgeListItem {
  id: string;
  file: string;
  title: string | null;
  generatedAt: string | null;
  sourceFile: string | null;
  tool: string | null;
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    lessons: number;
    lessonsConfirmed: number;
    atlasReal: number;
    atlasProposed: number;
    questions: number;
    questionsConfirmed: number;
    questionsProposed: number;
  } | null;
  gate: { red: number; yellow: number; verdict: string } | null;
}

function pickIdentityTitle(identity: Record<string, unknown>[]): string | null {
  const f = identity.find(
    (x) => x && typeof x === "object" && x["field"] === "عنوان فارسی خشاب"
  );
  return f && typeof f["value"] === "string" ? f["value"] : null;
}

/** فهرست همهٔ فایل‌های KH-*.json در پوشهٔ cartridges به‌همراه حکم گیت هرکدام */
export async function listCartridges(): Promise<CartridgeListItem[]> {
  let names: string[] = [];
  try {
    names = await readdir(CARTRIDGES_DIR);
  } catch {
    return []; // پوشه نیست = خشابی نصب نیست
  }

  const items = await Promise.all(
    names
      .filter((n) => /^KH-[A-Za-z0-9_-]+\.json$/.test(n))
      .map(async (n): Promise<CartridgeListItem> => {
        const id = n.replace(/\.json$/, "");
        try {
          const raw = await readFile(path.join(CARTRIDGES_DIR, n), "utf8");
          const cartridge = JSON.parse(raw) as Record<string, unknown>;
          const validation = validateCartridge(cartridge, cartridge?.cartridgeId as string);
          const meta = buildMeta(cartridge, validation);
          return {
            id,
            file: n,
            title: pickIdentityTitle(meta.identity),
            generatedAt: meta.generatedAt,
            sourceFile: meta.source?.file ?? null,
            tool: meta.source?.tool ?? null,
            valid: validation.ok,
            errors: validation.errors ?? [],
            warnings: validation.warnings ?? [],
            stats: validation.stats && "lessons" in validation.stats
              ? (validation.stats as CartridgeListItem["stats"])
              : null,
            gate: validation.gate ?? null,
          };
        } catch (err) {
          return {
            id,
            file: n,
            title: null,
            generatedAt: null,
            sourceFile: null,
            tool: null,
            valid: false,
            errors: [
              `فایل خوانده یا تجزیه نشد: ${err instanceof Error ? err.message : "خطای ناشناخته"}`,
            ],
            warnings: [],
            stats: null,
            gate: null,
          };
        }
      })
  );

  // خشاب پُرتر و تازه‌تر اول — برای نمایش پایدار
  return items.sort((a, b) => {
    const score = (c: CartridgeListItem) => (c.stats?.questions ?? 0) * 1000 + (c.stats?.lessons ?? 0);
    return score(b) - score(a) || a.id.localeCompare(b.id);
  });
}

// ─── خواندن جزئیات یک خشاب ───

export interface CartridgeDetail {
  cartridge: CartridgeMetaPayload;
  bookMap: Record<string, unknown>[];
  atlas: Record<string, unknown>[];
  bank: Record<string, unknown>[];
}

const BOOKMAP_FIELDS = [
  "id", "page", "chapter", "title", "objective", "vocabulary", "activityType",
  "visual", "practicePotential", "engineCompat", "anchorsRaw", "source", "status", "note",
] as const;

const ATLAS_FIELDS = [
  "code", "nameFa", "category", "description", "behavioralSignal", "intervention",
  "priority", "questionPattern", "source", "status", "note",
] as const;

function pickFields(row: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f] = row?.[f] ?? null;
  return out;
}

/** خواندن یک خشاب با گارد شناسه (ضد path traversal) — null = یافت نشد */
export async function readCartridgeDetail(id: string): Promise<CartridgeDetail | null> {
  if (!CARTRIDGE_ID_PATTERN.test(id)) return null;
  let raw: string;
  try {
    raw = await readFile(path.join(CARTRIDGES_DIR, `${id}.json`), "utf8");
  } catch {
    return null;
  }
  let cartridge: Record<string, unknown>;
  try {
    cartridge = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`فایل خشاب «${id}» JSON معتبر نیست.`);
  }
  const validation = validateCartridge(cartridge, cartridge?.cartridgeId as string);
  return {
    cartridge: buildMeta(cartridge, validation),
    bookMap: (Array.isArray(cartridge.bookMap) ? cartridge.bookMap : []).map((r) =>
      pickFields(r as Record<string, unknown>, BOOKMAP_FIELDS)
    ),
    atlas: (Array.isArray(cartridge.errorAtlas) ? cartridge.errorAtlas : []).map((r) =>
      pickFields(r as Record<string, unknown>, ATLAS_FIELDS)
    ),
    bank: enrichBank(cartridge),
  };
}

// ─── نصب خشاب از فایل آپلودی ───

export type InstallOutcome =
  | { ok: true; id: string; overwritten: boolean; validation: ReturnType<typeof validateCartridge> }
  | { ok: false; status: 400; reason: string; errors: string[]; warnings: string[] }
  | { ok: false; status: 409; reason: string; id: string };

/**
 * نصب fail-closed: فقط خشابی که گیت را با صفر قرمز رد کند نوشته می‌شود.
 * شناسه باید با الگوی KH-… بخواند (گارد مسیر + قاعدهٔ نام‌گذاری)؛
 * overwrite=false و فایل موجود → 409.
 */
export async function installCartridge(
  data: unknown,
  overwrite: boolean
): Promise<InstallOutcome> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, status: 400, reason: "بدنهٔ آپلودی یک شیء JSON خشاب نیست.", errors: [], warnings: [] };
  }
  const cartridge = data as Record<string, unknown>;
  const id = cartridge?.cartridgeId;
  if (typeof id !== "string" || !CARTRIDGE_ID_PATTERN.test(id)) {
    return {
      ok: false,
      status: 400,
      reason: "شناسهٔ خشاب (cartridgeId) نامعتبر است — باید با الگوی KH-… باشد.",
      errors: [],
      warnings: [],
    };
  }

  const validation = validateCartridge(cartridge, id);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      reason: "خشاب گیت اعتبارسنجی را نگذراند — نصب نشد (fail-closed).",
      errors: validation.errors ?? [],
      warnings: validation.warnings ?? [],
    };
  }

  const target = path.join(CARTRIDGES_DIR, `${id}.json`);
  let overwritten = false;
  try {
    await readFile(target, "utf8");
    overwritten = true; // فایل موجود است
  } catch {
    overwritten = false;
  }
  if (overwritten && !overwrite) {
    return { ok: false, status: 409, reason: "خشابی با همین شناسه نصب است.", id };
  }

  await writeFile(target, `${JSON.stringify(cartridge, null, 2)}\n`, "utf8");
  return { ok: true, id, overwritten, validation };
}
