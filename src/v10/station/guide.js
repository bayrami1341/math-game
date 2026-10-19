// Secondary guide rules strictly following station-brief.md

export function hasGuideForBuilding(buildingState) {
  // بنای قفل، بنای تمام‌شده و میز معلم دکمهٔ راهنما ندارند.
  return buildingState === 'current';
}

export function createMapGuide() {
  return {
    action: 'show-sheet',
    openLock: false,
    goToQuestion: false
  };
}

export function createQuestionGuide(question) {
  if (!question || typeof question.f1 !== 'number' || typeof question.f2 !== 'number') {
    return null;
  }
  if (question.f1 > 12 || question.f2 > 12) {
    return null;
  }
  const f1 = question.f1;
  const f2 = question.f2;

  // دسته‌های مساوی را نشان می‌دهد و حاصل را به رقم نمی‌نویسد.
  // جواب را انتخاب نمی‌کند. صدای موفقیت ندارد.
  return {
    groupsCount: f1,
    itemsPerGroup: f2,
    groups: Array.from({ length: f1 }, () => f2),
    // Explicit safety flags to verify by tests
    writeResultAsNumber: false,
    selectAnswer: false,
    playsSuccessSound: false
  };
}
