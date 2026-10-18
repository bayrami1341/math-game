// Pure 2.5D Isometric Vector (SVG) Visual Generators strictly adhering to station-brief.md
import { COLORS } from './constants.js';

/**
 * 8 Authorized Visual Representations (100% Pure Lightweight SVG — Zero Raster Dependencies):
 * 1. map-dark: Map background with 3 stations in order (Power bottom, Tower center, Pad top), no text.
 * 2. power-dark: Power station unlit (locked).
 * 3. tower-dark: Tower unlit (locked).
 * 4. pad-dark: Pad unlit with parked spacecraft (locked).
 * 5. path-power-to-tower: Lit path between Power station and Tower.
 * 6. path-tower-to-pad: Lit path between Tower and Launch pad.
 * 7. cell-off: Dark unlit cell.
 * 8. cell-on: Lit cyan/emerald cell (no coin, no star).
 */

export const VISUAL_ASSETS = Object.freeze({
  'map-dark': 'assets/v10/map-dark.svg',
  'power-dark': 'assets/v10/power-dark.svg',
  'power-lit': 'assets/v10/power-lit.svg',
  'tower-dark': 'assets/v10/tower-dark.svg',
  'tower-lit': 'assets/v10/tower-lit.svg',
  'pad-dark': 'assets/v10/pad-dark.svg',
  'pad-lit': 'assets/v10/pad-lit.svg',
  'path-power-to-tower': 'assets/v10/path-power-to-tower.svg',
  'path-tower-to-pad': 'assets/v10/path-tower-to-pad.svg',
  'cell-off': 'assets/v10/cell-off.svg',
  'cell-on': 'assets/v10/cell-on.svg'
});

