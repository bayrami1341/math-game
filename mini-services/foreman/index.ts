/**
 * کارگاه‌بان (khshab-foreman) v2.0.0 — ربات مرکزی مدیریت پروژه
 * پورت ثابت: 3030 | بدون وابستگی خارجی (Bun + fetch + git)
 *
 * §۱ خط محتوا (v1): پایش شاخه‌های arena/** → گیت ماشینی محلی → PR به v10.3-beta
 *        → کامنت رأی فارسی برای آرنا → BRIEF.md → وضعیت زنده در /status
 * §۲ سیستم مرکزی (v2 — پروتکل GOVERNANCE.md):
 *        - تابلوی مرکزی مدیریت (Issue گیت‌هاب) = آینهٔ زندهٔ blueprints/registry.json
 *        - کانال «تأیید واحد» مالک: کامنت «تایید BP-xxx» / «تایید همه» روی تابلو
 *          → ثبت رسمی در رجیستری (کامیت روی main با Contents API) → دیسپچ خودکار
 *        - دستور کار آرنا: کامنت تابلو + PR مرتبط | دستور کار Z.ai: تابلو + بریفینگ
 *        - فرمان «فریز» = توقف دیسپچ/تأیید (مادهٔ ۸)
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import path from "path";

// ── ثابت‌ها ────────────────────────────────────────────────────────────────
const VERSION = "2.0.0";
const PORT = 3030;
const REPO = "/home/z/my-project";
const OWNER = "bayrami1341";
const REPO_NAME = "math-game";
const OWNER_LOGIN = OWNER; // تأیید واحد فقط از این حساب (مادهٔ ۵)
const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO_NAME}`;
const BASE_BRANCH = "v10.3-beta";
const WORKROOT = "/tmp/foreman-work";
const DIR = import.meta.dir;
const STATE_FILE = path.join(DIR, "state.json");
const LOG_FILE = path.join(DIR, "foreman.log");
const BRIEF_FILE = path.join(DIR, "BRIEF.md");
const OFFICIAL_HEADS_MAIN = path.join(REPO, "public/math-game/authoring/OFFICIAL-HEADS.json");
const REGISTRY_PATH = "blueprints/registry.json";
const BOARD_TITLE = "🤖 تابلوی مرکزی مدیریت پروژه (پروتکل مرکزی)";
const BOARD_LABEL = "central-board";
const SCAN_INTERVAL_MS = Number(process.env.FOREMAN_INTERVAL_MS || 10 * 60_000);
const GATE_WF = "khshab-gate";

type BranchState = {
  lastSha: string;
  lastProcessedAt?: string;
  seeded?: boolean;
  prNumber?: number | null;
  prUrl?: string | null;
  verdictSha?: string | null;
  verdictKind?: string | null;
  note?: string;
};

type BlueprintTask = { id: string; desc: string; automated: boolean };
type Blueprint = {
  id: string; title: string; lane: "dev" | "content"; assignee: "z.ai" | "arena";
  status: string; priority: number; created_by: string; created_at: string;
  approved_by: string | null; approved_at: string | null;
  dispatched_at: string | null; delivered_at: string | null; verified_at: string | null;
  context: string; tasks: BlueprintTask[]; acceptance: string[]; artifacts: string[];
  links: { pr: string | null; issue: string | null; notes: string | null };
  notes: string;
};
type Registry = { schema: string; version: number; updated_at: string; updated_by: string; blueprints: Blueprint[] };

type BlueprintState = {
  lastRegistryVersion: number | null;
  boardIssue: number | null;
  boardUrl: string | null;
  lastCommentId: number;
  dispatched: Record<string, string>; // bpId → approved_at که دیسپچ شده
  warnedNonOwner: number[];
  events: string[];
};
type State = {
  branches: Record<string, BranchState>;
  lastScanAt?: string;
  lastScanOk?: boolean;
  lastError?: string | null;
  frozen?: boolean;
  blueprints?: BlueprintState;
};

// ── ابزارهای پایه ──────────────────────────────────────────────────────────
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try { appendFileSync(LOG_FILE, line + "\n"); } catch {}
  console.log(line);
}

function git(args: string[], cwd = REPO, timeout = 120_000) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", timeout });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

function ghToken(): string {
  const r = git(["remote", "get-url", "origin"]);
  const m = r.out.match(/x-access-token:([^@]+)@/);
  if (!m) throw new Error("توکن گیت‌هاب از remote قابل استخراج نبود");
  return m[1];
}

async function gh<T = any>(path_: string, init: RequestInit = {}, token?: string): Promise<{ status: number; json: T; body: string }> {
  const res = await fetch(`${API_ROOT}${path_}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "khshab-foreman",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  let json: any = null;
  try { json = JSON.parse(body); } catch {}
  return { status: res.status, json: json as T, body };
}

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function verParts(v: string): number[] {
  return v.replace(/^v/, "").split(".").map((x) => parseInt(x || "0", 10) || 0);
}
function cmpVer(a: string, b: string): number {
  const A = verParts(a), B = verParts(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}
function sha7(s: string) { return s.slice(0, 7); }
function slug(b: string) { return b.replace(/[^a-zA-Z0-9._-]+/g, "__"); }
function nowIso() { return new Date().toISOString(); }

function loadState(): State {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
    if (!s.blueprints || typeof s.blueprints !== "object") s.blueprints = {} as BlueprintState;
    s.blueprints.lastRegistryVersion ??= null;
    s.blueprints.boardIssue ??= null;
    s.blueprints.boardUrl ??= null;
    s.blueprints.lastCommentId ??= 0;
    s.blueprints.dispatched ??= {};
    s.blueprints.warnedNonOwner ??= [];
    s.blueprints.events ??= [];
    return s;
  } catch {
    return {
      branches: {},
      blueprints: { lastRegistryVersion: null, boardIssue: null, boardUrl: null, lastCommentId: 0, dispatched: {}, warnedNonOwner: [], events: [] },
    };
  }
}
function saveState(s: State) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}
function pushEvent(s: State, text: string) {
  s.blueprints!.events.unshift(`${text} — ${nowIso().slice(0, 16).replace("T", " ")}`);
  s.blueprints!.events = s.blueprints!.events.slice(0, 10);
}

const STATUS_FA: Record<string, string> = {
  draft: "✏️ نگارش",
  awaiting_approval: "⏳ در انتظار تأیید مالک",
  approved: "✅ تأییدشده",
  executing: "🔨 در حال اجرا",
  delivered: "📦 تحویل‌شده",
  verified: "🔍 وارسی‌شده",
  done: "🏁 بسته",
  blocked: "⛔ متوقف",
  rejected: "❌ رد",
};

// ════════════════════════════════════════════════════════════════════════
// §۱ — خط محتوا: گیت ماشینی محلی روی تحویل آرنا (v1 — دست‌نخورده)
// ════════════════════════════════════════════════════════════════════════
type FamilyReport = {
  family: string;
  herVersion: string | null;
  herFile: string | null;
  officialVersion: string;
  verdict: "IN_SYNC" | "STALE_BASE" | "NEWER_THAN_OFFICIAL" | "SHA_MISMATCH" | "INFO";
  shaMatch?: boolean;
};

function scanFamilies(wt: string, official: any): { families: FamilyReport[]; cartridgeFiles: string[]; pageMaps: string[] } {
  const families: FamilyReport[] = [];
  const cartridgeFiles: string[] = [];
  const pageMaps: string[] = [];
  const dirs = [path.join(wt, "authoring"), path.join(wt, "public/math-game/authoring")];
  const byFamily = new Map<string, { version: string; file: string }>();

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      for (const rel of new Bun.Glob("khshab-G*-MATH_v*.xlsx").scanSync({ cwd: dir })) {
        const file = path.join(dir, rel);
        cartridgeFiles.push(path.relative(wt, file));
        const m = path.basename(rel).match(/^khshab-G(\d+)-MATH_v([\d.]+)\.xlsx$/);
        if (!m) continue;
        const fam = `KH-G${m[1]}-MATH`;
        const version = `v${m[2]}`;
        const cur = byFamily.get(fam);
        if (!cur || cmpVer(version, cur.version) > 0) byFamily.set(fam, { version, file });
      }
      for (const rel of new Bun.Glob("PAGE-MAP-*.xlsx").scanSync({ cwd: dir })) {
        pageMaps.push(path.relative(wt, path.join(dir, rel)));
      }
    } catch {}
  }

  for (const [fam, found] of byFamily) {
    const off = official?.heads?.[fam];
    if (!off) {
      families.push({ family: fam, herVersion: found.version, herFile: path.relative(wt, found.file), officialVersion: "—", verdict: "INFO" });
      continue;
    }
    const c = cmpVer(found.version, off.version);
    if (c < 0) {
      families.push({ family: fam, herVersion: found.version, herFile: path.relative(wt, found.file), officialVersion: off.version, verdict: "STALE_BASE" });
    } else if (c > 0) {
      families.push({ family: fam, herVersion: found.version, herFile: path.relative(wt, found.file), officialVersion: off.version, verdict: "NEWER_THAN_OFFICIAL" });
    } else {
      let shaMatch = false;
      try { shaMatch = sha256File(found.file) === off.sha256; } catch {}
      families.push({ family: fam, herVersion: found.version, herFile: path.relative(wt, found.file), officialVersion: off.version, verdict: shaMatch ? "IN_SYNC" : "SHA_MISMATCH", shaMatch });
    }
  }
  families.sort((a, b) => a.family.localeCompare(b.family));
  return { families, cartridgeFiles, pageMaps };
}

function runLocalGates(wt: string): { headsVerify: string | null; smoke: string | null; notes: string[] } {
  const notes: string[] = [];
  let headsVerify: string | null = null;
  if (existsSync(path.join(wt, "authoring/agent/cli.py"))) {
    if (existsSync(path.join(wt, "public/math-game/authoring/OFFICIAL-HEADS.json"))) {
      const r = spawnSync("python3", ["-m", "authoring.agent.cli", "heads", "--verify", "--repo-root", "."], { cwd: wt, encoding: "utf8", timeout: 90_000 });
      headsVerify = r.status === 0 ? "PASS" : `FAIL — ${(r.stdout || r.stderr || "").slice(-300)}`;
    } else {
      headsVerify = "SKIP — مانیفست OFFICIAL-HEADS در این شاخه نیست (قدیمی‌تر از Task 66)";
    }
  } else {
    headsVerify = "SKIP — ایجنت authoring/agent در این شاخه نیست";
  }

  let smoke: string | null = null;
  const hasConverter = existsSync(path.join(wt, "tools/cartridge-converter/convert.mjs"));
  const hasAgent = existsSync(path.join(wt, "authoring/agent/cli.py"));
  if (!hasConverter || !hasAgent) {
    notes.push(!hasConverter ? "مبدل رسمی (tools/cartridge-converter) در شاخهٔ آرنا نیست — smoke مبدل رد شد" : "");
    smoke = "SKIP";
  }
  return { headsVerify, smoke, notes: notes.filter(Boolean) };
}

function runSmokeCheckWave(wt: string, famFileRel: string): string {
  try {
    const nm = path.join(REPO, "tools/cartridge-converter/node_modules");
    const target = path.join(wt, "tools/cartridge-converter/node_modules");
    if (existsSync(path.join(wt, "tools/cartridge-converter")) && !existsSync(target)) {
      spawnSync("ln", ["-sfn", nm, target]);
    }
    const f = path.join(wt, famFileRel);
    const args = ["-m", "authoring.agent.cli", "check-wave",
      "--candidate", famFileRel, "--base", famFileRel, "--official", famFileRel];
    const r = spawnSync("python3", args, { cwd: wt, encoding: "utf8", timeout: 300_000 });
    const out = r.stdout || "";
    const m = out.match(/"overall_gate_status":\s*"([^"]+)"/);
    return r.status === 0 ? `PASS (${m?.[1] ?? "PASS"})` : `FAIL — overall=${m?.[1] ?? "?"} | کد ${r.status} | ${(out || r.stderr).slice(-240)}`;
  } catch (e: any) {
    return `ERROR — ${e?.message ?? e}`;
  }
}

async function findOpenPR(branch: string, token: string): Promise<{ number: number; html_url: string } | null> {
  const { json } = await gh<any>("/pulls?state=open&per_page=50", {}, token);
  if (!Array.isArray(json)) return null;
  const hit = json.find((p: any) => p.head?.ref === branch && p.base?.ref === BASE_BRANCH);
  return hit ? { number: hit.number, html_url: hit.html_url } : null;
}

async function ensurePR(branch: string, token: string, meta: { sha: string; families: FamilyReport[]; pageMaps: string[] }) {
  const existing = await findOpenPR(branch, token);
  if (existing) return { pr: existing, created: false as const, note: "" };
  const famLines = meta.families.map((f) => `- ${f.family}: نسخهٔ آرنا ${f.herVersion ?? "—"} / سر رسمی ${f.officialVersion} → ${verdictFa(f.verdict)}`).join("\n") || "- فایل خشاب khshab در این تحویل دیده نشد";
  const body = [
    `## 🤖 کارگاه‌بان — تحویل خودکار از شاخهٔ \`${branch}\``,
    ``,
    `**هد تحویل:** \`${sha7(meta.sha)}\` | **پایه:** \`${BASE_BRANCH}\``,
    ``,
    `### گیت ماشینی (خلاصه)`,
    famLines,
    meta.pageMaps.length ? `\n**نقشه‌های صفحهٔ همراه:** ${meta.pageMaps.length} فایل` : "",
    ``,
    `CI رسمی (\`${GATE_WF}\`) روی این PR اجرا می‌شود؛ نتیجهٔ کامل و رأی ماشینی در کامنت بعدی کارگاه‌بان اعلام خواهد شد.`,
    ``,
    `> این PR به‌صورت خودکار توسط کارگاه‌بان ساخته شده است. مراحل انسانی بعد از گیت ماشینی: بازرسی دوم (Z.ai) ← رأی معلم ← ادغام رسمی.`,
  ].join("\n");
  const res = await gh<any>("/pulls", { method: "POST", body: JSON.stringify({ title: `کارگاه‌بان: تحویل آرنا ${branch} (${sha7(meta.sha)})`, head: branch, base: BASE_BRANCH, body }) }, token);
  if (res.status === 201 && res.json?.number) return { pr: { number: res.json.number, html_url: res.json.html_url }, created: true as const, note: "" };
  const msg = res.json?.message || res.body.slice(0, 200);
  const noDiff = /No commits|nothing to compare/i.test(msg + res.body);
  return { pr: null, created: false as const, note: noDiff ? "بدون تفاوت با v10.3-beta (احتمالاً هم‌گام کامل)" : `ساخت PR ناموفق: ${msg}` };
}

async function ciSnapshot(branch: string, token: string): Promise<string> {
  try {
    const { json } = await gh<any>(`/actions/runs?branch=${encodeURIComponent(branch)}&per_page=15`, {}, token);
    const runs = (json?.workflow_runs || []).filter((r: any) => r.name === GATE_WF);
    if (!runs.length) return "شروع نشده (فایل CI روی این شاخه نیست یا هنوز فعال نشده)";
    const r = runs[0];
    if (r.status !== "completed") return `در حال اجرا… (run ${r.id})`;
    return r.conclusion === "success" ? `success ✓ (run ${r.id})` : `${r.conclusion} ✗ (run ${r.id})`;
  } catch { return "نامشخص"; }
}

async function postComment(prNumber: number, body: string, token: string) {
  return gh(`/issues/${prNumber}/comments`, { method: "POST", body: JSON.stringify({ body }) }, token);
}

function verdictFa(v: FamilyReport["verdict"]): string {
  switch (v) {
    case "IN_SYNC": return "🟢 هم‌گام با سر رسمی";
    case "STALE_BASE": return "🔴 پایهٔ کهنه (INC-07) — rebase روی سر رسمی لازم است";
    case "NEWER_THAN_OFFICIAL": return "🟡 جدیدتر از سر رسمی — در انتظار بازرسی دوم";
    case "SHA_MISMATCH": return "🟡 هم‌نسخه ولی SHA متفاوت — محتوا تغییر کرده";
    default: return "ℹ️ خارج از مانیفست";
  }
}

async function handleDelivery(branch: string, sha: string, st: BranchState, state: State) {
  log(`📥 تحویل جدید روی ${branch}: ${sha7(st.lastSha)} → ${sha7(sha)}`);
  const token = ghToken();
  mkdirSync(WORKROOT, { recursive: true });
  const wt = path.join(WORKROOT, slug(branch));

  git(["worktree", "remove", "--force", wt]);
  const add = git(["worktree", "add", "--detach", wt, sha], REPO, 180_000);
  if (!add.ok) throw new Error(`worktree ساخت نشد: ${add.err.slice(0, 200)}`);

  try {
    const official = JSON.parse(readFileSync(OFFICIAL_HEADS_MAIN, "utf8"));
    const { families, cartridgeFiles, pageMaps } = scanFamilies(wt, official);
    const gates = runLocalGates(wt);

    let smokeLine = gates.smoke;
    const inSync = families.find((f) => f.verdict === "IN_SYNC");
    if (inSync) smokeLine = runSmokeCheckWave(wt, inSync.herFile!);

    const prRes = await ensurePR(branch, token, { sha, families, pageMaps });
    const ci = await ciSnapshot(branch, token);

    const verdictKind = families.some((f) => f.verdict === "STALE_BASE")
      ? "RED_STALE_BASE"
      : families.some((f) => f.verdict === "NEWER_THAN_OFFICIAL" || f.verdict === "SHA_MISMATCH")
        ? "YELLOW_REVIEW"
        : families.length
          ? "GREEN_SYNC"
          : "NO_CARTRIDGE";

    if (prRes.pr) {
      const report = buildReport({ branch, sha, families, cartridgeFiles, pageMaps, headsVerify: gates.headsVerify, smoke: smokeLine, notes: gates.notes, ci, prUrl: prRes.pr.html_url });
      const c = await postComment(prRes.pr.number, report, token);
      if (c.status >= 300) log(`⚠️ کامنت رأی روی PR #${prRes.pr.number} ناموفق: ${c.status}`);
    }

    st.lastSha = sha;
    st.lastProcessedAt = new Date().toISOString();
    st.seeded = false;
    st.prNumber = prRes.pr?.number ?? null;
    st.prUrl = prRes.pr?.html_url ?? null;
    st.verdictSha = sha;
    st.verdictKind = verdictKind;
    st.note = prRes.note || (prRes.pr ? `PR #${prRes.pr.number}` : "");
    log(`⚖️ رأی کارگاه‌بان برای ${branch}: ${verdictKind} ${prRes.pr ? `→ PR #${prRes.pr.number}` : `(${prRes.note})`}`);
  } finally {
    git(["worktree", "remove", "--force", wt]);
  }
}

function buildReport(x: {
  branch: string; sha: string; families: FamilyReport[]; cartridgeFiles: string[]; pageMaps: string[];
  headsVerify: string | null; smoke: string | null; notes: string[]; ci: string; prUrl: string;
}): string {
  const famTable = x.families.length
    ? ["| خانواده | نسخهٔ آرنا | سر رسمی | حکم |", "|---|---|---|---|",
       ...x.families.map((f) => `| ${f.family} | ${f.herVersion ?? "—"} | ${f.officialVersion} | ${verdictFa(f.verdict)}${f.verdict === "SHA_MISMATCH" ? " (SHA متفاوت)" : ""} |`)].join("\n")
    : "_فایل خشاب `khshab-G*-MATH_v*.xlsx` در این تحویل یافت نشد (تحویل غیرخشابی: سند/اسکریپت/نقشهٔ صفحه)._";

  const nextStep =
    x.families.some((f) => f.verdict === "STALE_BASE")
      ? "**گام بعدی آرنا:** rebase روی `v10.3-beta` (سر رسمی فعلی) و پوش مجدد — موج جدید فقط از فایلِ اعلام‌شدهٔ مانیفست شروع می‌شود (INC-07)."
      : x.families.some((f) => f.verdict === "NEWER_THAN_OFFICIAL" || f.verdict === "SHA_MISMATCH")
        ? "**گام بعدی:** خشاب جدید به صف بازرسی دوم (Z.ai) رفت — پس از تأیید، ادغام رسمی و به‌روزرسانی مانیفست انجام می‌شود."
        : x.families.length
          ? "**گام بعدی:** هم‌گامی تأیید شد — در انتظار مراحل انسانی (بازرسی دوم ← رأی معلم ← ادغام)."
          : "**گام بعدی:** تحویل غیرخشابی است — Z.ai روی محتوای سند/ابزارها بازرسی می‌کند.";

  return [
    `## 🤖 رأی ماشینی کارگاه‌بان`,
    ``,
    `**شاخه:** \`${x.branch}\` | **هد:** \`${sha7(x.sha)}\` | **[مشاهدهٔ PR](${x.prUrl})**`,
    ``,
    `### ۱) خشاب‌ها در برابر سرهای رسمی (OFFICIAL-HEADS)`,
    famTable,
    ``,
    `### ۲) گیت‌های محلی`,
    `- خودسازگاری مانیفست شاخهٔ آرنا: \`${x.headsVerify ?? "N/A"}\``,
    `- Smoke مبدل رسمی: \`${x.smoke ?? "N/A"}\``,
    x.notes.length ? x.notes.map((n) => `- ℹ️ ${n}`).join("\n") : "",
    ``,
    `### ۳) CI گیت‌هاب (\`${GATE_WF}\`)`,
    `- ${x.ci}`,
    ``,
    `<details><summary>فایل‌های تحویلی شناسایی‌شده</summary>`,
    ``,
    x.cartridgeFiles.length ? x.cartridgeFiles.map((f) => `- خشاب: \`${f}\``).join("\n") : "- خشاب: —",
    x.pageMaps.length ? x.pageMaps.map((f) => `- نقشهٔ صفحه: \`${f}\``).join("\n") : "",
    ``,
    `</details>`,
    ``,
    `---`,
    nextStep,
    ``,
    `<sub>این پیام به‌صورت خودکار توسط کارگاه‌بان v${VERSION} تولید شده است. مراحل انسانی: بازرسی دوم (Z.ai) ← رأی معلم ← ادغام رسمی در v10.3-beta.</sub>`,
  ].filter((l) => l !== "").join("\n");
}

// ════════════════════════════════════════════════════════════════════════
// §۲ — سیستم مرکزی مدیریت (v2): رجیستری + تابلو + تأیید واحد + دیسپچ
// ════════════════════════════════════════════════════════════════════════

function registryFromOrigin(): Registry | null {
  const r = git(["show", `origin/main:${REGISTRY_PATH}`], REPO, 60_000);
  if (!r.ok) return null;
  try { return JSON.parse(r.out) as Registry; } catch { return null; }
}

function registryLocal(): Registry | null {
  try { return JSON.parse(readFileSync(path.join(REPO, REGISTRY_PATH), "utf8")) as Registry; } catch { return null; }
}

/** ثبت رسمی رجیستری روی origin/main با Contents API (کامیت با هویت مالک/ربات — بدون درگیر کردن درخت محلی) */
async function putRegistryOnMain(reg: Registry, message: string, token: string): Promise<{ ok: boolean; detail: string }> {
  const get = await gh<any>(`/contents/${REGISTRY_PATH}?ref=main`, {}, token);
  let sha: string | undefined;
  if (get.status === 200) sha = get.json?.sha;
  else if (get.status !== 404) return { ok: false, detail: `GET contents ${get.status}: ${(get.json as any)?.message ?? ""}` };
  const content = Buffer.from(JSON.stringify(reg, null, 2) + "\n", "utf8").toString("base64");
  const put = await gh<any>(`/contents/${REGISTRY_PATH}`, { method: "PUT", body: JSON.stringify({ message, content, sha }) }, token);
  if (put.status >= 200 && put.status < 300) return { ok: true, detail: `کامیت ${put.json?.commit?.sha ? sha7(put.json.commit.sha) : "?"}` };
  return { ok: false, detail: `PUT ${put.status}: ${(put.json as any)?.message ?? put.body.slice(0, 140)}` };
}

