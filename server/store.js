'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const clone = value => value == null ? null : structuredClone(value);

// Local development only. The promise queue also serializes atomic file replacement.
class LocalStore {
  constructor(file = null) { this.file = file; this.data = {}; this.queue = Promise.resolve(); }
  async open() {
    if (this.file) {
      try { this.data = JSON.parse(await fs.readFile(this.file, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return this;
  }
  async get(key) { await this.queue; return clone(this.data[key]); }
  async list(prefix, limit = 100, orderBy = null) {
    await this.queue;
    return Object.entries(this.data).filter(([key]) => key.startsWith(prefix + '/'))
      .sort(([a, av], [b, bv]) => orderBy ? String(av[orderBy]).localeCompare(String(bv[orderBy])) || a.localeCompare(b) : a.localeCompare(b)).slice(-limit).map(([, value]) => clone(value));
  }
  async transact(key, change) {
    const operation = this.queue.then(async () => {
      const next = change(clone(this.data[key]));
      const draft = { ...this.data, [key]: clone(next) };
      if (this.file) {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.writeFile(this.file + '.tmp', JSON.stringify(draft), { mode: 0o600 });
        await fs.rename(this.file + '.tmp', this.file);
      }
      this.data = draft;
      return clone(next);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}

class FirebaseStore {
  constructor(database) { this.database = database; }
  async get(key) { return (await this.database.ref('v9/' + key).get()).val(); }
  async list(prefix, limit = 100, orderBy = null) {
    const ref = this.database.ref('v9/' + prefix);
    const snapshot = await (orderBy ? ref.orderByChild(orderBy) : ref.orderByKey()).limitToLast(limit).get();
    const values = []; snapshot.forEach(child => { values.push(child.val()); });
    return values;
  }
  async transact(key, change) {
    let failure;
    const result = await this.database.ref('v9/' + key).transaction(current => {
      try { failure = undefined; return change(clone(current)); }
      // The SDK may first invoke an updater with an empty local cache. A null
      // proposal allows the server to retry with its actual value; no stale
      // record is copied back. A genuinely absent record remains null.
      catch (error) { failure = error; return current === null ? null : undefined; }
    }, undefined, false);
    if (failure) throw failure;
    if (!result.committed) throw new Error('Transaction aborted');
    return result.snapshot.val();
  }
}

module.exports = { LocalStore, FirebaseStore };
