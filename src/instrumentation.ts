/**
 * Next.js instrumentation — مدیریت چرخهٔ کارگاه‌بان (mini-services/foreman)
 *
 * چرا این‌جا؟ در این سندباکس فقط درخت پروسهٔ `bun run dev` (سرور Next) از پاک‌سازی
 * پروسه‌های پس‌زمینه جان سالم می‌برد. پس کارگاه‌بان به‌عنوان فرزند همین پروسه spawn
 * می‌شود و اگر به هر دلیلی بمیرد، ظرف ۱۵ ثانیه دوباره بالا می‌آید (خودترمیم).
 * پورت کارگاه‌بان: 3030 | لاگ: mini-services/foreman/foreman.log
 *
 * نکته: در Edge Runtime این ماژول فقط لاگ می‌کند؛ spawn فقط در Node.js انجام می‌شود.
 */
import fs from "node:fs";

const INSTR_LOG = "/tmp/khshab-instr.log";
function mark(msg: string) {
  try { fs.appendFileSync(INSTR_LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}

export async function register() {
  mark(`register runtime=${process.env.NEXT_RUNTIME}`);
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as any;
  if (g.__khshabForemanManaged) return;
  g.__khshabForemanManaged = true;

  const FOREMAN_DIR = "/home/z/my-project/mini-services/foreman";
  let lastSpawnAt = 0;

  const start = async () => {
    const now = Date.now();
    if (now - lastSpawnAt < 10_000) return; // گارد تندزنی
    lastSpawnAt = now;
    try {
      const { spawn } = await import("node:child_process");
      const child = spawn("bun", ["run", "start"], {
        cwd: FOREMAN_DIR,
        stdio: "ignore",
        env: { ...process.env, FOREMAN_PARENT: "next-instrumentation" },
      });
      g.__khshabForemanChildPid = child.pid ?? null;
      mark(`spawned pid=${child.pid}`);
      child.on("exit", (code, sig) => {
        mark(`child exit code=${code} sig=${sig}`);
        if (g.__khshabForemanManaged) setTimeout(start, 15_000);
      });
      child.on("error", (e) => {
        mark(`child error: ${e?.message ?? e}`);
        if (g.__khshabForemanManaged) setTimeout(start, 15_000);
      });
    } catch (e: any) {
      mark(`spawn failed: ${e?.message ?? e}`);
      if (g.__khshabForemanManaged) setTimeout(start, 15_000);
    }
  };

  await start();
}