/** همگام‌سازی محلی best-effort پس از کامیت ربات (فقط وقتی درخت کاری تمیز است) */
function syncLocalBestEffort() {
  if (git(["status", "--porcelain"]).out.trim().length) {
    log("↩️ sync محلی رد شد — درخت کاری تمیز نیست");
    return;
  }
  const p = git(["pull", "--rebase", "origin", "main"], REPO, 180_000);
  log(p.ok ? "↩️ main محلی با origin همگام شد" : `⚠️ sync محلی ناموفق: ${(p.err || p.out).slice(0, 140)}`);
}

async function ensureBoard(token: string, state: State): Promise<{ number: number; url: string } | null> {
  if (state.blueprints!.boardIssue) {
    const g = await gh<any>(`/issues/${state.blueprints!.boardIssue}`, {}, token);
    if (g.status === 200 && g.json?.number) return { number: g.json.number, url: g.json.html_url };
    state.blueprints!.boardIssue = null; // حذف شده — دوباره بساز
  }
  const s = await gh<any>("/issues?state=open&per_page=100", {}, token);
  if (Array.isArray(s.json)) {
    const hit = s.json.find((i: any) => i.title?.includes("تابلوی مرکزی مدیریت"));
    if (hit) {
      state.blueprints!.boardIssue = hit.number;
      state.blueprints!.boardUrl = hit.html_url;
      return { number: hit.number, url: hit.html_url };
    }
  }
  const c = await gh<any>("/issues", {
    method: "POST",
    body: JSON.stringify({ title: BOARD_TITLE, body: "_ساخت تابلو توسط کارگاه‌بان…_", labels: [BOARD_LABEL] }),
  }, token);
  if (c.status === 201 && c.json?.number) {
    state.blueprints!.boardIssue = c.json.number;
    state.blueprints!.boardUrl = c.json.html_url;
    log(`🗂️ تابلوی مرکزی ساخته شد: #${c.json.number}`);
    return { number: c.json.number, url: c.json.html_url };
  }
  log(`⚠️ ساخت تابلو ناموفق: ${c.status} ${(c.json as any)?.message ?? c.body.slice(0, 120)}`);
  return null;
}

