// Bottom sheet and momentary main button strictly adhering to station-brief.md
import { MAIN_BUTTON_LABELS } from './constants.js';
import { getStoryText } from './story.js';

export function createStationSheet({ currentBuilding, isFinished, completedBuildings = [] }) {
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

  function onMainButton() {
    if (isFinished || !currentBuilding) {
      return {
        action: 'stay-on-map',
        canProceed: false
      };
    }
    // از ورق فقط یک دکمه به سؤال می‌رود
    return {
      action: 'go-to-question',
      buildingId: currentBuilding,
      canProceed: true
    };
  }

  return {
    getMainButtonLabel,
    getSheetText,
    onMainButton
  };
}
