'use strict';
// Read-only release checks: never creates a user, class, session or database row.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function checkRelease({ config, fetcher = fetch }) {
  const checks = [];
  function record(name, passed, detail) { checks.push({ name, passed, detail }); }
  let base;
  try {
    base = new URL(config.apiBase);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error();
  } catch {
    record('public-api', false, 'نشانی API عمومی HTTPS در v9-config.js تنظیم نشده یا معتبر نیست.');
    return { ok: false, checks };
  }
  const origin = 'https://bayrami1341.github.io';
  async function probe(name, route, options, verify, detail) {
    try {
      const response = await fetcher(base.origin + route, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
      record(name, await verify(response), detail);
    } catch { record(name, false, 'سرور پاسخ معتبر نداد؛ اتصال، HTTPS یا تنظیمات میزبان را بررسی کنید.'); }
  }
  await probe('production-mode', '/api/v9/meta', {}, async res => {
    const meta = await res.json(); return res.status === 200 && meta.ok === true && meta.mode === 'production' && meta.contractVersion === '9.0.3-entry-preview';
  }, 'API باید حالت production و قرارداد فعلی نسخهٔ ۹ را اعلام کند.');
  await probe('no-development-accounts', '/api/dev/accounts', {}, async res => {
    const body = await res.json(); return res.status === 404 && !Object.hasOwn(body, 'accounts');
  }, 'حساب‌های آزمایشی محلی نباید در تولید در دسترس باشند.');
  await probe('authentication-required', '/api/v9/getTeacherClasses', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ schemaVersion: 1 })
  }, async res => res.status === 401 && (await res.json()).error?.code === 'UNAUTHENTICATED',
  'عملیات معلم بدون ورود باید با 401 رد شود.');
  await probe('github-pages-cors', '/api/v9/getTeacherClasses', {
    method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }
  }, async res => res.status === 204 && res.headers.get('access-control-allow-origin') === origin &&
    (res.headers.get('access-control-allow-headers') || '').toLowerCase().includes('authorization'),
  'سرور باید درخواست رابط GitHub Pages را بپذیرد.');
  return { ok: checks.every(check => check.passed), checks };
}

if (require.main === module) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../v9-config.js'), 'utf8'), context);
  const config = context.window.MathGameV9Config;
  const args = process.argv.slice(2);
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--api') { console.error('Usage: npm run check:v9:release -- [--api https://your-api.example]'); process.exitCode = 1; }
    else config.apiBase = args[1];
  }
  if (!process.exitCode) checkRelease({ config }).then(result => {
    for (const check of result.checks) console.log(`${check.passed ? 'PASS' : 'BLOCKED'} ${check.name}: ${check.detail}`);
    console.log('این بررسی جای آزمون ورود واقعی، Firebase و دو دستگاه را نمی‌گیرد.');
    if (!result.ok) process.exitCode = 1;
  }).catch(() => { console.error('Release check failed'); process.exitCode = 1; });
}
module.exports = { checkRelease };
