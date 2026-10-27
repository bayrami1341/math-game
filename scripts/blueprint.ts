/**
 * blueprint.ts — CLI رسمی نقشه‌های فنی «کارگاه ضرب» (مالک و عامل‌ها)
 *
 *   bun scripts/blueprint.ts list
 *   bun scripts/blueprint.ts show BP-001
 *   bun scripts/blueprint.ts approve BP-001 [BP-002|all] --by "مالک-چت"
 *   bun scripts/blueprint.ts set-status BP-001 executing --note "..."
 *   bun scripts/blueprint.ts validate
 *
 * SSOT = blueprints/registry.json (روی main). تغییرات را کامیت و پوش کنید؛
 * کارگاه‌بان تابلوی مرکزی گیت‌هاب را خودکار به‌روز می‌کند.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dir, "..");
const REG = path.join(ROOT, "blueprints", "registry.json");

const STATUSES = ["draft", "awaiting_approval", "approved", "executing", "delivered", "verified", "done", "blocked", "rejected"] as const;
type Status = (typeof STATUSES)[number];

type Task = { id: string; desc: string; automated: boolean };
type Blueprint = {
  id: string; title: string; lane: "dev" | "content"; assignee: "z.ai" | "arena";
  status: Status; priority: number; created_by: string; created_at: string;
  approved_by: string | null; approved_at: string | null;
  dispatched_at: string | null; delivered_at: string | null; verified_at: string | null;
  context: string; tasks: Task[]; acceptance: string[]; artifacts: string[];
  links: { pr: string | null; issue: string | null; notes: string | null };
  notes: string;
};
type Registry = { schema: string; version: number; updated_at: string; updated_by: string; blueprints: Blueprint[] };

const STATUS_FA: Record<Status, string> = {
  draft: "✏️ نگارش",
  awaiting_approval: "⏳ در انتظار تأیید مالک",
  approved: "✅ تأییدشده (دیسپچ خودکار)",
  executing: "🔨 در حال اجرا",
  delivered: "📦 تحویل‌شده",
  verified: "🔍 وارسی‌شده",
  done: "🏁 بسته",
  blocked: "⛔ متوقف",
  rejected: "❌ رد",
};

function load(): Registry {
  const r = JSON.parse(readFileSync(REG, "utf8")) as Registry;
  if (r.schema !== "khshab.blueprints/v1") throw new Error(`اسکیمای ناشناخته: ${r.schema}`);
  return r;
}
function save(r: Registry, by: string) {
  r.version += 1;
  r.updated_at = new Date().toISOString();
  r.updated_by = by;
  writeFileSync(REG, JSON.stringify(r, null, 2) + "\n");
}
function find(r: Registry, id: string): Blueprint {
  const bp = r.blueprints.find((b) => b.id.toLowerCase() === id.toLowerCase());
  if (!bp) throw new Error(`نقشهٔ ${id} یافت نشد. موجود: ${r.blueprints.map((b) => b.id).join(", ")}`);
  return bp;
}
function arg(idx: number): string {
  const v = process.argv[idx];
  if (!v) throw new Error("آرگومان ناقص — راهنما: bun scripts/blueprint.ts بدون آرگومان");
  return v;
}
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function now(): string { return new Date().toISOString(); }

function cmdList(r: Registry) {
  console.log(`\n📐 نقشه‌های فنی — نسخهٔ رجیستری ${r.version} (به‌روزرسانی: ${r.updated_at} توسط ${r.updated_by})\n`);
  const rows = [...r.blueprints].sort((a, b) => a.priority - b.priority);
  for (const b of rows) {
    console.log(`${b.id}  ${STATUS_FA[b.status]}  [${b.lane}/${b.assignee}] ${b.title}`);
  }
  const pending = rows.filter((b) => b.status === "awaiting_approval");
  if (pending.length) {
    console.log(`\n⏳ در انتظار تأیید واحد مالک: ${pending.map((b) => b.id).join(" ")}`);
    console.log(`   روی تابلوی مرکزی کامنت بگذارید: «تایید ${pending[0].id}» یا «تایید همه»\n`);
  }
}

function cmdShow(r: Registry, id: string) {
  const b = find(r, id);
  console.log(JSON.stringify(b, null, 2));
}

function cmdApprove(r: Registry, targets: string[], by: string) {
  if (!by) throw new Error("تأیید بدون نام تأییدکننده مجاز نیست: --by «مالک-چت»");
  const all = targets.some((t) => /^(all|همه|همگی)$/i.test(t));
  const list = all ? r.blueprints.filter((b) => b.status === "awaiting_approval") : targets.map((t) => find(r, t));
  if (!list.length) { console.log("چیزی برای تأیید نبود."); return; }
  for (const b of list) {
    if (b.status !== "awaiting_approval" && b.status !== "draft" && b.status !== "rejected") {
      console.log(`⚠️ ${b.id} در وضعیت ${b.status} است — رد شد (فقط awaiting_approval/draft/rejected تأیید می‌گیرد).`);
      continue;
    }
    b.status = "approved";
    b.approved_by = by;
    b.approved_at = now();
    b.dispatched_at = null; // کارگاه‌بان در اسکن بعدی دیسپچ می‌کند
    console.log(`✅ ${b.id} تأیید شد (توسط: ${by})`);
  }
  save(r, `owner-cli:${by}`);
  console.log(`\n💾 رجیستری ذخیره شد (نسخهٔ ${r.version}). حالا: git add blueprints && git commit -m "blueprint: تأیید واحد مالک" && git push origin main`);
}

function cmdSetStatus(r: Registry, id: string, status: Status) {
  const b = find(r, id);
  if (!STATUSES.includes(status)) throw new Error(`وضعیت نامعتبر: ${status} | مجاز: ${STATUSES.join(", ")}`);
  b.status = status;
  if (status === "delivered") b.delivered_at = now();
  if (status === "verified") b.verified_at = now();
  const note = flag("note");
  if (note) b.notes = b.notes ? `${b.notes}\n[${now()}] ${note}` : `[${now()}] ${note}`;
  const pr = flag("pr");
  if (pr) b.links.pr = pr;
  save(r, `agent:${flag("by") ?? process.env.USER ?? "unknown"}`);
  console.log(`✅ ${id} → ${STATUS_FA[status]} (نسخهٔ رجیستری ${r.version}) — کامیت و پوش یادتان نرود.`);
}

function cmdValidate(r: Registry) {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const b of r.blueprints) {
    if (seen.has(b.id)) errors.push(`${b.id}: شناسهٔ تکراری`);
    seen.add(b.id);
    if (!/^BP-\d{3}$/.test(b.id)) errors.push(`${b.id}: قالب شناسه باید BP-\\d{3} باشد`);
    if (!STATUSES.includes(b.status)) errors.push(`${b.id}: وضعیت نامعتبر ${b.status}`);
    if (!["dev", "content"].includes(b.lane)) errors.push(`${b.id}: خط نامعتبر ${b.lane}`);
    if (!["z.ai", "arena"].includes(b.assignee)) errors.push(`${b.id}: مسئول نامعتبر ${b.assignee}`);
    if (!b.title?.trim()) errors.push(`${b.id}: عنوان خالی`);
    if (!Array.isArray(b.tasks) || !b.tasks.length) errors.push(`${b.id}: فهرست کارها خالی`);
    if (!Array.isArray(b.acceptance) || !b.acceptance.length) errors.push(`${b.id}: معیار پذیرش خالی`);
    if (b.status === "approved" && !b.approved_by) errors.push(`${b.id}: تأییدشده بدون نام تأییدکننده`);
  }
  if (errors.length) { console.error("⛔ اعتبارسنجی ناموفق:\n- " + errors.join("\n- ")); process.exit(1); }
  console.log(`✅ رجیستری سالم است — ${r.blueprints.length} نقشه، نسخهٔ ${r.version}`);
}

const cmd = process.argv[2];
const r = load();
try {
  switch (cmd) {
    case "list": cmdList(r); break;
    case "show": cmdShow(r, arg(3)); break;
    case "approve": {
      const targets: string[] = [];
      for (let i = 3; i < process.argv.length && !process.argv[i].startsWith("--"); i++) targets.push(process.argv[i]);
      if (!targets.length) throw new Error("شناسهٔ نقشه لازم است: approve BP-001 [BP-002|all] --by ...");
      cmdApprove(r, targets, flag("by") ?? "");
      break;
    }
    case "set-status": cmdSetStatus(r, arg(3), arg(4) as Status); break;
    case "validate": cmdValidate(r); break;
    default:
      console.log(`استفاده:
  bun scripts/blueprint.ts list
  bun scripts/blueprint.ts show BP-001
  bun scripts/blueprint.ts approve BP-001 [BP-002|all] --by "مالک-چت"
  bun scripts/blueprint.ts set-status BP-001 executing --note "..."
  bun scripts/blueprint.ts validate`);
  }
} catch (e: any) {
  console.error(`⛔ ${e?.message ?? e}`);
  process.exit(1);
}
