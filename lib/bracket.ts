/**
 * Bracket utilities — read the knockout tree, propagate winners through it,
 * and produce a structured shape suitable for rendering.
 *
 * Bracket structure (encoded on Match via bracketCode / nextMatchCode / nextMatchSlot):
 *
 *   R32 (16 matches: R32-1 … R32-16) → R16 (8: R16-1 … R16-8) → QF (4) → SF (2) → Final
 *                                                                          └──────→ 3P
 *
 * Each match knows which match its winner advances to (`nextMatchCode`) and
 * which slot to fill (`nextMatchSlot` = "home"|"away").  The Final and 3rd
 * Place have no `nextMatchCode`.
 *
 * `propagateBracketWinners` runs after a knockout match completes: it writes
 * the actual winner into the next match, and for semifinals writes the loser
 * into the bronze match. Existing real teams are not overwritten.
 */

import { prisma } from "@/lib/prisma";
import { isPlaceholderTeamId } from "@/lib/utils";
import {
  calculateKnockoutScore,
  calculateFinalScore,
  actualWinnerTeamId,
} from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Stage ordering
// ---------------------------------------------------------------------------

export const KNOCKOUT_STAGES = ["r32", "r16", "qf", "sf", "3p", "final"] as const;
export type KnockoutStage = (typeof KNOCKOUT_STAGES)[number];

export function isKnockoutStage(stage: string): stage is KnockoutStage {
  return (KNOCKOUT_STAGES as readonly string[]).includes(stage);
}

// ---------------------------------------------------------------------------
// Types — what a bracket node looks like in the API response
// ---------------------------------------------------------------------------

export type BracketTeam = {
  id: string;
  name: string;
};

export type BracketUserPrediction = {
  predictedWinnerTeamId: string | null;
  predictedHome: number | null;
  predictedAway: number | null;
  /** Final-tournament score (null until the underlying match completes). */
  score: number | null;
  /**
   * True for non-final knockouts where the predicted team is no longer in this
   * match (e.g. they were eliminated in an earlier round). Lets the UI show a
   * "kaskad — laget redan utslaget" hint without re-running scoring.
   */
  cascadeMiss: boolean;
};

export type BracketNode = {
  matchId: string;
  bracketCode: string;        // "R32-1", "R16-1", ..., "F", "3P"
  stage: KnockoutStage;
  scheduledAt: Date;
  homeTeam: BracketTeam | null;
  awayTeam: BracketTeam | null;
  status: "upcoming" | "live" | "completed";
  homeScore: number | null;
  awayScore: number | null;
  knockoutWinner: "home" | "away" | null;
  winnerTeamId: string | null;
  nextMatchCode: string | null;
  nextMatchSlot: "home" | "away" | null;
  /** Current user's prediction for this match, if they made one. */
  userPrediction: BracketUserPrediction | null;
};

export type BracketTree = {
  rounds: Record<KnockoutStage, BracketNode[]>;
  /**
   * Total points the user has currently locked in across the bracket.
   * Counts both finalised scores (match completed) AND current points for
   * matches not yet played but where the predicted team is still alive
   * vs cascade-missed (those can never recover).
   */
  userPointsAwarded: number;     // points already finalised
  userPointsAtRisk: number;      // potential points from un-played matches where team still alive
  userPointsLost: number;        // 0-point predictions on already-played OR cascade-missed matches
};

// ---------------------------------------------------------------------------
// Retrieval — assemble the full tree for a given user (and optional group)
// ---------------------------------------------------------------------------

type BracketSlot = "home" | "away";

export type BracketSlotUpdate = {
  bracketCode: string;
  slot: BracketSlot;
  teamId: string;
};

/**
 * Fetch the bracket as a structured tree.
 *
 * @param userId Optional — if provided, each node includes this user's prediction.
 * @param groupId Optional — if provided alongside userId, scopes predictions to that group.
 *                Without groupId we use the user's first prediction per match (any group).
 */
