// Bridge translating v9/v10.1 state into strict stationState
import { BUILDINGS, MAP_COMBOS } from './station/constants.js';
import { stationSystems, isUnlocked, CORE_SECTORS } from '../v9/experience.mjs';

export function toStationState(session = null, records = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  const systems = stationSystems(safeRecords);

  // Derive completion from pure stationSystems logic
  const p1 = systems.find(s => s.sectorId === 1);
  const p2 = systems.find(s => s.sectorId === 2);
  const p3 = systems.find(s => s.sectorId === 3);

  // Check if active session is finalized complete
  const isSessionFinalizedComplete = (sectorId) => {
    if (!session || session.sectorId !== sectorId || session.status !== 'FINALIZED') return false;
    const total = session.questions?.length || 0;
    return total > 0 && session.score >= total;
  };

  const sector1Done = (p1?.complete ?? false) || isSessionFinalizedComplete(1);
  const sector1UnlockedFor2 = (p1?.percent ?? 0) >= 80 || sector1Done;

  const sector2Done = sector1Done && ((p2?.complete ?? false) || isSessionFinalizedComplete(2));
  const sector2UnlockedFor3 = sector2Done || ((p2?.percent ?? 0) >= 80 && sector1UnlockedFor2);

  const sector3Done = sector1Done && sector2Done && ((p3?.complete ?? false) || isSessionFinalizedComplete(3));

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

  // Count lit cells from active session.
  // Side-mission sessions never feed the core cell tracker (affectsLeaderboard: false).
  const cells = { 1: 0, 2: 0, 3: 0 };
  if (session && session.sectorId && session.questions && session.activityType !== 'side') {
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
    mapCombo,
    systems,
    // v10.1 metadata
    activeDepth: session?.depth || 1,
    activeType: session?.activityType || 'core',
    activeMissionId: session?.missionId || null,
    // Union of unlocked side missions across ALL sectors (each gated by its own 70% rule)
    availableSides: systems.flatMap(s => s.availableSides || [])
  };
}