export function renderBuildingSVG(buildingId, state = 'locked') {
  // state: 'locked' | 'current' | 'done'
  const isCurrent = state === 'current';
  const isDone = state === 'done';
  const strokeColor = isCurrent ? COLORS.currentRing : (isDone ? COLORS.done : COLORS.locked);
  const primaryGlow = isDone ? COLORS.done : (isCurrent ? COLORS.currentRing : '#354b5e');
  const secondaryGlow = isDone ? '#7ef0ff' : (isCurrent ? '#5ee0b5' : '#243647');
  const hullTop = isDone ? '#174843' : (isCurrent ? '#163850' : '#132235');
  const hullFront = isDone ? '#113532' : (isCurrent ? '#10293d' : '#0e1b2b');
  const hullSide = isDone ? '#0c2624' : (isCurrent ? '#0b1e2e' : '#0a1421');
  const metalTrim = isCurrent || isDone ? '#1d4358' : '#1a2c3e';
  const windowOpacity = isCurrent || isDone ? '0.95' : '0.22';

  // Ring for current building ONLY (never on locked or done):
  const isoHalo = isCurrent ? `
    <circle cx="100" cy="100" r="92" fill="none" stroke="${COLORS.currentRing}" stroke-width="1.5" stroke-opacity="0.28" />
    <circle cx="100" cy="100" r="86" fill="none" stroke="${COLORS.currentRing}" stroke-width="4" stroke-dasharray="12 8" stroke-linecap="round" class="current-halo">
      <animate attributeName="stroke-dashoffset" values="0;40" dur="2.2s" repeatCount="indefinite" />
    </circle>
  ` : '';

  if (buildingId === 1) {
    // ۱. نیروگاه (پایین نقشه) — طراحی برداری ایزومتریک ۲.۵ بعدی با گنبد پلاسما، توربین ۶ پره، فونداسیون چندضلعی و پنجرهٔ پانورامیک
    const uid = `pwr-${state}`;
    return `
      <svg class="station-svg power-svg state-${state}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id="${uid}-dome" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stop-color="${primaryGlow}" stop-opacity="${isCurrent || isDone ? '0.9' : '0.2'}"/>
            <stop offset="65%" stop-color="${COLORS.accent}" stop-opacity="${isCurrent || isDone ? '0.55' : '0.15'}"/>
            <stop offset="100%" stop-color="#071427" stop-opacity="0.95"/>
          </radialGradient>
          <linearGradient id="${uid}-front" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${hullTop}"/>
            <stop offset="100%" stop-color="${hullFront}"/>
          </linearGradient>
          <linearGradient id="${uid}-window" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${COLORS.currentRing}"/>
            <stop offset="100%" stop-color="${COLORS.done}"/>
          </linearGradient>
        </defs>
        ${isoHalo}
        <!-- فونداسیون ایزومتریک و خطوط مدار -->
        <ellipse cx="100" cy="162" rx="68" ry="14" fill="${primaryGlow}" fill-opacity="${isCurrent || isDone ? '0.16' : '0.04'}"/>
        <polygon points="28,148 100,166 172,148 156,136 44,136" fill="${hullFront}" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round"/>
        <polygon points="28,148 100,166 100,174 28,156" fill="${hullSide}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>
        <polygon points="172,148 100,166 100,174 172,156" fill="${hullTop}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M 48 158 L 26 168 M 74 165 L 62 176" stroke="${primaryGlow}" stroke-width="2.5" stroke-linecap="round" stroke-opacity="${windowOpacity}"/>
        <path d="M 152 158 L 174 168" stroke="${secondaryGlow}" stroke-width="2.5" stroke-linecap="round" stroke-opacity="${windowOpacity}"/>
        <!-- دیسک خنک‌کننده پشتی و گنبد پلاسما -->
        <circle cx="54" cy="84" r="22" fill="${hullSide}" stroke="${strokeColor}" stroke-width="2.2"/>
        <circle cx="54" cy="84" r="15" fill="${metalTrim}" stroke="${primaryGlow}" stroke-width="1.4" stroke-opacity="${windowOpacity}"/>
        <path d="M 122 60 L 122 44 Q 122 36 130 36 L 138 36 L 138 72" fill="none" stroke="${strokeColor}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 122 60 L 122 44 Q 122 36 130 36 L 138 36 L 138 72" fill="none" stroke="${primaryGlow}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${windowOpacity}"/>
        <path d="M 68 64 C 68 34, 132 34, 132 64 Z" fill="url(#${uid}-dome)" stroke="${strokeColor}" stroke-width="2.5"/>
        <ellipse cx="100" cy="52" rx="22" ry="6" fill="none" stroke="${primaryGlow}" stroke-width="2" stroke-opacity="${windowOpacity}"/>
        <ellipse cx="100" cy="44" rx="13" ry="4" fill="${secondaryGlow}" fill-opacity="${windowOpacity}"/>
        <ellipse cx="100" cy="64" rx="34" ry="8" fill="${hullTop}" stroke="${strokeColor}" stroke-width="2.2"/>
        <!-- بدنه سه‌بعدی، پنجره پانورامیک و درگاه -->
        <polygon points="44,72 100,58 152,72 100,86" fill="${hullTop}" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round"/>
        <polygon points="44,72 100,86 100,152 44,136" fill="url(#${uid}-front)" stroke="${strokeColor}" stroke-width="2.4" stroke-linejoin="round"/>
        <polygon points="100,86 152,72 152,136 100,152" fill="${hullSide}" stroke="${strokeColor}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M 74 66 Q 66 72 66 84" fill="none" stroke="${primaryGlow}" stroke-width="4" stroke-linecap="round" stroke-opacity="${windowOpacity}"/>
        <path d="M 84 69 Q 76 75 76 87" fill="none" stroke="${secondaryGlow}" stroke-width="4" stroke-linecap="round" stroke-opacity="${windowOpacity}"/>
        <polygon points="52,88 92,98 92,114 52,104" fill="#071427" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>
        <polygon points="55,91 89,100 89,111 55,102" fill="url(#${uid}-window)" fill-opacity="${windowOpacity}"/>
        <path d="M 62 142 L 62 120 Q 72 114 82 122 L 82 147 Z" fill="${metalTrim}" stroke="${strokeColor}" stroke-width="2.2"/>
        <path d="M 66 143 L 66 124 Q 72 120 78 125 L 78 146 Z" fill="${primaryGlow}" fill-opacity="${windowOpacity}"/>
        <rect x="49" y="114" width="5" height="16" rx="2.5" fill="${secondaryGlow}" fill-opacity="${windowOpacity}" stroke="${strokeColor}" stroke-width="1"/>
        <rect x="88" y="122" width="5" height="16" rx="2.5" fill="${secondaryGlow}" fill-opacity="${windowOpacity}" stroke="${strokeColor}" stroke-width="1"/>
        <!-- توربین ۶ پره سمت راست -->
        <circle cx="132" cy="106" r="24" fill="${hullFront}" stroke="${strokeColor}" stroke-width="2.5"/>
        <circle cx="132" cy="106" r="19" fill="#071427" stroke="${primaryGlow}" stroke-width="1.8" stroke-opacity="${windowOpacity}"/>
        <g stroke="${secondaryGlow}" stroke-width="2.6" stroke-linecap="round" fill="none" opacity="${windowOpacity}">
          <path d="M 132 106 Q 138 94 146 96"/>
          <path d="M 132 106 Q 144 108 142 118"/>
          <path d="M 132 106 Q 132 118 122 118"/>
          <path d="M 132 106 Q 120 110 120 98"/>
          <path d="M 132 106 Q 126 92 136 90"/>
          <path d="M 132 106 Q 142 100 146 108"/>
        </g>
        <circle cx="132" cy="106" r="5.5" fill="${primaryGlow}" stroke="${strokeColor}" stroke-width="1.8"/>
        <circle cx="114" cy="134" r="7" fill="${hullFront}" stroke="${strokeColor}" stroke-width="1.8"/>
        <circle cx="114" cy="134" r="3.5" fill="${secondaryGlow}" fill-opacity="${windowOpacity}"/>
      </svg>
    `;
  }

  if (buildingId === 2) {
    // ۲. برج ارتباط (وسط نقشه) — طراحی برداری ایزومتریک ۲.۵ بعدی با دیش مخابراتی فضایی، دکل مشبک سه‌بعدی، اتاقک فرستنده و امواج ارتباطی
    const uid = `twr-${state}`;
    const wavesMarkup = (isCurrent || isDone) ? `
      <g class="signal-waves" stroke="${primaryGlow}" fill="none" stroke-linecap="round">
        <path d="M 122 34 A 22 22 0 0 1 142 54" stroke-width="3" stroke-opacity="0.9"/>
        <path d="M 128 24 A 34 34 0 0 1 154 50" stroke-width="2.4" stroke-opacity="0.65"/>
        <path d="M 134 14 A 46 46 0 0 1 166 46" stroke-width="1.8" stroke-opacity="0.4"/>
      </g>
    ` : '';

    return `
      <svg class="station-svg tower-svg state-${state}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id="${uid}-dish" cx="45%" cy="45%" r="55%">
            <stop offset="0%" stop-color="${primaryGlow}" stop-opacity="${isCurrent || isDone ? '0.75' : '0.18'}"/>
            <stop offset="60%" stop-color="${hullTop}" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="${hullSide}" stop-opacity="1"/>
          </radialGradient>
        </defs>
        ${isoHalo}
        <!-- فونداسیون ایزومتریک هشت‌ضلعی برج ارتباط -->
        <ellipse cx="100" cy="166" rx="64" ry="12" fill="${primaryGlow}" fill-opacity="${isCurrent || isDone ? '0.15' : '0.04'}"/>
        <polygon points="36,154 100,170 164,154 148,142 52,142" fill="${hullFront}" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round"/>
        <polygon points="36,154 100,170 100,177 36,161" fill="${hullSide}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>
        <polygon points="164,154 100,170 100,177 164,161" fill="${hullTop}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>
        <!-- پایه‌های مهار و ستون‌های دکل مخابراتی -->
        <polygon points="62,152 78,78 100,84 88,158" fill="${hullFront}" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round"/>
        <polygon points="138,152 122,78 100,84 112,158" fill="${hullSide}" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round"/>
        <!-- سازه مشبک و ضربدری میانی دکل -->
        <line x1="74" y1="98" x2="126" y2="98" stroke="${strokeColor}" stroke-width="2.4"/>
        <line x1="68" y1="124" x2="132" y2="124" stroke="${strokeColor}" stroke-width="2.4"/>
        <line x1="78" y1="78" x2="126" y2="98" stroke="${metalTrim}" stroke-width="2"/>
        <line x1="122" y1="78" x2="74" y2="98" stroke="${metalTrim}" stroke-width="2"/>
        <line x1="74" y1="98" x2="132" y2="124" stroke="${metalTrim}" stroke-width="2"/>
        <line x1="126" y1="98" x2="68" y2="124" stroke="${metalTrim}" stroke-width="2"/>
        <!-- لوله موج‌بر عمودی و هسته مرکزی فرستنده -->
        <line x1="100" y1="78" x2="100" y2="156" stroke="${primaryGlow}" stroke-width="3.5" stroke-opacity="${windowOpacity}"/>
        <circle cx="100" cy="112" r="11" fill="#071427" stroke="${strokeColor}" stroke-width="2.2"/>
        <circle cx="100" cy="112" r="6" fill="${primaryGlow}" fill-opacity="${windowOpacity}"/>
        <!-- بوسترهای سیگنال کناری روی دکل -->
        <rect x="60" y="104" width="7" height="16" rx="3" fill="${secondaryGlow}" fill-opacity="${windowOpacity}" stroke="${strokeColor}" stroke-width="1.4"/>
        <rect x="133" y="104" width="7" height="16" rx="3" fill="${secondaryGlow}" fill-opacity="${windowOpacity}" stroke="${strokeColor}" stroke-width="1.4"/>
        <!-- اتاقک کنترل ایزومتریک زیر آنتن -->
        <polygon points="68,72 100,64 132,72 100,80" fill="${hullTop}" stroke="${strokeColor}" stroke-width="2"/>
        <polygon points="68,72 100,80 100,90 68,82" fill="${hullFront}" stroke="${strokeColor}" stroke-width="2"/>
        <polygon points="132,72 100,80 100,90 132,82" fill="${hullSide}" stroke="${strokeColor}" stroke-width="2"/>
        <rect x="76" y="75" width="14" height="4" rx="2" fill="${primaryGlow}" fill-opacity="${windowOpacity}"/>
        <circle cx="114" cy="78" r="2.2" fill="${secondaryGlow}" fill-opacity="${windowOpacity}"/>
        <circle cx="122" cy="76" r="2.2" fill="${primaryGlow}" fill-opacity="${windowOpacity}"/>
        <!-- بشقاب سهموی آنتن ارتباط با زمین -->
        <ellipse cx="96" cy="46" rx="38" ry="22" transform="rotate(-24 96 46)" fill="url(#${uid}-dish)" stroke="${strokeColor}" stroke-width="2.6"/>
        <ellipse cx="96" cy="46" rx="24" ry="13" transform="rotate(-24 96 46)" fill="none" stroke="${primaryGlow}" stroke-width="1.6" stroke-opacity="${windowOpacity}"/>
        <!-- بازوی کانونی و گوی فرستنده دیش -->
        <line x1="88" y1="50" x2="114" y2="30" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round"/>
        <line x1="104" y1="58" x2="114" y2="30" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="116" cy="28" r="6.5" fill="${primaryGlow}" stroke="${strokeColor}" stroke-width="2"/>
        ${wavesMarkup}
      </svg>
    `;
  }

  if (buildingId === 3) {
    // ۳. سکوی پرتاب با سفینه ایستاده (بالای نقشه) — طراحی برداری ایزومتریک ۲.۵ بعدی با دکل مهار، بازوی سوخت‌رسانی و فضاپیمای ایستاده روی سکو
    const uid = `pad-${state}`;
    return `
      <svg class="station-svg pad-svg state-${state}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="${uid}-shuttle" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${hullTop}"/>
            <stop offset="55%" stop-color="${hullFront}"/>
            <stop offset="100%" stop-color="${hullSide}"/>
          </linearGradient>
        </defs>
        ${isoHalo}
        <!-- سکوی ایزومتریک پرتاب و دریچه‌های هدایت سوخت -->
        <ellipse cx="100" cy="164" rx="70" ry="14" fill="${primaryGlow}" fill-opacity="${isCurrent || isDone ? '0.16' : '0.04'}"/>
        <polygon points="24,148 100,166 176,148 158,134 42,134" fill="${hullFront}" stroke="${strokeColor}" stroke-width="2.4" stroke-linejoin="round"/>
        <polygon points="24,148 100,166 100,176 24,158" fill="${hullSide}" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round"/>
        <polygon points="176,148 100,166 100,176 176,158" fill="${hullTop}" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round"/>
        <rect x="86" y="154" width="28" height="5" rx="2.5" fill="${primaryGlow}" fill-opacity="${windowOpacity}"/>
        <!-- مخزن کپسول سوخت در سمت چپ سکو -->
        <rect x="38" y="106" width="16" height="34" rx="6" fill="${hullSide}" stroke="${strokeColor}" stroke-width="2"/>
        <rect x="42" y="112" width="8" height="22" rx="3" fill="${secondaryGlow}" fill-opacity="${windowOpacity}"/>
        <path d="M 46 106 L 46 76 L 68 76" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linejoin="round"/>
        <!-- دکل ایزومتریک مهار و سوخت‌رسانی در سمت راست -->
        <polygon points="136,34 156,34 156,142 136,142" fill="${hullSide}" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round"/>
        <rect x="132" y="30" width="28" height="6" rx="2" fill="${hullTop}" stroke="${strokeColor}" stroke-width="2"/>
        <line x1="136" y1="52" x2="156" y2="70" stroke="${strokeColor}" stroke-width="1.8"/>
        <line x1="156" y1="52" x2="136" y2="70" stroke="${strokeColor}" stroke-width="1.8"/>
        <line x1="136" y1="74" x2="156" y2="92" stroke="${strokeColor}" stroke-width="1.8"/>
        <line x1="156" y1="74" x2="136" y2="92" stroke="${strokeColor}" stroke-width="1.8"/>
        <line x1="136" y1="96" x2="156" y2="114" stroke="${strokeColor}" stroke-width="1.8"/>
        <line x1="156" y1="96" x2="136" y2="114" stroke="${strokeColor}" stroke-width="1.8"/>
        <!-- بازوی افقی اتصال سوخت به بدنه سفینه -->
        <rect x="104" y="60" width="32" height="7" rx="2" fill="${hullFront}" stroke="${strokeColor}" stroke-width="2"/>
        <line x1="106" y1="63.5" x2="134" y2="63.5" stroke="${primaryGlow}" stroke-width="2.4" stroke-opacity="${windowOpacity}"/>
        <!-- سفینه فضایی ایستاده روی سکو (آرام، بدون شعله و بدون پرواز به بیرون نقشه) -->
        <!-- بال‌های دلتا چپ و راست -->
        <polygon points="72,86 48,124 72,130" fill="${hullFront}" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round"/>
        <polygon points="108,86 132,124 108,130" fill="${hullSide}" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round"/>
        <!-- پایه‌های فرود ایستاده روی سکو -->
        <rect x="74" y="132" width="8" height="10" rx="1.5" fill="${metalTrim}" stroke="${strokeColor}" stroke-width="1.8"/>
        <rect x="98" y="132" width="8" height="10" rx="1.5" fill="${metalTrim}" stroke="${strokeColor}" stroke-width="1.8"/>
        <!-- بدنه اصلی فضاپیما -->
        <path d="M 90 28 C 104 44, 110 76, 110 132 L 70 132 C 70 76, 76 44, 90 28 Z" fill="url(#${uid}-shuttle)" stroke="${strokeColor}" stroke-width="2.6" stroke-linejoin="round"/>
        <!-- دماغه و شیشه کابین سفینه -->
        <path d="M 90 28 C 95 34, 98 42, 99 48 L 81 48 C 82 42, 85 34, 90 28 Z" fill="#071427" stroke="${strokeColor}" stroke-width="2"/>
        <path d="M 82 56 Q 90 50 98 56 L 96 64 Q 90 60 84 64 Z" fill="${primaryGlow}" fill-opacity="${windowOpacity}"/>
        <!-- مخزن و نشانگر عمودی اندازه سوخت روی بدنه سفینه -->
        <rect x="83" y="72" width="14" height="38" rx="6" fill="#071427" stroke="${strokeColor}" stroke-width="1.8"/>
        <rect x="86" y="76" width="8" height="30" rx="4" fill="${secondaryGlow}" fill-opacity="${windowOpacity}"/>
        <!-- نشانگرهای باله و سکان عمودی -->
        <line x1="90" y1="112" x2="90" y2="136" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round"/>
        <rect x="56" y="118" width="10" height="4" rx="2" fill="${primaryGlow}" fill-opacity="${windowOpacity}"/>
        <rect x="114" y="118" width="10" height="4" rx="2" fill="${primaryGlow}" fill-opacity="${windowOpacity}"/>
      </svg>
    `;
  }

  return '';
}

