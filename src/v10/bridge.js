// Bridge translating v9 state into strict v10 stationState
import { BUILDINGS, MAP_COMBOS } from './station/constants.js';

export function toStationState(session = null, records = []) {
  const safeRecords = Array.isArray(records) ? records : [];

  // Determine which sectors have complete records (score === total && total > 0)
  const isSectorCompleteInRecords = (sectorId) => {
    return safeRecords.some(r =>
      r.sectorId === sectorId &&
      r.total > 0 &&
      r.score >= r.total
    );
  };

  // Determine if active session has completed its sector
  const isSessionFinalizedComplete = (sectorId) => {
    if (!session || session.sectorId !== sectorId) return false;
    if (session.status !== 'FINALIZED') return false;
    const total = session.questions?.length || 0;
    return total > 0 && session.score >= total;
  };

  const sector1Done = isSectorCompleteInRecords(1) || isSessionFinalizedComplete(1);
  const sector2Done = sector1Done && (isSectorCompleteInRecords(2) || isSessionFinalizedComplete(2));
  const sector3Done = sector1Done && sector2Done && (isSectorCompleteInRecords(3) || isSessionFinalizedComplete(3));

  const completed = [];
  if (sector1Done) completed.push(BUILDINGS.POWER);
  if (sector2Done) completed.push(BUILDINGS.TOWER);
  if (sector3Done) completed.push(BUILDINGS.PAD);

  let current = null;
  if (!sector1Done) {
    current = BUILDINGS.POWER;
  } else if (!sector2Done) {
    current = BUILDINGS.TOWER;
  } else if (!sector3Done) {
    current = BUILDINGS.PAD;
  }

  // Count accepted answers / lit cells for each building
  const cells = { 1: 0, 2: 0, 3: 0 };

  // Calculate cells from active session
  if (session && session.sectorId && session.questions) {
    const receipts = new Map(Object.values(session.receipts || {}).map(r => [r.eventId, r]));
    let litCount = 0;
    for (const q of session.questions) {
      const attempt = session.answers?.[q.questionId];
      if (!attempt) continue;
      const receipt = receipts.get(attempt.eventId);
      if (receipt?.status === 'ACKNOWLEDGED') {
        if (receipt.correct) litCount++;
      } else if (attempt.answer === q.f1 * q.f2) {
        litCount++;
      }
    }
    cells[session.sectorId] = litCount;
  }

  // If sector is completed in records, reflect max score
  for (const s of [1, 2, 3]) {
    if (completed.includes(s) && !cells[s]) {
      const rec = safeRecords.find(r => r.sectorId === s && r.total > 0 && r.score >= r.total);
      if (rec) cells[s] = rec.score;
    }
  }

  let mapCombo = MAP_COMBOS.START;
  if (completed.length === 3) {
    mapCombo = MAP_COMBOS.FINISHED;
  } else if (completed.includes(BUILDINGS.POWER)) {
    mapCombo = MAP_COMBOS.AFTER_POWER;
  }

  return {
    completed,
    current,
    cells,
    isFinished: completed.length === 3,
    mapCombo
  };
}