function buildBoardBody(reg: Registry, state: State): string {
  const rows = [...reg.blueprints].sort((a, b) => a.priority - b.priority).map((b) => {
    const appr = b.approved_by ? String(b.approved_by).split("—")[0].trim().slice(0, 40) : "—";
    return `| **${b.id}** | ${b.title} | ${b.lane === "dev" ? "🛠 توسعه" : "📚 محتوا"} / \`${b.assignee}\` | ${STATUS_FA[b.status] ?? b.status} | ${appr} |`;
  });
  const pending = [...reg.blueprints].filter((b) => b.status === "awaiting_approval").sort((a, b) => a.priority - b.priority);
  const pendingLines = pending.length
    ? pending.map((b) => `- **${b.id}** — ${b.title} (مسئول: \`${b.assignee}\`)`).join("\n") +
      `\n\n👉 برای فعال‌سازی، همین‌جا کامنت بگذارید: \`تایید ${pending[0].id}\` یا \`تایید همه\``
    : "_موردی در انتظار تأیید نیست._";

  const events = state.blueprints!.events.length
    ? state.blueprints!.events.map((e) => `- ${e}`).join("\n")
    : "_هنوز رویدادی ثبت نشده._";

  return [
    `> 🤖 **تابلوی رسمی سیستم مرکزی مدیریت** — آینهٔ زندهٔ \`${REGISTRY_PATH}\` روی \`main\` | قانون: \`GOVERNANCE.md\``,
    `> آخرین همگام‌سازی: ${nowIso().slice(0, 16).replace("T", " ")} UTC | نسخهٔ رجیستری: **${reg.version}**${state.frozen ? " | 🧊 **فریز فعال است**" : ""}`,
    ``,
    `## ✅ تأیید واحد — تنها کاری که مالک باید بکند`,
    `کامنت زیر همین تابلو (فقط از حساب \`${OWNER_LOGIN}\`):`,
    "```",
    `تایید BP-001`,
    `تایید BP-002 BP-003`,
    `تایید همه`,
    "```",
    `کارگاه‌بان تأیید را در رجیستری ثبت و دستور کار را برای مسئول دیسپچ می‌کند. (توقف اضطراری: کامنت \`فریز\`)`,
    ``,
    `## 📊 وضعیت نقشه‌های فنی`,
    `| شناسه | عنوان | خط/مسئول | وضعیت | تأیید |`,
    `|---|---|---|---|---|`,
    ...rows,
    ``,
    `## ⏳ در انتظار تأیید مالک`,
    pendingLines,
    ``,
    `## 🧾 رویدادهای اخیر`,
    events,
    ``,
    `---`,
    `<sub>کارگاه‌بان v${VERSION} — «پایش شاخه‌های arena/**» و «گیت‌های fail-closed» در پس‌زمینه فعال‌اند. مراحل انسانی خط محتوا: بازرسی دوم (Z.ai) ← رأی معلم ← ادغام رسمی.</sub>`,
  ].join("\n");
}

