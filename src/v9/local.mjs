// The answer, profile state, and outgoing command share one IndexedDB commit.
export function openLocal(indexedDB = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDB) return reject(new Error('حافظهٔ پایدار مرورگر در دسترس نیست.'));
    const request = indexedDB.open('math-game-v9', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('records');
      const outbox = request.result.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      outbox.createIndex('requestId', 'input.requestId', { unique: true });
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('برای ارتقای حافظه، تب‌های دیگر کارگاه را ببندید.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      const transaction = (stores, mode, fn) => new Promise((done, failed) => {
        const tx = db.transaction(stores, mode); let result;
        tx.oncomplete = () => done(result);
        tx.onerror = () => failed(tx.error);
        tx.onabort = () => failed(tx.error || new Error('ذخیره انجام نشد.'));
        try { fn(tx, value => { result = value; }); } catch (error) { tx.abort(); failed(error); }
      });
      resolve({
        get: key => transaction(['records'], 'readonly', (tx, result) => { tx.objectStore('records').get(key).onsuccess = event => result(event.target.result); }),
        put: (key, value) => transaction(['records'], 'readwrite', tx => tx.objectStore('records').put(value, key)),
        enqueue: (key, state, command) => transaction(['records', 'outbox'], 'readwrite', tx => {
          tx.objectStore('records').put(state, key); tx.objectStore('outbox').add(command);
        }),
        pending: uid => transaction(['outbox'], 'readonly', (tx, result) => { tx.objectStore('outbox').getAll().onsuccess = event => result(event.target.result.filter(command => command.uid === uid)); }),
        acknowledge: (command, response, stateKey) => {
          const expected = new Set(command.input.attempts.map(attempt => attempt.eventId));
          if (response.sessionId !== command.input.sessionId || !Array.isArray(response.receipts)
            || response.receipts.length !== expected.size || new Set(response.receipts.map(receipt => receipt.eventId)).size !== expected.size
            || response.receipts.some(receipt => !expected.has(receipt.eventId) || receipt.status !== 'ACKNOWLEDGED' || !Number.isInteger(receipt.revision) || receipt.revision < 1)) {
            return Promise.reject(new Error('رسید پاسخ کامل نیست؛ پاسخ محلی نگهداری شد.'));
          }
          return transaction(['records', 'outbox'], 'readwrite', tx => {
          const store = tx.objectStore('records');
          store.get(stateKey).onsuccess = event => {
            const state = event.target.result;
            if (state?.session?.sessionId === response.sessionId) {
              state.session.receipts ||= {};
              for (const receipt of response.receipts) state.session.receipts[receipt.eventId] = receipt;
              store.put(state, stateKey);
            }
            tx.objectStore('outbox').delete(command.id);
          };
          });
        },
        block: (command, code) => transaction(['outbox'], 'readwrite', tx => tx.objectStore('outbox').put({ ...command, blocked: code })),
        retry: command => transaction(['outbox'], 'readwrite', tx => {
          const retries = (command.retries || 0) + 1;
          tx.objectStore('outbox').put({ ...command, retries, retryAt: Date.now() + Math.min(60000, 1000 * 2 ** Math.min(retries, 6)) + Math.random() * 1000 });
        }),
        close: () => db.close()
      });
    };
  });
}
