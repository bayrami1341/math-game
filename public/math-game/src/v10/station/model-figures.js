// ─────────────────────────────────────────────────────────────────────────────
// model-figures.js — رندرر SVG پارامتریک برای ۱۴ مدل کاتالوگ MOTOR-TALIF-KHSHAB-v1
// (BP-003 / Task 64 — گام ۵ دستورکار ۶۰–۶۶)
//
// گرامر رسمی سلول «ساختار تصویر» (۷.۳ کتاب موتور):
//   نوع: M_XXX؛ <پارامتر=مقدار، ...>؛ رنگ: …؛ پرسش: «…»
// قالب فشردهٔ داخل متن سؤال هم پذیرفته است: «M_ARRAY(۳×۴)»
//
// تضمین ضد باگ تاریخی #۹ (INC-09): تعداد المان‌های گرافیکیِ شمارش‌پذیر در SVG
// خروجی باید ریاضی‌وار و دقیقاً برابر پارامتر عددی پارس‌شده باشد. هر المان
// شمارش‌پذیر یک کلاس «mf-*» دارد و تست واحد با شمردن کلاس‌ها، INC-09 را قفل می‌کند.
//
// قرارداد «صادقانه بی‌الگو» (هم‌سبک errors.js): ورودی بدشکل/ناقابل‌رندر → null.
// هیچ استثنایی از این ماژول بیرون نمی‌زند؛ Pure است: بدون DOM/FS/صدا.
// ─────────────────────────────────────────────────────────────────────────────

