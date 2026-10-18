// Facade orchestrating station modules without modifying v9 engine
import { createStationMap } from './map.js';
import { createStationSheet } from './sheet.js';
import { createCellTracker } from './cells.js';
import { getStoryText, getLockReason, getDoneMessage, getWrongFeedback } from './story.js';
import { createMapGuide, createQuestionGuide, hasGuideForBuilding } from './guide.js';
import { createStationSoundPlayer } from './sounds.js';
import * as visuals from './visuals.js';
import * as constants from './constants.js';

export function createStationLayer({ stationState = { completed: [], current: 1, cells: { 1: 0, 2: 0, 3: 0 } }, session = null, playSound = null } = {}) {
  const map = createStationMap(stationState);
  const currentBuilding = map.getCurrentBuilding();
  const isFinished = map.isAllDone();

  const sheet = createStationSheet({
    currentBuilding,
    isFinished,
    completedBuildings: map.getCompletedBuildings()
  });

  const cells = createCellTracker({
    buildingId: currentBuilding || 1,
    initialAccepted: (stationState.cells && currentBuilding && stationState.cells[currentBuilding]) || 0,
    totalQuestions: session?.questions?.length || 0
  });

  const soundPlayer = playSound || createStationSoundPlayer();

  return {
    map,
    sheet,
    cells,
    soundPlayer,
    visuals,
    constants,
    story: {
      getStoryText,
      getLockReason,
      getDoneMessage,
      getWrongFeedback
    },
    guide: {
      createMapGuide,
      createQuestionGuide,
      hasGuideForBuilding
    }
  };
}

export * from './constants.js';
export * from './story.js';
export * from './guide.js';
export * from './cells.js';
export * from './map.js';
export * from './sheet.js';
export * from './sounds.js';
export * from './visuals.js';