export async function getBracket(
  userId?: string,
  groupId?: string
): Promise<BracketTree> {
  const matches = await prisma.match.findMany({
    where: { stage: { in: [...KNOCKOUT_STAGES] } },
    include: { homeTeam: true, awayTeam: true },
    orderBy: [{ stage: "asc" }, { matchNumber: "asc" }],
  });

  const predictions = userId
    ? await prisma.prediction.findMany({
        where: {
          userId,
          matchId: { in: matches.map((m) => m.id) },
          ...(groupId ? { groupId } : {}),
        },
      })
    : [];

  // Pick one prediction per match (first found if no group specified)
  const predByMatch = new Map<string, (typeof predictions)[number]>();
  for (const p of predictions) {
    if (!predByMatch.has(p.matchId)) predByMatch.set(p.matchId, p);
  }

  // Build a quick lookup of who "should" be in each match according to the
  // user's predictions, so we can detect cascade-misses for upcoming rounds.
  // For each match: predictedHome / predictedAway are the team IDs the user
  // *implicitly* expects to be in this match, given their previous-round picks.
  const expectedTeamsByMatch = computeExpectedTeams(matches, predByMatch);

  const rounds: Record<KnockoutStage, BracketNode[]> = {
    r32: [], r16: [], qf: [], sf: [], "3p": [], final: [],
  };
  let pointsAwarded = 0;
  let pointsAtRisk = 0;
  let pointsLost = 0;

  for (const m of matches) {
    if (!isKnockoutStage(m.stage)) continue;

    const homeIsPlaceholder = isPlaceholderTeamId(m.homeTeamId);
    const awayIsPlaceholder = isPlaceholderTeamId(m.awayTeamId);
    const homeTeam: BracketTeam | null = !homeIsPlaceholder
      ? { id: m.homeTeam.id, name: m.homeTeam.name }
      : null;
    const awayTeam: BracketTeam | null = !awayIsPlaceholder
      ? { id: m.awayTeam.id, name: m.awayTeam.name }
      : null;

    const winnerTeamId = actualWinnerTeamId(
      m.knockoutWinner,
      m.homeTeamId,
      m.awayTeamId
    );

    const pred = predByMatch.get(m.id) ?? null;
    let userPrediction: BracketUserPrediction | null = null;

    if (pred) {
      const expected = expectedTeamsByMatch.get(m.id);
      const teamsActuallyInMatch = new Set(
        [homeTeam?.id, awayTeam?.id].filter((id): id is string => !!id)
      );
      const cascadeMiss =
        m.status !== "completed" &&
        !!pred.predictedWinnerTeamId &&
        // both real slots filled AND user's pick isn't one of them
        teamsActuallyInMatch.size === 2 &&
        !teamsActuallyInMatch.has(pred.predictedWinnerTeamId) &&
        // also flag if the user's own bracket lineage no longer leads here
        !!expected &&
        !expected.has(pred.predictedWinnerTeamId);

      userPrediction = {
        predictedWinnerTeamId: pred.predictedWinnerTeamId,
        predictedHome: pred.predictedHome,
        predictedAway: pred.predictedAway,
        score: pred.score,
        cascadeMiss,
      };

      // Roll up points
      if (pred.score !== null) {
        pointsAwarded += pred.score;
        if (pred.score === 0) pointsLost += maxPointsForStage(m.stage);
      } else if (cascadeMiss) {
        pointsLost += maxPointsForStage(m.stage);
      } else if (pred.predictedWinnerTeamId) {
        pointsAtRisk += maxPointsForStage(m.stage);
      }
    }

    rounds[m.stage].push({
      matchId: m.id,
      bracketCode: m.bracketCode ?? `${m.stage}-${m.matchNumber ?? "?"}`,
      stage: m.stage,
      scheduledAt: m.scheduledAt,
      homeTeam,
      awayTeam,
      status: m.status as "upcoming" | "live" | "completed",
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      knockoutWinner: m.knockoutWinner as "home" | "away" | null,
      winnerTeamId,
      nextMatchCode: m.nextMatchCode,
      nextMatchSlot: m.nextMatchSlot as BracketSlot | null,
      userPrediction,
    });
  }

  return {
    rounds,
    userPointsAwarded: pointsAwarded,
    userPointsAtRisk: pointsAtRisk,
    userPointsLost: pointsLost,
  };
}

function maxPointsForStage(stage: string): number {
  return stage === "final" ? 5 : 2;
}

/**
 * Walk the bracket forward from each user's prediction, building up the set
 * of teams they expect to "appear" in each subsequent match. A team is in
 * `expectedTeams[match]` if the user picked them to win the previous match
 * that feeds into one of this match's slots.
 *
 * Used purely for the cascade-miss UI signal: if the user's pick for a future
 * match isn't part of the lineage they themselves predicted, mark it.
 */
function computeExpectedTeams(
  matches: { id: string; bracketCode: string | null; nextMatchCode: string | null; homeTeamId: string; awayTeamId: string }[],
  predByMatch: Map<string, { predictedWinnerTeamId: string | null }>
): Map<string, Set<string>> {
  const matchByCode = new Map<string, { id: string; nextMatchCode: string | null }>();
  for (const m of matches) {
    if (m.bracketCode) matchByCode.set(m.bracketCode, m);
  }

  const expected = new Map<string, Set<string>>();
  // Round 1 (R32 / R16): the actual home/away teams are already in the DB
  for (const m of matches) {
    expected.set(m.id, new Set([m.homeTeamId, m.awayTeamId]));
  }

  // Cascade user's predicted winners forward
  for (const m of matches) {
    const pred = predByMatch.get(m.id);
    if (!pred?.predictedWinnerTeamId) continue;
    if (!m.nextMatchCode) continue;
    const next = matchByCode.get(m.nextMatchCode);
    if (!next) continue;
    const set = expected.get(next.id) ?? new Set<string>();
    set.add(pred.predictedWinnerTeamId);
    expected.set(next.id, set);
  }
  return expected;
}

