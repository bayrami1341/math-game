// Map and buildings state machine strictly adhering to station-brief.md
import { BUILDINGS, ORDER, BUILDING_STATE, MAP_COMBOS, SOUND_EVENTS } from './constants.js';
import { getLockReason, getDoneMessage } from './story.js';

export function createStationMap(stationState = { completed: [], current: 1, cells: { 1: 0, 2: 0, 3: 0 } }) {
  // Strict sequential validation: Building 2 cannot be complete without Building 1,
  // and Building 3 cannot be complete without Building 1 and 2.
  const rawCompleted = Array.isArray(stationState?.completed) ? stationState.completed : [];
  const completed = [];
  if (rawCompleted.includes(BUILDINGS.POWER)) {
    completed.push(BUILDINGS.POWER);
    if (rawCompleted.includes(BUILDINGS.TOWER)) {
      completed.push(BUILDINGS.TOWER);
      if (rawCompleted.includes(BUILDINGS.PAD)) {
        completed.push(BUILDINGS.PAD);
      }
    }
  }

  // Strict sequential invariant: Power (1) -> Tower (2) -> Pad (3)
  // Current building cannot jump ahead
  let current = null;
  if (!completed.includes(BUILDINGS.POWER)) {
    current = BUILDINGS.POWER;
  } else if (!completed.includes(BUILDINGS.TOWER)) {
    current = BUILDINGS.TOWER;
  } else if (!completed.includes(BUILDINGS.PAD)) {
    current = BUILDINGS.PAD;
  }

  function getBuildingState(id) {
    if (completed.includes(id)) {
      return BUILDING_STATE.DONE;
    }
    if (current === id) {
      return BUILDING_STATE.CURRENT;
    }
    return BUILDING_STATE.LOCKED;
  }

  function getMapCombo() {
    // Exactly three allowed map combinations
    if (completed.includes(BUILDINGS.POWER) &&
        completed.includes(BUILDINGS.TOWER) &&
        completed.includes(BUILDINGS.PAD)) {
      return MAP_COMBOS.FINISHED;
    }
    if (completed.includes(BUILDINGS.POWER)) {
      return MAP_COMBOS.AFTER_POWER;
    }
    return MAP_COMBOS.START;
  }

  function getPathState(pathId) {
    // path 1: Power -> Tower. Lit only after Power is done.
    if (pathId === 1) {
      return completed.includes(BUILDINGS.POWER);
    }
    // path 2: Tower -> Pad. Lit only after Tower is done (and Power done).
    if (pathId === 2) {
      return completed.includes(BUILDINGS.POWER) && completed.includes(BUILDINGS.TOWER);
    }
    return false;
  }

  function canEnter(id) {
    if (id === BUILDINGS.POWER) {
      return current === BUILDINGS.POWER;
    }
    if (id === BUILDINGS.TOWER) {
      return current === BUILDINGS.TOWER;
    }
    if (id === BUILDINGS.PAD) {
      return current === BUILDINGS.PAD;
    }
    return false;
  }

  function touchBuilding(id) {
    const state = getBuildingState(id);
    if (state === BUILDING_STATE.DONE) {
      // لمس تمام‌شده: فقط «تمام شد». بازی نمره‌دار تازه نه.
      return {
        action: 'show-done-message',
        buildingId: id,
        state: BUILDING_STATE.DONE,
        message: getDoneMessage(),
        sound: null,
        staysOnMap: true
      };
    }

    if (state === BUILDING_STATE.LOCKED) {
      // لمس قفل: همان نقشه. فقط دلیل قفل. کلیک بی‌برق.
      return {
        action: 'show-lock-reason',
        buildingId: id,
        state: BUILDING_STATE.LOCKED,
        message: getLockReason(id),
        sound: SOUND_EVENTS.locked,
        staysOnMap: true
      };
    }

    // بنای جاری: ورود مجاز
    return {
      action: 'enter-building',
      buildingId: id,
      state: BUILDING_STATE.CURRENT,
      message: '',
      sound: null,
      staysOnMap: false
    };
  }

  return {
    getOrder: () => [...ORDER],
    getCurrentBuilding: () => current,
    getCompletedBuildings: () => [...completed],
    isAllDone: () => completed.length === 3,
    getBuildingState,
    getMapCombo,
    getPathState,
    canEnter,
    touchBuilding
  };
}
