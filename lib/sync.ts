/**
 * Match sync logic. API-Football is the primary source for live state,
 * scores, fixture IDs, and knockout winners.
 *
 * Call this from app/api/sync/matches/route.ts:
 * - Before tournament: once per day.
 * - Match days: every 60 seconds while games may be live.
 * - Between matches: every 5 minutes.
 */

import { propagateBracketWinners } from "@/lib/bracket";
import {
  getAllFixtures,
  getFixturesByDate,
  getLiveFixtures,
  isCompleted,
  isLive,
  minuteLabel,
  type AFFixture,
} from "@/lib/api-football";
import { parseEvents, parseStats } from "@/lib/mock-live";
import { prisma } from "@/lib/prisma";
import { calculateScore, actualWinnerTeamId as resolveWinnerTeamId } from "@/lib/scoring";
import { isPlaceholderTeamId } from "@/lib/utils";

const MATCH_WINDOW_HOURS = 36;

type BracketSlot = "home" | "away";

type SyncDbMatch = {
  id: string;
  apiFootballId: number | null;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: Date;
  venue: string;
  city: string;
  country: string;
  stage: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  minute: string | null;
  halftimeHomeScore: number | null;
  halftimeAwayScore: number | null;
  liveEvents: unknown;
  liveStats: unknown;
  knockoutWinner: string | null;
};

type TeamMapping = {
  id: string;
  name: string;
};

const TEAM_BY_API_NAME: Record<string, TeamMapping> = {
  "Algeria": { id: "ALG", name: "Algeriet" },
  "Argentina": { id: "ARG", name: "Argentina" },
  "Australia": { id: "AUS", name: "Australien" },
  "Austria": { id: "AUT", name: "Österrike" },
  "Belgium": { id: "BEL", name: "Belgien" },
  "Bosnia & Herzegovina": { id: "BIH", name: "Bosnien-Hercegovina" },
  "Bosnia and Herzegovina": { id: "BIH", name: "Bosnien-Hercegovina" },
  "Brazil": { id: "BRA", name: "Brasilien" },
  "Canada": { id: "CAN", name: "Kanada" },
  "Cape Verde": { id: "CPV", name: "Kap Verde" },
  "Cape Verde Islands": { id: "CPV", name: "Kap Verde" },
  "Colombia": { id: "COL", name: "Colombia" },
  "Costa Rica": { id: "CRC", name: "Costa Rica" },
  "Croatia": { id: "CRO", name: "Kroatien" },
  "Curaçao": { id: "CUW", name: "Curaçao" },
  "Curacao": { id: "CUW", name: "Curaçao" },
  "Czech Republic": { id: "CZE", name: "Tjeckien" },
  "DR Congo": { id: "COD", name: "DR Kongo" },
  "Ecuador": { id: "ECU", name: "Ecuador" },
  "Egypt": { id: "EGY", name: "Egypten" },
  "England": { id: "ENG", name: "England" },
  "France": { id: "FRA", name: "Frankrike" },
  "Germany": { id: "GER", name: "Tyskland" },
  "Ghana": { id: "GHA", name: "Ghana" },
  "Haiti": { id: "HAI", name: "Haiti" },
  "Iran": { id: "IRN", name: "Iran" },
  "IR Iran": { id: "IRN", name: "Iran" },
  "Iraq": { id: "IRQ", name: "Irak" },
  "Ivory Coast": { id: "CIV", name: "Elfenbenskusten" },
  "Cote d'Ivoire": { id: "CIV", name: "Elfenbenskusten" },
  "Côte d'Ivoire": { id: "CIV", name: "Elfenbenskusten" },
  "Japan": { id: "JPN", name: "Japan" },
  "Jordan": { id: "JOR", name: "Jordanien" },
  "Korea Republic": { id: "KOR", name: "Sydkorea" },
  "South Korea": { id: "KOR", name: "Sydkorea" },
  "Mexico": { id: "MEX", name: "Mexiko" },
  "Morocco": { id: "MAR", name: "Marocko" },
  "Netherlands": { id: "NED", name: "Nederländerna" },
  "New Zealand": { id: "NZL", name: "Nya Zeeland" },
  "Norway": { id: "NOR", name: "Norge" },
  "Panama": { id: "PAN", name: "Panama" },
  "Paraguay": { id: "PAR", name: "Paraguay" },
  "Portugal": { id: "POR", name: "Portugal" },
  "Qatar": { id: "QAT", name: "Qatar" },
  "Saudi Arabia": { id: "SAU", name: "Saudiarabien" },
  "Scotland": { id: "SCO", name: "Skottland" },
  "Senegal": { id: "SEN", name: "Senegal" },
  "South Africa": { id: "RSA", name: "Sydafrika" },
  "Spain": { id: "ESP", name: "Spanien" },
  "Sweden": { id: "SWE", name: "Sverige" },
  "Switzerland": { id: "SUI", name: "Schweiz" },
  "Tunisia": { id: "TUN", name: "Tunisien" },
  "Turkey": { id: "TUR", name: "Turkiet" },
  "Turkiye": { id: "TUR", name: "Turkiet" },
  "Türkiye": { id: "TUR", name: "Turkiet" },
  "United States": { id: "USA", name: "USA" },
  "USA": { id: "USA", name: "USA" },
  "Uruguay": { id: "URU", name: "Uruguay" },
  "Uzbekistan": { id: "UZB", name: "Uzbekistan" },
};