// ── ابزارهای پایه ──

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** نرمال‌سازی ارقام فارسی/عربی به لاتین */
export function normalizeDigits(text) {
  return String(text ?? '')
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

function toInt(v) {
  const n = Number(normalizeDigits(v));
  return Number.isInteger(n) ? n : null;
}

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SVG_OPEN = (w, h, model, label) =>
  `<svg class="model-figure model-figure--${model}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(label)}" xmlns="http://www.w3.org/2000/svg">`;

const wrap = (w, h, model, label, body) =>
  `${SVG_OPEN(w, h, model, label)}${body}</svg>`;

// وایت‌لیست رسمی کاتالوگ ۷.۲ — پارسِ مدل خارج از این فهرست = null (گیت قطعی)
const MODEL_WHITELIST = new Set([
  'M_ARRAY', 'M_GROUPS', 'M_NUMBERLINE', 'M_BUNDLES', 'M_PLACEVALUE',
  'M_AREAMODEL', 'M_BARS', 'M_FRACTION', 'M_GEO_SHAPES', 'M_CLOCK_TIME',
  'M_BALANCE', 'M_MONEY', 'M_CHART', 'M_PATTERN'
]);

// ── پارسر ──

/**
 * پارس قطعی گرامر «نوع: M_XXX؛ ...».
 * خروجی: { model, params, question, color, raw } یا null (بدشکل/«—»/خالی).
 * مقادیر عددی به int نرمال می‌شوند؛ فهرست‌ها (رده‌ها/مقادیر/جمله‌ها) آرایه‌اند.
 */
export function parseVisualSpec(specText) {
  try {
    if (specText === null || specText === undefined) return null;
    const raw = String(specText).trim();
    if (!raw || raw === '—' || raw === '–' || raw === '-') return null;

    // قالب فشرده «M_ARRAY(۳×۴)» — مستقل از «نوع:»
    const compact = raw.match(/M_([A-Z_]+)\s*\(\s*([۰-۹0-9]+)\s*[×x]\s*([۰-۹0-9]+)\s*\)/);
    if (compact) {
      const model = `M_${compact[1]}`;
      if (model !== 'M_ARRAY' && model !== 'M_GROUPS') return null;
      return {
        model,
        params: model === 'M_ARRAY'
          ? { 'سطر': toInt(compact[2]), 'ستون': toInt(compact[3]) }
          : { 'گروه': toInt(compact[2]), 'اندازه': toInt(compact[3]) },
        question: null,
        color: null,
        raw
      };
    }

    if (!raw.includes('نوع:')) return null;

    // پرسش «...» را اول جدا می‌کنیم تا «؛» داخل گیومه پارسر را نبَرد
    let question = null;
    let body = raw;
    const qm = body.match(/پرسش\s*:\s*«([^»]*)»/);
    if (qm) {
      question = qm[1].trim();
      body = body.replace(qm[0], 'پرسش:');
    }

    const segments = body.split('؛').map(s => s.trim()).filter(Boolean);
    let model = null;
    const params = {};
    let color = null;

    for (const seg of segments) {
      const ci = seg.indexOf(':');
      if (ci < 0) continue;
      const key = seg.slice(0, ci).trim();
      const val = seg.slice(ci + 1).trim();
      if (key === 'نوع') {
        const mm = val.match(/M_[A-Z_]+/);
        if (!mm) return null;
        model = mm[0];
      } else if (key === 'رنگ') {
        color = val || null;
      } else if (key === 'پرسش') {
        // پرسش بدون گیومه (نادر) — از باقی‌ماندهٔ seg
        if (!question && val) question = val.trim() || null;
      } else if (key) {
        // نرمال‌سازی قطعی: مقدارِ تماماً عددی → int؛ بقیه → رشتهٔ نرمال ارقام
        const nv = normalizeDigits(val).trim();
        params[key] = /^-?\d+$/.test(nv) ? Number(nv) : nv;
      }
    }

    if (!model || !MODEL_WHITELIST.has(model)) return null;
    return { model, params, question, color, raw };
  } catch {
    return null; // هرگز استثنا نمی‌دهد
  }
}

/** مقدار عددی یک پارامتر؛ نال/ناموجود → null */
function num(params, key) {
  if (!(key in params)) return null;
  return toInt(params[key]);
}

/** فهرست اعداد از رشتهٔ «۵،۸،۳» یا «5, 8, 3» */
function numList(params, key) {
  if (!(key in params)) return null;
  const parts = normalizeDigits(params[key]).split(/[,،]/).map(s => s.trim()).filter(Boolean);
  const out = parts.map(p => (p === '؟' ? '?' : toInt(p)));
  return out.every(x => x === '?' || x !== null) ? out : null;
}

/** فهرست رشته‌ای (رده‌ها: شنبه، یک‌شنبه، دوشنبه) */
function strList(params, key) {
  if (!(key in params)) return null;
  return normalizeDigits(params[key]).split(/[,،]/).map(s => s.trim()).filter(Boolean);
}

// ── سازنده‌های SVG هر مدل (هر تابع: پارامترهای عددیِ پاک‌سازی‌شده) ──
// قرارداد INC-09: هر المان شمارش‌پذیر دقیقاً یک کلاس «mf-*» دارد.

const INK = '#4b5563';
const ACCENT = '#c2410c'; // نارنجی/قهوه‌ای — بدون آبی
const FILL_SOFT = '#fed7aa';

function svgArray(r, c) {
  if (r < 1 || r > 12 || c < 1 || c > 12) return null;
  const W = 40 + c * 22, H = 40 + r * 22;
  let dots = '';
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      dots += `<circle class="mf-dot" cx="${28 + j * 22}" cy="${28 + i * 22}" r="8" fill="${FILL_SOFT}" stroke="${INK}"/>`;
    }
  }
  return wrap(W, H, 'M_ARRAY', `آرایهٔ ${r} در ${c}`, dots);
}

function svgGroups(g, size) {
  if (g < 1 || g > 8 || size < 1 || size > 12) return null;
  const gw = 24 + size * 20;
  const W = 20 + g * (gw + 14), H = 76;
  let body = '';
  for (let k = 0; k < g; k++) {
    const gx = 12 + k * (gw + 14);
    body += `<rect class="mf-group" x="${gx}" y="12" width="${gw}" height="52" rx="10" fill="none" stroke="${INK}" stroke-dasharray="4 3"/>`;
    for (let i = 0; i < size; i++) {
      body += `<circle class="mf-dot" cx="${gx + 20 + i * 20}" cy="38" r="7" fill="${FILL_SOFT}" stroke="${INK}"/>`;
    }
  }
  return wrap(W, H, 'M_GROUPS', `${g} گروهِ ${size}تایی`, body);
}

