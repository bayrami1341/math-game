(function (global) {
  'use strict';
  var پیشوند = 'mathgame:';
  var نسخه_ساختار = 6;

  function کلید_کامل(کلید) { return پیشوند + کلید; }

  function بخوان(کلید, پیش‌فرض) {
    try {
      var خام = localStorage.getItem(کلید_کامل(کلید));
      if (خام === null) return پیش‌فرض;
      return JSON.parse(خام);
    } catch (خطا) {
      console.warn('خواندن ناموفق:', کلید, خطا);
      return پیش‌فرض;
    }
  }

  function بنویس(کلید, مقدار) {
    try {
      localStorage.setItem(کلید_کامل(کلید), JSON.stringify(مقدار));
      return true;
    } catch (خطا) {
      if (global.AppErrors) {
        throw new global.AppErrors.حافظه('نوشتن ناموفق', { کلید: کلید, خطا: خطا.message });
      }
      throw خطا;
    }
  }

  function پاک_کن(کلید) {
    try { localStorage.removeItem(کلید_کامل(کلید)); return true; }
    catch (خطا) { return false; }
  }

  function بررسی_نسخه() {
    var فعلی = بخوان('schemaVersion', null);
    if (فعلی === null) {
      بنویس('schemaVersion', نسخه_ساختار);
      return { وضعیت: 'آغاز', نسخه: نسخه_ساختار };
    }
    if (فعلی < نسخه_ساختار) { return { وضعیت: 'نیازمند مهاجرت', از: فعلی, به: نسخه_ساختار }; }
    if (فعلی > نسخه_ساختار) { return { وضعیت: 'جدیدتر', نسخه: فعلی }; }
    return { وضعیت: 'سازگار', نسخه: فعلی };
  }

  global.Storage = {
    بخوان: بخوان,
    بنویس: بنویس,
    پاک_کن: پاک_کن,
    بررسی_نسخه: بررسی_نسخه,
    نسخه_ساختار: نسخه_ساختار,
    کلید_کامل: کلید_کامل
  };
})(typeof window !== 'undefined' ? window : this);
