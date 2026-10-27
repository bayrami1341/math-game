// GET /api/teacher-review — دادهٔ صفحهٔ بازرسی محتوا (BP-004 گام ۳ دستورکار ۶۰–۶۶)
// سرهای رسمی + نامزدهای شاخه‌های آرنا (از state کارگاه‌بان) + مُهرهای ثبت‌شدهٔ معلم

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const OFFICIAL_HEADS_PATH = path.join(ROOT, "public/math-game/authoring/OFFICIAL-HEADS.json");
const FOREMAN_STATE_PATH = path.join(ROOT, "mini-services/foreman/state.json");
const STAMPS_PATH = path.join(ROOT, "authoring/teacher-stamps.json");

async function readJsonSafe<T>(p: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

type HeadInfo = { file: string; sha256: string; version?: string; status?: string };
type OfficialHeads = { formatVersion?: number; heads: Record<string, HeadInfo> };
type ForemanBranch = {
  lastSha?: string; verdictKind?: string; prNumber?: number;
  prUrl?: string; note?: string; lastProcessedAt?: string;
};
type StampRecord = {
  id: string; ts: string; family: string; officialSha: string;
  candidateBranch: string; candidateSha: string;
  verdict: "approve" | "reject" | "needs_changes"; note: string; by: string;
};

export async function GET() {
  const official = await readJsonSafe<OfficialHeads | null>(OFFICIAL_HEADS_PATH, null);
  const foreman = await readJsonSafe<{ branches?: Record<string, ForemanBranch> }>(FOREMAN_STATE_PATH, {});
  const stamps = await readJsonSafe<{ schema?: string; stamps?: StampRecord[] }>(STAMPS_PATH, {});

  const heads = Object.entries(official?.heads ?? {}).map(([family, info]) => ({
    family,
    file: info.file,
    sha256: info.sha256,
    version: info.version ?? null,
    status: info.status ?? null,
  }));

  const candidates = Object.entries(foreman.branches ?? {}).map(([branch, b]) => ({
    branch,
    sha: b.lastSha ?? null,
    verdict: b.verdictKind ?? null,
    prNumber: b.prNumber ?? null,
    prUrl: b.prUrl ?? null,
    note: b.note ?? null,
    processedAt: b.lastProcessedAt ?? null,
  }));

  return NextResponse.json({
    schema: "khshab.teacher-review/v1",
    generatedAt: new Date().toISOString(),
    officialHeads: heads,
    manifestOk: Boolean(official),
    candidates,
    stamps: stamps.stamps ?? [],
  });
}