function svgNumberline(from, till, step) {
  if (from < 0 || till <= from || till > 10000 || step < 1) return null;
  const span = till - from;
  if (span % step !== 0) return null; // پرش ناقص — صادقانه null
  const jumps = span / step;
  if (jumps < 1 || jumps > 12) return null;
  const ticks = jumps + 1;
  const W = Math.max(300, jumps * 52 + 60), H = 84;
  const y = 52;
  let body = `<line x1="28" y1="${y}" x2="${W - 28}" y2="${y}" stroke="${INK}" stroke-width="2"/>`;
  for (let k = 0; k <= jumps; k++) {
    const x = 28 + (k * (W - 56)) / jumps;
    body += `<line class="mf-tick" x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + 8}" stroke="${INK}" stroke-width="2"/>`;
    body += `<text class="mfl-tick" x="${x}" y="${y + 24}" font-size="11" text-anchor="middle" fill="${INK}">${from + k * step}</text>`;
  }
  for (let k = 0; k < jumps; k++) {
    const x1 = 28 + (k * (W - 56)) / jumps;
    const x2 = 28 + ((k + 1) * (W - 56)) / jumps;
    const mx = (x1 + x2) / 2;
    body += `<path class="mf-jump" d="M ${x1} ${y - 10} Q ${mx} ${y - 34} ${x2} ${y - 10}" fill="none" stroke="${ACCENT}" stroke-width="2"/>`;
  }
  return wrap(W, H, 'M_NUMBERLINE', `خط عدد از ${from} تا ${till} با پرش ${step}`, body);
}

function svgBundles(tens, ones) {
  if (tens < 0 || tens > 9 || ones < 0 || ones > 9) return null;
  if (tens + ones < 1) return null;
  const W = 30 + (tens + ones) * 34, H = 84;
  let body = '';
  let x = 20;
  for (let k = 0; k < tens; k++) {
    body += `<rect class="mf-bundle" x="${x}" y="22" width="22" height="40" rx="4" fill="${FILL_SOFT}" stroke="${INK}"/>`;
    for (let s = 1; s < 10; s++) {
      body += `<line x1="${x + (s * 22) / 10}" y1="22" x2="${x + (s * 22) / 10}" y2="62" stroke="${INK}" stroke-width="0.6" opacity="0.5"/>`;
    }
    x += 34;
  }
  for (let k = 0; k < ones; k++) {
    body += `<circle class="mf-dot" cx="${x + 11}" cy="42" r="9" fill="#fff" stroke="${INK}"/>`;
    x += 34;
  }
  return wrap(W, H, 'M_BUNDLES', `${tens} بستهٔ ده‌تایی و ${ones} تک`, body);
}

function svgPlacevalue(chips) {
  // chips: {هزار، صد، ده، یک} — فقط ستون‌های غیرصفر رسم می‌شوند
  const cols = [
    { key: 'هزار', label: 'هزارتا' },
    { key: 'صد', label: 'صدتا' },
    { key: 'ده', label: 'دهتا' },
    { key: 'یک', label: 'یکتا' }
  ].filter(c => (chips[c.key] || 0) > 0);
  if (!cols.length) return null;
  const colW = 92;
  const W = 24 + cols.length * colW, H = 128;
  let body = '';
  cols.forEach((c, i) => {
    const x = 12 + i * colW;
    body += `<rect x="${x}" y="18" width="${colW - 12}" height="86" rx="8" fill="none" stroke="${INK}"/>`;
    body += `<text class="mfl-col" x="${x + (colW - 12) / 2}" y="34" font-size="12" text-anchor="middle" fill="${INK}">${c.label}</text>`;
    const n = chips[c.key];
    for (let k = 0; k < n; k++) {
      const row = Math.floor(k / 3), colIdx = k % 3;
      body += `<circle class="mf-chip" cx="${x + 18 + colIdx * 24}" cy="${54 + row * 18}" r="7" fill="${FILL_SOFT}" stroke="${INK}"/>`;
    }
  });
  return wrap(W, H, 'M_PLACEVALUE', 'جدول ارزش مکانی', body);
}

