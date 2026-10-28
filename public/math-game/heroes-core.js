/* heroes-core.js — غیرفعال‌شده (درِ بسته) — برنچ feature/rosha-night-core
 *
 * چرا بسته شد: این ماژول لایهٔ «چالش سرعتی و رکورد» بود — «پاسخ درست زیر ۲ ثانیه»،
 * «رکورد کلاس (دختران)» و مکانیک نشان‌های رقابتی. قرارداد طراحی پروژه (MEMARI-KOL §۳.۷
 * و §۸) می‌گوید: تابلوی شرم و مقایسهٔ عمومی ممنوع است؛ نشان و صندوقچه جنگ نمره نمی‌سازند.
 * خاموشی این درها در جدول جانمایی سند بازار برچسب «لازم برای تمام‌شدن حلقه» دارد.
 *
 * حالت فعلی: استابِ بی‌اثر با همان شکل API قبلی — همهٔ مصرف‌کنندگان (teacher.js،
 * groups-ui.js، ui-controller.js، heroes-ui.js) بدون خطا کار می‌کنند و هیچ
 * پهلوانی، هیچ رکوردی و هیچ جایزه‌ای ساخته نمی‌شود. هیچ داده‌ای از localStorage
 * خوانده یا نوشته نمی‌شود.
 *
 * بازگشت: تاریخچهٔ کامل این فایل در گیت همین برنچ و در شاخهٔ اصلی محفوظ است.
 * بازگشایی فقط با فرمان مالک.
 */
(function () {
  'use strict';

  var CLOSED = true; // گیت سراسری در — برای بازگشایی به false نیاز به فرمان مالک دارد

  var HEROES = []; // فهرست پهلوان‌ها تخلیه شد — نه چالش سرعتی، نه رکورد کلاس، نه جایزه

  var api = {
    closed: CLOSED,
    getAll: function () { return HEROES.slice(); },
    getById: function (id) { return HEROES.length ? null : null; },
    getForProfile: function () { return []; },
    hasHero: function () { return false; },
    checkAndAward: function () {
      if (CLOSED) console.info('🚪 heroes-core بسته است — چالش سرعتی/رکورد کلاس طبق قرارداد طراحی خاموش است.');
      return { newlyAwarded: [] };
    },
    _checkCondition: function () { return false; },
    countForProfile: function () { return 0; },
    getLockedForProfile: function () { return []; },
    _clearAll: function () { /* هیچ — هیچ داده‌ای پاک نمی‌شود؛ فقط دسترسی قطع است */ }
  };

  window.HeroesCore = api;
  console.log('🚪 HeroesCore در حالت درِ بسته بارگذاری شد (بدون چالش سرعتی، بدون رکورد کلاس).');
})();
