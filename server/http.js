'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { ApiError } = require('./service');

const messages = { UNAUTHENTICATED: 'ورود لازم است.', FORBIDDEN: 'اجازهٔ این کار را ندارید.', INVALID_PAYLOAD: 'اطلاعات درخواست معتبر نیست.', INVITE_EXPIRED: 'دعوت معتبر نیست یا ظرفیت آن تمام شده است.', EVENT_CONFLICT: 'این پاسخ با سابقهٔ ثبت‌شده تفاوت دارد.', STALE_WRITER: 'جلسه در دستگاه دیگری فعال شده است.', RATE_LIMITED: 'کمی صبر کنید و دوباره تلاش کنید.', TEMPORARILY_UNAVAILABLE: 'ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.' };
const statusFor = { UNAUTHENTICATED: 401, FORBIDDEN: 403, INVALID_PAYLOAD: 400, INVITE_EXPIRED: 403, EVENT_CONFLICT: 409, STALE_WRITER: 409, RATE_LIMITED: 429, TEMPORARILY_UNAVAILABLE: 503 };
const rootFiles = new Set(['v9.html', 'v9-config.js', 'index.html', 'home.html', 'join.html', 'leaderboard.html', 'firebase-config.js', 'workshop-core.js', 'storage.js', 'errors.js', 'profile-manager.js', 'social-core.js', 'heroes-core.js', 'live-board.js']);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };

function localAccounts() {
  return [['teacher', 'معلم آزمایشی', true], ['student-a', 'دانش‌آموز اول', false], ['student-b', 'دانش‌آموز دوم', false]]
    .map(([uid, name, teacher]) => ({ uid, name, teacher, token: randomBytes(32).toString('hex') }));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [], exceeded = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 65536) { exceeded = true; chunks = []; reject(new ApiError('INVALID_PAYLOAD')); }
      else if (!exceeded) chunks.push(chunk);
    });
    req.on('end', () => { if (!exceeded) { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new ApiError('INVALID_PAYLOAD')); } } });
    req.on('error', reject);
  });
}

function createServer({ service, authenticate, mode, root, allowedOrigins = [], accounts = [] }) {
  if (!['local', 'production'].includes(mode)) throw new Error('Explicit server mode required');
  if (mode === 'production' && accounts.length) throw new Error('Development accounts forbidden in production');
  const buckets = new Map();
  function rateLimit(key, limit) {
    const now = Date.now();
    if (buckets.size > 10000) for (const [key, value] of buckets) if (value.until < now) buckets.delete(key);
    if (buckets.size > 10000) throw new ApiError('RATE_LIMITED');
    let bucket = buckets.get(key);
    if (!bucket || bucket.until < now) { bucket = { count: 0, until: now + 60000 }; buckets.set(key, bucket); }
    if (++bucket.count > limit) throw new ApiError('RATE_LIMITED');
  }
  return http.createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const host = req.headers.host || '';
      if (mode === 'local' && !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new ApiError('FORBIDDEN');
      const sameOrigin = `${mode === 'local' ? 'http' : 'https'}://${host}`;
      const origin = req.headers.origin;
      if (origin && origin !== sameOrigin && (mode === 'local' || !allowedOrigins.includes(origin))) throw new ApiError('FORBIDDEN');
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }); return res.end();
      }
      const url = new URL(req.url, sameOrigin);
      if (url.pathname.startsWith('/api/')) rateLimit('ip:' + req.socket.remoteAddress, 300);
      if (req.method === 'GET' && url.pathname === '/api/v9/meta') return send(200, { ok: true, mode, contractVersion: '9.0.3-entry-preview' });
      if (req.method === 'GET' && url.pathname === '/api/dev/accounts' && mode === 'local') return send(200, { ok: true, accounts });
      if (req.method === 'POST' && /^\/api\/v9\/[A-Za-z]+$/.test(url.pathname)) {
        if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new ApiError('INVALID_PAYLOAD');
        const token = (req.headers.authorization || '').match(/^Bearer (\S+)$/)?.[1];
        if (!token) throw new ApiError('UNAUTHENTICATED');
        let actor;
        try { actor = await authenticate(token); } catch { throw new ApiError('UNAUTHENTICATED'); }
        if (!actor) throw new ApiError('UNAUTHENTICATED');
        const operation = url.pathname.split('/').at(-1);
        rateLimit('uid:' + actor.uid, ['redeemInvite', 'joinStudentClass', 'createStudent'].includes(operation) ? 20 : 120);
        const input = await readJson(req);
        return send(200, await service.call(operation, input, actor));
      }
      if (req.method !== 'GET') return send(404, { ok: false, error: { code: 'INVALID_PAYLOAD' } });
      let file = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'v9.html';
      if (!rootFiles.has(file) && !/^(src|styles|assets)\/[A-Za-z0-9_./-]+$/.test(file)) return send(404, { ok: false });
      if (file.split('/').some(part => part.startsWith('.'))) return send(404, { ok: false });
      const absolute = path.resolve(root, file);
      if (!absolute.startsWith(path.resolve(root) + path.sep)) return send(404, { ok: false });
      const ext = path.extname(file);
      if (!mime[ext]) return send(404, { ok: false });
      const data = await fs.readFile(absolute);
      res.writeHead(200, { 'Content-Type': mime[ext] }); res.end(data);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EISDIR') return send(404, { ok: false });
      const code = error instanceof ApiError ? error.code : 'TEMPORARILY_UNAVAILABLE';
      send(statusFor[code] || 503, { ok: false, error: { code, message: messages[code] } });
    }
  });
}
module.exports = { createServer, localAccounts };
