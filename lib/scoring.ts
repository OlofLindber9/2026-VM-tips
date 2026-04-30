/**
 * Stage-aware prediction scoring rules:
 *
 * Gruppspel (group):
 *   3 pts — exakt rätt resultat (t.ex. tips 2-1, verkligt 2-1)
 *   1 pt  — rätt utfall (H/O/B) men fel mål
 *   0 pts — fel utfall
 *
 * Slutspel exkl. final (r32 / r16 / qf / sf / 3p):
 *   2 pts — rätt vinnande lag (man tippar laget, inte sidan)
 *   0 pts — fel vinnare (eller laget redan utslaget — kaskadbestraffning)
 *
 * Final:
 *   5 pts — rätt vinnande lag av turneringen OCH exakt rätt 90-min-resultat
 *   3 pts — rätt vinnande lag av turneringen
 *   0 pts — fel vinnare
 *
 * Kaskadbestraffning (knockouts): predictions store the predicted winning TEAM
 * (FIFA code). If the team is eliminated earlier, it can't appear in the
 * later match — the team-ID compare automatically yields 0 for those rounds.
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

/**
 * Knockout (non-final): 2 pts if predicted team won, else 0.
 *
 * `predictedTeamId` is the FIFA code the user picked (e.g. "ESP").
 * `actualWinnerTeamId` is the FIFA code of whichever team won the actual match.
 * If the predicted team isn't even in the match (eliminated earlier), the IDs
 * won't match and the score is 0 — that's the cascading penalty.
 */
export function calculateKnockoutScore(
  predictedTeamId: string,
  actualWinnerTeamId: string
): 0 | 2 {
  return predictedTeamId === actualWinnerTeamId ? 2 : 0;
}

/**
 * Final: 5 pts if correct winner + exact 90-min score. 3 pts if correct winner only.
 *        0 pts if wrong winner.
 */
export function calculateFinalScore(
  predictedTeamId: string,
  predictedHome: number,
  predictedAway: number,
  actual90Home: number,
  actual90Away: number,
  actualWinnerTeamId: string
): 0 | 3 | 5 {
  if (predictedTeamId !== actualWinnerTeamId) return 0;
  const exactScore =
    predictedHome === actual90Home && predictedAway === actual90Away;
  return exactScore ? 5 : 3;
}

/**
 * Resolve "home" / "away" knockoutWinner into the actual team's FIFA code.
 */
export function actualWinnerTeamId(
  knockoutWinner: string | null,
  homeTeamId: string,
  awayTeamId: string
): string | null {
  if (knockoutWinner === "home") return homeTeamId;
  if (knockoutWinner === "away") return awayTeamId;
  return null;
}

/**
 * Main entry point called by sync when scoring predictions.
 *
 * For knockouts the prediction is a team ID, compared to the actual winning
 * team. For group-stage it's a score. For the final it's both.
 */
export function calculateScore(
  stage: string,
  predictedHome: number | null,
  predictedAway: number | null,
  predictedWinnerTeamId: string | null,
  actual90Home: number,
  actual90Away: number,
  actualWinnerTeamId: string | null
): number {
  if (stage === "group") {
    if (predictedHome === null || predictedAway === null) return 0;
    return calculateGroupScore(predictedHome, predictedAway, actual90Home, actual90Away);
  }

  if (stage === "final") {
    if (
      predictedHome === null ||
      predictedAway === null ||
      !predictedWinnerTeamId ||
      !actualWinnerTeamId
    ) {
      return 0;
    }
    return calculateFinalScore(
      predictedWinnerTeamId,
      predictedHome,
      predictedAway,
      actual90Home,
      actual90Away,
      actualWinnerTeamId
    );
  }

  // All other knockout stages (r32, r16, qf, sf, 3p)
  if (!predictedWinnerTeamId || !actualWinnerTeamId) return 0;
  return calculateKnockoutScore(predictedWinnerTeamId, actualWinnerTeamId);
}
