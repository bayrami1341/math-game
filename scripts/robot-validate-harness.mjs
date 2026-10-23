// ─────────────────────────────────────────────────────────────────────────────
// robot-validate-harness.mjs — پل ورود «موتور واقعی اعتبارسنجی خشاب» به ریزربات
// (BP-020 — گیت ۱ حلقهٔ تولید؛ fail-closed)
//
// چرا این فایل؟ cartridge-schema.js یک ماژول ESM خالص است؛ این پل نازک همان
// صادره‌های رسمی موتور را برای scripts/production-robot.ts عریان می‌کند تا
// ربات دقیقاً همان منطقی را اجرا کند که موتور/مبدل/تست‌ها اجرا می‌کنند —
// بدون هیچ بازنویسی یا کپیِ قواعد (یک حقیقت، یک اجرا).
//
// مصرف: import { validateCartridge, ... } from './robot-validate-harness.mjs'
// ─────────────────────────────────────────────────────────────────────────────

import {
  validateCartridge,
  extractQRefs,
  parsePlainMultiplication,
  parseOptionValue,
  isFracValue,
  ANSWER_FORMAT_VALUES,
  DOMAIN_CODE_PATTERN,
  CARTRIDGE_ID_PATTERN,
  STATUS_CONFIRMED,
  STATUS_PROPOSED,
  AUDIT_ANSWER_RECEIPTS
} from '../public/math-game/src/v10/station/cartridge-schema.js';

export {
  validateCartridge,
  extractQRefs,
  parsePlainMultiplication,
  parseOptionValue,
  isFracValue,
  ANSWER_FORMAT_VALUES,
  DOMAIN_CODE_PATTERN,
  CARTRIDGE_ID_PATTERN,
  STATUS_CONFIRMED,
  STATUS_PROPOSED,
  AUDIT_ANSWER_RECEIPTS
};
