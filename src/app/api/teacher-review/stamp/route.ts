// POST /api/teacher-review/stamp — ثبت مُهر رأی تربیتی معلم (BP-004 T2)
// مُهر در authoring/teacher-stamps.json (فایل ثبت رسمی) append می‌شود؛
// کارگاه‌بان در چرخهٔ اسکن بعدی آن را به تابلوی مرکزی دیسپچ می‌کند (T3).
// قفل یکپارچگی: SHA سر رسمیِ لحظهٔ مُهر در رکورد ذخیره می‌شود (سبک GovernanceLedger).

import { NextResponse } from "next/server";
import { readFile, writeFile, rename } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const STAMPS_PATH = path.join(ROOT, "authoring/teacher-stamps.json");
const OFFICIAL_HEADS_PATH = path.join(ROOT, "public/math-game/authoring/OFFICIAL-HEADS.json");

type StampBody = {
  family?: string;
  candidateBranch?: string;
  candidateSha?: string;
  verdict?: "approve" | "reject" | "needs_changes";
  note?: string;
  by?: string;
};

type OfficialHeads = {
  heads: Record<string, { file: string; sha256: string; version?: string }>;
};

type StampsFile = {
  schema: string;
  updatedAt: string;
  stamps: Array<Record<string, unknown>>;
};

const VALID_VERDICTS = new Set(["approve", "reject", "needs_changes"]);

export async function POST(req: Request) {
  let body: StampBody;
  try {
    body = (await req.json()) as StampBody;
  } catch {
    return NextResponse.json({ ok: false, error: "بدن درخواست JSON نیست" }, { status: 400 });
  }

  const { family, candidateBranch, candidateSha, verdict, note = "", by = "معلم" } = body;

  if (!family || !VALID_VERDICTS.has(verdict ?? "")) {
    return NextResponse.json(
      { ok: false, error: "family و verdict معتبر (approve|reject|needs_changes) الزامی است" },
      { status: 400 }
    );
  }

  // قفل رسمی: SHA سر رسمی همین خانواده در لحظهٔ مُهر
  let officialSha = "";
  let officialFile = "";
  try {
    const heads = JSON.parse(await readFile(OFFICIAL_HEADS_PATH, "utf8")) as OfficialHeads;
    const info = heads.heads?.[family];
    if (!info) {
      return NextResponse.json({ ok: false, error: `خانوادهٔ ${family} در مانیفست نیست` }, { status: 400 });
    }
    officialSha = info.sha256;
    officialFile = info.file;
  } catch {
    return NextResponse.json({ ok: false, error: "مانیفست OFFICIAL-HEADS خوانده نشد" }, { status: 500 });
  }

  let stampsFile: StampsFile = { schema: "khshab.teacher-stamps/v1", updatedAt: "", stamps: [] };
  try {
    stampsFile = JSON.parse(await readFile(STAMPS_PATH, "utf8")) as StampsFile;
  } catch {
    // فایل تازه ساخته می‌شود
  }
  if (!Array.isArray(stampsFile.stamps)) stampsFile.stamps = [];

  const record = {
    id: `TS-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    ts: new Date().toISOString(),
    family,
    officialFile,
    officialSha,
    candidateBranch: candidateBranch ?? null,
    candidateSha: candidateSha ?? null,
    verdict,
    note: String(note).slice(0, 2000),
    by,
  };

  stampsFile.schema = stampsFile.schema || "khshab.teacher-stamps/v1";
  stampsFile.updatedAt = record.ts;
  stampsFile.stamps.push(record);

  // نوشتن اتمی: tmp → rename (مقابله با نیم‌نوشته)
  const tmp = `${STAMPS_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(stampsFile, null, 2) + "\n", "utf8");
  await rename(tmp, STAMPS_PATH);

  return NextResponse.json({ ok: true, stamp: record });
}
