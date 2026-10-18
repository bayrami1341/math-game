// Visual generators strictly adhering to station-brief.md and v10.1
import { COLORS } from './constants.js';

const KEY_TO_ID = { power: 1, tower: 2, pad: 3, 1: 1, 2: 2, 3: 3 };

/**
 * 8 Authorized Visual Representations (Clean SVG):
 * 1. map-dark: Map background with 3 stations in order (Power bottom, Tower center, Pad top), no text.
 * 2. power-dark: Power station unlit (locked).
 * 3. tower-dark: Tower unlit (locked).
 * 4. pad-dark: Pad unlit with parked spacecraft (locked).
 * 5. path-power-to-tower: Lit path between Power station and Tower.
 * 6. path-tower-to-pad: Lit path between Tower and Launch pad.
 * 7. cell-off: Dark unlit cell.
 * 8. cell-on: Lit cyan/emerald cell (no coin, no star).
 */

export function renderBuildingSVG(buildingIdOrKey, state = 'locked') {
  const buildingId = KEY_TO_ID[buildingIdOrKey] || Number(buildingIdOrKey) || 1;
  const isCurrent = state === 'current';
  const isDone = state === 'done';
  const strokeColor = isCurrent ? COLORS.currentRing : (isDone ? COLORS.done : COLORS.locked);
  const fillColor = isDone ? '#143834' : (isCurrent ? '#122e3d' : '#0d1a29');
  const windowFill = isCurrent || isDone ? (isDone ? COLORS.done : COLORS.currentRing) : '#1a2b3c';

  // Ring for current building only:
  const currentRingMarkup = isCurrent ? `
    <circle cx="50" cy="50" r="44" fill="none" stroke="${COLORS.currentRing}" stroke-width="3" stroke-dasharray="6 4" class="current-halo">
      <animate attributeName="stroke-dashoffset" values="0;20" dur="2s" repeatCount="indefinite" />
    </circle>
  ` : '';

  if (buildingId === 1) {
    // نیروگاه (power)
    return `
      <svg class="station-svg power-svg state-${state}" viewBox="0 0 100 100" aria-hidden="true">
        ${currentRingMarkup}
        <rect x="25" y="42" width="50" height="36" rx="4" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.5"/>
        <polygon points="35,42 40,24 48,24 45,42" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
        <polygon points="55,42 60,24 68,24 65,42" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
        <rect x="33" y="52" width="14" height="12" rx="2" fill="${windowFill}"/>
        <rect x="53" y="52" width="14" height="12" rx="2" fill="${windowFill}"/>
        <line x1="20" y1="78" x2="80" y2="78" stroke="${strokeColor}" stroke-width="3"/>
      </svg>
    `;
  }

  if (buildingId === 2) {
    // برج ارتباط (tower)
    return `
      <svg class="station-svg tower-svg state-${state}" viewBox="0 0 100 100" aria-hidden="true">
        ${currentRingMarkup}
        <path d="M30 32 A 22 22 0 0 1 70 32" fill="none" stroke="${strokeColor}" stroke-width="3"/>
        <line x1="50" y1="32" x2="50" y2="20" stroke="${windowFill}" stroke-width="2.5"/>
        <circle cx="50" cy="18" r="3" fill="${windowFill}"/>
        <polygon points="42,32 58,32 64,78 36,78" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.5"/>
        <line x1="40" y1="48" x2="60" y2="48" stroke="${strokeColor}" stroke-width="2"/>
        <line x1="38" y1="62" x2="62" y2="62" stroke="${strokeColor}" stroke-width="2"/>
        <circle cx="50" cy="55" r="5" fill="${windowFill}"/>
      </svg>
    `;
  }

  if (buildingId === 3) {
    // سکوی پرتاب (pad)
    return `
      <svg class="station-svg pad-svg state-${state}" viewBox="0 0 100 100" aria-hidden="true">
        ${currentRingMarkup}
        <rect x="22" y="74" width="56" height="10" rx="2" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.5"/>
        <line x1="28" y1="74" x2="28" y2="38" stroke="${strokeColor}" stroke-width="3"/>
        <line x1="28" y1="46" x2="42" y2="46" stroke="${strokeColor}" stroke-width="2"/>
        <path d="M 50,22 Q 58,40 58,68 L 42,68 Q 42,40 50,22 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.5"/>
        <polygon points="42,60 36,70 42,70" fill="${strokeColor}"/>
        <polygon points="58,60 64,70 58,70" fill="${strokeColor}"/>
        <circle cx="50" cy="42" r="4" fill="${windowFill}"/>
      </svg>
    `;
  }

  return '';
}

export function renderPathSVG(pathId, isLit = false) {
  const stroke = isLit ? COLORS.done : '#182b3d';
  const glow = isLit ? `filter="drop-shadow(0 0 6px ${COLORS.done})"` : '';
  const dash = isLit ? 'stroke-dasharray="none"' : 'stroke-dasharray="4 4"';

  return `
    <svg class="path-svg path-${pathId} ${isLit ? 'lit' : 'unlit'}" viewBox="0 0 20 120" preserveAspectRatio="none" aria-hidden="true">
      <line x1="10" y1="0" x2="10" y2="120" stroke="${stroke}" stroke-width="4" ${dash} ${glow}/>
    </svg>
  `;
}

export function renderCellSVG(isLit = false) {
  if (isLit) {
    return `
      <svg class="cell-svg lit" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="6" fill="#146a62" stroke="${COLORS.currentRing}" stroke-width="2"/>
        <rect x="7" y="7" width="18" height="18" rx="3" fill="${COLORS.done}"/>
      </svg>
    `;
  }
  return `
    <svg class="cell-svg unlit" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="#0d1b2a" stroke="#25394d" stroke-width="2"/>
      <rect x="8" y="8" width="16" height="16" rx="3" fill="#142436"/>
    </svg>
  `;
}

export function renderEqualGroupsSVG(groupsCount, itemsPerGroup) {
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
