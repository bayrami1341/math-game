/* live-board.js — ثبت امتیاز و لیدربرد زنده */
window.LiveBoard = (function () {
  'use strict';

  function db() {
    return window.fbDB || null;
  }

  /** ثبت / به‌روزرسانی امتیاز یک بازیکن */
  function submitScore(roomCode, player) {
    var database = db();
    if (!database || !roomCode || !player || !player.profileId) {
      console.warn('LiveBoard: داده ناقص یا Firebase نیست');
      return Promise.resolve(false);
    }
    var path = 'rooms/' + String(roomCode).trim() + '/scores/' + player.profileId;
    var payload = {
      name: player.name || 'بازیکن',
      avatar: player.avatar || '👤',
      score: Number(player.score) || 0,
      sector: Number(player.sector) || 1,
      updatedAt: Date.now()
    };
    return database.ref(path).set(payload)
      .then(function () {
        console.log('✅ امتیاز ارسال شد', path, payload);
        return true;
      })
      .catch(function (err) {
        console.error('LiveBoard submit error', err);
        return false;
      });
  }

  /** گوش دادن زنده به لیدربرد یک اتاق/کلاس/گروه */
  function listen(roomCode, onUpdate) {
    var database = db();
    if (!database || !roomCode) return function () {};
    var ref = database.ref('rooms/' + String(roomCode).trim() + '/scores');
    var handler = function (snap) {
      var val = snap.val() || {};
      var list = Object.keys(val).map(function (id) {
        return Object.assign({ profileId: id }, val[id]);
      });
      list.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
      if (typeof onUpdate === 'function') onUpdate(list);
    };
    ref.on('value', handler);
    return function unsubscribe() {
      ref.off('value', handler);
    };
  }

  /** پاک کردن امتیازهای یک اتاق (فقط برای تست دمو) */
  function clearRoom(roomCode) {
    var database = db();
    if (!database || !roomCode) return Promise.resolve();
    return database.ref('rooms/' + String(roomCode).trim()).remove();
  }

  return {
    submitScore: submitScore,
    listen: listen,
    clearRoom: clearRoom
  };
})();