export type SyncResult = {
  live: number;
  completed: number;
  predictionsScored: number;
  bootstrapped?: { matched: number; unmatched: number };
  teamsUpdated: number;
};

export type SyncMode = "auto" | "live" | "window";

export async function syncMatches({ mode = "auto" }: { mode?: SyncMode } = {}): Promise<SyncResult> {
  const result: SyncResult = {
    live: 0,
    completed: 0,
    predictionsScored: 0,
    teamsUpdated: 0,
  };

  const needsBootstrap = await prisma.match.count({
    where: { apiFootballId: null, status: { not: "completed" } },
  });

  if (needsBootstrap > 0) {
    result.bootstrapped = await bootstrapApiFootballIds();
    console.log(
      `  API-Football bootstrap: ${result.bootstrapped.matched} matched, ${result.bootstrapped.unmatched} unmatched`
    );
  }

  const fixtures = await getFixturesForMode(mode, new Date());
  if (fixtures.length === 0) {
    console.log("  No WC fixtures in sync window.");
    result.predictionsScored += await scoreCompletedMatchesWithUnscoredPredictions();
    return result;
  }

  const fixtureById = new Map(fixtures.map((f) => [f.fixture.id, f]));
  const dbMatches = await prisma.match.findMany({
    where: { apiFootballId: { in: Array.from(fixtureById.keys()) } },
  });

  for (const dbMatch of dbMatches) {
    if (!dbMatch.apiFootballId) continue;
    const fixture = fixtureById.get(dbMatch.apiFootballId);
    if (!fixture) continue;

    const update = buildMatchUpdate(dbMatch, fixture);
    result.teamsUpdated += update.teamsUpdated;

    if (Object.keys(update.data).length === 0) continue;

    const wasCompleted = dbMatch.status === "completed";
    await prisma.match.update({
      where: { id: dbMatch.id },
      data: update.data,
    });

    if (update.nextStatus === "live") result.live++;
    if (update.nextStatus === "completed") result.completed++;

    if (
      update.nextStatus === "completed" &&
      !wasCompleted &&
      update.scoreHome !== null &&
      update.scoreAway !== null
    ) {
      const scored = await scorePredictions(
        dbMatch.id,
        dbMatch.stage,
        update.nextHomeTeamId,
        update.nextAwayTeamId,
        update.scoreHome,
        update.scoreAway,
        update.nextKnockoutWinner
      );
      result.predictionsScored += scored;

      if (dbMatch.stage !== "group" && update.nextKnockoutWinner) {
        await propagateBracketWinners(dbMatch.id);
      }
    }
  }

  result.predictionsScored += await scoreCompletedMatchesWithUnscoredPredictions();

  return result;
}