async function updateBoard(reg: Registry, state: State, token: string) {
  const board = await ensureBoard(token, state);
  if (!board) return;
  const p = await gh<any>(`/issues/${board.number}`, { method: "PATCH", body: JSON.stringify({ body: buildBoardBody(reg, state) }) }, token);
  if (p.status >= 300) log(`⚠️ به‌روزرسانی تابلو ناموفق: ${p.status}`);
}

function bpWorkOrder(b: Blueprint): string {
  const tasks = b.tasks.map((t) => `- [${t.automated ? "🤖" : "👤"}] ${t.id}: ${t.desc}`).join("\n");
  const acc = b.acceptance.map((a) => `- ${a}`).join("\n");
  return [
    `### 📋 دستور کار ${b.id} — ${b.title}`,
    ``,
    `**خط:** ${b.lane === "dev" ? "توسعه" : "محتوا"} | **مسئول:** \`${b.assignee}\` | **تأییدکننده:** ${b.approved_by ?? "—"} (تأیید واحد مالک)`,
    ``,
    `**زمینه:** ${b.context}`,
    ``,
    `**کارها:**`,
    tasks,
    ``,
    `**معیار پذیرش:**`,
    acc,
    b.notes ? `\n**یادداشت:** ${b.notes}` : "",
    ``,
    `وضعیت را با \`bun scripts/blueprint.ts set-status ${b.id} executing|delivered --note "..."\` و پوش به main اعلام کنید.`,
  ].filter((l) => l !== undefined).join("\n");
}

