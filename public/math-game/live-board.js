/* live-board.js — غیرفعال‌شده (درِ بسته) — برنچ feature/rosha-night-core
 *
 * چرا بسته شد: این ماژول ناشرِ امتیاز به لیدربرد زندهٔ Firebase بود. لیدربرد
 * «تابلوی شرم» است و در قرارداد طراحی (MEMARI-KOL §۳.۱/§۸) ممنوع؛ خاموشی
 * لیدربرد در جدول جانمایی سند بازار «لازم برای تمام‌شدن حلقه» است، نه کار بعدی.
 * کودک شبِ آزمون نباید به محصولی دیگر (رتبه و مقایسه) فرستاده شود.
 *
 * حالت فعلی: استابِ بی‌اثر با همان شکل API قبلی (publishResult/submitScore/
 * listen/clearRoom) — هیچ تماسی با Firebase برقرار نمی‌شود (window.fbDB هرگز
 * خوانده نمی‌شود)، هیچ امتیازی منتشر نمی‌شود و هیچ رتبه‌ای ساخته نمی‌شود.
 * مصرف‌کنندهٔ فعلی (index.html) بدون خطا کار می‌کند.
 *
 * بازگشت: تاریخچهٔ کامل این فایل در گیت همین برنچ و در شاخهٔ اصلی محفوظ است.
 * بازگشایی فقط با فرمان مالک.
 */
(function () {
  'use strict';

  var CLOSED = true; // گیت سراسری در — برای بازگشایی به false نیاز به فرمان مالک دارد

  function notice(statusId) {
    var status = (typeof statusId === 'string') ? document.getElementById(statusId) : null;
    if (status) status.textContent = '🚪 لیدربرد خاموش است — اینجا جای رتبه و مقایسه نیست.';
  }

  window.LiveBoard = {
    closed: CLOSED,
    publishResult: function (result, score, statusId) {
      if (CLOSED) console.info('🚪 LiveBoard.publishResult بی‌اثر است — لیدربرد طبق قرارداد طراحی خاموش است.');
      notice(statusId);
      return Promise.resolve({ published: false, closed: true });
    },
    submitScore: function () {
      if (CLOSED) console.info('🚪 LiveBoard.submitScore بی‌اثر است.');
      return Promise.resolve({ submitted: false, closed: true });
    },
    listen: function () {
      // تابع لغو اشتراک بی‌اثر برمی‌گرداند تا فراخوان‌ها نشکنند
      return function () {};
    },
    clearRoom: function () {
      return Promise.resolve();
    }
  };

  console.log('🚪 LiveBoard در حالت درِ بسته بارگذاری شد (بدون Firebase، بدون انتشار امتیاز).');
})();
