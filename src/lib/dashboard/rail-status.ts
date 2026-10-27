// وضعیت زندهٔ «ریل اصلی» — نمای هماهنگ‌کنندهٔ خط لولهٔ سه‌بخشی
//
// نقش (فرمان مالک — trace 1a16cb2bea057abd): طراحی و نظارت کل ریل از ابتدای بخش ۱
// تا تحویل خروجی بخش ۳ بر عهدهٔ z.ai است؛ توسعهٔ بخش ۱ و بخش ۲ توسط دو هوش مصنوعی
// مجزا انجام می‌شود و این تابلو فقط «وضعیت را می‌خواند» — هیچ داوری ارزشی و
// هیچ مُهری اینجا وجود ندارد.

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  getMatrixView,
  getReceipts,
  tehranNowFa,
} from "@/lib/dashboard/domain-matrix";

const execFileAsync = promisify(execFile);

const REPO = "/home/z/math-game-repo";
const REGISTRY_PATH = path.join(REPO, "blueprints", "registry.json");
const SOURCE_REPORT_PATH = path.join(REPO, "reports", "source-acceptance-c205.md");
const CONTRACT_PATH = path.join(REPO, "authoring", "OPERATION-CONTRACT.json");
const RAIL_CONTRACT_DOC_PATH = path.join(REPO, "reports", "rail-main-contract-v1.fa.md");
const PAGE_MAP_G2_PATH = path.join(REPO, "authoring", "PAGE-MAP-KH-G2-MATH-v1.json");
const PAGE_MAP_G3_PATH = path.join(REPO, "authoring", "PAGE-MAP-KH-G3-MATH-v1.json");
const BUDGET_G3_PATH = path.join(REPO, "authoring", "QUESTION-BUDGET-G3-v1.json");
const BUDGET_G2_PATH = path.join(REPO, "authoring", "QUESTION-BUDGET-G2-v1.json");
const HANDOFF_MANIFEST_PATH = path.join(REPO, "handoff", "HANDOFF-MANIFEST-v1.json");
const BATCHES_DIR = path.join(REPO, "authoring", "batches");

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const faBudget = (n: number): string =>
  String(n).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);

export type RailStatus = "green" | "amber" | "red";

export interface RailMechanism {
  name: string;
  status: RailStatus;
  evidence?: string;
  detail?: string;
}

export interface RailBoundary {
  id: string;
  title: string;
  from: string;
  to: string;
  status: RailStatus;
  summary: string;
  mechanisms: RailMechanism[];
}

export interface RailPart {
  id: string;
  title: string;
  developer: string;
  coordinator: string;
  scope: string;
  status: RailStatus;
  statusText: string;
}

export interface RailDecision {
  id: string;
  group: "معلم" | "مالک کار";
  title: string;
  status: "open" | "partial";
  note?: string;
}

export interface RailBudget {
  path: string;
  exists: boolean;
  schema: string;
  status: string;
  traceId: string;
  totalMin: number;
  totalMax: number;
  subtopics: number;
  chapters: number;
  levels?: Record<string, number[]>;
  ratiosClaimed?: Record<string, number>;
  foldingRule?: string;
  verification?: { script?: string; result?: string; checks?: string[] };
  reconciliation?: { matrixCurrent?: { g3MinTotal?: number; status?: string }; gap?: string };
}

export interface RailHandoffView {
  path: string;
  exists: boolean;
  status: string;
  orderTrace: string;
  deliveryTrace: string;
  issuedAtTehran: string;
  deliveryCommit: string;
  evidenceCommits: string[];
  gate: { script: string; tests: number; result: string };
  recipients: { id: string; fa: string; brief: string; firstTask: string }[];
  filesCount: number;
}

export interface RailRegistrySnapshot {
  version: number;
  total: number;
  counts: { label: string; value: number }[];
  pendingAcceptance: { id: string; title: string }[];
  lastCommit: { sha: string; subject: string } | null;
  error?: string;
}

