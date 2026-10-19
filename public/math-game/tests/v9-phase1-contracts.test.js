'use strict';

// Contract shape checks only. No server, credentials, or live database is used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const schema = JSON.parse(read('contracts/v9-phase1-api.schema.json'));
const ajv = new Ajv2020({ strict: true, allErrors: true, validateFormats: true });
addFormats(ajv);
ajv.addSchema(schema);
const validate = name => {
  const validator = ajv.getSchema(`${schema.$id}#/$defs/${name}`);
  assert.ok(validator, `Missing schema: ${name}`);
  return validator;
};
const check = (name, payload, expected = true) => {
  const validator = validate(name);
  const before = JSON.stringify(payload);
  assert.equal(validator(payload), expected, JSON.stringify(validator.errors));
  assert.equal(JSON.stringify(payload), before, 'Validation must not mutate the payload');
};
const copy = data => structuredClone(data);
const base = { schemaVersion: 1, requestId: 'req_test_001' };
const samples = {
  createClass: { ...base, name: 'کلاس سوم', policy: { leaderboard: 'off', membership: 'invite_confirm' } },
  issueInvite: { ...base, classId: 'cls_001', expiresInSeconds: 86400, maxUses: 40 },
  redeemInvite: { ...base, token: 'sample-token-not-a-real-secret', displayName: 'مینا' },
  startSession: { ...base, classId: 'cls_001', studentId: 'stu_001', goal: { type: 'sector', sectorId: 1 } },
  submitAttempts: {
    ...base, sessionId: 'ses_001', writerEpoch: 1,
    attempts: [{ eventId: 'evt_test_001', questionId: 'q-01', answer: 4, responseMs: 3200, clientOccurredAt: '2026-10-16T08:30:00Z' }]
  }
};

test('schema compiles strictly as draft 2020-12, including all payload definitions', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  for (const name of Object.keys(schema.$defs)) validate(name);
  assert.ok(ajv.getSchema(schema.$id));
});

for (const [operation, sample] of Object.entries(samples)) {
  test(`${operation}: accepts the documented request`, () => check(`${operation}Request`, sample));
  test(`${operation}: rejects non-object values and missing required fields`, () => {
    for (const payload of [null, [], 'invalid', 1, true]) check(`${operation}Request`, payload, false);
    for (const field of schema.$defs[`${operation}Request`].required) {
      const payload = copy(sample);
      delete payload[field];
      check(`${operation}Request`, payload, false);
    }
  });
  test(`${operation}: rejects client-controlled result, identity, and role fields`, () => {
    for (const [field, value] of Object.entries({ score: 99, mastery: 5, acceptedAt: '2026-10-16T08:30:00Z', role: 'teacher', ownerUid: 'other-user', typoField: true })) {
      check(`${operation}Request`, { ...sample, [field]: value }, false);
    }
  });
  test(`${operation}: rejects unsupported versions and short request IDs`, () => {
    for (const version of [0, 2, '1']) check(`${operation}Request`, { ...sample, schemaVersion: version }, false);
    check(`${operation}Request`, { ...sample, requestId: 'short' }, false);
  });
}

