import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUILDINGS,
  ORDER,
  BUILDING_STATE,
  MAP_COMBOS,
  MAIN_BUTTON_LABELS,
  COLORS,
  SOUND_CONFIG,
  SOUND_EVENTS,
  FORBIDDEN_WORDS
} from '../src/v10/station/constants.js';

import {
  TEXTS,
  getStoryText,
  getLockReason,
  getDoneMessage,
  getWrongFeedback,
  containsForbiddenWords
} from '../src/v10/station/story.js';

import {
  createStationMap
} from '../src/v10/station/map.js';

import {
  createStationSheet
} from '../src/v10/station/sheet.js';

import {
  createCellTracker
} from '../src/v10/station/cells.js';

import {
  createMapGuide,
  createQuestionGuide,
  hasGuideForBuilding
} from '../src/v10/station/guide.js';

import {
  createStationSoundPlayer
} from '../src/v10/station/sounds.js';

import {
  toStationState
} from '../src/v10/bridge.js';

test('1. Map strictly enforces 3 buildings in sequence from bottom to top', () => {
  assert.deepEqual(ORDER, [BUILDINGS.POWER, BUILDINGS.TOWER, BUILDINGS.PAD]);
  assert.equal(ORDER.length, 3);
  assert.equal(ORDER[0], 1); // Power
  assert.equal(ORDER[1], 2); // Tower
  assert.equal(ORDER[2], 3); // Pad

  // Initial state: Power current, others locked
  const mapStart = createStationMap({ completed: [], current: 1 });
  assert.equal(mapStart.getBuildingState(BUILDINGS.POWER), BUILDING_STATE.CURRENT);
  assert.equal(mapStart.getBuildingState(BUILDINGS.TOWER), BUILDING_STATE.LOCKED);
  assert.equal(mapStart.getBuildingState(BUILDINGS.PAD), BUILDING_STATE.LOCKED);
  assert.equal(mapStart.canEnter(BUILDINGS.POWER), true);
  assert.equal(mapStart.canEnter(BUILDINGS.TOWER), false);
  assert.equal(mapStart.canEnter(BUILDINGS.PAD), false);
});

test('2. Strict sequential locking: cannot jump from power to pad, nor open tower early', () => {
  // If state attempts to skip Tower
  const forgedState = createStationMap({ completed: [BUILDINGS.PAD], current: BUILDINGS.PAD });
  // Engine forces sequential constraint: Power is not completed, so current must remain Power!
  assert.equal(forgedState.getCurrentBuilding(), BUILDINGS.POWER);
  assert.equal(forgedState.getBuildingState(BUILDINGS.PAD), BUILDING_STATE.LOCKED);
  assert.equal(forgedState.canEnter(BUILDINGS.PAD), false);

  // Tower unlocks only after Power is done
  const afterPower = createStationMap({ completed: [BUILDINGS.POWER], current: BUILDINGS.TOWER });
  assert.equal(afterPower.getBuildingState(BUILDINGS.POWER), BUILDING_STATE.DONE);
  assert.equal(afterPower.getBuildingState(BUILDINGS.TOWER), BUILDING_STATE.CURRENT);
  assert.equal(afterPower.getBuildingState(BUILDINGS.PAD), BUILDING_STATE.LOCKED);
  assert.equal(afterPower.canEnter(BUILDINGS.TOWER), true);
  assert.equal(afterPower.canEnter(BUILDINGS.PAD), false);
});

test('3. Exactly three allowed map combinations and strict path illumination', () => {
  // Combo 1: START
  const map1 = createStationMap({ completed: [] });
  assert.equal(map1.getMapCombo(), MAP_COMBOS.START);
  assert.equal(map1.getPathState(1), false);
  assert.equal(map1.getPathState(2), false);

  // Combo 2: AFTER_POWER
  const map2 = createStationMap({ completed: [BUILDINGS.POWER] });
  assert.equal(map2.getMapCombo(), MAP_COMBOS.AFTER_POWER);
  assert.equal(map2.getPathState(1), true);
  assert.equal(map2.getPathState(2), false);

  // Combo 3: FINISHED
  const map3 = createStationMap({ completed: [BUILDINGS.POWER, BUILDINGS.TOWER, BUILDINGS.PAD] });
  assert.equal(map3.getMapCombo(), MAP_COMBOS.FINISHED);
  assert.equal(map3.getPathState(1), true);
  assert.equal(map3.getPathState(2), true);
  assert.equal(map3.getCurrentBuilding(), null); // No active building ring in finished state!
});