async function dispatchApproved(reg: Registry, state: State, token: string): Promise<number> {
  let count = 0;
  const board = state.blueprints!.boardIssue;
  for (const b of [...reg.blueprints].sort((a, b2) => a.priority - b2.priority)) {
    if (b.status !== "approved") continue;
    const key = b.id;
    if (state.blueprints!.dispatched[key] && state.blueprints!.dispatched[key] === b.approved_at) continue;

    const order = bpWorkOrder(b);
    if (board) {
      const tag = b.assignee === "arena" ? `@${OWNER} — دستور کار برای **آرنا** (از کانال رسمی تابلو/PR اطلاع داده می‌شود)` : `دستور کار برای **Z.ai** (ثبت در بریفینگ)`;
      const c = await postComment(board, `🚀 **دیسپچ ${b.id}** — ${tag}\n\n${order}`, token);
      if (c.status >= 300) log(`⚠️ کامنت دیسپچ ${b.id} ناموفق: ${c.status}`);
    }
    if (b.assignee === "arena" && b.links?.pr) {
      const mPr = String(b.links.pr).match(/(\d+)\s*$/);
      if (mPr) {
        const prNum = parseInt(mPr[1], 10);
        const c = await postComment(prNum, `🤖 کارگاه‌بان: نقشهٔ فنی **${b.id}** برای این تحویل تأیید واحد شد.\n\n${order}`, token);
        if (c.status >= 300) log(`⚠️ کامنت دیسپچ ${b.id} روی PR #${prNum} ناموفق: ${c.status}`);
      }
    }
    state.blueprints!.dispatched[key] = b.approved_at ?? nowIso();
    b.dispatched_at = b.dispatched_at ?? nowIso();
    pushEvent(state, `🚀 ${b.id} دیسپچ شد → ${b.assignee}`);
    log(`🚀 دیسپچ ${b.id} → ${b.assignee}`);
    count++;
  }
  return count;
}

