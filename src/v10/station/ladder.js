/**
 * نردبان داربست پداگوژیک ۷پله‌ای کارگاه ضرب — نسخهٔ ۱۰.۲ (Pure)
 * مطابق کتاب درسی ریاضی سوم دبستان (کد ۳۰۵، چاپ ۱۴۰۳)
 * پوشش کامل ۵ دامنه: جدول ضرب (table)، عنصر بی‌اثر یک (identity)،
 * عنصر جاذب صفر (zero)، ضرب در ۱۰ (x10)، یک‌رقم در چندرقمی (multi).
 *
 * بدون افشای پاسخ کل و جزئی در همهٔ ۷ پله (Strict Anti-Leak Policy).
 */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export const toFa = n => String(n ?? '').replace(/[0-9]/g, d => FA_DIGITS[d]);

/**
 * تعیین دامنهٔ مسئله
 * خروجی: 'zero' | 'identity' | 'x10' | 'table' | 'multi' | null
 */
export function classifyQuestionDomain(input = {}) {
  const { f1, f2 } = input || {};
  if (!Number.isInteger(f1) || !Number.isInteger(f2)) return null;
  if (f1 < 0 || f2 < 0 || f1 > 999 || f2 > 999) return null;

  if (f1 === 0 || f2 === 0) {
    if (f1 + f2 === 0) return null; // ۰×۰ در کتاب مطرح نیست
    return 'zero';
  }
  if (f1 === 1 || f2 === 1) {
    return 'identity';
  }
  if (f1 === 10 || f2 === 10) {
    return 'x10';
  }
  if (f1 >= 2 && f1 <= 9 && f2 >= 2 && f2 <= 9) {
    return 'table';
  }
  const small = Math.min(f1, f2);
  const big = Math.max(f1, f2);
  const prod = f1 * f2;
  if (small >= 2 && small <= 9 && big >= 11 && big <= 999 && prod <= 999) {
    return 'multi';
  }
  return null;
}

/**
 * راستی‌آزمایی اکید عدم نشت پاسخ در تمام ۷ پله
 */
export function assertNoLeak(arg1, arg2) {
  let q, ladder;
  if (Array.isArray(arg1)) {
    ladder = arg1;
    q = arg2 || {};
  } else {
    q = arg1 || {};
    ladder = arg2;
  }

  const { f1, f2 } = q;
  if (typeof f1 !== 'number' || typeof f2 !== 'number') return true;
  const product = f1 * f2;
  const partials = [];

  if (f1 > 5 && f2 > 1 && f2 <= 10) partials.push(5 * f2);
  if (f2 > 5 && f1 > 1 && f1 <= 10) partials.push(f1 * 5);
  if (f2 > 10) {
    const tens = Math.floor(f2 / 10) * 10;
    const ones = f2 % 10;
    if (tens > 0) partials.push(f1 * tens);
    if (ones > 0) partials.push(f1 * ones);
  }

  const forbiddenValues = [product, ...partials].filter(n => Number.isFinite(n) && n > 0);
  const forbiddenTokens = [];
  for (const val of forbiddenValues) {
    forbiddenTokens.push(String(val));
    forbiddenTokens.push(toFa(val));
  }

  if (Array.isArray(ladder)) {
    for (const step of ladder) {
      const text = step?.text || step?.textFa || '';
      for (const token of forbiddenTokens) {
        if (text.includes(token)) {
          throw new Error(`نشت پاسخ در پلهٔ ${step?.step || step?.level}: عدد ${token} نباید در متن باشد.`);
        }
      }
    }
  }

  return true;
}