function svgAreaModel(hParts, vParts) {
  if (!Array.isArray(hParts) || !Array.isArray(vParts)) return null;
  if (hParts.length < 1 || hParts.length > 4 || vParts.length < 1 || vParts.length > 4) return null;
  const widths = hParts.map(v => (v > 0 ? v : null));
  const heights = vParts.map(v => (v > 0 ? v : null));
  if (widths.some(v => v === null) || heights.some(v => v === null)) return null;
  const sumW = widths.reduce((a, b) => a + b, 0);
  const sumH = heights.reduce((a, b) => a + b, 0);
  const W = 260, H = 200, x0 = 16, y0 = 16, gw = W - 32, gh = H - 32;
  let body = '';
  let x = x0;
  for (let i = 0; i < widths.length; i++) {
    const cw = (widths[i] / sumW) * gw;
    let y = y0;
    for (let j = 0; j < heights.length; j++) {
      const ch = (heights[j] / sumH) * gh;
      body += `<rect class="mf-part" x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${(i + j) % 2 ? '#fff' : FILL_SOFT}" stroke="${INK}"/>`;
      body += `<text class="mfl-part" x="${x + cw / 2}" y="${y + ch / 2 + 4}" font-size="10" text-anchor="middle" fill="${INK}">${widths[i]}×${heights[j]}</text>`;
      y += ch;
    }
    x += cw;
  }
  return wrap(W, H, 'M_AREAMODEL', `مدل مساحتی ${hParts.join('+')} در ${vParts.join('+')}`, body);
}

function svgBars(bars, divisions) {
  if (bars < 1 || bars > 4 || divisions < 1 || divisions > 12) return null;
  const W = 300, H = 30 + bars * 44;
  let body = '';
  for (let b = 0; b < bars; b++) {
    const y = 24 + b * 44;
    body += `<rect class="mf-bar" x="24" y="${y}" width="${W - 48}" height="28" rx="4" fill="none" stroke="${INK}"/>`;
    const sw = (W - 48) / divisions;
    for (let s = 1; s < divisions; s++) {
      body += `<line x1="${24 + s * sw}" y1="${y}" x2="${24 + s * sw}" y2="${y + 28}" stroke="${INK}"/>`;
    }
    for (let s = 0; s < divisions; s++) {
      body += `<rect class="mf-seg" x="${24 + s * sw}" y="${y}" width="${sw}" height="28" fill="transparent" stroke="none"/>`;
    }
  }
  return wrap(W, H, 'M_BARS', `${bars} نوارِ ${divisions}بخشی`, body);
}

function svgFraction(divisions, filled, shape) {
  if (divisions < 2 || divisions > 12 || filled < 0 || filled > divisions) return null;
  const isDisc = shape === 'دیسک';
  if (isDisc) {
    const W = 160, H = 160, cx = 80, cy = 80, r = 62;
    let body = '';
    for (let k = 0; k < divisions; k++) {
      const a1 = (-90 + (360 / divisions) * k) * Math.PI / 180;
      const a2 = (-90 + (360 / divisions) * (k + 1)) * Math.PI / 180;
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const large = (360 / divisions) > 180 ? 1 : 0;
      const cls = k < filled ? 'mf-slice mf-slice-filled' : 'mf-slice';
      body += `<path class="${cls}" d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${k < filled ? ACCENT : '#fff'}" stroke="${INK}"/>`;
    }
    return wrap(W, H, 'M_FRACTION', `${filled} از ${divisions} قطعهٔ دیسک`, body);
  }
  const W = 320, H = 96;
  const sw = (W - 48) / divisions;
  let body = '';
  for (let k = 0; k < divisions; k++) {
    const cls = k < filled ? 'mf-slice mf-slice-filled' : 'mf-slice';
    body += `<rect class="${cls}" x="${24 + k * sw}" y="32" width="${sw}" height="32" fill="${k < filled ? ACCENT : '#fff'}" stroke="${INK}"/>`;
  }
  return wrap(W, H, 'M_FRACTION', `${filled} از ${divisions} قطعهٔ نوار`, body);
}

