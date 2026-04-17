/**
 * API-Football client (api-football.com)
 *
 * Uses league=1 (FIFA World Cup) and season=2026.
 *
 * Requires env var:  API_FOOTBALL_KEY
 *
 * Free tier: 100 req/day — enough for development and pre-tournament seeding.
 * During the tournament use a paid plan and increase poll frequency.
 */

const BASE_URL = "https://v3.football.api-sports.io";
const WC_LEAGUE = 1;
const WC_SEASON = 2026;

// ---------------------------------------------------------------------------
// Types (subset of the full API-Football response we actually use)
// ---------------------------------------------------------------------------

export type AFFixtureStatus = {
  long: string;
  short: string; // "NS" | "1H" | "HT" | "2H" | "ET" | "P" | "FT" | "AET" | "PEN" | "PST" | "CANC"
  elapsed: number | null; // minutes elapsed, null if not started
};

export type AFTeam = {
  id: number;
  name: string;
};

export type AFEvent = {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string };
  assist: { id: number | null; name: string } | null;
  type: string;   // "Goal" | "Card" | "Subst" | "Var"
  detail: string; // "Normal Goal" | "Penalty" | "Own Goal" | "Yellow Card" | "Red Card" | ...
  comments: string | null;
};

export type AFStatEntry = { type: string; value: string | number | null };

export type AFTeamStatistics = {
  team: { id: number; name: string };
  statistics: AFStatEntry[];
};

export type AFFixture = {
  fixture: {
    id: number;
    date: string; // ISO 8601
    status: AFFixtureStatus;
  };
  league: {
    id: number;
    season: number;
    round: string;
  };
  teams: {
    home: AFTeam;
    away: AFTeam;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score?: {
    halftime?: { home: number | null; away: number | null };
    fulltime?: { home: number | null; away: number | null };
    extratime?: { home: number | null; away: number | null };
    /** Penalty shootout goals (NOT total goals including match — pure penalty count) */
    penalty?: { home: number | null; away: number | null };
  };
  /** Match events — embedded in live/completed fixture responses */
  events?: AFEvent[];
  /** Per-team statistics — embedded in live/completed fixture responses */
  statistics?: AFTeamStatistics[];
};

type AFResponse<T> = {
  response: T[];
  errors: string[] | Record<string, string>;
  results: number;
};

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function getKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("Missing env var: API_FOOTBALL_KEY");
  return key;
}

async function apiFetch<T>(path: string): Promise<T[]> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "x-apisports-key": getKey(),
    },
    // Don't cache — we always want fresh data
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football error ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as AFResponse<T>;

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    throw new Error(`API-Football errors: ${JSON.stringify(json.errors)}`);
  }
  if (!Array.isArray(json.errors) && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football errors: ${JSON.stringify(json.errors)}`);
  }

  return json.response;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All currently live WC 2026 fixtures. */
export async function getLiveFixtures(): Promise<AFFixture[]> {
  return apiFetch<AFFixture>(
    `/fixtures?live=all&league=${WC_LEAGUE}&season=${WC_SEASON}`
  );
}

/** All WC 2026 fixtures for a specific date (YYYY-MM-DD). */
export async function getFixturesByDate(date: string): Promise<AFFixture[]> {
  return apiFetch<AFFixture>(
    `/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&date=${date}`
  );
}

/** All WC 2026 fixtures (use once to build apiFootballId mapping). */
export async function getAllFixtures(): Promise<AFFixture[]> {
  return apiFetch<AFFixture>(
    `/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}`
  );
}

/**
 * Single fixture by API-Football ID, including embedded events and statistics.
 * Use this to get live match details (events timeline, key stats).
 */
export async function getFixtureById(id: number): Promise<AFFixture | null> {
  const results = await apiFetch<AFFixture>(`/fixtures?id=${id}`);
  return results[0] ?? null;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT"]);
const DONE_STATUSES = new Set(["FT", "AET", "PEN"]);

export function isLive(status: AFFixtureStatus): boolean {
  return LIVE_STATUSES.has(status.short);
}

export function isCompleted(status: AFFixtureStatus): boolean {
  return DONE_STATUSES.has(status.short);
}

/** Human-readable minute label, e.g. "45+2'" or "HT" */
export function minuteLabel(status: AFFixtureStatus): string {
  if (status.short === "HT") return "HT";
  if (status.elapsed !== null) return `${status.elapsed}'`;
  return status.short;
}
