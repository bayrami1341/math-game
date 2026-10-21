// انواع مشترک داشبورد معلم — قرارداد API و فرانت‌اند

import type { Remedy } from './remediation';
import type { CpaStage } from './error-model';

export type Severity = 'critical' | 'high' | 'medium';
export type StudentStatus = 'excellent' | 'good' | 'practice' | 'critical';

/** آمار یک فاکتور ضرب (مثلاً ۷×۸) */
export interface FactStat {
  a: number;
  b: number;
  fact: string; // «۷×۸»
  attempts: number;
  wrong: number;
  errorRate: number; // 0..1
}

/** یک گلوگاه یادگیری در سطح کلاس */
export interface BottleneckItem extends FactStat {
  severity: Severity;
  students: number; // تعداد دانش‌آموزان درگیر
  tables: number[]; // جدول‌های مرتبط (۷ و ۸ برای ۷×۸)
  recommendation: string; // پیشنهاد آموزشی
  remedy: Remedy | null; // ماموریت درمانی بازی برای این گلوگاه (حلقهٔ گزارش←اقدام)
  affected: { id: string; name: string; attempts: number; errorRate: number }[];
}

/** سلامت هر جدول ضرب (۲ تا ۱۲) */
export interface TableHealth {
  table: number;
  attempts: number;
  errorRate: number;
  worstFact: string | null;
  affectedStudents: number;
}

/** یک نقطه روند روزانه */
export interface TrendPoint {
  date: string; // yyyy-mm-dd
  label: string; // «شنبه ۱۲»
  accuracy: number | null; // 0..1 (null = داده‌ای نبوده)
  questions: number;
  sessions: number;
}

/** خلاصه یک جلسه برای فید فعالیت */
export interface SessionSummary {
  id: string;
  studentId: string;
  studentName: string;
  layer: number;
  layerName: string;
  mode: string;
  total: number;
  correct: number;
  accuracy: number;
  durationSec: number;
  createdAt: string;
}

export interface Kpis {
  students: number;
  sessionsToday: number;
  accuracy7d: number | null;
  activeBottlenecks: number;
  attentionStudents: number;
  totalQuestions: number;
  totalSessions: number;
}

export interface OverviewResponse {
  kpis: Kpis;
  trend: TrendPoint[];
  recentSessions: SessionSummary[];
  heroDistribution: { hero: string; count: number }[];
  tableHealth: TableHealth[];
  generatedAt: string;
}

export interface StudentSummary {
  id: string;
  name: string;
  grade: number;
  hero: string;
  currentLayer: number;
  currentLayerName: string;
  masteredLayers: number;
  progressPct: number; // 0..100
  accuracy7d: number | null;
  overallAccuracy: number | null;
  totalSessions: number;
  totalQuestions: number;
  lastActivity: string | null;
  status: StudentStatus;
  weakestFact: FactStat | null;
}

export interface LeaderRow {
  rank: number;
  id: string;
  name: string;
  hero: string;
  progressPct: number;
  overallAccuracy: number | null;
  totalSessions: number;
  totalQuestions: number;
  lastActivity: string | null;
}

export interface LeaderboardResponse {
  leaders: LeaderRow[];
  totalStudents: number;
}

export interface StudentsResponse {
  students: StudentSummary[];
}

export interface LayerProgress {
  layer: number;
  name: string;
  short: string;
  sessions: number;
  attempts: number;
  accuracy: number | null; // دقت آخرین جلسهٔ این لایه
  mastered: boolean;
  isCurrent: boolean;
}

export interface StudentDetailResponse {
  student: StudentSummary;
  layers: LayerProgress[];
  trend: TrendPoint[];
  bottlenecks: FactStat[];
  recommendations: string[];
  recommendedRemedy: Remedy | null; // ماموریت درمانی بر اساس ضعیف‌ترین فاکتور
  recentSessions: SessionSummary[];
  diagnoses: DiagnosisItem[]; // لایهٔ بالینی: مدل ۱۲خطا (CEAP §7.3 و §9.1)
  overrides: OverrideItem[]; // تاریخچهٔ بازنویسی معلم (فقط‌الحاقی)
  chain: ChainReportResponse; // وضعیت زنجیرهٔ رسید و بازپخش قطعی
}

// ─── لایهٔ بالینی: تشخیص ۱۲خطا (CEAP §7.3 / §9.1) ───

export interface DiagnosisItem {
  code: string; // E_SKIP_OVERCOUNT ...
  titleFa: string;
  cpaStage: CpaStage; // Concrete | Pictorial | Abstract
  cpaLabelFa: string; // مجسم / تصویری / انتزاعی
  confidence: number; // 0..1 — فاصلهٔ اطمینان الگوریتم
  attempts: number;
  errorRate: number; // 0..1
  medianTimeSec: number;
  sampleFacts: string[]; // شواهد عینی (مثل «۷×۸»)
  patternFa: string; // توضیح مفهومی الگو بدون اصطلاح پیچیده
  actionFa: string; // اقدام پیشنهادی قابل اجرا در کلاس
}

export interface OverrideItem {
  id: string;
  originalCode: string;
  overrideCode: string;
  note: string | null;
  createdAt: string;
}

export interface PostOverrideBody {
  studentId: string;
  originalCode: string;
  overrideCode: string;
  note?: string;
}