function svgGeoShapes(counts) {
  // counts: {مثلث: n، مربع: n، دایره: n، مستطیل: n}
  const kinds = [
    { key: 'مثلث', draw: (x, y) => `<polygon class="mf-shape mf-triangle" points="${x}, ${y - 12} ${x - 12}, ${y + 10} ${x + 12}, ${y + 10}" fill="${FILL_SOFT}" stroke="${INK}"/>` },
    { key: 'مربع', draw: (x, y) => `<rect class="mf-shape mf-square" x="${x - 11}" y="${y - 11}" width="22" height="22" fill="#fff" stroke="${INK}"/>` },
    { key: 'دایره', draw: (x, y) => `<circle class="mf-shape mf-circle" cx="${x}" cy="${y}" r="11" fill="${FILL_SOFT}" stroke="${INK}"/>` },
    { key: 'مستطیل', draw: (x, y) => `<rect class="mf-shape mf-rectangle" x="${x - 15}" y="${y - 9}" width="30" height="18" fill="#fff" stroke="${INK}"/>` }
  ].filter(k => (counts[k.key] || 0) > 0);
  if (!kinds.length) return null;
  const total = kinds.reduce((a, k) => a + counts[k.key], 0);
  if (total > 30) return null;
  const perRow = Math.min(6, total);
  const rows = Math.ceil(total / perRow);
  const W = 30 + perRow * 40, H = 30 + rows * 40;
  let body = '', i = 0;
  for (const k of kinds) {
    for (let n = 0; n < counts[k.key]; n++) {
      const cx = 30 + (i % perRow) * 40, cy = 30 + Math.floor(i / perRow) * 40;
      body += k.draw(cx, cy);
      i++;
    }
  }
  return wrap(W, H, 'M_GEO_SHAPES', `${total} شکل هندسی`, body);
}

function svgClock(hour, minute) {
  if (hour < 0 || hour > 12 || minute < 0 || minute > 59) return null;
  const W = 160, H = 160, cx = 80, cy = 80, r = 62;
  let body = `<circle class="mf-clock" cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  for (let k = 0; k < 12; k++) {
    const a = (k * 30) * Math.PI / 180;
    body += `<line x1="${cx + (r - 8) * Math.sin(a)}" y1="${cy - (r - 8) * Math.cos(a)}" x2="${cx + r * Math.sin(a)}" y2="${cy - r * Math.cos(a)}" stroke="${INK}" stroke-width="1.4"/>`;
  }
  const hA = ((hour % 12) + minute / 60) * 30 * Math.PI / 180;
  body += `<line class="mf-hand mf-hand-hour" x1="${cx}" y1="${cy}" x2="${cx + 30 * Math.sin(hA)}" y2="${cy - 30 * Math.cos(hA)}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  const mA = minute * 6 * Math.PI / 180;
  body += `<line class="mf-hand mf-hand-minute" x1="${cx}" y1="${cy}" x2="${cx + 48 * Math.sin(mA)}" y2="${cy - 48 * Math.cos(mA)}" stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="round"/>`;
  return wrap(W, H, 'M_CLOCK_TIME', `ساعت ${hour}:${String(minute).padStart(2, '0')}`, body);
}

function svgBalance(leftCount, rightUnknown) {
  if (leftCount < 1 || leftCount > 10) return null;
  const W = 300, H = 140, bx = 150, by = 34;
  let body = `<polygon class="mf-stand" points="${bx - 6},${by + 74} ${bx + 6},${by + 74} ${bx + 2},${by + 12} ${bx - 2},${by + 12}" fill="${INK}"/>`;
  body += `<line class="mf-beam" x1="40" y1="${by}" x2="260" y2="${by}" stroke="${INK}" stroke-width="3"/>`;
  for (const [px, cls] of [[92, 'mf-pan'], [208, 'mf-pan']]) {
    body += `<path class="${cls}" d="M ${px - 34} ${by + 6} A 34 20 0 0 0 ${px + 34} ${by + 6} Z" fill="#fff" stroke="${INK}"/>`;
  }
  for (let k = 0; k < leftCount; k++) {
    body += `<rect class="mf-weight" x="${72 + (k % 4) * 16}" y="${by + 16 + Math.floor(k / 4) * 12}" width="12" height="10" fill="${FILL_SOFT}" stroke="${INK}"/>`;
  }
  if (rightUnknown) {
    body += `<text class="mf-mystery" x="208" y="${by + 30}" font-size="16" text-anchor="middle" fill="${ACCENT}">؟</text>`;
  }
  return wrap(W, H, 'M_BALANCE', 'ترازو', body);
}