test('4. Momentary main button labels change dynamically and disappear on all 3 done', () => {
  // Moment 1
  const sheet1 = createStationSheet({ currentBuilding: 1, isFinished: false });
  assert.equal(sheet1.getMainButtonLabel(), MAIN_BUTTON_LABELS[1]);
  assert.equal(sheet1.getMainButtonLabel(), 'ادامهٔ چراغ‌ها');

  // Moment 2
  const sheet2 = createStationSheet({ currentBuilding: 2, isFinished: false });
  assert.equal(sheet2.getMainButtonLabel(), MAIN_BUTTON_LABELS[2]);
  assert.equal(sheet2.getMainButtonLabel(), 'ادامهٔ پیام');

  // Moment 3
  const sheet3 = createStationSheet({ currentBuilding: 3, isFinished: false });
  assert.equal(sheet3.getMainButtonLabel(), MAIN_BUTTON_LABELS[3]);
  assert.equal(sheet3.getMainButtonLabel(), 'ادامهٔ سکو');

  // All 3 Done: No question button!
  const sheetFinished = createStationSheet({ currentBuilding: null, isFinished: true, completedBuildings: [1, 2, 3] });
  assert.equal(sheetFinished.getMainButtonLabel(), null);
  const action = sheetFinished.onMainButton();
  assert.equal(action.action, 'stay-on-map');
  assert.equal(action.canProceed, false);
});

test('5. Cell tracker: wrong answer keeps same question, shows "روشن نشد.", no score or advance', () => {
  const tracker = createCellTracker({ buildingId: 1, initialAccepted: 0, totalQuestions: 3 });
  const wrongResult = tracker.onAnswer(false);

  assert.equal(wrongResult.action, 'same-question');
  assert.equal(wrongResult.cellLit, false);
  assert.equal(wrongResult.feedback, 'روشن نشد.');
  assert.equal(wrongResult.sound, SOUND_EVENTS.wrong);
  assert.equal(wrongResult.nextBuildingLocked, true);
  assert.equal(tracker.getAcceptedCount(), 0);

  // Accepted answer advances and lights cell
  const correctResult = tracker.onAnswer(true);
  assert.equal(correctResult.action, 'next-question');
  assert.equal(correctResult.cellLit, true);
  assert.equal(correctResult.sound, SOUND_EVENTS.accepted);
  assert.equal(tracker.getAcceptedCount(), 1);

  // Abandon returns to map with building still current
  const abandonResult = tracker.onAbandon();
  assert.equal(abandonResult.action, 'back-to-map');
  assert.equal(abandonResult.buildingStillCurrent, true);
});

test('6. Story texts strictly match station-brief and contain ZERO forbidden words', () => {
  const allTexts = [
    TEXTS.powerCurrent,
    TEXTS.towerLocked,
    TEXTS.towerCurrent,
    TEXTS.padLocked,
    TEXTS.padCurrent,
    TEXTS.done,
    TEXTS.wrong
  ];

  for (const text of allTexts) {
    for (const forbidden of FORBIDDEN_WORDS) {
      assert.equal(
        text.includes(forbidden),
        false,
        `Text "${text}" must NOT contain forbidden word "${forbidden}"`
      );
    }
  }

  // Exact authorized strings:
  assert.equal(getStoryText(1, 'current'), 'چراغ‌ها خاموش‌اند. سلول درست روشن‌شان می‌کند.');
  assert.equal(getLockReason(2), 'بی‌برق نمی‌شود حرف زد. اول چراغ‌ها.');
  assert.equal(getStoryText(2, 'current'), 'صدای زمین قطع است. سلول درست آنتن را راه می‌اندازد.');
  assert.equal(getLockReason(3), 'تا زمین خبر نداشته باشد، سکو آماده نمی‌شود.');
  assert.equal(getStoryText(3, 'current'), 'سلول درست سوخت را اندازه می‌کند. آماده یعنی سکو آماده است، نه اینکه بروی.');
  assert.equal(getDoneMessage(), 'تمام شد. سلول تازه نمی‌خواهد.');
  assert.equal(getWrongFeedback(), 'روشن نشد.');
});

test('7. Secondary guides: map sheet vs question equal groups (no digits, no answer picking)', () => {
  // Map guide
  const mapGuide = createMapGuide();
  assert.equal(mapGuide.action, 'show-sheet');
  assert.equal(mapGuide.openLock, false);
  assert.equal(mapGuide.goToQuestion, false);

  // Question guide for 4 x 3
  const qGuide = createQuestionGuide({ f1: 4, f2: 3 });
  assert.equal(qGuide.groupsCount, 4);
  assert.equal(qGuide.itemsPerGroup, 3);
  assert.deepEqual(qGuide.groups, [3, 3, 3, 3]);
  assert.equal(qGuide.writeResultAsNumber, false); // حاصل را به رقم نمی‌نویسد
  assert.equal(qGuide.selectAnswer, false);        // جواب را انتخاب نمی‌کند
  assert.equal(qGuide.playsSuccessSound, false);   // صدای موفقیت ندارد

  // Locked and done buildings have NO guide
  assert.equal(hasGuideForBuilding('locked'), false);
  assert.equal(hasGuideForBuilding('done'), false);
  assert.equal(hasGuideForBuilding('current'), true);
});

