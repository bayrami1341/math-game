// انواع مشترک داشبورد معلم — قرارداد API و فرانت‌اند

import type { Remedy } from './remediation';

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
  results: { a: number; b: number; correct: boolean; timeSec?: number }[];
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