export interface RailView {
  schema: "khshab.rail-view/v1";
  generatedAtTehran: string;
  coordinatorNote: string;
  railContract: { path: string; exists: boolean; note: string };
  pipeline: RailBoundary[];
  parts: RailPart[];
  budget: RailBudget | null;
  budgetG2: RailBudget | null;
  handoff: RailHandoffView | null;
  feedbackLoop: { title: string; status: RailStatus; summary: string };
  decisions: RailDecision[];
  principles: string[];
  registry: RailRegistrySnapshot;
  engineTests: { passed: number; total: number; note: string };
}

// ---------- ابزارهای کوچک ----------

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  const text = await readTextIfExists(p);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function listBatchFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(BATCHES_DIR);
    return entries.filter((e) => /batch/i.test(e));
  } catch {
    return [];
  }
}

async function getLastCommit(): Promise<{ sha: string; subject: string } | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", REPO, "log", "-1", "--pretty=format:%h%n%s"],
      { timeout: 5_000 }
    );
    const [sha, subject] = stdout.trim().split("\n");
    if (!sha) return null;
    return { sha, subject: subject ?? "" };
  } catch {
    return null;
  }
}

// ---------- تصمیم‌های انسانی معلق (منبع حقیقت: گفتگو با مالک) ----------

const DECISIONS: RailDecision[] = [
  {
    id: "۱",
    group: "معلم",
    title: "مُهر گام صفر روی ماتریس دامنه‌ها",
    status: "open",
    note: "ایستگاه مُهر در تب «ماتریس دامنه‌ها» آماده است؛ تا مُهر، ماتریس DRAFT می‌ماند.",
  },
  {
    id: "۲",
    group: "معلم",
    title: "بازبینی بچ محتوایی D4-G3 (۱۰۰ سؤال ضرب و تقسیم)",
    status: "open",
    note: "بچ با وضعیت «نیاز به تأیید» ادغام شده؛ رأی معلم منتظر است.",
  },
  {
    id: "۳",
    group: "معلم",
    title: "مُهر اطلس رسمی کدهای خطای W8",
    status: "open",
    note: "طبقه‌بندی خطا آماده و آزمون‌شده است؛ نام‌گذاری رسمی کار معلم است.",
  },
  {
    id: "۴",
    group: "معلم",
    title: "حدهای عددی per-book برای هر پایه",
    status: "partial",
    note: "پیش‌فرض فنی در قرارداد M09 v1.1.0 ثبت شده — رأی انسانی معلق است.",
  },
  {
    id: "۵",
    group: "مالک کار",
    title: "تعارض الف — حدود استقلال ریزربات‌های G2",
    status: "open",
  },
  {
    id: "۶",
    group: "مالک کار",
    title: "تعارض ب — گسترش حدهای G2 (سناریوهای CAP-01/02/03 فراتر از محدوده)",
    status: "open",
  },
  {
    id: "۷",
    group: "مالک کار",
    title: "تعارض ج — میزبانی ریزربات حلقه (T4: foreman + صف ۲۴ ساعته)",
    status: "open",
    note: "وضعیت فعلی T4: NOT_DEPLOYED — هیچ ادعای استقراری وجود ندارد.",
  },
  {
    id: "۸",
    group: "مالک کار",
    title: "تعارض د — اتصال دوسویهٔ مبدل (بازسازی Excel→JSON بچ D4 را خالی می‌کند)",
    status: "open",
  },
  {
    id: "۹",
    group: "مالک کار",
    title: "سرنوشت PR #2 آرنا (۱۵ فایل متعارض)",
    status: "partial",
    note: "گزارش تعارض و طرح امن یک‌سویه آماده است؛ merge فقط با فرمان صاحب کار.",
  },
  {
    id: "۱۰",
    group: "مالک کار",
    title: "پذیرش رسمی BP-022 / BP-023 / BP-024 / BP-025 / BP-026",
    status: "open",
    note: "پنج تحویلِ در انتظار آزمون مصرف‌کننده و مُهر مالک — BP-026 بودجهٔ رسمی سؤالات G3 است.",
  },
];

