/**
 * Stage-aware prediction scoring rules:
 *
 * Gruppspel (group):
 *   3 pts — exakt rätt resultat (t.ex. tips 2-1, verkligt 2-1)
 *   1 pt  — rätt utfall (H/O/B) men fel mål
 *   0 pts — fel utfall
 *
 * Slutspel exkl. final (r32 / r16 / qf / sf / 3p):
 *   2 pts — rätt vinnare
 *   0 pts — fel vinnare
 *   (inga mål tippas — bara vem som vinner matchen)
 *
 * Final:
 *   5 pts — rätt vinnare av turneringen OCH rätt resultat efter 90 min
 *   2 pts — rätt vinnare av turneringen (fel eller ej tippat 90-min resultat)
 *   0 pts — fel vinnare
 *   (resultatet efter 90 min = vanlig tid; vinnaren bestäms efter hela matchen inkl. förlängning / straffar)
 */

export type MatchResult = "home" | "draw" | "away";

export function getResult(home: number, away: number): MatchResult {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

/** Group stage: 3 pts exact score, 1 pt correct W/D/L, 0 wrong result. */
export function calculateGroupScore(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): 0 | 1 | 3 {
  if (predictedHome === actualHome && predictedAway === actualAway) return 3;
  if (getResult(predictedHome, predictedAway) === getResult(actualHome, actualAway)) return 1;
  return 0;
}

/** Knockout non-final: 2 pts correct winner, 0 wrong. */
export function calculateKnockoutScore(
  predictedWinner: string,
  actualWinner: string
): 0 | 2 {
  return predictedWinner === actualWinner ? 2 : 0;
}

/**
 * Final: 5 pts if correct 90-min score AND correct overall winner.
 *        2 pts if correct overall winner only.
 *        0 pts if wrong overall winner.
 */
export function calculateFinalScore(
  predictedHome: number,
  predictedAway: number,
  actual90Home: number,
  actual90Away: number,
  predictedWinner: string,
  actualWinner: string
): 0 | 2 | 5 {
  if (predictedWinner !== actualWinner) return 0;
  const exactScore =
    predictedHome === actual90Home && predictedAway === actual90Away;
  return exactScore ? 5 : 2;
}

/**
 * Main entry point called by sync when scoring predictions.
 *
 * @param stage         Match stage ("group" | "r32" | "r16" | "qf" | "sf" | "3p" | "final")
 * @param predictedHome Predicted home goals (null for knockout non-final)
 * @param predictedAway Predicted away goals (null for knockout non-final)
 * @param predictedWinner "home" | "away" (null for group-stage)
 * @param actual90Home  Actual home goals at 90 min
 * @param actual90Away  Actual away goals at 90 min
 * @param knockoutWinner Who won the match after ET/PEN ("home" | "away" | null for group)
 */
export function calculateScore(
  stage: string,
  predictedHome: number | null,
  predictedAway: number | null,
  predictedWinner: string | null,
  actual90Home: number,
  actual90Away: number,
  knockoutWinner: string | null
): number {
  if (stage === "group") {
    if (predictedHome === null || predictedAway === null) return 0;
    return calculateGroupScore(predictedHome, predictedAway, actual90Home, actual90Away);
  }

  if (stage === "final") {
    if (predictedHome === null || predictedAway === null || !predictedWinner || !knockoutWinner) return 0;
    return calculateFinalScore(predictedHome, predictedAway, actual90Home, actual90Away, predictedWinner, knockoutWinner);
  }

  // All other knockout stages (r32, r16, qf, sf, 3p)
  if (!predictedWinner || !knockoutWinner) return 0;
  return calculateKnockoutScore(predictedWinner, knockoutWinner);
}
