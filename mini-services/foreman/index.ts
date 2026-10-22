/**
 * کارگاه‌بان (khshab-foreman) — ربات ناظر خط تولید محتوا
 * پورت ثابت: 3030 | بدون وابستگی خارجی (Bun + fetch + git)
 *
 * وظایف: پایش شاخه‌های arena/** → گیت ماشینی محلی → ساخت PR به v10.3-beta
 *        → کامنت رأی فارسی برای آرنا → BRIEF.md برای Z.ai → وضعیت زنده در /status
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import path from "path";

// ── ثابت‌ها ────────────────────────────────────────────────────────────────
const PORT = 3030;
const REPO = "/home/z/my-project";
const OWNER = "bayrami1341";
const REPO_NAME = "math-game";
const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO_NAME}`;
const BASE_BRANCH = "v10.3-beta";
const WORKROOT = "/tmp/foreman-work";
const DIR = import.meta.dir;
const STATE_FILE = path.join(DIR, "state.json");
const LOG_FILE = path.join(DIR, "foreman.log");
const BRIEF_FILE = path.join(DIR, "BRIEF.md");
const OFFICIAL_HEADS_MAIN = path.join(REPO, "public/math-game/authoring/OFFICIAL-HEADS.json");
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
type State = { branches: Record<string, BranchState>; lastScanAt?: string; lastScanOk?: boolean; lastError?: string | null };

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

function loadState(): State {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")) as State; } catch { return { branches: {} }; }
}
function saveState(s: State) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

// ── گیت ماشینی محلی روی یک تحویل ───────────────────────────────────────────
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
  // ۱) خودسازگاری مانیفست شاخهٔ آرنا (اگر دارد)
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

  // ۲) smoke مبدل روی خانوادهٔ هم‌گام — فقط اگر مبدل در شاخه هست
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

// ── گیت‌هاب: PR و CI و کامنت ───────────────────────────────────────────────
async function findOpenPR(branch: string, token: string): Promise<{ number: number; html_url: string } | null> {
  const { json } = await gh<any>("/pulls?state=open&per_page=50", {}, token);
  if (!Array.isArray(json)) return null;
  // فقط PRهایی که پایه‌شان v10.3-beta است — PRهای داخلی خود آرنا نباید دست‌کاری شوند
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

// ── پردازش یک تحویل جدید ───────────────────────────────────────────────────
let busy = false;

async function handleDelivery(branch: string, sha: string, st: BranchState, state: State) {
  log(`📥 تحویل جدید روی ${branch}: ${sha7(st.lastSha)} → ${sha7(sha)}`);
  const token = ghToken();
  mkdirSync(WORKROOT, { recursive: true });
  const wt = path.join(WORKROOT, slug(branch));

  git(["worktree", "remove", "--force", wt]); // بی‌اهمیت اگر نبود
  const add = git(["worktree", "add", "--detach", wt, sha], REPO, 180_000);
  if (!add.ok) throw new Error(`worktree ساخت نشد: ${add.err.slice(0, 200)}`);

  try {
    const official = JSON.parse(readFileSync(OFFICIAL_HEADS_MAIN, "utf8"));
    const { families, cartridgeFiles, pageMaps } = scanFamilies(wt, official);
    const gates = runLocalGates(wt);

    // smoke مبدل روی اولین خانوادهٔ هم‌گام
    let smokeLine = gates.smoke;
    const inSync = families.find((f) => f.verdict === "IN_SYNC");
    if (inSync) smokeLine = runSmokeCheckWave(wt, inSync.herFile!);

    // PR
    const prRes = await ensurePR(branch, token, { sha, families, pageMaps });
    const ci = await ciSnapshot(branch, token);

    // رأی فارسی
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
    `<sub>این پیام به‌صورت خودکار توسط کارگاه‌بان v1.0.0 تولید شده است. مراحل انسانی: بازرسی دوم (Z.ai) ← رأی معلم ← ادغام رسمی در v10.3-beta.</sub>`,
  ].filter((l) => l !== "").join("\n");
}

// ── پایش یک دور کامل ───────────────────────────────────────────────────────
async function scan(): Promise<{ processed: number; events: string[] }> {
  if (busy) return { processed: 0, events: ["مشغول دور قبلی"] };
  busy = true;
  const state = loadState();
  const events: string[] = [];
  try {
    const f = git(["fetch", "origin", "--prune", "--quiet"]);
    if (!f.ok) throw new Error(`fetch ناموفق: ${f.err.slice(0, 200)}`);

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

function writeBrief(state: State) {
  const rows = Object.entries(state.branches).map(([b, st]) => {
    const pr = st.prNumber ? `[PR #${st.prNumber}](${st.prUrl})` : st.prUrl === null && st.note ? st.note : "—";
    return `| \`${b}\` | \`${sha7(st.lastSha)}\` | ${pr} | ${st.verdictKind ?? (st.seeded ? "پایه‌گذاری" : "—")} | ${st.lastProcessedAt?.slice(0, 16).replace("T", " ") ?? "—"} |`;
  });
  const md = [
    `# 📋 بریفینگ کارگاه‌بان — برای Z.ai و مالک`,
    ``,
    `> آخرین اسکن: ${state.lastScanAt?.replace("T", " ").slice(0, 19) ?? "—"} | وضعیت: ${state.lastScanOk ? "✅" : `⛔ ${state.lastError ?? ""}`}`,
    ``,
    `| شاخهٔ آرنا | هد | PR به ${BASE_BRANCH} | رأی ماشینی | به‌روزشدن |`,
    `|---|---|---|---|---|`,
    ...rows,
    ``,
    `## قواعد ثابت`,
    `- رأی ماشینی فقط گیت است؛ مراحل انسانی: **بازرسی دوم (Z.ai) ← رأی معلم ← ادغام رسمی**.`,
    `- پایهٔ هر موج جدید = فایل اعلام‌شدهٔ \`OFFICIAL-HEADS.json\` (INC-07 لامسکوت).`,
    `- لاگ کامل: \`mini-services/foreman/foreman.log\` | پورت: 3030 | اسکن دستی: \`POST /scan\`.`,
    ``,
  ].join("\n");
  writeFileSync(BRIEF_FILE, md);
}

// ── سرور HTTP + حلقه ───────────────────────────────────────────────────────
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/status") {
      const s = loadState();
      return Response.json({ bot: "کارگاه‌بان v1.0.0", port: PORT, ...s, brief: BRIEF_FILE });
    }
    if (url.pathname === "/scan" && req.method === "POST") {
      const r = await scan();
      return Response.json({ ok: true, ...r });
    }
    return new Response("کارگاه‌بان زنده است ✅ — GET /status | POST /scan\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  },
});

log(`🤖 کارگاه‌بان روی پورت ${PORT} بالا آمد — فواصل اسکن: ${SCAN_INTERVAL_MS / 1000}s`);

if (process.argv.includes("--scan-once")) {
  scan().then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(0); });
} else {
  setTimeout(scan, 5_000); // اولین اسکن زودهنگام
  setInterval(scan, SCAN_INTERVAL_MS);
}