function svgMoney(bills, coins) {
  const billTotal = (bills['هزار'] || 0) + (bills['دوهزار'] || 0) + (bills['پانصد'] || 0);
  if (billTotal + coins < 1 || billTotal > 12 || coins > 12) return null;
  const W = 30 + Math.max(billTotal, coins) * 46, H = 120;
  const BILL_W = 40, BILL_H = 20;
  const values = { 'پانصد': '۵۰۰', 'دوهزار': '۲۰۰۰', 'هزار': '۱۰۰۰' };
  let body = '', x = 24;
  for (const key of ['هزار', 'دوهزار', 'پانصد']) {
    for (let k = 0; k < (bills[key] || 0); k++) {
      body += `<rect class="mf-bill" x="${x}" y="26" width="${BILL_W}" height="${BILL_H}" rx="3" fill="#fff" stroke="${INK}"/>`;
      body += `<text x="${x + BILL_W / 2}" y="40" font-size="9" text-anchor="middle" fill="${INK}">${values[key]}</text>`;
      x += 46;
    }
  }
  let cx0 = 24 + Math.max(0, (billTotal - coins) * 23);
  for (let k = 0; k < coins; k++) {
    body += `<circle class="mf-coin" cx="${cx0 + 20 + k * 46}" cy="84" r="13" fill="${FILL_SOFT}" stroke="${INK}"/>`;
  }
  return wrap(W, H, 'M_MONEY', 'سکه و اسکناس', body);
}

function svgChart(cats, values) {
  if (!Array.isArray(cats) || !Array.isArray(values)) return null;
  if (cats.length < 2 || cats.length > 8 || cats.length !== values.length) return null;
  if (values.some(v => v === '?' || v === null || v < 0 || v > 100)) return null;
  const W = 60 + cats.length * 64, H = 190;
  const maxV = Math.max(...values, 1);
  const baseY = 150, chartH = 100;
  let body = `<line x1="30" y1="${baseY}" x2="${W - 20}" y2="${baseY}" stroke="${INK}"/>`;
  cats.forEach((c, i) => {
    const x = 48 + i * 64;
    const bh = Math.max(2, (values[i] / maxV) * chartH);
    body += `<rect class="mf-col" x="${x}" y="${baseY - bh}" width="36" height="${bh}" fill="${FILL_SOFT}" stroke="${INK}"/>`;
    body += `<text class="mfl-col" x="${x + 18}" y="${baseY - bh - 6}" font-size="11" text-anchor="middle" fill="${INK}">${values[i]}</text>`;
    body += `<text class="mfl-cat" x="${x + 18}" y="${baseY + 16}" font-size="11" text-anchor="middle" fill="${INK}">${escapeXml(c)}</text>`;
  });
  return wrap(W, H, 'M_CHART', 'نمودار میله‌ای', body);
}

function svgPattern(terms) {
  if (!Array.isArray(terms) || terms.length < 2 || terms.length > 6) return null;
  const W = 30 + terms.length * 62, H = 76;
  let body = '';
  terms.forEach((t, i) => {
    const x = 22 + i * 62;
    if (t === '?') {
      body += `<rect class="mf-term mf-term-question" x="${x}" y="18" width="46" height="40" rx="8" fill="none" stroke="${ACCENT}" stroke-dasharray="5 3"/>`;
      body += `<text class="mfl-term" x="${x + 23}" y="44" font-size="16" text-anchor="middle" fill="${ACCENT}">؟</text>`;
    } else {
      body += `<rect class="mf-term" x="${x}" y="18" width="46" height="40" rx="8" fill="${FILL_SOFT}" stroke="${INK}"/>`;
      body += `<text class="mfl-term" x="${x + 23}" y="44" font-size="14" text-anchor="middle" fill="${INK}">${t}</text>`;
    }
    if (i < terms.length - 1) {
      body += `<text x="${x + 53}" y="44" font-size="12" text-anchor="middle" fill="${INK}">←</text>`;
    }
  });
  return wrap(W, H, 'M_PATTERN', 'الگو', body);
}

// ── رندرر اصلی ──

/**
 * رندر SVG از خروجی parseVisualSpec.
 * خروجی: رشتهٔ SVG یا null (مدل نامعلوم/پارامتر نامعتبر — صادقانه بی‌الگو).
 */
