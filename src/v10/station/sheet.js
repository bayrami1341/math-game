// Bottom sheet and momentary main button strictly adhering to station-brief.md and v10.1
import { MAIN_BUTTON_LABELS } from './constants.js';
import { getStoryText } from './story.js';
import { SIDE_MISSIONS } from '../../v9/experience.mjs';

export function createStationSheet({ currentBuilding, isFinished, completedBuildings = [], availableSides = [], currentDepth = 1 }) {
  function getMainButtonLabel() {
    // هر سه تمام: دکمهٔ سؤال تازه نیست
    if (isFinished || (currentBuilding === null && completedBuildings.length === 3)) {
      return null;
    }
    return MAIN_BUTTON_LABELS[currentBuilding] || null;
  }

  function getSheetText() {
    if (isFinished) {
      return getStoryText(3, 'done');
    }
    if (!currentBuilding) {
      return getStoryText(1, 'current');
    }
    return getStoryText(currentBuilding, 'current');
  }

  function getAvailableSides() {
    return (availableSides || []).map(id => SIDE_MISSIONS[id]).filter(Boolean);
  }

  function onMainButton() {
    if (isFinished || !currentBuilding) {
      return {
        action: 'stay-on-map',
        canProceed: false
      };
    }
    return {
      action: 'go-to-question',
      buildingId: currentBuilding,
      depth: currentDepth || 1,
      canProceed: true
    };
  }

  return {
    getMainButtonLabel,
    getSheetText,
    getAvailableSides,
    onMainButton
  };
}
