/**
 * Football prediction scoring rules:
 *   3 pts — exact score (e.g. predicted 2-1, actual 2-1)
 *   1 pt  — correct match result (W/D/L) but wrong score
 *   0 pts — wrong result
 *
 * Maximum score per match: 3 pts
 */

export type MatchResult = "home" | "draw" | "away";

export function getResult(home: number, away: number): MatchResult {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

export function calculateScore(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): number {
  if (predictedHome === actualHome && predictedAway === actualAway) return 3;
  if (getResult(predictedHome, predictedAway) === getResult(actualHome, actualAway)) return 1;
  return 0;
}
