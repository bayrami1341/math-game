// هلپرهای fetch داشبورد — همهٔ درخواست‌ها نسبی و بدون کش مرورگر

import type {
  BottlenecksResponse,
  OverviewResponse,
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

export async function postAiReport(): Promise<string> {
  const res = await fetch("/api/ai-report", { method: "POST", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`خطای سرور (${res.status})`);
  }
  const data = (await res.json()) as { report: string };
  return data.report;
}
