import { spawn } from "node:child_process";
import net from "node:net";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FOREMAN_DIR = "/home/z/my-project/mini-services/foreman";
const PORT = 3030;

let lastSpawnAt = 0;

/** پورت 3030 زنده است؟ (پروب TCP سبک — بدون spawnSync) */
function probePort(port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: "127.0.0.1" });
    const done = (ok: boolean) => { try { sock.destroy(); } catch {} resolve(ok); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}

/**
 * GET /api/foreman-boot — نگه‌دارندهٔ حیات کارگاه‌بان.
 * اگر کارگاه‌بان (پورت 3030) زنده باشد کاری نمی‌کند؛ وگرنه آن را به‌عنوان
 * فرزند همین پروسهٔ Next بالا می‌آورد (درخت پروسهٔ امن سندباکس) و اگر بمیرد،
 * فراخوانی بعدی دوباره برمی‌گرداندش. spawn محدود به مسیر ثابت و بدون هیچ پارامتری.
 */
export async function GET() {
  const alive = await probePort(PORT);
  if (alive) {
    return NextResponse.json({ ok: true, alive: true, note: "کارگاه‌بان روی 3030 زنده است" });
  }
  const now = Date.now();
  if (now - lastSpawnAt < 8_000) {
    return NextResponse.json({ ok: true, alive: false, spawning: false, note: "اسپاون اخیر انجام شد — منتظر بالا آمدن" });
  }
  lastSpawnAt = now;
  try {
    const child = spawn("bun", ["run", "start"], {
      cwd: FOREMAN_DIR,
      stdio: "ignore",
      env: { ...process.env, FOREMAN_PARENT: "next-api-boot" },
    });
    child.on("error", () => { /* در فراخوانی بعدی تلاش می‌شود */ });
    // چند لحظه صبر تا پورت بالا بیاید
    await new Promise((r) => setTimeout(r, 2500));
    const up = await probePort(PORT);
    return NextResponse.json({ ok: true, alive: up, spawned: true, pid: child.pid ?? null, note: up ? "کارگاه‌بان بالا آمد (فرزند Next)" : "اسپاون شد — بالا آمدن کامل نیست، دوباره فراخوانی کنید" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