test('8. Sound system: volume <= 0.045, default muted, unknown sound is silent', async () => {
  assert.equal(SOUND_CONFIG.MAX_VOLUME <= 0.045, true);
  assert.equal(SOUND_CONFIG.DEFAULT_ENABLED, false);

  // Mock AudioContext to test safety and volume ceiling
  let maxObservedGain = 0;
  const mockAudioContext = () => ({
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime: (v) => { if (v > maxObservedGain) maxObservedGain = v; },
        linearRampToValueAtTime: (v) => { if (v > maxObservedGain) maxObservedGain = v; },
        exponentialRampToValueAtTime: () => {}
      },
      connect: () => {},
      disconnect: () => {}
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: {
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      },
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {}
    })
  });

  const player = createStationSoundPlayer(mockAudioContext);

  // Test every allowed sound
  for (const soundName of Object.values(SOUND_EVENTS)) {
    const success = await player(soundName);
    assert.equal(success, true);
  }
  assert.ok(maxObservedGain <= 0.045, `Observed gain ${maxObservedGain} must be <= 0.045`);

  // Unknown sound must return silently without throwing and without 440Hz beep
  const unknownResult = await player('unknown_explosion_sound');
  assert.equal(unknownResult, true);
});

test('9. Bridge converts v9 session and records into sequential stationState', () => {
  // Empty initial state
  const state0 = toStationState(null, []);
  assert.deepEqual(state0.completed, []);
  assert.equal(state0.current, 1);
  assert.equal(state0.mapCombo, MAP_COMBOS.START);

  // Sector 1 completed
  const recordsAfter1 = [
    { sectorId: 1, score: 5, total: 5, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' }
  ];
  const state1 = toStationState(null, recordsAfter1);
  assert.deepEqual(state1.completed, [1]);
  assert.equal(state1.current, 2);
  assert.equal(state1.mapCombo, MAP_COMBOS.AFTER_POWER);

  // Attempt to skip sector 2 by having sector 3 in records
  const forgedRecords = [
    { sectorId: 1, score: 5, total: 5, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' },
    { sectorId: 3, score: 5, total: 5, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' }
  ];
  const stateSkipped = toStationState(null, forgedRecords);
  // Sector 3 CANNOT be marked complete until Sector 2 is completed!
  assert.deepEqual(stateSkipped.completed, [1]);
  assert.equal(stateSkipped.current, 2);

  // All 3 completed
  const allRecords = [
    { sectorId: 1, score: 5, total: 5, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' },
    { sectorId: 2, score: 5, total: 5, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' },
    { sectorId: 3, score: 5, total: 5, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' }
  ];
  const stateAll = toStationState(null, allRecords);
  assert.deepEqual(stateAll.completed, [1, 2, 3]);
  assert.equal(stateAll.current, null);
  assert.equal(stateAll.isFinished, true);
  assert.equal(stateAll.mapCombo, MAP_COMBOS.FINISHED);
});

test('10. Touch interactions on buildings follow allowed results', () => {
  const map = createStationMap({ completed: [BUILDINGS.POWER], current: BUILDINGS.TOWER });

  // Touch completed Power:
  const touchDone = map.touchBuilding(BUILDINGS.POWER);
  assert.equal(touchDone.action, 'show-done-message');
  assert.equal(touchDone.message, 'تمام شد. سلول تازه نمی‌خواهد.');
  assert.equal(touchDone.staysOnMap, true);

  // Touch current Tower:
  const touchCurrent = map.touchBuilding(BUILDINGS.TOWER);
  assert.equal(touchCurrent.action, 'enter-building');
  assert.equal(touchCurrent.buildingId, 2);
  assert.equal(touchCurrent.staysOnMap, false);

  // Touch locked Pad:
  const touchLocked = map.touchBuilding(BUILDINGS.PAD);
  assert.equal(touchLocked.action, 'show-lock-reason');
  assert.equal(touchLocked.message, 'تا زمین خبر نداشته باشد، سکو آماده نمی‌شود.');
  assert.equal(touchLocked.staysOnMap, true);
  assert.equal(touchLocked.sound, SOUND_EVENTS.locked);
});
