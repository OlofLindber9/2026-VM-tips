/**
 * Mock live match data for development.
 *
 * Enable by setting USE_MOCK_LIVE=true in your .env file.
 * The match page will override the DB status to "live" and inject these events
 * and statistics so you can develop the live match UI without a real fixture.
 *
 * The mock scenario:
 *   72nd minute, 2nd half
 *   Home team leads 2–1 (HT was 1–1)
 *   Events: Away goal 23', Home goal 38', Home penalty 61', Away yellow 70'
 */

import type { AFEvent, AFTeamStatistics } from "./api-football";

// Injected match state (overrides DB values when mock is active)
export const MOCK_MATCH_OVERRIDE = {
  status: "live" as const,
  homeScore: 2,
  awayScore: 1,
  minute: "72",
};

export const MOCK_HALFTIME = { home: 1, away: 1 };

// Events use "home"/"away" so they work regardless of which teams are in the DB.
// The render component maps these to actual team names.
export interface MockEvent {
  minute: number;
  extra: number | null;
  side: "home" | "away";
  player: string;
  assist: string | null;
  type: "Goal" | "Card" | "Subst";
  detail: string;
}

export const MOCK_EVENTS: MockEvent[] = [
  {
    minute: 23,
    extra: null,
    side: "away",
    player: "L. Messi",
    assist: "Á. Di María",
    type: "Goal",
    detail: "Normal Goal",
  },
  {
    minute: 38,
    extra: null,
    side: "home",
    player: "Vinícius Jr.",
    assist: "R. Rodrigues",
    type: "Goal",
    detail: "Normal Goal",
  },
  {
    minute: 61,
    extra: null,
    side: "home",
    player: "Neymar Jr.",
    assist: null,
    type: "Goal",
    detail: "Penalty",
  },
  {
    minute: 70,
    extra: null,
    side: "away",
    player: "N. González",
    assist: null,
    type: "Card",
    detail: "Yellow Card",
  },
];

// Stats as { home: {...}, away: {...} } so the component can render directly.
export interface MockStats {
  possession: { home: number; away: number }; // e.g. 58, 42
  shotsOnGoal: { home: number; away: number };
  totalShots: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  offsides: { home: number; away: number };
  yellowCards: { home: number; away: number };
}

export const MOCK_STATS: MockStats = {
  possession: { home: 58, away: 42 },
  shotsOnGoal: { home: 7, away: 4 },
  totalShots: { home: 13, away: 9 },
  corners: { home: 6, away: 3 },
  fouls: { home: 9, away: 14 },
  offsides: { home: 2, away: 4 },
  yellowCards: { home: 1, away: 2 },
};

// ---------------------------------------------------------------------------
// Apply mock override to a list of matches (server-side only)
//
// When USE_MOCK_LIVE=true this picks one match to treat as "live":
//   - If MOCK_MATCH_ID is set in .env, that specific match is overridden.
//   - Otherwise the first "upcoming" match (by order) is used.
//
// Call this after fetching from the DB, before any status-based filtering.
// ---------------------------------------------------------------------------

export function applyMockIfEnabled<
  T extends {
    id: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    minute: string | null;
  }
>(matches: T[]): T[] {
  if (process.env.USE_MOCK_LIVE !== "true") return matches;
  const mockId = process.env.MOCK_MATCH_ID;
  const target = mockId
    ? matches.find((m) => m.id === mockId)
    : matches.find((m) => m.status === "upcoming");
  if (!target) return matches;
  return matches.map((m) =>
    m.id === target.id ? { ...m, ...MOCK_MATCH_OVERRIDE } : m
  );
}

// ---------------------------------------------------------------------------
// Helpers for parsing real API-Football data into the same shape as MockStats
// ---------------------------------------------------------------------------

function stat(
  stats: AFTeamStatistics["statistics"],
  type: string
): number {
  const entry = stats.find((s) => s.type === type);
  if (!entry || entry.value === null) return 0;
  if (typeof entry.value === "string") return parseInt(entry.value) || 0;
  return entry.value;
}

export function parseStats(statistics: AFTeamStatistics[]): MockStats | null {
  if (statistics.length < 2) return null;
  const [home, away] = statistics;
  return {
    possession: {
      home: stat(home.statistics, "Ball Possession"),
      away: stat(away.statistics, "Ball Possession"),
    },
    shotsOnGoal: {
      home: stat(home.statistics, "Shots on Goal"),
      away: stat(away.statistics, "Shots on Goal"),
    },
    totalShots: {
      home: stat(home.statistics, "Total Shots"),
      away: stat(away.statistics, "Total Shots"),
    },
    corners: {
      home: stat(home.statistics, "Corner Kicks"),
      away: stat(away.statistics, "Corner Kicks"),
    },
    fouls: {
      home: stat(home.statistics, "Fouls"),
      away: stat(away.statistics, "Fouls"),
    },
    offsides: {
      home: stat(home.statistics, "Offsides"),
      away: stat(away.statistics, "Offsides"),
    },
    yellowCards: {
      home: stat(home.statistics, "Yellow Cards"),
      away: stat(away.statistics, "Yellow Cards"),
    },
  };
}

export function parseEvents(
  apiEvents: AFEvent[],
  homeTeamId: number
): MockEvent[] {
  return apiEvents
    .filter((e) => e.type === "Goal" || e.type === "Card" || e.type === "Subst")
    .map((e) => ({
      minute: e.time.elapsed,
      extra: e.time.extra,
      side: e.team.id === homeTeamId ? "home" : "away",
      player: e.player.name,
      assist: e.assist?.name ?? null,
      type: e.type as "Goal" | "Card" | "Subst",
      detail: e.detail,
    }));
}
