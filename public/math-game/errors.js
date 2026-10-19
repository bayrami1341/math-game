(function (global) {
  'use strict';
  function خطای_برنامه(پیام, کد, جزئیات) {
    this.name = 'خطای_برنامه';
    this.message = پیام || 'خطای نامشخص';
    this.code = کد || 'UNKNOWN';
    this.details = جزئیات || null;
    this.timestamp = new Date().toISOString();
    if (Error.captureStackTrace) { Error.captureStackTrace(this, خطای_برنامه); }
    else { this.stack = (new Error()).stack; }
  }
  خطای_برنامه.prototype = Object.create(Error.prototype);
  خطای_برنامه.prototype.constructor = خطای_برنامه;

  function خطای_حافظه(پیام, جزئیات) {
    خطای_برنامه.call(this, پیام, 'STORAGE', جزئیات);
    this.name = 'خطای_حافظه';
  }
  خطای_حافظه.prototype = Object.create(خطای_برنامه.prototype);
  خطای_حافظه.prototype.constructor = خطای_حافظه;

  function خطای_ماژول(پیام, جزئیات) {
    خطای_برنامه.call(this, پیام, 'MODULE', جزئیات);
    this.name = 'خطای_ماژول';
  }
  خطای_ماژول.prototype = Object.create(خطای_برنامه.prototype);
  خطای_ماژول.prototype.constructor = خطای_ماژول;

  global.AppErrors = {
    پایه: خطای_برنامه,
    حافظه: خطای_حافظه,
    ماژول: خطای_ماژول,
    بگیر: function (کار, زمینه) {
      try { return { موفق: true, نتیجه: کار() }; }
      catch (خطا) {
        console.error('[' + (زمینه || 'عمومی') + ']', خطا);
        return { موفق: false, خطا: خطا };
      }
    }
  };
})(typeof window !== 'undefined' ? window : this);