async function processBoardComments(state: State, token: string) {
  const board = state.blueprints!.boardIssue;
  if (!board) return;
  const cs = await gh<any>(`/issues/${board}/comments?per_page=100`, {}, token);
  if (!Array.isArray(cs.json)) return;
  const fresh = (cs.json as any[]).filter((c) => c.id > (state.blueprints!.lastCommentId ?? 0)).sort((a, b) => a.id - b.id);
  for (const c of fresh) {
    state.blueprints!.lastCommentId = Math.max(state.blueprints!.lastCommentId ?? 0, c.id);
    const body = String(c.body || "").trim();
    const user = c.user?.login ?? "?";

    if (/^\s*(?:فریز|freeze)\s*$/im.test(body) && body.length < 60) {
      state.frozen = !state.frozen;
      pushEvent(state, state.frozen ? "🧊 فریز فعال شد (مالک)" : "🧊 فریز برداشته شد (مالک)");
      await postComment(board, state.frozen
        ? `🧊 **فریز فعال شد** — ثبت تأیید و دیسپچ متوقف است (مادهٔ ۸ GOVERNANCE). برداشتن: کامنت \`فریز\` مجدد.`
        : `▶️ **فریز برداشته شد** — سیستم مرکزی از سر گرفته شد.`, token);
      log(`🧊 فریز = ${state.frozen}`);
      continue;
    }

    const m = body.match(/^\s*(?:>[^\n]*\n)*\s*(?:\*\*)?(?:تأیید|تایید|approve)\*\*\s*[:：]?\s*(.+)$/im);
    if (!m) continue;

    if (user !== OWNER_LOGIN) {
      if (!state.blueprints!.warnedNonOwner.includes(c.id)) {
        state.blueprints!.warnedNonOwner.push(c.id);
        await postComment(board, `⛔ @${user} طبق مادهٔ ۵ پروتکل، تأیید فقط از حساب مالک (\`${OWNER_LOGIN}\`) معتبر است.`, token);
        log(`⛔ تلاش تأیید از حساب غیرمالک: ${user}`);
      }
      continue;
    }
    if (state.frozen) {
      await postComment(board, `🧊 فریز فعال است — تأیید ثبت نشد. ابتدا \`فریز\` را بردارید.`, token);
      continue;
    }

    const raw = m[1];
    const ids = [...raw.matchAll(/BP-(\d{3})/gi)].map((x) => `BP-${x[1]}`);
    const isAll = !ids.length && /همه|همگی|all/i.test(raw);
    const targets = isAll ? ["ALL"] : ids;
    if (!targets.length) {
      await postComment(board, `🤖 قالب تأیید درست نشد. نمونه: \`تایید BP-001\` یا \`تایید همه\``, token);
      continue;
    }
    await applyApprovals(state, targets, user, raw, token);
  }
}

