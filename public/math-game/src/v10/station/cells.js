// Cell energy management strictly following station-brief.md
import { SOUND_EVENTS } from './constants.js';
import { getWrongFeedback } from './story.js';

export function createCellTracker({ buildingId, initialAccepted = 0, totalQuestions = 0 }) {
  let acceptedCount = initialAccepted;

  function onAnswer(isAccepted) {
    if (!isAccepted) {
      // جواب غلط: همان سؤال. سلول روشن نمی‌شود. بنای بعد بسته می‌ماند.
      return {
        action: 'same-question',
        cellLit: false,
        acceptedCount,
        feedback: getWrongFeedback(), // فقط «روشن نشد.» (نگو «اشتباه کردی»)
        sound: SOUND_EVENTS.wrong,    // drop (افت خیلی کوتاه)
        nextBuildingLocked: true
      };
    }

    // پاسخ پذیرفته: یک سلول همان بنا.
    acceptedCount += 1;
    const hasMore = totalQuestions > 0 ? acceptedCount < totalQuestions : false;

    if (hasMore) {
      return {
        action: 'next-question',
        cellLit: true,
        acceptedCount,
        feedback: '',
        sound: SOUND_EVENTS.accepted, // tick (یک تیک کوتاه)
        buildingComplete: false
      };
    }

    // پایان جلسه بنا
    return {
      action: 'building-complete',
      cellLit: true,
      acceptedCount,
      feedback: '',
      sound: buildingId === 3 ? SOUND_EVENTS.allDone : SOUND_EVENTS.buildingDone,
      buildingComplete: true
    };
  }

  function onAbandon() {
    // رها کردن: برگشت به نقشه. بنا هنوز جاری است.
    return {
      action: 'back-to-map',
      buildingStillCurrent: true,
      acceptedCount
    };
  }

  return {
    getAcceptedCount: () => acceptedCount,
    setAcceptedCount: count => { acceptedCount = count; },
    onAnswer,
    onAbandon
  };
}
