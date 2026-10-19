// هلپرهای fetch داشبورد — همهٔ درخواست‌ها نسبی و بدون کش مرورگر

import type {
  AssignmentsResponse,
  BottlenecksResponse,
  OverviewResponse,
  PostAssignmentBody,
  PostOverrideBody,
  ScanPaperAnalyzeResponse,
  StudentDetailResponse,
  StudentsResponse,
} from "@/lib/dashboard/types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    throw new Error(`خطای سرور (${res.status})`);
  }
  return (await res.json()) as T;
}

export const fetchOverview = () => fetchJson<OverviewResponse>("/api/overview");

export const fetchStudents = () => fetchJson<StudentsResponse>("/api/students");

export const fetchBottlenecks = () => fetchJson<BottlenecksResponse>("/api/bottlenecks");

export const fetchStudentDetail = (id: string) =>
  fetchJson<StudentDetailResponse>(`/api/students/${encodeURIComponent(id)}`);

/** فهرست مأموریت‌های درمانی ارسال‌شده به یک دانش‌آموز (نزولی، حداکثر ۲۰) */
export const fetchStudentAssignments = (studentId: string) =>
  fetchJson<AssignmentsResponse>(`/api/assignments?studentId=${encodeURIComponent(studentId)}`);

/** ارسال مأموریت درمانی به دانش‌آموز (۲۰۰ = تکراری در انتظار، ۲۰۱ = ساخته شد) */
export async function postAssignment(body: PostAssignmentBody) {
  const res = await fetch("/api/assignments", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`خطای سرور (${res.status})`);
  }
  return (await res.json()) as { ok: boolean; duplicate?: boolean; assignment: AssignmentsResponse["assignments"][number] };
}

/** ثبت بازنویسی تشخیص معلم (CEAP §9.2 — فقط‌الحاقی) — ۲۰۱ = رکورد با برچسب TEACHER_OVERRIDE ساخته شد */
export async function postOverride(body: PostOverrideBody) {
  const res = await fetch("/api/overrides", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`خطای سرور (${res.status})`);
  }
  return (await res.json()) as { ok: boolean; id: string };
}

/** اسکن برگهٔ کاغذی با VLM — commit=false فقط تحلیل، commit=true ثبت در پروندهٔ دانش‌آموز */
export async function analyzePaper(
  dataUrl: string,
  commit: boolean,
  studentId?: string
): Promise<ScanPaperAnalyzeResponse> {
  const res = await fetch("/api/scan-paper", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl, commit, studentId }),
  });
  if (!res.ok) {
    throw new Error(`خطای سرور (${res.status})`);
  }
  return (await res.json()) as ScanPaperAnalyzeResponse;
}

export async function postAiReport(): Promise<string> {
  const res = await fetch("/api/ai-report", { method: "POST", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`خطای سرور (${res.status})`);
  }
  const data = (await res.json()) as { report: string };
  return data.report;
}
