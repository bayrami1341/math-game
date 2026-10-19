'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { productionConfig, isTeacher } = require('../server/production-config');
const env = { FIREBASE_PROJECT_ID: 'class-board-2752e', FIREBASE_DATABASE_URL: 'https://class-board-2752e-default-rtdb.europe-west1.firebasedatabase.app', MATH_GAME_ID_SECRET: 'test-secret-'.repeat(4), MATH_GAME_ALLOWED_ORIGINS: 'https://bayrami1341.github.io', MATH_GAME_TEACHER_EMAILS: 'bayrami1341@gmail.com' };
test('production configuration binds the database to the intended project', () => {
  assert.equal(productionConfig(env).projectId, 'class-board-2752e');
  for (const url of ['https://math-game-live-default-rtdb.firebaseio.com', 'http://class-board-2752e.firebaseio.com', 'https://class-board-2752e.firebaseio.com/?token=x', 'https://class-board-2752e.firebaseio.com/v9', 'https://class-board-2752e.firebaseio.com.attacker.example']) {
    assert.throws(() => productionConfig({ ...env, FIREBASE_DATABASE_URL: url }));
  }
  assert.throws(() => productionConfig({ ...env, FIREBASE_DATABASE_EMULATOR_HOST: 'localhost:9000' }));
  assert.throws(() => productionConfig({ ...env, MATH_GAME_ID_SECRET: '' }));
  assert.throws(() => productionConfig({ ...env, FIREBASE_PROJECT_ID: '' }));
});
test('a verified email from the server allowlist can be a teacher; client or unverified claims cannot', () => {
  const config = productionConfig(env);
  assert.equal(isTeacher({ uid: 'owner', email: 'Bayrami1341@gmail.com', email_verified: true }, config), true);
  for (const claims of [{ uid: 'student' }, { uid: 'student', teacher: 'true' }, { uid: 'student', email: 'bayrami1341@gmail.com' }, { uid: 'student', email: 'bayrami1341@gmail.com', email_verified: false }, { uid: 'student', email: 'other@gmail.com', email_verified: true }]) assert.equal(isTeacher(claims, config), false);
  assert.equal(isTeacher({ uid: 'explicit', teacher: true }, config), true);
});
test('CORS configuration rejects HTTP, wildcard and URL paths', () => {
  for (const origin of ['*', 'http://bayrami1341.github.io', 'https://bayrami1341.github.io/math-game/', 'https://user:pass@example.com']) assert.throws(() => productionConfig({ ...env, MATH_GAME_ALLOWED_ORIGINS: origin }));
});