async function bootstrapApiFootballIds(): Promise<{ matched: number; unmatched: number }> {
  const [dbMatches, fixtures, existingMappedMatches] = await Promise.all([
    prisma.match.findMany({
      where: { apiFootballId: null, status: { not: "completed" } },
      orderBy: [{ scheduledAt: "asc" }, { matchNumber: "asc" }, { id: "asc" }],
    }),
    getAllFixtures(),
    prisma.match.findMany({
      where: { apiFootballId: { not: null } },
      select: { apiFootballId: true },
    }),
  ]);

  let matched = 0;
  let unmatched = 0;
  const usedFixtureIds = new Set(
    existingMappedMatches
      .map((match) => match.apiFootballId)
      .filter((id): id is number => id !== null)
  );

  for (const dbMatch of dbMatches) {
    const fixture = findBestFixtureMatch(dbMatch, fixtures, usedFixtureIds);
    if (!fixture) {
      unmatched++;
      continue;
    }

    const home = teamMappingForApiName(fixture.teams.home.name);
    const away = teamMappingForApiName(fixture.teams.away.name);
    await ensureFixtureTeams(home, away);

    const data: Record<string, unknown> = {
      apiFootballId: fixture.fixture.id,
      scheduledAt: new Date(fixture.fixture.date),
    };
    if (home && (isPlaceholderTeamId(dbMatch.homeTeamId) || dbMatch.homeTeamId === home.id)) {
      data.homeTeamId = home.id;
    }
    if (away && (isPlaceholderTeamId(dbMatch.awayTeamId) || dbMatch.awayTeamId === away.id)) {
      data.awayTeamId = away.id;
    }

    await prisma.match.update({
      where: { id: dbMatch.id },
      data,
    });
    usedFixtureIds.add(fixture.fixture.id);
    matched++;
  }

  return { matched, unmatched };
}

async function getFixturesForSyncWindow(now: Date): Promise<AFFixture[]> {
  const dates = [-1, 0, 1].map((offset) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  });

  const fixtureGroups = await Promise.all(dates.map((date) => getFixturesByDate(date)));
  const fixtures = new Map<number, AFFixture>();
  for (const fixture of fixtureGroups.flat()) {
    fixtures.set(fixture.fixture.id, fixture);
  }
  return Array.from(fixtures.values());
}

async function getFixturesForMode(mode: SyncMode, now: Date): Promise<AFFixture[]> {
  if (mode === "live") return getLiveFixtures();
  if (mode === "window") return getFixturesForSyncWindow(now);

  const liveFixtures = await getLiveFixtures();
  if (liveFixtures.length > 0) return liveFixtures;
  return getFixturesForSyncWindow(now);
}

