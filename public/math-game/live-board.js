/* live-board.js — ثبت امتیاز و لیدربرد زنده */
window.LiveBoard = (function () {
  'use strict';

  function db() {
    return window.fbDB || null;
  }

  // Keep the result and its classroom identity fixed while a write is pending.
  function publishResult(result, score, statusId) {
    var status = document.getElementById(statusId);
    function message(text, retry) {
      if (!status) return;
      status.textContent = text;
      if (retry) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'تلاش دوباره';
        button.addEventListener('click', function () { publishResult(result, score, statusId); });
        status.appendChild(button);
      }
    }
    if (result.liveScoreSent) return Promise.resolve(true);
    if (result.liveScorePending) return result.liveScorePromise;
    try {
      if (!result.liveSubmission) {
        var room = localStorage.getItem('demo_class_code');
        if (!room) {
          message('برای ثبت در لیدربرد، ابتدا از «ورود به کلاس» با کد معلم وارد شوید.');
          return Promise.resolve(false);
        }
        if (!/^[0-9]{6}$/.test(room)) throw new Error('Invalid classroom code');
        var id = localStorage.getItem('demo_player_id');
        if (!id || !/^p_[A-Za-z0-9-]{8,100}$/.test(id)) {
          id = 'p_' + ((window.crypto && window.crypto.randomUUID)
            ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
          localStorage.setItem('demo_player_id', id);
        }
        result.liveSubmission = { room: room, player: {
          profileId: id,
          name: localStorage.getItem('demo_student_name') || score.name || 'بازیکن',
          avatar: score.avatar || '👤', score: score.score, sector: score.sector
        } };
      }
      result.liveScorePending = true;
      message('در انتظار تأیید ثبت امتیاز در کلاس ' + result.liveSubmission.room + '؛ تا تأیید، صفحه را باز نگه دارید.');
      result.liveScorePromise = submitScore(result.liveSubmission.room, result.liveSubmission.player)
        .then(function (sent) {
          result.liveScorePending = false;
          result.liveScoreSent = sent;
          message(sent ? 'امتیاز ' + score.score + ' در لیدربرد کلاس ' + result.liveSubmission.room + ' ثبت شد.'
            : 'امتیاز ارسال نشد؛ اتصال اینترنت و دسترسی Firebase را بررسی کنید. ', !sent);
          return sent;
        });
      return result.liveScorePromise;
    } catch (err) {
      result.liveScorePending = false;
      result.liveScoreSent = false;
      message('ثبت امتیاز ممکن نشد؛ اطلاعات ورود و ذخیره‌سازی مرورگر را بررسی کنید. ', true);
      return Promise.resolve(false);
    }
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
  function listen(roomCode, onUpdate, onError, onConnection) {
    var database = db();
    if (!database || !roomCode) {
      if (typeof onError === 'function') onError(new Error('Firebase آماده نیست یا کد کلاس وارد نشده است.'));
      return function () {};
    }
    var ref = database.ref('rooms/' + String(roomCode).trim() + '/scores');
    var handler = function (snap) {
      var val = snap.val() || {};
      var list = Object.keys(val).map(function (id) {
        return Object.assign({ profileId: id }, val[id]);
      });
      list.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
      if (typeof onUpdate === 'function') onUpdate(list);
    };
    ref.on('value', handler, function (err) {
      console.error('LiveBoard listen error', err);
      if (typeof onError === 'function') onError(err);
    });
    var connectionRef = null;
    var connectionHandler = function (snap) { onConnection(snap.val() === true); };
    if (typeof onConnection === 'function') {
      connectionRef = database.ref('.info/connected');
      connectionRef.on('value', connectionHandler);
    }
    return function unsubscribe() {
      ref.off('value', handler);
      if (connectionRef) connectionRef.off('value', connectionHandler);
    };
  }

  /** پاک کردن امتیازهای یک اتاق (فقط برای تست دمو) */
  function clearRoom(roomCode) {
    var database = db();
    if (!database || !roomCode) return Promise.resolve();
    return database.ref('rooms/' + String(roomCode).trim()).remove();
  }

  return {
    publishResult: publishResult,
    submitScore: submitScore,
    listen: listen,
    clearRoom: clearRoom
  };
})();