async function applyApprovals(state: State, targets: string[], approver: string, rawText: string, token: string) {
  const board = state.blueprints!.boardIssue;
  const reg = registryFromOrigin() ?? registryLocal();
  if (!reg) {
    if (board) await postComment(board, `⚠️ رجیستری \`${REGISTRY_PATH}\` روی \`main\` نیست — تأیید ثبت نشد.`, token);
    return;
  }
  const list = targets.includes("ALL")
    ? reg.blueprints.filter((b) => b.status === "awaiting_approval")
    : targets.map((t) => reg.blueprints.find((b) => b.id.toLowerCase() === t.toLowerCase())).filter(Boolean) as Blueprint[];

  if (!list.length) {
    if (board) await postComment(board, `🤖 موردی با وضعیت «در انتظار تأیید» برای \`${targets.join(", ")}\` نبود.`, token);
    return;
  }

  const approved: string[] = [];
  const skipped: string[] = [];
  for (const b of list) {
    if (b.status !== "awaiting_approval" && b.status !== "draft" && b.status !== "rejected") { skipped.push(`${b.id} (${b.status})`); continue; }
    b.status = "approved";
    b.approved_by = `مالک (@${approver}) — تابلو: «${rawText.replace(/\s+/g, " ").slice(0, 60)}»`;
    b.approved_at = nowIso();
    b.dispatched_at = null;
    approved.push(b.id);
  }

  if (approved.length) {
    reg.version += 1;
    reg.updated_at = nowIso();
    reg.updated_by = `foreman:approval-by-${approver}`;
    const msg = `blueprints: ثبت تأیید واحد مالک برای ${approved.join(", ")} (GOVERNANCE مادهٔ ۵)`;
    const put = await putRegistryOnMain(reg, msg, token);
    if (put.ok) {
      pushEvent(state, `✅ تأیید واحد ثبت شد: ${approved.join(", ")} (توسط @${approver})`);
      syncLocalBestEffort();
    } else {
      pushEvent(state, `⚠️ ثبت تأیید ${approved.join(", ")} ناموفق: ${put.detail}`);
      log(`⚠️ putRegistry ناموفق: ${put.detail}`);
      if (board) await postComment(board, `⚠️ ثبت تأیید در رجیستری ناموفق بود: \`${put.detail}\` — در اسکن بعدی تلاش می‌شود.`, token);
      return;
    }
  }

  const lines: string[] = [`✅ **ثبت تأیید واحد** (پروتکل مادهٔ ۵)`];
  if (approved.length) lines.push(`- تأیید شد: ${approved.map((a) => `**${a}**`).join("، ")}`);
  if (skipped.length) lines.push(`- رد شد (وضعیت فعلی مانع است): ${skipped.join("، ")}`);
  lines.push(`- دیسپچ: در ادامهٔ همین اسکن انجام می‌شود ⏩`);
  if (board) await postComment(board, lines.join("\n"), token);
  log(`✅ تأیید مالک ثبت شد: ${approved.join(", ") || "—"} | رد‌شده: ${skipped.join(", ") || "—"}`);
}

/** موتور رجیستری: تشخیص تغییر نسخه → دیسپچ تأییدشده‌های جدید → به‌روزرسانی تابلو */
async function processRegistryEngine(state: State, token: string, force = false): Promise<void> {
  const reg = registryFromOrigin();
  if (!reg) {
    const local = registryLocal();
    log(local ? "ℹ️ رجیستری هنوز روی origin/main نیست (پوش نشده) — موتور منتظر ماند" : "ℹ️ رجیستری نقشه‌ها موجود نیست");
    return;
  }
  const changed = force || state.blueprints!.lastRegistryVersion !== reg.version;
  if (state.blueprints!.lastRegistryVersion === null) log(`📐 رجیستری کشف شد — نسخهٔ ${reg.version} با ${reg.blueprints.length} نقشه`);
  state.blueprints!.lastRegistryVersion = reg.version;

  await ensureBoard(token, state);
  const n = state.frozen ? 0 : await dispatchApproved(reg, state, token);
  if (changed || n > 0) {
    await updateBoard(reg, state, token);
    writeBrief(state, reg);
    log(`🗂️ تابلو به‌روز شد (نسخهٔ رجیستری ${reg.version}${n ? ` | ${n} دیسپچ` : ""})`);
  }
}

// ── بریفینگ ────────────────────────────────────────────────────────────────
function writeBrief(state: State, reg?: Registry | null) {
  const r = reg ?? registryFromOrigin() ?? registryLocal();
  const rows = Object.entries(state.branches).map(([b, st]) => {
    const pr = st.prNumber ? `[PR #${st.prNumber}](${st.prUrl})` : st.prUrl === null && st.note ? st.note : "—";
    return `| \`${b}\` | \`${sha7(st.lastSha)}\` | ${pr} | ${st.verdictKind ?? (st.seeded ? "پایه‌گذاری" : "—")} | ${st.lastProcessedAt?.slice(0, 16).replace("T", " ") ?? "—"} |`;
  });

  let bpSection = "_رجیستری نقشه‌ها هنوز روی main پوش نشده._";
  let workQueue = "";
  if (r) {
    const rowsBp = [...r.blueprints].sort((a, b) => a.priority - b.priority)
      .map((b) => `| ${b.id} | ${b.title.slice(0, 60)} | ${b.assignee} | ${STATUS_FA[b.status] ?? b.status} |`)
      .join("\n");
    bpSection = `| شناسه | عنوان | مسئول | وضعیت |\n|---|---|---|---|\n${rowsBp}`;
    const zai = r.blueprints.filter((b) => b.assignee === "z.ai" && ["approved", "executing"].includes(b.status));
    const arena = r.blueprints.filter((b) => b.assignee === "arena" && ["approved", "executing"].includes(b.status));
    workQueue = [
      `## 🔨 صف کار Z.ai (خط توسعه)`,
      zai.length ? zai.map((b) => `- **${b.id}**: ${b.title} — ${STATUS_FA[b.status]}`).join("\n") : "- خالی",
      ``,
      `## 📚 صف محتوا (آرنا)`,
      arena.length ? arena.map((b) => `- **${b.id}**: ${b.title} — ${STATUS_FA[b.status]}`).join("\n") : "- خالی",
    ].join("\n");
  }

  const md = [
    `# 📋 بریفینگ کارگاه‌بان v${VERSION} — برای Z.ai و مالک`,
    ``,
    `> آخرین اسکن: ${state.lastScanAt?.replace("T", " ").slice(0, 19) ?? "—"} | وضعیت: ${state.lastScanOk ? "✅" : `⛔ ${state.lastError ?? ""}`} | ${state.frozen ? "🧊 فریز فعال" : "▶️ فعال"}`,
    ``,
    `## 🗂️ تابلوی مرکزی: ${state.blueprints?.boardUrl ?? "ساخته نشده"}`,
    ``,
    bpSection,
    ``,
    workQueue,
    ``,
    `## 📥 خط محتوا (شاخه‌های arena/**)`,
    ``,
    `| شاخهٔ آرنا | هد | PR به ${BASE_BRANCH} | رأی ماشینی | به‌روزشدن |`,
    `|---|---|---|---|---|`,
    ...rows,
    ``,
    `## قواعد ثابت`,
    `- تأیید واحد مالک = کامنت روی تابلوی مرکزی («تایید BP-xxx» / «تایید همه») — فقط از \`${OWNER_LOGIN}\`.`,
    `- رأی ماشینی فقط گیت است؛ مراحل انسانی خط محتوا: **بازرسی دوم (Z.ai) ← رأی معلم ← ادغام رسمی**.`,
    `- پایهٔ هر موج جدید = فایل اعلام‌شدهٔ \`OFFICIAL-HEADS.json\` (INC-07 لامسکوت).`,
    `- لاگ کامل: \`mini-services/foreman/foreman.log\` | پورت: 3030 | اسکن دستی: \`POST /scan\`.`,
    ``,
  ].join("\n");
  writeFileSync(BRIEF_FILE, md);
}

