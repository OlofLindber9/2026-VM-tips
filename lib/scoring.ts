/**
 * Scoring rules:
 *   3 pts  — predicted 1st place is the actual winner
 *   +1 pt  — predicted 2nd place finished anywhere on the podium (top 3)
 *   +1 pt  — predicted 3rd place finished anywhere on the podium (top 3)
 *
 * Maximum score per event: 5 pts
 */

export interface PodiumActual {
  first: string;   // participant ID
  second: string;
  third: string;
}

export interface PodiumPrediction {
  first: string;
  second: string;
  third: string;
}

export function calculateScore(
  prediction: PodiumPrediction,
  actual: PodiumActual
): number {
  const actualPodium = new Set([actual.first, actual.second, actual.third]);
  let score = 0;

  if (prediction.first === actual.first) score += 3;
  if (actualPodium.has(prediction.second)) score += 1;
  if (actualPodium.has(prediction.third)) score += 1;

  return score;
}

export function getPodiumFromResults(
  results: Array<{ athleteId: string; rank: number | null }>
): PodiumActual | null {
  const sorted = results
    .filter((r) => r.rank !== null)
    .sort((a, b) => a.rank! - b.rank!);

  if (sorted.length < 3) return null;

  return {
    first: sorted[0].athleteId,
    second: sorted[1].athleteId,
    third: sorted[2].athleteId,
  };
}
