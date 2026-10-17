'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { Service } = require('./service');
const { LocalStore, FirebaseStore } = require('./store');
const { createServer, localAccounts } = require('./http');
const { productionConfig, isTeacher } = require('./production-config');

async function main() {
  const local = process.argv.includes('--local');
  const mode = local ? 'local' : 'production';
  const root = path.resolve(__dirname, '..');
  let secret = process.env.MATH_GAME_ID_SECRET, store, authenticate, accounts = [], allowedOrigins = [];
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
    const config = productionConfig(process.env);
    allowedOrigins = config.allowedOrigins;
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const { getDatabase } = require('firebase-admin/database');

    // ساخت آبجکت credential از متغیرهای محیطی Railway
  const serviceAccount = {
  project_id: config.projectId,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key: process.env.FIREBASE_PRIVATE_KEY_BASE64 
    ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8') 
    : undefined,
};

    const app = initializeApp({ 
      credential: cert(serviceAccount), 
      projectId: config.projectId, 
      databaseURL: config.databaseURL 
    });
    store = new FirebaseStore(getDatabase(app));
    await store.get('system/readiness');
    authenticate = async token => {
      const claims = await getAuth(app).verifyIdToken(token, true);
      return { uid: claims.uid, teacher: isTeacher(claims, config) };
    };
  }
  const server = createServer({ service: new Service(store, { secret }), authenticate, mode, root, accounts,
    allowedOrigins });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  const port = Number(process.env.PORT || 9090);
  server.listen(port, local ? '127.0.0.1' : '0.0.0.0', () => console.log(`Math Workshop v9 ${mode}: http://127.0.0.1:${port}/v9.html`));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
