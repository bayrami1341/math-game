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

  // دکمه‌های مأموریت جانبی: هر کدام اکشن شروع جلسهٔ جانبی را حمل می‌کنند
  function getSideMissionButtons() {
    return getAvailableSides().map(m => ({
      id: m.id,
      title: m.title,
      icon: m.icon,
      objective: m.objective,
      questionCount: m.questionCount || 5,
      action: 'start-side-mission',
      missionId: m.id,
      canProceed: true
    }));
  }

  function onSideMissionButton(missionId) {
    const mission = SIDE_MISSIONS[missionId];
    if (!mission) {
      return { action: 'stay-on-map', canProceed: false };
    }
    return {
      action: 'start-side-mission',
      missionId,
      buildingId: mission.parentSectorId,
      canProceed: true
    };
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
    getSideMissionButtons,
    onSideMissionButton,
    onMainButton
  };
}
