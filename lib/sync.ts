/**
 * Match sync logic — pulls results from TheSportsDB and writes them into our DB.
 * Also scores predictions when a match finishes.
 *
 * Call this from app/api/sync/matches/route.ts on a schedule:
 *   - Match days:      every 60s while matches are live
 *   - Between matches: every 5 minutes
 *
 * Note: TheSportsDB free tier does not provide live in-progress scores.
 * Status will be set to "live" when a match is in progress, but the score
 * will only be written once the match is "Match Finished".
 */

import { prisma } from "@/lib/prisma";
import { calculateScore } from "@/lib/scoring";
import {
  getSeasonEvents,
  getEventsByDate,
  isCompleted,
  isLive,
  parseScore,
  resolveKnockoutWinner,
  type SDBEvent,
} from "@/lib/thesportsdb";

// ---------------------------------------------------------------------------
// Bootstrap: link unlinked DB matches to TheSportsDB event IDs
// ---------------------------------------------------------------------------

/**
 * For any DB match that has no sportsDbId yet, fetch all TheSportsDB season
 * events and try to match by team name + date (±1 day tolerance).
 * Called automatically at the start of each sync if unlinked matches exist.
 */
async function bootstrapSportsDbIds(): Promise<{ matched: number; unmatched: number }> {
  const dbMatches = await prisma.match.findMany({
    where: { sportsDbId: null, status: { not: "completed" } },
    include: { homeTeam: true, awayTeam: true },
  });
  if (dbMatches.length === 0) return { matched: 0, unmatched: 0 };

  const events = await getSeasonEvents();

  // Build index: "homeTeamName|awayTeamName|date" → event (lower-case names, ±1 day)
  const index = new Map<string, SDBEvent>();
  for (const ev of events) {
    const base = new Date(ev.dateEvent);
    for (let delta = -1; delta <= 1; delta++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + delta);
      const key = `${ev.strHomeTeam.toLowerCase()}|${ev.strAwayTeam.toLowerCase()}|${d.toISOString().slice(0, 10)}`;
      index.set(key, ev);
    }
  }

  // Also build reverse-name index using Swedish display names from DB
  // (so "Mexiko" matches "Mexico" via team lookup)
  let matched = 0;
  let unmatched = 0;

  for (const dbMatch of dbMatches) {
    const date = dbMatch.scheduledAt.toISOString().slice(0, 10);

    // Try direct name match and ±1 day
    let found: SDBEvent | undefined;
    const homeLC = dbMatch.homeTeam.name.toLowerCase();
    const awayLC = dbMatch.awayTeam.name.toLowerCase();

    for (const [key, ev] of index) {
      const [evHome, evAway, evDate] = key.split("|");
      const dateDiff = Math.abs(new Date(evDate).getTime() - new Date(date).getTime()) / 86400000;
      if (dateDiff <= 1) {
        // Check if names are substrings of each other (handles partial matches)
        const evHomeFull = ev.strHomeTeam.toLowerCase();
        const evAwayFull = ev.strAwayTeam.toLowerCase();
        if (
          (evHomeFull.includes(homeLC) || homeLC.includes(evHomeFull)) &&
          (evAwayFull.includes(awayLC) || awayLC.includes(evAwayFull))
        ) {
          found = ev;
          break;
        }
      }
      void evHome; void evAway;
    }

    if (!found) {
      unmatched++;
      continue;
    }

    await prisma.match.update({
      where: { id: dbMatch.id },
      data: { sportsDbId: found.idEvent },
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
 * 1. Fetch today's WC 2026 events from TheSportsDB.
 * 2. Update match status / scores in DB.
 * 3. Score predictions for newly completed matches.
 */
export async function syncMatches(): Promise<SyncResult> {
  const result: SyncResult = { live: 0, completed: 0, predictionsScored: 0 };

  // Bootstrap sportsDbId for any unlinked matches (TheSportsDB adds events over time)
  const needsBootstrap = await prisma.match.count({
    where: { sportsDbId: null, status: { not: "completed" } },
  });
  if (needsBootstrap > 0) {
    result.bootstrapped = await bootstrapSportsDbIds();
    console.log(`  Bootstrap: ${result.bootstrapped.matched} matched, ${result.bootstrapped.unmatched} unmatched`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const events = await getEventsByDate(today);

  if (events.length === 0) {
    console.log("  No WC events today.");
    return result;
  }

  // Build lookup by sportsDbId
  const eventById = new Map<string, SDBEvent>(events.map((e) => [e.idEvent, e]));

  // Load our DB matches for the events we just fetched
  const dbMatches = await prisma.match.findMany({
    where: { sportsDbId: { in: Array.from(eventById.keys()) } },
  });

  for (const dbMatch of dbMatches) {
    const event = eventById.get(dbMatch.sportsDbId!);
    if (!event) continue;

    const wasCompleted = dbMatch.status === "completed";

    let newStatus: string;
    if (isCompleted(event.strStatus)) newStatus = "completed";
    else if (isLive(event.strStatus)) newStatus = "live";
    else newStatus = "upcoming";

    const newHome = isCompleted(event.strStatus) ? parseScore(event.intHomeScore) : dbMatch.homeScore;
    const newAway = isCompleted(event.strStatus) ? parseScore(event.intAwayScore) : dbMatch.awayScore;

    // Determine knockout winner for non-group matches that just completed
    let newKnockoutWinner: string | null = dbMatch.knockoutWinner;
    if (newStatus === "completed" && !wasCompleted && dbMatch.stage !== "group") {
      newKnockoutWinner = resolveKnockoutWinner(event);
    }

    // Skip if nothing changed
    if (
      dbMatch.status === newStatus &&
      dbMatch.homeScore === newHome &&
      dbMatch.awayScore === newAway &&
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
        // Clear minute when no longer live (TheSportsDB free doesn't provide it)
        minute: newStatus === "live" ? dbMatch.minute : null,
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