// ─── ۱. نردبان جدول ضرب پایه (table) ───
function buildTableLadder(f1, f2) {
  const steps = [
    {
      step: 1, level: 1,
      text: `به دسته‌ها و اعضا نگاه کن: ${toFa(f1)} دستهٔ ${toFa(f2)}تایی.`,
      visual: 'equal-groups', sibling: null
    },
    {
      step: 2, level: 2,
      text: `دست‌ورزی با اشیا: ${toFa(f1)} ظرف بچین و در هر ظرف ${toFa(f2)} مهره قرار بده.`,
      visual: null, sibling: null
    },
    {
      step: 3, level: 3,
      text: f2 > 5
        ? `شکستن با لنگر ۵: ${toFa(f1)} دستهٔ ۵تایی اول را بساز، بعد ${toFa(f1)} دستهٔ ${toFa(f2 - 5)}تایی باقی‌مانده را.`
        : `شمارش جهشی با دسته‌های ساده: اول دسته‌های ۲تایی یا ۵تایی را در ذهن بیاور.`,
      visual: null, sibling: null
    },
    {
      step: 4, level: 4,
      text: `شمارش چندتا چندتا: ${toFa(f2)}تا ${toFa(f2)}تا رو به جلو حرکت کن. حاصل جهش را ننویس.`,
      visual: null, sibling: null
    },
    {
      step: 5, level: 5,
      text: `نیمهٔ دسته‌ها را بشمار و بعد نیمهٔ دیگر را اضافه کن؛ هنوز عددی روی صفحه ثبت نکن.`,
      visual: null, sibling: null
    },
    {
      step: 6, level: 6,
      text: `نمایش جبری جمعی: ${toFa(f1)}×${toFa(f2)} برابر است با جمع دسته‌های شناخته‌شده. حاصل کل را بازگو نکن.`,
      visual: null, sibling: null
    },
    {
      step: 7, level: 7,
      text: `یک الگوی مشابه را که قبلاً یاد گرفتی به یاد بیاور. حالا خودت این دسته را کامل کن.`,
      visual: null, sibling: null
    }
  ];
  return steps.map(s => ({ ...s, textFa: s.text }));
}

// ─── ۲. نردبان عنصر بی‌اثر یک (identity) ───
function buildIdentityLadder(f1, f2) {
  const steps = [
    {
      step: 1, level: 1,
      text: 'به دسته‌بندی و عامل‌ها نگاه کن: ضرب یک دسته یا ضرب در عدد یک.',
      visual: null, sibling: null
    },
    {
      step: 2, level: 2,
      text: 'اگر فقط ۱ بسته داشته باشی، هر چه درون بسته باشد همان مقدار کل است.',
      visual: null, sibling: null
    },
    {
      step: 3, level: 3,
      text: 'قاعدهٔ ضرب در یک: ضرب کردن در ۱ تغییری نمی‌کند و مقدار خود عدد است؛ حاصل را ننویس.',
      visual: null, sibling: null
    },
    {
      step: 4, level: 4,
      text: 'عنصر بی‌اثر: عدد ۱ در ضرب مثل آیینه عمل می‌کند و همان مقدار را نشان می‌دهد.',
      visual: null, sibling: null
    },
    {
      step: 5, level: 5,
      text: 'یک بار با دست مجسم کن: یک بستهٔ بازنشده با همان اعضای اولیه.',
      visual: null, sibling: null
    },
    {
      step: 6, level: 6,
      text: 'دسته‌ها یا اعضای تکی؟ ۱ ضربدر هر عددی یعنی خودِ آن مقدار.',
      visual: null, sibling: null
    },
    {
      step: 7, level: 7,
      text: 'حالا طبق قاعدهٔ عنصر بی‌اثر عدد را در کادر بنویس.',
      visual: null, sibling: null
    }
  ];
  return steps.map(s => ({ ...s, textFa: s.text }));
}

// ─── ۳. نردبان عنصر جاذب صفر (zero) ───
function buildZeroLadder(f1, f2) {
  const steps = [
    {
      step: 1, level: 1,
      text: 'به علامت ضرب و عدد صفر نگاه کن. معنای دسته یا عضو خالی چیست؟',
      visual: null, sibling: null
    },
    {
      step: 2, level: 2,
      text: 'بشقاب‌های خالی را تصور کن. وقتی در بسته‌ها صفر دانه است، هیچ عضوی برای شمارش وجود ندارد.',
      visual: null, sibling: null
    },
    {
      step: 3, level: 3,
      text: 'قاعدهٔ ضرب در صفر: هر عددی در صفر ضرب شود حاصل پوچ و خالی می‌شود.',
      visual: null, sibling: null
    },
    {
      step: 4, level: 4,
      text: 'جمع صفرها: صفر را هر چند بار با خودش جمع کنی باز هم خالی است.',
      visual: null, sibling: null
    },
    {
      step: 5, level: 5,
      text: 'دقت کن با جمع اشتباه نشود: در ضرب، بستهٔ خالی یعنی هیچ.',
      visual: null, sibling: null
    },
    {
      step: 6, level: 6,
      text: 'عنصر جاذب در ضرب همه چیز را به صفر می‌رساند.',
      visual: null, sibling: null
    },
    {
      step: 7, level: 7,
      text: 'حالا با توجه به معنای بستهٔ خالی، پاسخ را وارد کن.',
      visual: null, sibling: null
    }
  ];
  return steps.map(s => ({ ...s, textFa: s.text }));
}