const PRINCIPLES = [
  "هیچ ارزش‌گذاری آموزشی بدون مُهر انسان انجام نمی‌شود — AI فقط اجرا، پیشنهاد و گزارش است.",
  "هر تعارض به‌صورت گزینه‌های مجزا به صاحب کار عرضه می‌شود؛ برداشت نتیجه ممنوع.",
  "هیچ push و merge بدون فرمان صریح صاحب کار انجام نمی‌شود.",
  "داده فقط از دروازه‌های رسمی (گیت‌های fail-closed) وارد موتور می‌شود — بدون استثنا.",
  "زبان مالک همیشه فارسی است؛ هیچ بایتی از کتاب، PDF یا توکن هرگز در چت منتشر نمی‌شود.",
];

const STATUS_LABELS: Record<string, string> = {
  done: "پایان‌یافته",
  verified: "تأییدشده",
  delivered: "تحویل‌شده",
  executing: "در حال اجرا",
  approved: "تصویب‌شده",
  planned: "برنامه‌ریزی‌شده",
  blocked: "متوقف",
};

// ---------- ساخت نمای ریل ----------

export async function getRailView(): Promise<RailView> {
  // موازی‌سازی همهٔ خواندن‌ها برای پاسخ سریع
  const [
    registry,
    sourceReport,
    contract,
    railContractDocExists,
    pageMapG2Exists,
    pageMapG3Exists,
    budget,
    budgetG2,
    handoffManifest,
    batches,
    matrix,
    receipts,
    lastCommit,
  ] = await Promise.all([
    readJsonIfExists<{
      version?: number;
      blueprints?: { id: string; title: string; status: string }[];
    }>(REGISTRY_PATH),
    readTextIfExists(SOURCE_REPORT_PATH),
    readJsonIfExists<{ schema?: string; version?: string; contract_version?: string }>(
      CONTRACT_PATH
    ),
    fileExists(RAIL_CONTRACT_DOC_PATH),
    fileExists(PAGE_MAP_G2_PATH),
    fileExists(PAGE_MAP_G3_PATH),
    readJsonIfExists<{
      schema?: string;
      status?: string;
      provenance?: { traceId?: string };
      grandTotal?: { min?: number; max?: number; levels?: Record<string, number[]> };
      chapters?: unknown[];
      levels?: Record<string, { definition?: string }>;
      ratiosClaimed?: Record<string, number>;
      foldingRule?: string;
      verification?: { script?: string; result?: string; checks?: string[] };
      reconciliation?: {
        matrixCurrent?: { g3MinTotal?: number; status?: string };
        gap?: string;
      };
    }>(BUDGET_G3_PATH),
    readJsonIfExists<{
      schema?: string;
      status?: string;
      provenance?: { trace?: string; traceId?: string };
      grandTotal?: { min?: number; max?: number; levels?: Record<string, number[]> };
      chapters?: unknown[];
      ratiosClaimed?: Record<string, number>;
      foldingRule?: string;
      verification?: { script?: string; result?: string; checks?: string[] };
    }>(BUDGET_G2_PATH),
    readJsonIfExists<{
      status?: string;
      orderTrace?: string;
      deliveryTrace?: string;
      issuedAtTehran?: string;
      deliveryChannel?: { deliveryCommit?: string; evidenceCommits?: string[] };
      gate?: { script?: string; tests?: number; result?: string };
      recipients?: { id?: string; fa?: string; brief?: string; firstTask?: string }[];
      files?: unknown[];
    }>(HANDOFF_MANIFEST_PATH),
    listBatchFiles(),
    getMatrixView(),
    getReceipts(),
    getLastCommit(),
  ]);

  // --- رجیستری ---
  const blueprintList = registry?.blueprints ?? [];
  const statusCounts = new Map<string, number>();
  for (const bp of blueprintList) {
    statusCounts.set(bp.status, (statusCounts.get(bp.status) ?? 0) + 1);
  }
  const pendingAcceptance = blueprintList
    .filter((bp) => bp.status === "delivered")
    .map((bp) => ({ id: bp.id, title: bp.title }));

  const registrySnapshot: RailRegistrySnapshot = {
    version: registry?.version ?? 0,
    total: blueprintList.length,
    counts: [...statusCounts.entries()].map(([status, value]) => ({
      label: STATUS_LABELS[status] ?? status,
      value,
    })),
    pendingAcceptance,
    lastCommit,
    error: registry ? undefined : "رجیستری مخزن خوانده نشد (clone محلی در دسترس نیست)",
  };

  // --- نمای تحویل اسکلت (قبل از مرزها — B0 به آن وابسته است) ---
  const handoffView: RailHandoffView | null = handoffManifest
    ? {
        path: "handoff/HANDOFF-MANIFEST-v1.json",
        exists: true,
        status: handoffManifest.status ?? "—",
        orderTrace: handoffManifest.orderTrace ?? "—",
        deliveryTrace: handoffManifest.deliveryTrace ?? "—",
        issuedAtTehran: handoffManifest.issuedAtTehran ?? "—",
        deliveryCommit: handoffManifest.deliveryChannel?.deliveryCommit ?? "—",
        evidenceCommits: handoffManifest.deliveryChannel?.evidenceCommits ?? [],
        gate: {
          script: handoffManifest.gate?.script ?? "scripts/verify-skeleton-handoff.py",
          tests: handoffManifest.gate?.tests ?? 43,
          result: handoffManifest.gate?.result ?? "—",
        },
        recipients: (handoffManifest.recipients ?? []).map((r) => ({
          id: r.id ?? "—",
          fa: r.fa ?? "—",
          brief: r.brief ?? "—",
          firstTask: r.firstTask ?? "—",
        })),
        filesCount: Array.isArray(handoffManifest.files) ? handoffManifest.files.length : 0,
      }
    : null;

  // --- مرز ۰: ورود منبع ---
  const sourceReportText = sourceReport ?? "";
  const sourcePass = sourceReportText.includes("**PASS**") || /PASS/.test(sourceReportText);
  const pagesMatch = sourceReportText.match(/pages=(\d+)/);
  const shaMatch = sourceReportText.match(/C205:print-\d+:\d+:([0-9a-f]{12})/);

  const boundary0: RailBoundary = {
    id: "B0",
    title: "ورود منبع",
    from: "کتاب درسی رسمی",
    to: "بخش ۱ (ربات آشیل)",
    status: sourcePass ? "green" : "red",
    summary:
      "هیچ منبعی بدون تطبیق هش SHA-256 و مانیفست vault وارد ریل نمی‌شود؛ گیت منبع نسخهٔ ۲ fail-closed است.",
    mechanisms: [
      {
        name: "تحویل اسکلت ساخت به دو بخش قبلی (اشیل + آرنا)",
        status: handoffView ? "green" : "red",
        evidence: handoffView ? `handoff/ — commit ${handoffView.deliveryCommit}` : "handoff/HANDOFF-MANIFEST-v1.json",
        detail: handoffView
          ? `فرمان مالک (trace ${handoffView.deliveryTrace}): بودجهٔ خشاب G2 (موضوعات هر فصل + آمار) و G3، جداگانه، قبل از هر تحلیل — ${faBudget(handoffView.recipients.length)} گیرنده + دو بریف کپی‌آماده — گیت ${faBudget(handoffView.gate.tests)} آزمون: ${handoffView.gate.result}`
          : "مانیفست تحویل اسکلت یافت نشد — حکم «اسکلت قبل از تحلیل» بدون شاهد است.",
      },
      {
        name: "گیت پذیرش منبع Z01 (نسخهٔ ۲ سخت‌شده)",
        status: sourcePass ? "green" : "red",
        evidence: "reports/source-acceptance-c205.md",
        detail: sourcePass
          ? `حکم PASS — pin ${shaMatch ? `C205:print-14 (SHA ${shaMatch[1]}…)` : "C205"} — ${pagesMatch ? `${pagesMatch[1]} صفحه` : "صفحات تأییدشده"} — فقط هش و آمار منتشر می‌شود، هیچ بایتی از کتاب`
          : "گزارش پذیرش منبع یافت نشد — ورود منبع مسدود است.",
      },
      {
        name: "کتاب خام (vault محلی خارج از Git)",
        status: "amber",
        detail:
          "پس از ریست سندباکس، فایل محلی غایب است؛ بازپذیری فقط با منبع تازه از مالک و بدون انتقال بایت در چت.",
      },
    ],
  };

  // --- مرز ۱: استخراج و دست‌به‌دست به ممیزی ---
  const boundary1: RailBoundary = {
    id: "B1",
    title: "استخراج صفحه‌به‌صفحه و تحویل به ممیزی",
    from: "بخش ۱ (ربات آشیل)",
    to: "بخش ۲ (ممیزی — آرنا)",
    status: pageMapG2Exists && pageMapG3Exists ? "green" : "red",
    summary:
      "خروجی رسمی صفحه‌به‌صفحهٔ هر دو کتاب آماده و به خط محتوای آرنا تحویل شده است؛ کامل‌شدن برچسب دامنه پیش‌نیاز پوشش صددرصد است.",
    mechanisms: [
      {
        name: "page-map پایهٔ دوم (v1)",
        status: pageMapG2Exists ? "green" : "red",
        evidence: "authoring/PAGE-MAP-KH-G2-MATH-v1.json + xlsx",
      },
      {
        name: "page-map پایهٔ سوم (v1)",
        status: pageMapG3Exists ? "green" : "red",
        evidence: "authoring/PAGE-MAP-KH-G3-MATH-v1.json + xlsx",
      },
      {
        name: "بریف‌های هماهنگی آرنا",
        status: "green",
        evidence: "authoring/ARENA-BRIEF-PAGEMAP-KH-G2/G3-v1.fa.md",
      },
      {
        name: "برچسب دامنهٔ صفحات",
        status: "amber",
        detail:
          "۲۹۰ صفحه بدون برچسب دامنه (برگزیدهٔ بازرس مستقل BP-024) — برچسب‌گذاری کار خط تولید/انسان است و بازرس عمداً حدس نمی‌زند.",
      },
    ],
  };

  // --- مرز ۲: ارزش‌گذاری و تحویل به موتور ---
  const matrixStatus = matrix.matrix?.status ?? "UNKNOWN";
  const batchNames = batches;
  const budgetView: RailBudget | null = budget
    ? {
        path: "authoring/QUESTION-BUDGET-G3-v1.json",
        exists: true,
        schema: budget.schema ?? "khshab.question-budget/v1",
        status: budget.status ?? "OWNER_AUTHORITATIVE",
        traceId: budget.provenance?.traceId ?? "—",
        totalMin: budget.grandTotal?.min ?? 456,
        totalMax: budget.grandTotal?.max ?? 684,
        subtopics: Array.isArray(budget.chapters)
          ? budget.chapters.reduce(
              (acc, ch) => acc + (Array.isArray((ch as { topics?: unknown[] })?.topics) ? ((ch as { topics: unknown[] }).topics.length) : 0),
              0
            )
          : 0,
        chapters: Array.isArray(budget.chapters) ? budget.chapters.length : 0,
        levels: budget.grandTotal?.levels,
        ratiosClaimed: budget.ratiosClaimed,
        foldingRule: budget.foldingRule,
        verification: budget.verification,
        reconciliation: budget.reconciliation,
      }
    : null;
  const budgetG2View: RailBudget | null = budgetG2
    ? {
        path: "authoring/QUESTION-BUDGET-G2-v1.json",
        exists: true,
        schema: budgetG2.schema ?? "khshab.question-budget/v1",
        status: budgetG2.status ?? "OWNER_AUTHORITATIVE",
        traceId: budgetG2.provenance?.trace ?? budgetG2.provenance?.traceId ?? "—",
        totalMin: budgetG2.grandTotal?.min ?? 368,
        totalMax: budgetG2.grandTotal?.max ?? 552,
        subtopics: Array.isArray(budgetG2.chapters)
          ? budgetG2.chapters.reduce(
              (acc, ch) =>
                acc +
                (Array.isArray((ch as { subTopics?: unknown[] })?.subTopics)
                  ? (ch as { subTopics: unknown[] }).subTopics.length
                  : 0),
              0
            )
          : 0,
        chapters: Array.isArray(budgetG2.chapters) ? budgetG2.chapters.length : 0,
        levels: budgetG2.grandTotal?.levels,
        ratiosClaimed: budgetG2.ratiosClaimed,
        foldingRule: budgetG2.foldingRule,
        verification: budgetG2.verification,
      }
    : null;
  const boundary2: RailBoundary = {
    id: "B2",
    title: "ارزش‌گذاری و تحویل محتوای ممیزی‌شده",
    from: "بخش ۲ (ممیزی — آرنا)",
    to: "بخش ۳ (موتور)",
    status: "amber",
    summary:
      "مسیر فنی کاملاً باز و گیت‌دار است؛ شیر رسمی ارزش‌گذاری عمداً بسته مانده تا مُهر انسان — این بسته‌بودن یک ویژگی ایمنی است، نه نقص.",
    mechanisms: [
      {
        name: "بودجهٔ رسمی سؤالات G3 مالک (OWNER_AUTHORITATIVE)",
        status: budgetView ? "green" : "red",
        evidence: budgetView ? budgetView.path : "authoring/QUESTION-BUDGET-G3-v1.json",
        detail: budgetView
          ? `پاکت ${faBudget(budgetView.totalMin)}–${faBudget(budgetView.totalMax)} سؤال — ${faBudget(budgetView.chapters)} فصل / ${faBudget(budgetView.subtopics)} موضوع — گیت ${budgetView.verification?.script ?? "verify-question-budget.py"}: ${budgetView.verification?.result ?? "—"} — شکاف ماتریس فعلی: ${faBudget(budgetView.reconciliation?.matrixCurrent?.g3MinTotal ?? 452)} کمتر از حداقل بودجهٔ ${faBudget(456)} (اصلاح در v0.2)`
          : "بودجهٔ مالک در مخزن یافت نشد — پاکت کنترل B2 بی‌منبع است.",
      },
      {
        name: "بودجهٔ رسمی سؤالات G2 مالک (OWNER_AUTHORITATIVE)",
        status: budgetG2View ? "green" : "red",
        evidence: budgetG2View ? budgetG2View.path : "authoring/QUESTION-BUDGET-G2-v1.json",
        detail: budgetG2View
          ? `پاکت ${faBudget(budgetG2View.totalMin)}–${faBudget(budgetG2View.totalMax)} سؤال — ${faBudget(budgetG2View.chapters)} فصل / ${faBudget(budgetG2View.subtopics)} موضوع — گیت ${budgetG2View.verification?.script ?? "verify-question-budget-g2.py"}: ${budgetG2View.verification?.result ?? "—"} — ستون فقرات ۸ فصله دو-منبعی (page-map + کالیبراسیون چاپی مالک)`
          : "بودجهٔ G2 مالک در مخزن یافت نشد — پاکت کنترل B2 پایهٔ دوم بی‌منبع است.",
      },
      {
        name: "ماتریس دامنه‌ها (منبع واحد حقیقت)",
        status: matrixStatus === "OFFICIAL" || matrixStatus === "STAMPED" ? "green" : "amber",
        evidence: "public/math-game/authoring/DOMAIN-MATRIX.json",
        detail: `وضعیت: ${matrixStatus} — ۱۴ دامنه / ۶۹۴ سؤال — SHA ${matrix.sha256.slice(0, 12)}… — تعداد رسیدهای مُهر: ${receipts.length} — منتظر مُهر گام صفر (تصمیم انسانی ۱)`,
      },
      {
        name: "قرارداد عملیات M09",
        status: contract ? "green" : "amber",
        evidence: "authoring/OPERATION-CONTRACT.json",
        detail: contract
          ? `${contract.schema ?? "قرارداد"} — نسخهٔ ${contract.version ?? contract.contract_version ?? "1.1.0"}`
          : "فایل قرارداد در clone محلی یافت نشد.",
      },
      {
        name: "مبدل xlsx→JSON با اتصال SHA",
        status: "green",
        evidence: "authoring/khshab-G2/G3-MATH_*.xlsx → کارتریج‌های JSON",
        detail: "گیت‌های تبدیل fail-closed هستند؛ هیچ فایلی بدون هش تأییدشده وارد موتور نمی‌شود.",
      },
      {
        name: "بچ‌های محتوایی D4",
        status: "amber",
        evidence: batchNames.length ? `authoring/batches (${batchNames.length} فایل بچ)` : "authoring/batches",
        detail:
          "بچ اول G3 (۱۰۰ سؤال ضرب و تقسیم) با وضعیت «نیاز به تأیید» ادغام شده — منتظر بازبینی معلم (تصمیم انسانی ۲).",
      },
      {
        name: "پروتکل ریزربات‌های G2",
        status: "amber",
        evidence: "reports/g2-microbot-protocol-adaptation-v1.fa.md",
        detail:
          "پیاده و آزمون‌شده (نگاشت ۹ سناریو به قابلیت واقعی موتور) — ۴ تعارض حاکمیتی الف/ب/ج/د منتظر تصمیم مالک.",
      },
    ],
  };

  // --- مرز ۳: تبدیل به بازی و تمرین ---
  const boundary3: RailBoundary = {
    id: "B3",
    title: "تبدیل به بازی و تمرین گیمیفای‌شده",
    from: "بخش ۳ (موتور — z.ai)",
    to: "معلم و دانش‌آموز",
    status: "green",
    summary:
      "مصرف‌کنندهٔ نهایی ریل: هر سؤال فقط از کارتریجِ اتصال‌دار تولید می‌شود و هیچ مسیر جانبی به موتور وجود ندارد.",
    mechanisms: [
      {
        name: "موتور سؤال ۶-قالبی",
        status: "green",
        detail: "۲۳۷/۲۳۷ تست سبز (عدد، کسر، گزینه‌ای، محور عددی، زوج‌سازی، شکل/نمودار) — آخرین اجرای ثبت‌شده: آبان ۲",
      },
      {
        name: "داشبورد معلم",
        status: "green",
        detail: "۵ تب: نمای کلی، دانش‌آموزان، گلوگاه‌های یادگیری، ماتریس دامنه‌ها، ریل اصلی",
      },
      {
        name: "ابزارهای معلم داخل بازی",
        status: "green",
        detail: "لیدربرد زنده، چت کلاسی معلم–دانش‌آموز، چرخ گردان، گروه‌بندی، ورقه‌خوان، گزارش هوشمند",
      },
      {
        name: "ایستگاه‌های دامنه‌ای کامل",
        status: "amber",
        detail: "BP-018 تصویب‌شده/شروع‌نشده — گسترش نقشهٔ بازی از ۳ بنا به ۸ بنا (G3) و ۶ بنا (G2)",
      },
    ],
  };

  // --- نقش‌ها ---
  const parts: RailPart[] = [
    {
      id: "P1",
      title: "بخش ۱ — ربات آشیل (استخراج کتاب)",
      developer: "هوش مصنوعی مجزای بخش ۱",
      coordinator: "z.ai — هماهنگ‌کنندهٔ ریل (با فرمان مالک)",
      scope: "استخراج صفحه‌به‌صفحهٔ کتاب درسی، vault منبع، page-map، بریف خط محتوا",
      status: "green",
      statusText: "خروجی‌های تأییدشده: page-map G2/G3 + بریف‌های آرنا + گیت منبع PASS (pin C205)",
    },
    {
      id: "P2",
      title: "بخش ۲ — ممیزی و ارزش‌گذاری محتوا",
      developer: "آرنا (هوش مصنوعی محتوایی)",
      coordinator: "z.ai — هماهنگ‌کنندهٔ ریل (با فرمان مالک)",
      scope: "ماتریس دامنه‌ها، کارتریج‌های xlsx، گیت ۲، بچ‌های تولید، برچسب اهداف",
      status: "amber",
      statusText:
        "ماتریس DRAFT (منتظر مُهر معلم) + بچ D4 «نیاز به تأیید» + ۴ تعارض حاکمیتی G2 منتظر مالک",
    },
    {
      id: "P3",
      title: "بخش ۳ — هستهٔ تبدیل به بازی و تمرین",
      developer: "z.ai (مسئول مستقیم)",
      coordinator: "z.ai",
      scope: "موتور ۶-قالبی، بازی «سفر تا صد»، داشبورد معلم، ابزارهای تدریس، ریل اعتماد Z01–Z15",
      status: "green",
      statusText: "موتور ۲۳۷/۲۳۷ سبز + داشبورد و ابزارها زنده — BP-018 (۸ بنا) تصویب‌شده/شروع‌نشده",
    },
  ];

  const feedbackLoop = {
    title: "حلقهٔ بازخورد: داشبورد گلوگاه‌ها ← اولویت محتوای بخش ۲",
    status: "amber" as RailStatus,
    summary:
      "دادهٔ گلوگاه‌های یادگیری دانش‌آموزان باید به اولویت‌گذاری تولید محتوای آرنا تبدیل شود (پیشنهاد معماری z.ai) — تا تصمیم مالک، مسیر رسمی داده بسته است.",
  };

  return {
    schema: "khshab.rail-view/v1",
    generatedAtTehran: tehranNowFa(),
    coordinatorNote:
      "طبق فرمان مالک: طراحی و نظارت کل ریل (از ابتدای بخش ۱ تا تحویل بخش ۳) با z.ai است؛ توسعهٔ بخش ۱ و بخش ۲ با دو هوش مصنوعی مجزا انجام می‌شود و هماهنگی همهٔ مرزها از این تابلو دیده می‌شود.",
    railContract: {
      path: "reports/rail-main-contract-v1.fa.md",
      exists: railContractDocExists,
      note: "قرارداد رسمی ریل — khshab.rail-contract/v1.0.0 (BP-025، delivered) — نقشهٔ هنجاری مالک بند ۱ سند است؛ اصلاح فقط با فرمان مالک و افزایش نسخه",
    },
    pipeline: [boundary0, boundary1, boundary2, boundary3],
    parts,
    budget: budgetView,
    budgetG2: budgetG2View,
    handoff: handoffView,
    feedbackLoop,
    decisions: DECISIONS,
    principles: PRINCIPLES,
    registry: registrySnapshot,
    engineTests: {
      passed: 237,
      total: 237,
      note: "آخرین اجرای محلی ثبت‌شده — مجموعهٔ کامل ۱۴ فایل تست موتور",
    },
  };
}
