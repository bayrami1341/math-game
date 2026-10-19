// WebAudio Sound implementation strictly compliant with station-brief.md
import { SOUND_CONFIG, SOUND_EVENTS } from './constants.js';

export function createStationSoundPlayer(makeContext = () => {
  if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
    return new (window.AudioContext || window.webkitAudioContext)();
  }
  return null;
}) {
  let context = null;
  let bedSource = null;
  let bedGain = null;

  function getContext() {
    if (!context && typeof makeContext === 'function') {
      try {
        context = makeContext();
      } catch {
        context = null;
      }
    }
    return context;
  }

  // Ensure audio is non-blocking and safe against all WebAudio failures
  return async function play(kind) {
    // If kind is not recognized in the station brief, stay SILENT.
    // Do NOT rely on any 440Hz default beep!
    const validKinds = Object.values(SOUND_EVENTS);
    if (!validKinds.includes(kind)) {
      return true; // Silent success
    }

    const ctx = getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const now = ctx.currentTime;
      const MAX_VOL = SOUND_CONFIG.MAX_VOLUME; // Strict cap at 0.045

      if (kind === 'tick') {
        // سلول پذیرفته: یک تیک کوتاه (بدون دو نت C5 و E5)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(MAX_VOL, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.045);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      } else if (kind === 'drop') {
        // روشن نشد: افت خیلی کوتاه (بدون بوق خطا و بدون بسنده کردن به E4)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.06);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(MAX_VOL * 0.8, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.075);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      } else if (kind === 'layer') {
        // پایان یک بنا: یک لایهٔ کوتاه، بعد قطع (بدون آکورد C5 E5 G5)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(MAX_VOL, now + 0.03);
        gain.gain.setValueAtTime(MAX_VOL, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.23);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      } else if (kind === 'click') {
        // لمس قفل: کلیک بی‌برق (بدون نت ۴۴۰)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(MAX_VOL * 0.6, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.03);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      } else if (kind === 'glow') {
        // روشن شدن راه: حدود یک ثانیه درخشش (بدون پرتاب و انفجار)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(392, now);
        osc.frequency.linearRampToValueAtTime(523.25, now + 0.9);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(MAX_VOL, now + 0.15);
        gain.gain.setValueAtTime(MAX_VOL, now + 0.7);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.98);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.0);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      } else if (kind === 'threeLayers') {
        // هر سه تمام: سه لایه یک بار، بعد آرام (بدون صدای موشک)
        const freqs = [261.63, 329.63, 392.00]; // آرام و لایه‌ای
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(MAX_VOL / 3, now + 0.1 + i * 0.05);
          gain.gain.setValueAtTime(MAX_VOL / 3, now + 0.8);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.45);
          osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        });
      } else if (kind === 'bed') {
        // بستر بی‌کلام: بسیار آرام و نازک
        if (!bedSource) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(164.81, now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.012, now + 1.0);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          bedSource = osc;
          bedGain = gain;
        }
      }
      return true;
    } catch {
      return false; // Audio failures must never interrupt the learning flow
    }
  };
}