// ── پایش یک دور کامل ───────────────────────────────────────────────────────
let busy = false;

async function scan(): Promise<{ processed: number; events: string[] }> {
  if (busy) return { processed: 0, events: ["مشغول دور قبلی"] };
  busy = true;
  const state = loadState();
  const events: string[] = [];
  try {
    const token = ghToken();

    const f = git(["fetch", "origin", "--prune", "--quiet"]);
    if (!f.ok) throw new Error(`fetch ناموفق: ${f.err.slice(0, 200)}`);

    // §۱ — خط محتوا: پایش شاخه‌های آرنا
    const refs = git(["for-each-ref", "--format=%(refname:short) %(objectname)", "refs/remotes/origin/arena/"]);
    if (!refs.ok) throw new Error(`لیست شاخه‌ها ناموفق: ${refs.err.slice(0, 200)}`);

    for (const line of refs.out.split("\n").filter(Boolean)) {
      const [ref, sha] = line.split(/\s+/);
      const branch = ref.replace(/^origin\//, "");
      const st = state.branches[branch];
      if (!st) {
        state.branches[branch] = { lastSha: sha, seeded: true, lastProcessedAt: new Date().toISOString() };
        events.push(`🌱 ${branch}: پایه‌گذاری خاموش در ${sha7(sha)}`);
        log(`🌱 پایه‌گذاری خاموش ${branch} @ ${sha7(sha)}`);
        continue;
      }
      if (st.lastSha !== sha) {
        try {
          await handleDelivery(branch, sha, st, state);
          events.push(`📥 ${branch}: تحویل ${sha7(sha)} پردازش شد → ${st.verdictKind}`);
        } catch (e: any) {
          state.lastError = `${branch}: ${e?.message ?? e}`;
          events.push(`⚠️ ${branch}: خطا — ${e?.message ?? e}`);
          log(`⚠️ خطای پردازش ${branch}: ${e?.stack || e}`);
        }
      }
    }

    // §۲ — سیستم مرکزی: تابلو + کامنت‌های مالک + موتور رجیستری
    try {
      await ensureBoard(token, state);
      await processBoardComments(state, token);
      await processRegistryEngine(state, token);
    } catch (e: any) {
      log(`⚠️ خطای موتور مرکزی: ${e?.stack || e}`);
      events.push(`⚠️ موتور مرکزی: ${e?.message ?? e}`);
    }

    state.lastScanAt = new Date().toISOString();
    state.lastScanOk = true;
    state.lastError = null;
  } catch (e: any) {
    state.lastScanAt = new Date().toISOString();
    state.lastScanOk = false;
    state.lastError = String(e?.message ?? e);
    log(`⛔ خطای اسکن: ${state.lastError}`);
  } finally {
    saveState(state);
    writeBrief(state);
    busy = false;
  }
  return { processed: events.length, events };
}

// ── سرور HTTP + حلقه ───────────────────────────────────────────────────────
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/status") {
      const s = loadState();
      return Response.json({ bot: `کارگاه‌بان v${VERSION}`, port: PORT, frozen: !!s.frozen, board: s.blueprints?.boardUrl ?? null, ...s, brief: BRIEF_FILE });
    }
    if (url.pathname === "/blueprints") {
      const s = loadState();
      const origin = registryFromOrigin();
      return Response.json({
        registryOnMain: origin ? { version: origin.version, updated_at: origin.updated_at, count: origin.blueprints.length } : null,
        registryLocal: registryLocal()?.version ?? null,
        boardUrl: s.blueprints?.boardUrl ?? null,
        lastRegistryVersion: s.blueprints?.lastRegistryVersion ?? null,
        dispatched: s.blueprints?.dispatched ?? {},
        events: s.blueprints?.events ?? [],
        frozen: !!s.frozen,
      });
    }
    if (url.pathname === "/scan" && req.method === "POST") {
      const r = await scan();
      return Response.json({ ok: true, ...r });
    }
    return new Response(`کارگاه‌بان v${VERSION} زنده است ✅ — GET /status | GET /blueprints | POST /scan\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  },
});

log(`🤖 کارگاه‌بان v${VERSION} روی پورت ${PORT} بالا آمد — فواصل اسکن: ${SCAN_INTERVAL_MS / 1000}s`);

if (process.argv.includes("--scan-once")) {
  scan().then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(0); });
} else {
  setTimeout(scan, 5_000); // اولین اسکن زودهنگام
  setInterval(scan, SCAN_INTERVAL_MS);
}
