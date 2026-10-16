'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Service } = require('./service');
const { LocalStore, FirebaseStore } = require('./store');
const { createServer, localAccounts } = require('./http');

async function main() {
  const local = process.argv.includes('--local');
  const mode = local ? 'local' : 'production';
  const root = path.resolve(__dirname, '..');
  let secret = process.env.MATH_GAME_ID_SECRET, store, authenticate, accounts = [];
  if (local) {
    const directory = path.join(root, '.local', 'v9');
    await fs.mkdir(directory, { recursive: true });
    const secretPath = path.join(directory, 'id-secret');
    try { secret = await fs.readFile(secretPath, 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      secret = randomBytes(32).toString('hex'); await fs.writeFile(secretPath, secret, { mode: 0o600, flag: 'wx' });
    }
    store = await new LocalStore(path.join(directory, 'data.json')).open();
    accounts = localAccounts();
    authenticate = async token => accounts.find(account => account.token === token) || null;
  } else {
    if (!secret || secret.length < 32) throw new Error('MATH_GAME_ID_SECRET (32+ characters) is required');
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIREBASE_DATABASE_EMULATOR_HOST) throw new Error('Production entry point refuses emulator environment variables');
    if (!process.env.FIREBASE_DATABASE_URL) throw new Error('FIREBASE_DATABASE_URL is required');
    const { initializeApp, applicationDefault } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const { getDatabase } = require('firebase-admin/database');
    const app = initializeApp({ credential: applicationDefault(), databaseURL: process.env.FIREBASE_DATABASE_URL });
    store = new FirebaseStore(getDatabase(app));
    const teachers = new Set((process.env.MATH_GAME_TEACHER_UIDS || '').split(',').map(uid => uid.trim()).filter(Boolean));
    authenticate = async token => {
      const claims = await getAuth(app).verifyIdToken(token, true);
      return { uid: claims.uid, teacher: claims.teacher === true || teachers.has(claims.uid) };
    };
  }
  const server = createServer({ service: new Service(store, { secret }), authenticate, mode, root, accounts,
    allowedOrigins: (process.env.MATH_GAME_ALLOWED_ORIGINS || '').split(',').filter(Boolean) });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  const port = Number(process.env.PORT || 9090);
  server.listen(port, local ? '127.0.0.1' : '0.0.0.0', () => console.log(`Math Workshop v9 ${mode}: http://127.0.0.1:${port}/v9.html`));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