export function buildMatchUpdate(dbMatch: SyncDbMatch, fixture: AFFixture) {
  const nextStatus = statusFromFixture(fixture);
  const fixtureHome = teamMappingForApiName(fixture.teams.home.name);
  const fixtureAway = teamMappingForApiName(fixture.teams.away.name);

  const data: Record<string, unknown> = {};
  let teamsUpdated = 0;

  const nextHomeTeamId =
    fixtureHome && (isPlaceholderTeamId(dbMatch.homeTeamId) || dbMatch.homeTeamId === fixtureHome.id)
      ? fixtureHome.id
      : dbMatch.homeTeamId;
  const nextAwayTeamId =
    fixtureAway && (isPlaceholderTeamId(dbMatch.awayTeamId) || dbMatch.awayTeamId === fixtureAway.id)
      ? fixtureAway.id
      : dbMatch.awayTeamId;

  if (nextHomeTeamId !== dbMatch.homeTeamId) {
    data.homeTeamId = nextHomeTeamId;
    teamsUpdated++;
  }
  if (nextAwayTeamId !== dbMatch.awayTeamId) {
    data.awayTeamId = nextAwayTeamId;
    teamsUpdated++;
  }

  const scheduledAt = new Date(fixture.fixture.date);
  if (Math.abs(scheduledAt.getTime() - dbMatch.scheduledAt.getTime()) > 60_000) {
    data.scheduledAt = scheduledAt;
  }

  const nextMinute = nextStatus === "live" ? minuteLabel(fixture.fixture.status) : null;
  const displayScores = scoresForDisplay(fixture, nextStatus);
  const nextKnockoutWinner =
    nextStatus === "completed" && dbMatch.stage !== "group"
      ? resolveApiFootballKnockoutWinner(fixture)
      : dbMatch.knockoutWinner;

  if (dbMatch.status !== nextStatus) data.status = nextStatus;
  if (dbMatch.minute !== nextMinute) data.minute = nextMinute;
  if (dbMatch.homeScore !== displayScores.home) data.homeScore = displayScores.home;
  if (dbMatch.awayScore !== displayScores.away) data.awayScore = displayScores.away;
  const halftimeHomeScore = fixture.score?.halftime?.home ?? null;
  const halftimeAwayScore = fixture.score?.halftime?.away ?? null;
  const liveEvents = parseEvents(fixture.events ?? [], fixture.teams.home.id);
  const liveStats = parseStats(fixture.statistics ?? []);

  if (dbMatch.halftimeHomeScore !== halftimeHomeScore) data.halftimeHomeScore = halftimeHomeScore;
  if (dbMatch.halftimeAwayScore !== halftimeAwayScore) data.halftimeAwayScore = halftimeAwayScore;
  if (jsonChanged(dbMatch.liveEvents, liveEvents)) data.liveEvents = liveEvents;
  if (jsonChanged(dbMatch.liveStats, liveStats)) data.liveStats = liveStats;
  if (dbMatch.knockoutWinner !== nextKnockoutWinner) data.knockoutWinner = nextKnockoutWinner;

  const scoringScores = scoresForScoring(fixture, dbMatch.stage, displayScores);

  return {
    data,
    teamsUpdated,
    nextStatus,
    nextHomeTeamId,
    nextAwayTeamId,
    nextKnockoutWinner,
    scoreHome: scoringScores.home,
    scoreAway: scoringScores.away,
  };
}