// ---------------------------------------------------------------------------
// Propagation — when a knockout match completes, fill the next match's slot
// ---------------------------------------------------------------------------

/**
 * After a knockout match completes, copy the winning team into the next
 * match's home/away slot so subsequent rounds become predictable.
 *
 * Idempotent: if the next-match slot already holds the right team (or any
 * non-placeholder team), nothing changes.
 */
export async function propagateBracketWinners(matchId: string): Promise<void> {
  const m = await prisma.match.findUnique({ where: { id: matchId } });
  if (!m) return;

  const updates = bracketSlotUpdatesForCompletedMatch(m);
  for (const update of updates) {
    await fillBracketSlot(update);
  }
}

export function bracketSlotUpdatesForCompletedMatch(match: {
  stage: string;
  homeTeamId: string;
  awayTeamId: string;
  knockoutWinner: string | null;
  nextMatchCode: string | null;
  nextMatchSlot: string | null;
}): BracketSlotUpdate[] {
  if (match.knockoutWinner !== "home" && match.knockoutWinner !== "away") return [];

  const nextMatchSlot = normalizeBracketSlot(match.nextMatchSlot);
  const updates: BracketSlotUpdate[] = [];
  const winnerTeamId = actualWinnerTeamId(
    match.knockoutWinner,
    match.homeTeamId,
    match.awayTeamId
  );

  if (
    winnerTeamId &&
    !isPlaceholderTeamId(winnerTeamId) &&
    match.nextMatchCode &&
    nextMatchSlot
  ) {
    updates.push({
      bracketCode: match.nextMatchCode,
      slot: nextMatchSlot,
      teamId: winnerTeamId,
    });
  }

  if (match.stage === "sf" && nextMatchSlot) {
    const thirdPlaceCode = thirdPlaceCodeForFinal(match.nextMatchCode);
    const loserTeamId =
      match.knockoutWinner === "home" ? match.awayTeamId : match.homeTeamId;
    if (thirdPlaceCode && !isPlaceholderTeamId(loserTeamId)) {
      updates.push({
        bracketCode: thirdPlaceCode,
        slot: nextMatchSlot,
        teamId: loserTeamId,
      });
    }
  }

  return updates;
}

function normalizeBracketSlot(slot: string | null): BracketSlot | null {
  return slot === "home" || slot === "away" ? slot : null;
}

function thirdPlaceCodeForFinal(finalCode: string | null): string | null {
  if (finalCode === "F") return "3P";
  if (finalCode?.endsWith("-F")) return finalCode.replace(/-F$/, "-3P");
  return null;
}

async function fillBracketSlot(update: BracketSlotUpdate): Promise<void> {
  const next = await prisma.match.findUnique({
    where: { bracketCode: update.bracketCode },
  });
  if (!next) return;

  const slotField = update.slot === "home" ? "homeTeamId" : "awayTeamId";
  const currentSlotTeamId = update.slot === "home" ? next.homeTeamId : next.awayTeamId;
  if (!isPlaceholderTeamId(currentSlotTeamId) && currentSlotTeamId !== update.teamId) return;

  await prisma.match.update({
    where: { id: next.id },
    data: { [slotField]: update.teamId },
  });
}

// ---------------------------------------------------------------------------
// Pure point preview — used by the form / UI to show "what would I score?"
// ---------------------------------------------------------------------------

export function previewPoints(
  stage: KnockoutStage,
  predictedTeamId: string,
  actualWinnerTeamId: string,
  predictedHome?: number,
  predictedAway?: number,
  actual90Home?: number,
  actual90Away?: number
): number {
  if (stage === "final") {
    if (
      predictedHome === undefined ||
      predictedAway === undefined ||
      actual90Home === undefined ||
      actual90Away === undefined
    ) {
      return predictedTeamId === actualWinnerTeamId ? 3 : 0;
    }
    return calculateFinalScore(
      predictedTeamId,
      predictedHome,
      predictedAway,
      actual90Home,
      actual90Away,
      actualWinnerTeamId
    );
  }
  return calculateKnockoutScore(predictedTeamId, actualWinnerTeamId);
}