// ─── فروشگاه رویداد فقط‌الحاقی (CEAP §4) ───

export interface ChainReportResponse {
  valid: boolean; // زنجیرهٔ رسید سالم است
  integrityOk: boolean; // ناسازگاری submitted ↔ correct وجود ندارد
  sessions: number;
  verified: number;
  legacyCount: number; // جلسات پیش از ساخت زنجیره
  brokenAt: string | null;
  clockOrdered: boolean;
  replayMatch: boolean; // بازپخش قطعی با مقادیر ذخیره‌شده منطبق است
  mismatchedSessions: string[];
}

export interface BottlenecksResponse {
  bottlenecks: BottleneckItem[];
  tables: TableHealth[];
  generatedAt: string;
}

/** بدنه POST /api/sessions — اتصال بازی به داشبورد */
export interface PostSessionBody {
  eventId?: string; // شناسهٔ idempotency — ارسال دوبارهٔ همان رویداد، جلسهٔ تکراری نمی‌سازد
  studentId?: string;
  studentName?: string;
  grade?: number;
  hero?: string;
  buildingId?: string;
  layer: number;
  mode?: 'station' | 'online' | 'side';
  durationSec?: number;
  results: { a: number; b: number; correct: boolean; timeSec?: number; submitted?: number | null }[];
  hintsMax?: number; // بیشترین پلهٔ راهنمای استفاده‌شده در جلسه (تشخیص تکدی سرنخ)
}

export interface PostSessionResponse {
  ok: boolean;
  sessionId: string;
  studentId: string;
  studentName: string;
  total: number;
  correct: number;
  accuracy: number;
  layerName: string;
  duplicate?: boolean; // true یعنی رویداد قبلاً ثبت شده و رکورد جدیدی ساخته نشد
}

// ─── مأموریت‌های درمانی معلم (P3: حلقهٔ کامل) ───

export type AssignmentStatus = 'pending' | 'seen' | 'completed';

/** یک مأموریت درمانی ارسال‌شده به دانش‌آموز */
export interface AssignmentItem {
  id: string;
  studentId: string;
  studentName?: string;
  missionId: string;
  missionTitle: string;
  fact: string | null;
  note: string | null;
  status: AssignmentStatus;
  sessionId?: string | null; // جلسه‌ای که مأموریت را کامل کرد (در تکمیل خودکار)
  createdAt: string;
  completedAt: string | null;
}

export interface PostAssignmentBody {
  studentId: string;
  missionId: string;
  fact?: string;
  note?: string;
}

export interface AssignmentsResponse {
  assignments: AssignmentItem[];
}

// ─── اسکن برگهٔ کاغذی با VLM ───

/** یک مسئلهٔ ضرب شناسایی‌شده روی برگه */
export interface ScanPaperItem {
  a: number;
  b: number;
  studentAnswer: number | null;
  correct: boolean;
}

export interface ScanPaperAnalyzeResponse {
  ok: boolean;
  items: ScanPaperItem[];
  unreadable: number; // تعداد موارد ناخوانا
  notes: string; // مشاهدهٔ آزاد VLM
  factStats: FactStat[]; // فاکتورهای اشتباه برگه
  total: number;
  correct: number;
  sessionId?: string; // فقط در commit
  stored?: number; // فقط در commit
}

export interface ScanPaperCommitResponse {
  ok: boolean;
  sessionId?: string;
  stored: number; // تعداد نتیجه‌های ثبت‌شده
}

// ─── خشاب محتوا (تب «بانک تمرین خشاب») ───

/** حکم زندهٔ موتور تشخیص برای یک گزینهٔ انحرافی — موتور واقعی بازی (تک‌منبع حقیقت) */
export interface CartridgeVerdict {
  letter: string; // الف/ب/ج/د
  value: number | null; // مقدار عددی تفسیرشدهٔ گزینه (null = قابل‌تبدیل به عدد نیست)
  engineCode: string | null; // کد خطای موتور (مثل E_OP_REVERSE) یا null = بی‌الگو
  claim: string | null; // متن کاندید نقشهٔ گزینه→خطای خشاب (optionErrorMap)
}

/** یک سؤال بانک خشاب همراه با برچسب‌سنجی زنده */
export interface CartridgeQuestion {
  id: string;
  anchorId: string;
  anchorTitle: string | null; // عنوان درس از نقشهٔ کتاب
  cpa: string | null; // لایهٔ CPA (مجسم/تصویری/علامتی)
  domain: string | null; // CORE / DEPTH / SIDE
  status: string; // تأییدشده / نیاز به تأیید
  prompt: string;
  options: string[];
  answerIndex: number;
  optionErrorMap: string | null;
  verdicts: CartridgeVerdict[]; // فقط گزینه‌های انحرافی
}

/** یک فیلد شناسنامهٔ خشاب */
export interface CartridgeIdentityField {
  field: string;
  value: string;
  status: string;
  source: string;
}

/** پاسخ GET /api/cartridge */
export interface CartridgeResponse {
  cartridge: {
    cartridgeId: string | null;
    generatedAt: string | null;
    source: { file?: string; tool?: string } | null;
    validation: {
      ok: boolean;
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
      };
      gate: { red: number; yellow: number; verdict: string };
    } | null;
    identity: CartridgeIdentityField[];
  };
  bank: CartridgeQuestion[];
}