export function renderModelFigureSVG(parsed) {
  try {
    if (!parsed || typeof parsed !== 'object' || !parsed.model) return null;
    const p = parsed.params || {};
    switch (parsed.model) {
      case 'M_ARRAY': {
        const r = num(p, 'سطر'), c = num(p, 'ستون');
        if (r === null || c === null) return null;
        return svgArray(r, c);
      }
      case 'M_GROUPS': {
        const g = num(p, 'گروه'), s = num(p, 'اندازه');
        if (g === null || s === null) return null;
        return svgGroups(g, s);
      }
      case 'M_NUMBERLINE': {
        const f = num(p, 'از'), t = num(p, 'تا'), s = num(p, 'پرش');
        if (f === null || t === null || s === null) return null;
        return svgNumberline(f, t, s);
      }
      case 'M_BUNDLES': {
        const t = num(p, 'ده‌تایی'), o = num(p, 'تک');
        if (t === null || o === null) return null;
        return svgBundles(t, o);
      }
      case 'M_PLACEVALUE': {
        const chips = { 'هزار': num(p, 'هزار') ?? 0, 'صد': num(p, 'صد') ?? 0, 'ده': num(p, 'ده') ?? 0, 'یک': num(p, 'یک') ?? 0 };
        return svgPlacevalue(chips);
      }
      case 'M_AREAMODEL': {
        const h = (numList(p, 'قطع_افقی') || []).filter(v => v !== '?');
        const v = (numList(p, 'قطع_عمودی') || []).filter(v => v !== '?');
        return svgAreaModel(h, v);
      }
      case 'M_BARS': {
        const b = num(p, 'نوار'), d = num(p, 'تقسیم');
        if (b === null || d === null) return null;
        return svgBars(b, d);
      }
      case 'M_FRACTION': {
        const d = num(p, 'تقسیم'), f = num(p, 'رنگی') ?? 0;
        const shape = p['شکل'] === 'دیسک' ? 'دیسک' : 'نوار';
        if (d === null) return null;
        return svgFraction(d, f, shape);
      }
      case 'M_GEO_SHAPES': {
        const counts = {
          'مثلث': num(p, 'مثلث') ?? 0,
          'مربع': num(p, 'مربع') ?? 0,
          'دایره': num(p, 'دایره') ?? 0,
          'مستطیل': num(p, 'مستطیل') ?? 0
        };
        return svgGeoShapes(counts);
      }
      case 'M_CLOCK_TIME': {
        const h = num(p, 'ساعت') ?? 0, m = num(p, 'دقیقه') ?? 0;
        return svgClock(h, m);
      }
      case 'M_BALANCE': {
        const left = num(p, 'چپ');
        const right = p['راست'];
        if (left === null) return null;
        return svgBalance(left, right !== undefined);
      }
      case 'M_MONEY': {
        const bills = {
          'هزار': num(p, 'هزار') ?? 0,
          'دوهزار': num(p, 'دوهزار') ?? 0,
          'پانصد': num(p, 'پانصد') ?? 0
        };
        const coins = num(p, 'سکه') ?? 0;
        return svgMoney(bills, coins);
      }
      case 'M_CHART': {
        return svgChart(strList(p, 'رده‌ها'), numList(p, 'مقادیر'));
      }
      case 'M_PATTERN': {
        return svgPattern(numList(p, 'جمله‌ها'));
      }
      default:
        return null; // مدل نامعلوم — صادقانه بی‌الگو
    }
  } catch {
    return null; // هرگز استثنا نمی‌دهد
  }
}

/**
 * اتصال امنِ ستون تصویر (برای sheet/داشبورد/ابزار پیش‌نمایش):
 *   specText معتبر → { kind: 'svg', svg }
 *   «—»/خالی/بدشکل → { kind: 'text', text } (fallback متنی — هرگز استثنا)
 */
export function renderVisualColumn(specText) {
  try {
    const parsed = parseVisualSpec(specText);
    if (parsed) {
      const svg = renderModelFigureSVG(parsed);
      if (svg) return { kind: 'svg', svg };
    }
    const t = String(specText ?? '').trim();
    return { kind: 'text', text: t && t !== '—' ? t : '' };
  } catch {
    return { kind: 'text', text: '' };
  }
}
