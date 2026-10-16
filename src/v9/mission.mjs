// The renderer supplies choices only. Correctness and records come from API receipts.
export function missionChoices(question) {
  const answer = question.f1 * question.f2;
  const choices = new Set([answer]);
  for (const offset of [question.f1, -question.f2, 1, 2, 3]) {
    const value = answer + offset;
    if (value >= 0) choices.add(value);
    if (choices.size === 4) break;
  }
  const result = [...choices];
  const shift = Number(question.questionId.replace(/\D/g, '')) % 4;
  return result.slice(shift).concat(result.slice(0, shift));
}