function findBestFixtureMatch(
  dbMatch: SyncDbMatch,
  fixtures: AFFixture[],
  usedFixtureIds: Set<number>
): AFFixture | null {
  const candidates = fixtures
    .filter((fixture) => !usedFixtureIds.has(fixture.fixture.id))
    .filter((fixture) => stageFromApiRound(fixture.league.round) === dbMatch.stage)
    .map((fixture) => {
      const home = teamMappingForApiName(fixture.teams.home.name);
      const away = teamMappingForApiName(fixture.teams.away.name);
      const exactTeams =
        home?.id === dbMatch.homeTeamId && away?.id === dbMatch.awayTeamId;
      const hasPlaceholder = isPlaceholderTeamId(dbMatch.homeTeamId) || isPlaceholderTeamId(dbMatch.awayTeamId);
      const fixtureTime = new Date(fixture.fixture.date).getTime();
      const timeDiffMs = Math.abs(fixtureTime - dbMatch.scheduledAt.getTime());
      const timeDiffHours = timeDiffMs / 3_600_000;

      let score = 0;
      if (exactTeams) score += 1000;
      if (hasPlaceholder && home && away) score += 100;
      if (timeDiffHours <= MATCH_WINDOW_HOURS) score += Math.max(0, 100 - timeDiffHours);

      return { fixture, exactTeams, hasPlaceholder, timeDiffHours, score };
    })
    .filter((candidate) => {
      if (candidate.exactTeams) return candidate.timeDiffHours <= MATCH_WINDOW_HOURS;
      if (candidate.hasPlaceholder) return candidate.timeDiffHours <= 4;
      return false;
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.fixture ?? null;
}

export function statusFromFixture(fixture: AFFixture): "upcoming" | "live" | "completed" {
  if (isCompleted(fixture.fixture.status)) return "completed";
  if (isLive(fixture.fixture.status)) return "live";
  return "upcoming";
}

export function scoresForDisplay(
  fixture: AFFixture,
  status: "upcoming" | "live" | "completed"
): { home: number | null; away: number | null } {
  if (status === "upcoming") return { home: null, away: null };
  return {
    home: fixture.goals.home,
    away: fixture.goals.away,
  };
}

export function scoresForScoring(
  fixture: AFFixture,
  stage: string,
  fallback: { home: number | null; away: number | null }
): { home: number | null; away: number | null } {
  if (stage === "final") {
    return {
      home: fixture.score?.fulltime?.home ?? fallback.home,
      away: fixture.score?.fulltime?.away ?? fallback.away,
    };
  }
  return fallback;
}

export function resolveApiFootballKnockoutWinner(fixture: AFFixture): BracketSlot | null {
  const home = fixture.goals.home;
  const away = fixture.goals.away;
  if (home === null || away === null) return null;
  if (home > away) return "home";
  if (away > home) return "away";

  const homeExtra = fixture.score?.extratime?.home;
  const awayExtra = fixture.score?.extratime?.away;
  if (homeExtra !== null && homeExtra !== undefined && awayExtra !== null && awayExtra !== undefined) {
    if (homeExtra > awayExtra) return "home";
    if (awayExtra > homeExtra) return "away";
  }

  const homePen = fixture.score?.penalty?.home;
  const awayPen = fixture.score?.penalty?.away;
  if (homePen !== null && homePen !== undefined && awayPen !== null && awayPen !== undefined) {
    if (homePen > awayPen) return "home";
    if (awayPen > homePen) return "away";
  }

  console.warn(`  Could not determine knockout winner for API-Football fixture ${fixture.fixture.id}`);
  return null;
}

function jsonChanged(current: unknown, next: unknown): boolean {
  return JSON.stringify(current ?? null) !== JSON.stringify(next ?? null);
}

async function ensureFixtureTeams(...teams: Array<TeamMapping | null>) {
  for (const team of teams) {
    if (!team) continue;
    await prisma.team.upsert({
      where: { id: team.id },
      update: { name: team.name },
      create: { id: team.id, name: team.name, group: null },
    });
  }
}

function teamMappingForApiName(name: string): TeamMapping | null {
  return TEAM_BY_API_NAME[name] ?? TEAM_BY_API_NAME[normalizeApiTeamName(name)] ?? null;
}

function normalizeApiTeamName(name: string): string {
  return name
    .replace(/^United States of America$/, "United States")
    .replace(/^Korea Republic$/, "South Korea")
    .replace(/^Congo DR$/, "DR Congo")
    .trim();
}

export function stageFromApiRound(round: string): string {
  const value = round.toLowerCase();
  if (value.includes("round of 32")) return "r32";
  if (value.includes("round of 16")) return "r16";
  if (value.includes("quarter")) return "qf";
  if (value.includes("semi")) return "sf";
  if (value.includes("3rd") || value.includes("third")) return "3p";
  if (value.includes("final")) return "final";
  return "group";
}

export async function scorePredictions(
  matchId: string,
  stage: string,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
  knockoutWinner: string | null
): Promise<number> {
  const predictions = await prisma.prediction.findMany({
    where: { matchId, score: null },
  });

  const winnerTeamId = stage === "group"
    ? null
    : resolveWinnerTeamId(knockoutWinner, homeTeamId, awayTeamId);

  for (const prediction of predictions) {
    const pts = calculateScore(
      stage,
      prediction.predictedHome,
      prediction.predictedAway,
      prediction.predictedWinnerTeamId,
      homeScore,
      awayScore,
      winnerTeamId
    );
    await prisma.prediction.update({
      where: { id: prediction.id },
      data: { score: pts },
    });
  }

  return predictions.length;
}

export async function scoreCompletedMatchesWithUnscoredPredictions(): Promise<number> {
  const matches = await prisma.match.findMany({
    where: {
      status: "completed",
      homeScore: { not: null },
      awayScore: { not: null },
      predictions: { some: { score: null } },
    },
    select: {
      id: true,
      stage: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      knockoutWinner: true,
    },
  });

  let scored = 0;
  for (const match of matches) {
    if (match.homeScore === null || match.awayScore === null) continue;
    if (match.stage !== "group" && !match.knockoutWinner) continue;

    scored += await scorePredictions(
      match.id,
      match.stage,
      match.homeTeamId,
      match.awayTeamId,
      match.homeScore,
      match.awayScore,
      match.knockoutWinner
    );
  }

  return scored;
}
