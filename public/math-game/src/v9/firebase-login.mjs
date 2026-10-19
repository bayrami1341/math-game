const sdkBase = 'https://www.gstatic.com/firebasejs/10.14.1/';

export async function loadFirebaseLogin(config) {
  const [appSdk, sdk] = await Promise.all([
    import(sdkBase + 'firebase-app.js'), import(sdkBase + 'firebase-auth.js')
  ]);
  return { auth: sdk.getAuth(appSdk.initializeApp(config, 'math-game-v9')), sdk };
}

export function googleLogin(auth, sdk) {
  // Open directly from the click handler, before the UI operation queue awaits.
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return sdk.signInWithPopup(auth, provider);
}

export function loginError(error) {
  const messages = {
    'auth/popup-blocked': 'پنجرهٔ ورود مسدود شد؛ بازشدن پنجره برای این سایت را مجاز کن و دوباره بزن.',
    'auth/popup-closed-by-user': 'پنجرهٔ ورود بسته شد؛ برای ورود دوباره روی دکمه بزن.',
    'auth/cancelled-popup-request': 'یک پنجرهٔ ورود دیگر باز است؛ همان پنجره را کامل کن.',
    'auth/unauthorized-domain': 'این نشانی هنوز برای ورود بازی مجاز نشده است؛ مدیر باید دامنه را در Firebase تنظیم کند.',
    'auth/operation-not-allowed': 'این روش ورود هنوز در Firebase فعال نشده است؛ مدیر باید آن را فعال کند.',
    'auth/configuration-not-found': 'تنظیمات ورود Firebase این پروژه هنوز آماده نیست.',
    'auth/network-request-failed': 'ارتباط با سرویس ورود برقرار نشد؛ اتصال اینترنت را بررسی کن و دوباره تلاش کن.',
    'auth/too-many-requests': 'سرویس ورود فعلاً درخواست بیشتری نمی‌پذیرد؛ کمی بعد دوباره تلاش کن.',
    'auth/invalid-action-code': 'پیوند ورود معتبر نیست یا قبلاً استفاده شده است؛ از ورود Google یا یک پیوند تازه استفاده کن.',
    'auth/expired-action-code': 'مهلت پیوند ورود تمام شده است؛ از ورود Google یا یک پیوند تازه استفاده کن.'
  };
  return messages[error?.code] || 'ورود انجام نشد؛ دوباره تلاش کن. اگر ادامه داشت، وضعیت ورود Firebase باید بررسی شود.';
}
