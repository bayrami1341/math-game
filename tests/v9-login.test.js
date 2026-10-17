'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('../src/v9/firebase-login.mjs');

test('Google popup opens synchronously from the user gesture with an explicit account choice', async () => {
  const { googleLogin } = await modulePromise;
  const auth = {};
  let opened = false;
  class Provider { setCustomParameters(value) { this.parameters = value; } }
  const promise = googleLogin(auth, {
    GoogleAuthProvider: Provider,
    signInWithPopup(receivedAuth, provider) {
      opened = true;
      assert.equal(receivedAuth, auth);
      assert.deepEqual(provider.parameters, { prompt: 'select_account' });
      return Promise.resolve({ user: { uid: 'firebase-uid' } });
    }
  });
  assert.equal(opened, true);
  assert.equal((await promise).user.uid, 'firebase-uid');
});

test('login errors explain recovery without showing raw provider text or credentials', async () => {
  const { loginError } = await modulePromise;
  for (const [code, expected] of [
    ['auth/popup-blocked', /مسدود/], ['auth/popup-closed-by-user', /بسته/],
    ['auth/unauthorized-domain', /دامنه/], ['auth/operation-not-allowed', /فعال/],
    ['auth/network-request-failed', /اینترنت/], ['auth/too-many-requests', /کمی بعد/],
    ['auth/configuration-not-found', /آماده نیست/], ['auth/invalid-action-code', /معتبر نیست/]
  ]) {
    const message = loginError({ code, message: 'private-token-never-show' });
    assert.match(message, expected);
    assert.ok(!message.includes('private-token'));
  }
  assert.match(loginError(null), /ورود انجام نشد/);
});