// ─── ۴. نردبان ضرب در ۱۰ (x10) ───
function buildX10Ladder(f1, f2) {
  const other = f1 === 10 ? f2 : f1;
  const steps = [
    {
      step: 1, level: 1,
      text: `به عامل ۱۰ دقت کن: ${toFa(other)} دستهٔ ۱۰تایی داریم.`,
      visual: null, sibling: null
    },
    {
      step: 2, level: 2,
      text: `دسته‌های ۱۰تایی را تصور کن: مثل بسته‌های ۱۰تایی مداد یا پول.`,
      visual: null, sibling: null
    },
    {
      step: 3, level: 3,
      text: `شمارش ۱۰تایی: ۱۰، ۲۰، ۳۰... ۱۰تایی شمردن همان شیفت ارزش مکانی است.`,
      visual: null, sibling: null
    },
    {
      step: 4, level: 4,
      text: `ارزش مکانی: در ضرب در ۱۰، رقم‌ها یک مرتبه بالا می‌روند و یک صفر در سمت راست (یکان) قرار می‌گیرد.`,
      visual: null, sibling: null
    },
    {
      step: 5, level: 5,
      text: `یکان صفر می‌شود و ${toFa(other)} به مرتبهٔ بعدی منتقل می‌شود؛ حاصل را فاش نکن.`,
      visual: null, sibling: null
    },
    {
      step: 6, level: 6,
      text: `رابطه را ببین: ضرب در ۱۰ یعنی اضافه شدن یک صفر به سمت راست عدد.`,
      visual: null, sibling: null
    },
    {
      step: 7, level: 7,
      text: `حالا صفر را در یکان بگذار و رقم‌ها را ثبت کن.`,
      visual: null, sibling: null
    }
  ];
  return steps.map(s => ({ ...s, textFa: s.text }));
}

// ─── ۵. نردبان یک‌رقم در چندرقمی (multi) ───
function buildMultiLadder(f1, f2) {
  const small = Math.min(f1, f2);
  const big = Math.max(f1, f2);
  const tens = Math.floor(big / 10) * 10;
  const ones = big % 10;
  const steps = [
    {
      step: 1, level: 1,
      text: `به عدد بزرگ‌تر نگاه کن: ${toFa(big)}. می‌خواهیم آن را در ${toFa(small)} ضرب کنیم.`,
      visual: null, sibling: null
    },
    {
      step: 2, level: 2,
      text: `عدد ${toFa(big)} را به صورت گسترده بنویس و بشکن: ${toFa(tens)} به علاوهٔ ${toFa(ones)}.`,
      visual: null, sibling: null
    },
    {
      step: 3, level: 3,
      text: `پخش‌پذیری ضرب: ${toFa(small)} را در ${toFa(tens)} و سپس در ${toFa(ones)} ضرب کن. حاصل را ننویس.`,
      visual: null, sibling: null
    },
    {
      step: 4, level: 4,
      text: `بخش ده‌تایی‌ها و بخش یکان‌ها را جداگانه محاسبه کن و سپس با هم جمع بزن.`,
      visual: null, sibling: null
    },
    {
      step: 5, level: 5,
      text: `ارزش مکانی را گم نکن: صفرِ بخش ده‌تایی سر جای خودش قرار می‌گیرد.`,
      visual: null, sibling: null
    },
    {
      step: 6, level: 6,
      text: `حاصل دو بخش را در ذهن با هم جمع کن بدون اینکه زودتر بنویسی.`,
      visual: null, sibling: null
    },
    {
      step: 7, level: 7,
      text: `جمع نهایی دو بخش ضرب را حساب کن و در کادر بنویس.`,
      visual: null, sibling: null
    }
  ];
  return steps.map(s => ({ ...s, textFa: s.text }));
}

/**
 * تولید نردبان ۷پله‌ای برای هر سؤال
 */
export function buildLadder(question) {
  const domain = classifyQuestionDomain(question);
  if (!domain) return null;

  const { f1, f2 } = question;
  let steps = null;
  if (domain === 'table') steps = buildTableLadder(f1, f2);
  else if (domain === 'identity') steps = buildIdentityLadder(f1, f2);
  else if (domain === 'zero') steps = buildZeroLadder(f1, f2);
  else if (domain === 'x10') steps = buildX10Ladder(f1, f2);
  else if (domain === 'multi') steps = buildMultiLadder(f1, f2);

  if (steps) {
    assertNoLeak(question, steps);
  }
  return steps;
}

export { buildLadder as generateScaffoldingLadder };
