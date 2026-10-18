// Strictly permitted narrative texts from station-brief.md
import { FORBIDDEN_WORDS } from './constants.js';

export const TEXTS = Object.freeze({
  powerCurrent: 'چراغ‌ها خاموش‌اند. سلول درست روشن‌شان می‌کند.',
  towerLocked: 'بی‌برق نمی‌شود حرف زد. اول چراغ‌ها.',
  towerCurrent: 'صدای زمین قطع است. سلول درست آنتن را راه می‌اندازد.',
  padLocked: 'تا زمین خبر نداشته باشد، سکو آماده نمی‌شود.',
  padCurrent: 'سلول درست سوخت را اندازه می‌کند. آماده یعنی سکو آماده است، نه اینکه بروی.',
  done: 'تمام شد. سلول تازه نمی‌خواهد.',
  wrong: 'روشن نشد.'
});

export function getStoryText(buildingId, state) {
  if (state === 'done') {
    return TEXTS.done;
  }
  if (buildingId === 1 && state === 'current') {
    return TEXTS.powerCurrent;
  }
  if (buildingId === 2) {
    if (state === 'locked') return TEXTS.towerLocked;
    if (state === 'current') return TEXTS.towerCurrent;
  }
  if (buildingId === 3) {
    if (state === 'locked') return TEXTS.padLocked;
    if (state === 'current') return TEXTS.padCurrent;
  }
  return TEXTS.done;
}

export function getLockReason(buildingId) {
  if (buildingId === 2) return TEXTS.towerLocked;
  if (buildingId === 3) return TEXTS.padLocked;
  return '';
}

export function getDoneMessage() {
  return TEXTS.done;
}

export function getWrongFeedback() {
  return TEXTS.wrong;
}

export function containsForbiddenWords(text) {
  if (!text || typeof text !== 'string') return false;
  return FORBIDDEN_WORDS.some(word => text.includes(word));
}
