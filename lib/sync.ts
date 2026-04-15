/**
 * Match sync logic — pulls live & recent results from API-Football and
 * writes them into our DB.  Also scores predictions when a match finishes.
 *
 * Call this from app/api/sync/matches/route.ts on a schedule (e.g. every 60s
 * while matches are live, every 5 min otherwise).
 */

import { prisma } from "@/lib/prisma";
import { calculateScore } from "@/lib/scoring";
import {
  getAllFixtures,
  getFixturesByDate,
  getLiveFixtures,
  isCompleted,
  isLive,
  minuteLabel,
  type AFFixture,
} from "@/lib/api-football";

// ---------------------------------------------------------------------------
// apiFootballId bootstrap
// ---------------------------------------------------------------------------

/**
 * On first run (no apiFootballId stored yet), fetch all WC 2026 fixtures from
 * API-Football and match them to our DB rows by home/away team name + date.
 *
 * We normalise team names to lower-case for matching, and accept a ±1 day
 * tolerance for timezone-edge-case dates.
 */
export async function bootstrapApiIds(): Promise<{
  matched: number;
  unmatched: number;
}> {
  const dbMatches = await prisma.match.findMany({
    where: { apiFootballId: null },
    include: { homeTeam: true, awayTeam: true },
  });

  if (dbMatches.length === 0) return { matched: 0, unmatched: 0 };

  const allFixtures = await getAllFixtures();

  // Build lookup: "homeName|awayName|date" → AF fixture
  const fixtureIndex = new Map<string, AFFixture>();
  for (const f of allFixtures) {
    const date = f.fixture.date.slice(0, 10); // "2026-06-11"
    const key = `${f.teams.home.name.toLowerCase()}|${f.teams.away.name.toLowerCase()}|${date}`;
    fixtureIndex.set(key, f);
  }

  let matched = 0;
  let unmatched = 0;

  for (const dbMatch of dbMatches) {
    const date = dbMatch.scheduledAt.toISOString().slice(0, 10);
    const homeLC = dbMatch.homeTeam.name.toLowerCase();
    const awayLC = dbMatch.awayTeam.name.toLowerCase();

    // Try exact date first, then ±1 day
    let fixture: AFFixture | undefined;
    for (let delta = 0; delta <= 1; delta++) {
      const tryDates = [shiftDate(date, -delta), shiftDate(date, delta)];
      for (const d of tryDates) {
        fixture = fixtureIndex.get(`${homeLC}|${awayLC}|${d}`);
        if (fixture) break;
      }
      if (fixture) break;
    }

    if (!fixture) {
      console.warn(`  ⚠ No API-Football match for: ${dbMatch.homeTeam.name} vs ${dbMatch.awayTeam.name} on ${date}`);
      unmatched++;
      continue;
    }

    await prisma.match.update({
      where: { id: dbMatch.id },
      data: { apiFootballId: fixture.fixture.id },
    });
    matched++;
  }

  return { matched, unmatched };
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

export type SyncResult = {
  live: number;
  completed: number;
  predictionsScored: number;
  bootstrapped?: { matched: number; unmatched: number };
};

/**
 * Full sync cycle:
 * 1. Bootstrap apiFootballId mappings if needed.
 * 2. Fetch live fixtures + today's finished fixtures.
 * 3. Update match status / scores / minute in DB.
 * 4. Score predictions for newly completed matches.
 */
export async function syncMatches(): Promise<SyncResult> {
  const result: SyncResult = { live: 0, completed: 0, predictionsScored: 0 };

  // Bootstrap IDs for any DB matches that don't have one yet
  const needsBootstrap = await prisma.match.count({ where: { apiFootballId: null, status: { not: "completed" } } });
  if (needsBootstrap > 0) {
    result.bootstrapped = await bootstrapApiIds();
    console.log(`  Bootstrap: ${result.bootstrapped.matched} matched, ${result.bootstrapped.unmatched} unmatched`);
  }

  // Fetch live fixtures + today's fixtures (catches matches that just ended)
  const today = new Date().toISOString().slice(0, 10);
  const [liveFixtures, todayFixtures] = await Promise.all([
    getLiveFixtures(),
    getFixturesByDate(today),
  ]);

  // Deduplicate by fixture id
  const fixtureMap = new Map<number, AFFixture>();
  for (const f of [...liveFixtures, ...todayFixtures]) {
    fixtureMap.set(f.fixture.id, f);
  }

  if (fixtureMap.size === 0) {
    console.log("  No fixtures to process today.");
    return result;
  }

  // Load our DB matches by apiFootballId
  const afIds = Array.from(fixtureMap.keys());
  const dbMatches = await prisma.match.findMany({
    where: { apiFootballId: { in: afIds } },
  });

  const dbMatchByAfId = new Map(dbMatches.map((m) => [m.apiFootballId!, m]));

  for (const [afId, fixture] of fixtureMap) {
    const dbMatch = dbMatchByAfId.get(afId);
    if (!dbMatch) continue;

    const status = fixture.fixture.status;
    const wasCompleted = dbMatch.status === "completed";

    let newStatus: string;
    if (isCompleted(status)) newStatus = "completed";
    else if (isLive(status)) newStatus = "live";
    else newStatus = "upcoming";

    const newHome = fixture.goals.home;
    const newAway = fixture.goals.away;
    const newMinute = isLive(status) ? minuteLabel(status) : null;

    // Determine knockout winner for non-group matches completing now
    let newKnockoutWinner: string | null = null;
    if (newStatus === "completed" && dbMatch.stage !== "group") {
      newKnockoutWinner = resolveKnockoutWinner(fixture);
    }

    // Skip if nothing changed
    if (
      dbMatch.status === newStatus &&
      dbMatch.homeScore === newHome &&
      dbMatch.awayScore === newAway &&
      dbMatch.minute === newMinute &&
      dbMatch.knockoutWinner === newKnockoutWinner
    ) {
      continue;
    }

    await prisma.match.update({
      where: { id: dbMatch.id },
      data: {
        status: newStatus,
        homeScore: newHome,
        awayScore: newAway,
        minute: newMinute,
        knockoutWinner: newKnockoutWinner,
      },
    });

    if (newStatus === "live") result.live++;
    if (newStatus === "completed") result.completed++;

    // Score predictions when match transitions to completed
    if (newStatus === "completed" && !wasCompleted && newHome !== null && newAway !== null) {
      const scored = await scorePredictions(
        dbMatch.id,
        dbMatch.stage,
        newHome,
        newAway,
        newKnockoutWinner
      );
      result.predictionsScored += scored;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Prediction scoring
// ---------------------------------------------------------------------------

async function scorePredictions(
  matchId: string,
  stage: string,
  homeScore: number,
  awayScore: number,
  knockoutWinner: string | null
): Promise<number> {
  const predictions = await prisma.prediction.findMany({
    where: { matchId, score: null },
  });

  for (const prediction of predictions) {
    const pts = calculateScore(
      stage,
      prediction.predictedHome,
      prediction.predictedAway,
      prediction.predictedWinner,
      homeScore,
      awayScore,
      knockoutWinner
    );
    await prisma.prediction.update({
      where: { id: prediction.id },
      data: { score: pts },
    });
  }

  return predictions.length;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the winner of a knockout match from an API-Football fixture.
 *
 * - If one team scored more goals (regular time or AET): that side wins.
 * - If status is "PEN" and goals are level: the side with more penalty goals wins.
 * Returns null if the winner cannot be determined (shouldn't happen in a completed knockout).
 */
function resolveKnockoutWinner(fixture: AFFixture): string | null {
  const homeGoals = fixture.goals.home ?? 0;
  const awayGoals = fixture.goals.away ?? 0;

  if (homeGoals > awayGoals) return "home";
  if (awayGoals > homeGoals) return "away";

  // Scores level — check penalty shootout
  const homePen = fixture.score?.penalty?.home ?? null;
  const awayPen = fixture.score?.penalty?.away ?? null;

  if (homePen !== null && awayPen !== null) {
    if (homePen > awayPen) return "home";
    if (awayPen > homePen) return "away";
  }

  console.warn("  ⚠ Could not determine knockout winner for fixture", fixture.fixture.id);
  return null;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