export function renderPathSVG(pathId, isLit = false) {
  // pathId: 1 (نیروگاه به برج), 2 (برج به سکو) — مسیر برداری ایزومتریک با ریل‌های هادی و گره‌های انرژی
  const stroke = isLit ? COLORS.done : '#1e344a';
  const secondaryStroke = isLit ? COLORS.currentRing : '#122441';
  const glow = isLit ? `filter="drop-shadow(0 0 6px ${COLORS.done})"` : '';
  const dash = isLit ? 'stroke-dasharray="none"' : 'stroke-dasharray="6 6"';
  const nodeFill = isLit ? COLORS.done : '#16283d';

  return `
    <svg class="path-svg path-${pathId} ${isLit ? 'lit' : 'unlit'}" viewBox="0 0 40 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- بستر ایزومتریک مسیر -->
      <rect x="12" y="0" width="16" height="120" fill="#09182b" stroke="${secondaryStroke}" stroke-width="1.5" stroke-opacity="${isLit ? '0.55' : '0.35'}"/>
      <!-- خط اصلی انتقال انرژی -->
      <line x1="20" y1="0" x2="20" y2="120" stroke="${stroke}" stroke-width="4.5" ${dash} ${glow}/>
      <!-- گره‌های تقویت مسیر -->
      <circle cx="20" cy="28" r="4" fill="${nodeFill}" stroke="${stroke}" stroke-width="1.8"/>
      <circle cx="20" cy="60" r="4" fill="${nodeFill}" stroke="${stroke}" stroke-width="1.8"/>
      <circle cx="20" cy="92" r="4" fill="${nodeFill}" stroke="${stroke}" stroke-width="1.8"/>
    </svg>
  `;
}

