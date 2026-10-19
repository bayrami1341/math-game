'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { LocalStore } = require('../server/store');
const { Service } = require('../server/service');
const { createServer } = require('../server/http');
const { checkRelease } = require('../scripts/check-v9-release.cjs');

test('release check refuses missing, insecure or credential-bearing API URLs without network access', async () => {
  for (const apiBase of ['', 'http://localhost:9090', 'https://user:secret@example.com', 'https://example.com/api', 'https://example.com/?token=x']) {
    const result = await checkRelease({ config: { apiBase }, fetcher: () => assert.fail('Invalid URL must not be fetched') });
    assert.equal(result.ok, false); assert.equal(result.checks[0].name, 'public-api');
  }
});

test('release check verifies the actual production HTTP handler without privileged writes', async t => {
  const store = await new LocalStore().open();
  const server = createServer({ service: new Service(store, { secret: 'release-test-'.repeat(4) }), mode: 'production',
    root: path.resolve(__dirname, '..'), allowedOrigins: ['https://bayrami1341.github.io'],
    authenticate: async () => assert.fail('Probe must not provide a token') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const result = await checkRelease({ config: { apiBase: 'https://api.example.com' },
    fetcher: (url, options) => fetch(base + new URL(url).pathname, options) });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.checks.length, 4);
  assert.deepEqual(store.data, {});
});

test('release check cannot accept an HTML error page, a local server or a network failure', async () => {
  for (const fetcher of [
    async () => new Response('<html>Error</html>', { status: 200 }),
    async () => Response.json({ ok: true, mode: 'local', accounts: [] }),
    async () => { throw new Error('network'); }
  ]) {
    const result = await checkRelease({ config: { apiBase: 'https://api.example.com' }, fetcher });
    assert.equal(result.ok, false);
    assert.equal(result.checks[0].passed, false);
  }
});