test('every JSON example in the contract validates against its operation-specific schema', () => {
  const text = read('docs/v9-phase1-contracts.md');
  let exampleCount = 0;
  for (const section of text.split(/(?=^### ۴\.)/mu)) {
    const operation = section.match(/^### ۴\.[۱-۵] `([^`]+)`/mu)?.[1];
    if (!operation) continue;
    for (const match of section.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)) {
      const example = JSON.parse(match[1]);
      check(`${operation}${example.ok === true ? 'Response' : 'Request'}`, example);
      exampleCount++;
    }
  }
  assert.equal(exampleCount, 11, 'Five requests and six success examples, including pending membership');
});

test('membership accepts pending and active, but no implicit access or member disclosure', () => {
  const response = { ok: true, status: 'pending', studentId: 'stu_001', classId: 'cls_001', displayName: 'مینا' };
  check('redeemInviteResponse', response);
  check('redeemInviteResponse', { ...response, status: 'active' });
  check('redeemInviteResponse', { ...response, status: 'approved' }, false);
  check('redeemInviteResponse', { ...response, members: [{ studentId: 'other-child' }] }, false);
  const missingStatus = copy(response);
  delete missingStatus.status;
  check('redeemInviteResponse', missingStatus, false);
});

test('policy preserves both locked membership choices and leaderboard-off annotation', () => {
  for (const membership of ['invite_confirm', 'invite_open']) {
    check('createClassRequest', { ...samples.createClass, policy: { membership, leaderboard: 'off' } });
  }
  const withoutPolicy = { ...base, name: 'کلاس سوم' };
  check('createClassRequest', withoutPolicy);
  assert.equal(schema.$defs.createClassRequest.properties.policy.properties.leaderboard.default, 'off');
  assert.equal(withoutPolicy.policy, undefined, 'The server, not the validator, applies defaults');
  check('createClassRequest', { ...withoutPolicy, policy: { membership: 'public' } }, false);
});

test('invites reject invalid lifetimes, usage counts, and empty identity fields', () => {
  for (const expiresInSeconds of [59, -1, 60.5, '86400']) check('issueInviteRequest', { ...samples.issueInvite, expiresInSeconds }, false);
  for (const maxUses of [0, -1, 1.5, '40']) check('issueInviteRequest', { ...samples.issueInvite, maxUses }, false);
  check('issueInviteRequest', { ...samples.issueInvite, classId: '' }, false);
  check('redeemInviteRequest', { ...samples.redeemInvite, token: 'abc' }, false);
  check('redeemInviteRequest', { ...samples.redeemInvite, displayName: 'x'.repeat(41) }, false);
});

test('sessions reject unspecified goals, invalid sectors, and empty student identity', () => {
  for (const goal of [{}, { type: 'free' }, { type: 'sector', sectorId: 0 }, { type: 'sector', sectorId: 1, score: 99 }]) {
    check('startSessionRequest', { ...samples.startSession, goal }, false);
  }
  check('startSessionRequest', { ...samples.startSession, studentId: '' }, false);
});

test('attempt batches reject empty batches, invalid epochs, and nested forged fields', () => {
  check('submitAttemptsRequest', { ...samples.submitAttempts, attempts: [] }, false);
  for (const writerEpoch of [0, -1, 1.5, '1']) check('submitAttemptsRequest', { ...samples.submitAttempts, writerEpoch }, false);
  for (const field of ['score', 'mastery', 'acceptedAt', 'role', 'studentId']) {
    const payload = copy(samples.submitAttempts);
    payload.attempts[0][field] = 99;
    check('submitAttemptsRequest', payload, false);
  }
});

test('attempts enforce numeric answers, valid timestamps, and nonnegative integer timing', () => {
  const attempt = samples.submitAttempts.attempts[0];
  check('attempt', { eventId: 'evt_test_002', questionId: 'q-02', answer: 6 });
  for (const invalid of [{ answer: '4' }, { responseMs: -1 }, { responseMs: 1.5 }, { clientOccurredAt: 'not-a-date' }, { clientOccurredAt: '2026-02-30T08:30:00Z' }, { eventId: 'short' }, { questionId: '' }]) {
    check('attempt', { ...attempt, ...invalid }, false);
  }
});

test('receipts require server time, correctness, acknowledged state, and positive revisions', () => {
  const receipt = { eventId: 'evt_test_001', status: 'ACKNOWLEDGED', acceptedAt: '2026-10-16T08:30:01Z', correct: true, revision: 2 };
  check('receipt', receipt);
  for (const invalid of [{ acceptedAt: 'invalid' }, { status: 'PENDING' }, { correct: 'true' }, { revision: 0 }]) check('receipt', { ...receipt, ...invalid }, false);
  for (const field of ['acceptedAt', 'correct', 'revision']) {
    const payload = { ...receipt };
    delete payload[field];
    check('receipt', payload, false);
  }
});

test('error response permits only the eight locked codes and a public message', () => {
  for (const code of schema.$defs.errorCode.enum) check('apiError', { ok: false, error: { code, message: 'درخواست انجام نشد' } });
  for (const payload of [{ ok: false }, { ok: true, error: { code: 'FORBIDDEN' } }, { ok: false, error: { code: 'INTERNAL_SECRET', stack: 'private details' } }]) check('apiError', payload, false);
});

test('locked decisions and schema revision remain explicit in the published documents', () => {
  const locked = read('docs/v9-phase1-locked.md');
  for (const value of ['firebase_email_link', 'cloud_functions_or_equivalent', 'invite_confirm', 'invite_open', 'leaderboardDefault: off', '9.0.1-phase1']) assert.ok(locked.includes(value), value);
  assert.ok(schema.$comment.includes('9.0.1-phase1'));
  assert.ok(schema.$comment.includes('artifactRevision: 1.0.1'));
});