export function renderCellSVG(isLit = false) {
  // سلول خاموش یا سلول روشن. باتری مستطیلی ایزومتریک ایستگاه — سکه و ستاره نیست!
  if (isLit) {
    return `
      <svg class="cell-svg lit" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- قاب بیرونی پخ‌خورده سلول روشن -->
        <polygon points="10,4 34,4 40,10 40,34 34,40 10,40 4,34 4,10" fill="#122e3d" stroke="${COLORS.currentRing}" stroke-width="2.4" stroke-linejoin="round"/>
        <!-- قاب میانی تیل -->
        <rect x="9" y="9" width="26" height="26" rx="4" fill="#146a62" stroke="${COLORS.done}" stroke-width="1.5"/>
        <!-- هسته مستطیلی نورانی سلول -->
        <rect x="13" y="12" width="18" height="20" rx="2.5" fill="${COLORS.done}"/>
        <!-- کنتاکت‌های بالا و پایین باتری -->
        <rect x="17" y="6" width="10" height="2.5" rx="1" fill="${COLORS.currentRing}"/>
        <rect x="17" y="35.5" width="10" height="2.5" rx="1" fill="${COLORS.currentRing}"/>
      </svg>
    `;
  }
  return `
    <svg class="cell-svg unlit" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- قاب بیرونی پخ‌خورده سلول خاموش -->
      <polygon points="10,4 34,4 40,10 40,34 34,40 10,40 4,34 4,10" fill="#0b1726" stroke="#2a4057" stroke-width="2.2" stroke-linejoin="round"/>
      <!-- قاب میانی خاموش -->
      <rect x="9" y="9" width="26" height="26" rx="4" fill="#0f2034" stroke="#1d3554" stroke-width="1.4"/>
      <!-- هسته مستطیلی تاریک سلول -->
      <rect x="13" y="12" width="18" height="20" rx="2.5" fill="#14263c"/>
      <!-- کنتاکت‌های بالا و پایین باتری -->
      <rect x="17" y="6" width="10" height="2.5" rx="1" fill="#2a4057"/>
      <rect x="17" y="35.5" width="10" height="2.5" rx="1" fill="#2a4057"/>
    </svg>
  `;
}

