// ماتریس دامنه‌ها — منبع یگانه حقیقت (SSOT)
// منبع نخست: clone رسمی مخزن (/home/z/math-game-repo) — اگر نبود، نسخهٔ بایت‌به‌بایت محلی
// گیرِ ایمنی: هش SHA-256 از بایت‌های واقعیِ سرو‌شده محاسبه می‌شود تا مُهر به محتوا بسته شود.

import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

export interface DomainMatrixDomain {
  title: string;
  chapter: string;
  min: number;
  qTypes: string[];
}

export interface DomainMatrixFamily {
  title: string;
  minTotal: number;
  domains: Record<string, DomainMatrixDomain>;
}

export interface DomainMatrix {
  schema: string;
  updatedAt: string;
  updatedBy: string;
  status: string;
  note: string;
  answerFormats: string[];
  families: Record<string, DomainMatrixFamily>;
}

export interface StepZeroReceipt {
  id: string;
  recordedAt: string;
  recordedAtTehran: string;
  teacherName: string;
  role: string;
  matrixSha256: string;
  matrixSource: string;
  confirmations: {
    chaptersMatchBook: boolean;
    minCountsAgreed: boolean;
    questionTypesAgreed: boolean;
  };
  note: string;
  officialStatus: string;
}

const REPO_MATRIX_PATH =
  "/home/z/math-game-repo/public/math-game/authoring/DOMAIN-MATRIX.json";
const LOCAL_MATRIX_PATH = path.join(
  process.cwd(),
  "data",
  "domain-matrix",
  "DOMAIN-MATRIX.json"
);
const RECEIPTS_PATH = path.join(
  process.cwd(),
  "data",
  "domain-matrix",
  "stamp-receipts.json"
);

/** نمای کلی ماتریس + هش بایت‌های واقعی سرو‌شده */
export interface MatrixView {
  matrix: DomainMatrix;
  sha256: string;
  source: string;
  provenance: {
    repoPath: string;
    repoCommit: string;
    localCopyPath: string;
  };
}

const REPO_COMMIT = "8decb334f08cd7cdaddc72f7941c760aa983a1d4";

export async function getMatrixView(): Promise<MatrixView> {
  let bytes: Buffer;
  let source: string;

  try {
    bytes = await readFile(REPO_MATRIX_PATH);
    source = "repo";
  } catch {
    bytes = await readFile(LOCAL_MATRIX_PATH);
    source = "local-copy";
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const matrix = JSON.parse(bytes.toString("utf8")) as DomainMatrix;

  return {
    matrix,
    sha256,
    source,
    provenance: {
      repoPath: "public/math-game/authoring/DOMAIN-MATRIX.json",
      repoCommit: REPO_COMMIT,
      localCopyPath: "data/domain-matrix/DOMAIN-MATRIX.json",
    },
  };
}

export async function getReceipts(): Promise<StepZeroReceipt[]> {
  try {
    const raw = await readFile(RECEIPTS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}

export async function appendReceipt(
  receipt: StepZeroReceipt
): Promise<StepZeroReceipt[]> {
  const receipts = await getReceipts();
  receipts.push(receipt);
  const payload = JSON.stringify(
    { schema: "khshab.step-zero-receipts/v1", receipts },
    null,
    2
  );
  const { writeFile, mkdir } = await import("fs/promises");
  await mkdir(path.dirname(RECEIPTS_PATH), { recursive: true });
  await writeFile(RECEIPTS_PATH, payload, "utf8");
  return receipts;
}

/** تاریخ/ساعت تهران با تقویم شمسی — فقط سمت سرور تولید می‌شود */
export function tehranNowFa(): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      dateStyle: "full",
      timeStyle: "medium",
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}
