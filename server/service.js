'use strict';
const { createHmac, createHash } = require('node:crypto');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const schema = require('../contracts/v9-phase1-api.schema.json');
const core = require('../src/core/pedagogy');
const { FACTS } = require('../src/core/graph-data');

class ApiError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new ApiError(code); };
const need = (condition, code = 'INVALID_PAYLOAD') => { if (!condition) fail(code); };
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

class Service {
  constructor(store, { secret, now = () => Date.now() }) {
    need(typeof secret === 'string' && secret.length >= 32);
    this.store = store; this.secret = secret; this.now = now;
    const ajv = new Ajv({ strict: true }); addFormats(ajv); ajv.addSchema(schema);
    this.validators = Object.fromEntries(['createClass', 'issueInvite', 'redeemInvite', 'startSession', 'submitAttempts']
      .map(name => [name, ajv.getSchema(schema.$id + '#/$defs/' + name + 'Request')]));
  }
  id(kind, ...parts) { return kind + '_' + createHmac('sha256', this.secret).update(canonical(parts)).digest('hex').slice(0, 40); }
  async call(operation, input, actor) {
    need(actor && typeof actor.uid === 'string', 'UNAUTHENTICATED');
    need(['createClass', 'issueInvite', 'redeemInvite', 'startSession', 'submitAttempts', 'getIdentity', 'getClass', 'setMembership', 'getSyncStatus', 'finalizeSession'].includes(operation));
    if (this.validators[operation]) need(this.validators[operation](input));
    else {
      const runtimeSchema = require('../contracts/v9-runtime-api.schema.json');
      if (!this.runtimeValidators) {
        const ajv = new Ajv({ strict: true }); addFormats(ajv); ajv.addSchema(runtimeSchema);
        this.runtimeValidators = Object.fromEntries(['getIdentity', 'getClass', 'setMembership', 'getSyncStatus', 'finalizeSession'].map(name => [name, ajv.getSchema(runtimeSchema.$id + '#/$defs/' + name + 'Request')]));
      }
      need(this.runtimeValidators[operation](input));
    }
    for (const key of ['classId', 'studentId', 'sessionId', 'requestId']) if (input[key] != null) need(safeId(input[key]));
    return this[operation](input, actor);
  }
  async getIdentity(input, actor) { return { ok: true, uid: actor.uid, teacher: actor.teacher === true }; }
  teacher(actor) { need(actor.teacher === true, 'FORBIDDEN'); }
  async owned(classId, actor) {
    this.teacher(actor);
    const classroom = await this.store.get('classrooms/' + classId);
    need(classroom && classroom.ownerUid === actor.uid, 'FORBIDDEN');
    return classroom;
  }
  async member(classId, studentId, actor) {
    const member = await this.store.get('memberships/' + classId + '/' + studentId);
    need(member && member.uid === actor.uid && member.status === 'active', 'FORBIDDEN');
    return member;
  }
  replay(record, input) { need(record.inputHash === hash(input), 'EVENT_CONFLICT'); }
  async createClass(input, actor) {
    this.teacher(actor); need(input.name.trim().length > 0);
    const classId = this.id('cls', actor.uid, input.requestId);
    const record = await this.store.transact('classrooms/' + classId, old => {
      if (old) { this.replay(old, input); return old; }
      return { schemaVersion: 1, classId, ownerUid: actor.uid, name: input.name.trim(), policy: { leaderboard: 'off', membership: 'invite_confirm', ...input.policy }, revision: 1, inputHash: hash(input) };
    });
    return { ok: true, classId, name: record.name, ownerUid: record.ownerUid, revision: record.revision };
  }
  async issueInvite(input, actor) {
    const classroom = await this.owned(input.classId, actor);
    const expires = input.expiresInSeconds ?? 86400, maxUses = input.maxUses ?? 40;
    need(expires <= 604800 && maxUses <= 100);
    const token = this.id('invite', actor.uid, input.requestId, input.classId);
    const inviteId = this.id('inv', token);
    const record = await this.store.transact('invites/' + hash(token), old => {
      if (old) { this.replay(old, input); return old; }
      return { schemaVersion: 1, inviteId, classId: input.classId, membership: classroom.policy.membership, expiresAt: new Date(this.now() + expires * 1000).toISOString(), maxUses, uses: 0, grants: {}, inputHash: hash(input) };
    });
    // Idempotent issue response always describes the initial issuance.
    return { ok: true, inviteId, token, classId: input.classId, expiresAt: record.expiresAt, maxUses: record.maxUses, uses: 0 };
  }
  async redeemInvite(input, actor) {
    need(input.displayName.trim().length > 0);
    const redemption = this.id('grant', actor.uid, input.requestId);
    const studentId = this.id('stu', actor.uid, input.requestId);
    const invite = await this.store.transact('invites/' + hash(input.token), old => {
      need(old, 'INVITE_EXPIRED');
      if (old.grants && old.grants[redemption]) { this.replay(old.grants[redemption], input); return old; }
      need(Date.parse(old.expiresAt) > this.now() && old.uses < old.maxUses, 'INVITE_EXPIRED');
      old.grants ||= {};
      old.grants[redemption] = { schemaVersion: 1, studentId, classId: old.classId, uid: actor.uid, displayName: input.displayName.trim(), status: old.membership === 'invite_open' ? 'active' : 'pending', inputHash: hash(input), requests: {} };
      old.uses++;
      return old;
    });
    const grant = invite.grants[redemption];
    // A retry repairs interrupted materialization without consuming another use
    // or reverting a teacher's later approval/revocation.
    await this.store.transact('memberships/' + grant.classId + '/' + studentId, old => old || grant);
    return { ok: true, status: grant.status, studentId, classId: grant.classId, displayName: grant.displayName };
  }
  async setMembership(input, actor) {
    await this.owned(input.classId, actor);
    const requestKey = hash(input.requestId);
    const record = await this.store.transact('memberships/' + input.classId + '/' + input.studentId, old => {
      need(old, 'FORBIDDEN'); old.requests ||= {};
      if (old.requests[requestKey]) { this.replay(old.requests[requestKey], input); return old; }
      need(Object.keys(old.requests).length < 200, 'RATE_LIMITED');
      old.status = input.status;
      old.requests[requestKey] = { inputHash: hash(input), response: { ok: true, studentId: old.studentId, status: input.status } };
      return old;
    });
    return record.requests[requestKey].response;
  }
  async startSession(input, actor) {
    await this.member(input.classId, input.studentId, actor);
    const facts = FACTS.filter(fact => fact.sector === input.goal.sectorId);
    need(facts.length > 0);
    const sessionId = this.id('ses', actor.uid, input.requestId);
    const record = await this.store.transact('sessions/' + sessionId, old => {
      if (old) { this.replay(old, input); return old; }
      return { schemaVersion: 1, sessionId, classId: input.classId, studentId: input.studentId, writerUid: actor.uid, writerEpoch: 1, status: 'ACTIVE', rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1', questions: facts.map((f, index) => ({ questionId: 'q-' + (index + 1), f1: f.f1, f2: f.f2 })), revision: 1, events: {}, requests: {}, inputHash: hash(input), createdAt: new Date(this.now()).toISOString() };
    });
    await this.store.transact('sessionIndex/' + record.classId + '/' + sessionId, old => old || { sessionId, studentId: record.studentId, createdAt: record.createdAt });
    return { ok: true, sessionId, classId: record.classId, studentId: record.studentId, status: 'ACTIVE', rulesVersion: record.rulesVersion, questionSetVersion: record.questionSetVersion, writerEpoch: record.writerEpoch, questions: record.questions, revision: 1 };
  }
  async sessionAccess(sessionId, actor, writing = false) {
    const record = await this.store.get('sessions/' + sessionId);
    need(record, 'FORBIDDEN');
    if (!writing && actor.teacher) await this.owned(record.classId, actor);
    else { await this.member(record.classId, record.studentId, actor); need(record.writerUid === actor.uid, 'FORBIDDEN'); }
    return record;
  }
  async submitAttempts(input, actor) {
    await this.sessionAccess(input.sessionId, actor, true);
    need(input.attempts.length <= 50);
    const requestKey = hash(input.requestId);
    const record = await this.store.transact('sessions/' + input.sessionId, old => {
      need(old, 'FORBIDDEN'); old.requests ||= {}; old.events ||= {};
      need(old.writerUid === actor.uid, 'FORBIDDEN');
      need(old.writerEpoch === input.writerEpoch, 'STALE_WRITER');
      if (old.requests[requestKey]) { this.replay(old.requests[requestKey], input); return old; }
      need(Object.keys(old.requests).length < 200, 'RATE_LIMITED');
      const receipts = [];
      for (const attempt of input.attempts) {
        need(safeId(attempt.eventId));
        const eventKey = hash(attempt.eventId), existing = old.events[eventKey];
        if (existing) { this.replay(existing, attempt); receipts.push(existing.receipt); continue; }
        need(old.status === 'ACTIVE');
        const question = old.questions.find(q => q.questionId === attempt.questionId);
        need(question);
        need(!Object.values(old.events).some(event => event.attempt.questionId === attempt.questionId), 'EVENT_CONFLICT');
        need(attempt.responseMs == null || attempt.responseMs <= 3600000);
        need(Number.isFinite(attempt.answer) && Math.abs(attempt.answer) <= 10000);
        const receipt = { eventId: attempt.eventId, status: 'ACKNOWLEDGED', acceptedAt: new Date(this.now()).toISOString(), correct: attempt.answer === question.f1 * question.f2, revision: ++old.revision };
        old.events[eventKey] = { schemaVersion: 1, attempt, question, receipt, inputHash: hash(attempt) };
        receipts.push(receipt);
      }
      const response = { ok: true, sessionId: old.sessionId, receipts, sessionRevision: old.revision };
      old.requests[requestKey] = { inputHash: hash(input), response };
      return old;
    });
    return record.requests[requestKey].response;
  }
  summary(record) {
    const engine = new core.PedagogyEngine(); engine.origin = 'core';
    const events = Object.values(record.events || {}).sort((a, b) => a.receipt.revision - b.receipt.revision);
    for (const event of events) engine.recordAttempt(event.question.f1, event.question.f2, event.attempt.answer, event.receipt.correct, event.attempt.responseMs);
    return { sessionId: record.sessionId, studentId: record.studentId, status: record.status, revision: record.revision, score: events.filter(event => event.receipt.correct).length, answered: events.length, total: record.questions.length, mastery: engine.getReportData() };
  }
  async getSyncStatus(input, actor) {
    const record = await this.sessionAccess(input.sessionId, actor);
    return { ok: true, ...this.summary(record), questions: record.questions, writerEpoch: record.writerEpoch, receipts: Object.values(record.events || {}).map(event => event.receipt) };
  }
  async finalizeSession(input, actor) {
    await this.sessionAccess(input.sessionId, actor, true);
    const requestKey = hash(input.requestId);
    const record = await this.store.transact('sessions/' + input.sessionId, old => {
      need(old, 'FORBIDDEN'); old.requests ||= {}; old.events ||= {};
      need(old.writerUid === actor.uid, 'FORBIDDEN');
      need(old.writerEpoch === input.writerEpoch, 'STALE_WRITER');
      if (old.requests[requestKey]) { this.replay(old.requests[requestKey], input); return old; }
      need(Object.keys(old.requests).length < 200, 'RATE_LIMITED');
      need(Object.keys(old.events).length === old.questions.length);
      if (old.status !== 'FINALIZED') { old.status = 'FINALIZED'; old.revision++; }
      old.requests[requestKey] = { inputHash: hash(input), response: { ok: true, ...this.summary(old) } };
      return old;
    });
    return record.requests[requestKey].response;
  }
  async getClass(input, actor) {
    const classroom = await this.store.get('classrooms/' + input.classId);
    need(classroom, 'FORBIDDEN');
    if (!actor.teacher) {
      need(input.studentId, 'FORBIDDEN');
      const member = await this.store.get('memberships/' + input.classId + '/' + input.studentId);
      need(member && member.uid === actor.uid, 'FORBIDDEN');
      return { ok: true, classId: classroom.classId, name: classroom.name, membershipStatus: member.status };
    }
    await this.owned(input.classId, actor);
    const members = await this.store.list('memberships/' + input.classId, 101);
    const index = await this.store.list('sessionIndex/' + input.classId, 21, 'createdAt');
    const recent = index.slice(-20);
    const sessions = await Promise.all(recent.map(entry => this.store.get('sessions/' + entry.sessionId)));
    return { ok: true, classId: classroom.classId, name: classroom.name, policy: classroom.policy, members: members.slice(-100).map(member => ({ studentId: member.studentId, displayName: member.displayName, status: member.status })), membersTruncated: members.length > 100, sessions: sessions.filter(Boolean).map(record => this.summary(record)), historyTruncated: index.length > 20 };
  }
}
module.exports = { Service, ApiError, hash, safeId };