export function renderMapBackdropSVG() {
  // پس‌زمینه برداری نقشه ایستگاه (map-dark) با ۳ سکوی استقرار عمودی از پایین به بالا، بدون متن و بدون ستاره
  return `
    <svg class="map-backdrop-svg" viewBox="0 0 420 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="map-atmo" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stop-color="#102949" stop-opacity="0.75"/>
          <stop offset="100%" stop-color="#071427" stop-opacity="1"/>
        </radialGradient>
      </defs>
      <rect width="420" height="640" fill="url(#map-atmo)"/>
      <!-- خطوط تراز و تراس‌های ایزومتریک سه بنا از پایین به بالا -->
      <path d="M 0 190 Q 210 160 420 190 L 420 640 L 0 640 Z" fill="#09192f" fill-opacity="0.7" stroke="#163050" stroke-width="1.5"/>
      <path d="M 0 390 Q 210 360 420 390 L 420 640 L 0 640 Z" fill="#0b1d36" fill-opacity="0.8" stroke="#1b395e" stroke-width="1.5"/>
      <path d="M 0 560 Q 210 535 420 560 L 420 640 L 0 640 Z" fill="#0d223f" stroke="#1d3554" stroke-width="1.5"/>
      <!-- سکوهای استقرار زیر ۳ بنا (بالا: سکو، وسط: برج، پایین: نیروگاه) -->
      <ellipse cx="210" cy="128" rx="95" ry="24" fill="#0d223c" stroke="#1d3554" stroke-width="1.5"/>
      <ellipse cx="210" cy="324" rx="95" ry="24" fill="#0d223c" stroke="#1d3554" stroke-width="1.5"/>
      <ellipse cx="210" cy="520" rx="105" ry="26" fill="#0d223c" stroke="#1d3554" stroke-width="1.5"/>
    </svg>
  `;
}

export function renderEqualGroupsSVG(groupsCount, itemsPerGroup) {
  // دسته‌های مساوی را نشان می‌دهد و حاصل را به رقم نمی‌نویسد
  // جواب را انتخاب نمی‌کند
  let groupsHtml = '';
  for (let g = 0; g < groupsCount; g++) {
    let itemsHtml = '';
    for (let item = 0; item < itemsPerGroup; item++) {
      itemsHtml += `<span class="group-item" aria-hidden="true">●</span>`;
    }
    groupsHtml += `<div class="equal-group" aria-label="یک دسته">${itemsHtml}</div>`;
  }
  return `<div class="equal-groups-container">${groupsHtml}</div>`;
}
