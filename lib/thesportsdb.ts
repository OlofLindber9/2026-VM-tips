/**
 * TheSportsDB client (thesportsdb.com)
 *
 * Uses league ID 4429 (FIFA World Cup) and season 2026.
 * Free public API key: "3" — 30 requests/minute, no live scores.
 *
 * Optional env var: THESPORTSDB_API_KEY (defaults to "3")
 */

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";
const WC_LEAGUE_ID = "4429";
const WC_SEASON = "2026";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SDBEvent = {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  /** Score as a string like "2" or null if not yet played */
  intHomeScore: string | null;
  intAwayScore: string | null;
  /** "Not Started" | "In Progress" | "Match Finished" | "Postponed" */
  strStatus: string | null;
  strPostponed: string | null;
  /** "YYYY-MM-DD" */
  dateEvent: string;
  /** "HH:MM:SS" local time */
  strTime: string | null;
  /** ISO 8601 UTC timestamp, e.g. "2026-06-12T04:00:00+00:00" */
  strTimestamp: string | null;
  strVenue: string | null;
  strCity: string | null;
  strCountry: string | null;
  /** Round number as a string, e.g. "1" */
  intRound: string | null;
  /** Round name, e.g. "Group A", "Round of 16", "Quarter-Final", "Final" */
  strRound: string | null;
  /** Result string — may contain penalty info, e.g. "2-2 (4-3 pens)" */
  strResult: string | null;
};

type SDBEventsResponse = {
  events: SDBEvent[] | null;
};

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function apiKey(): string {
  return process.env.THESPORTSDB_API_KEY ?? "3";
}

async function sdbFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}/${apiKey()}/${path}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`TheSportsDB error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All WC 2026 events for the season. */
export async function getSeasonEvents(): Promise<SDBEvent[]> {
  const data = await sdbFetch<SDBEventsResponse>(
    `eventsseason.php?id=${WC_LEAGUE_ID}&s=${WC_SEASON}`
  );
  return data.events ?? [];
}

/** Single event by TheSportsDB event ID. */
export async function getEventById(id: string): Promise<SDBEvent | null> {
  const data = await sdbFetch<SDBEventsResponse>(`lookupevent.php?id=${id}`);
  return data.events?.[0] ?? null;
}

/** All WC 2026 events for a specific date (YYYY-MM-DD). */
export async function getEventsByDate(date: string): Promise<SDBEvent[]> {
  const data = await sdbFetch<SDBEventsResponse>(
    `eventsday.php?d=${date}&l=${WC_LEAGUE_ID}`
  );
  return data.events ?? [];
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export function isLive(status: string | null): boolean {
  return status === "In Progress";
}

export function isCompleted(status: string | null): boolean {
  return status === "Match Finished";
}

/** Parse a score string from TheSportsDB ("2", null, "") → number | null */
export function parseScore(score: string | null): number | null {
  if (!score && score !== "0") return null;
  const n = parseInt(score, 10);
  return isNaN(n) ? null : n;
}

/**
 * Determine the knockout winner from a completed event.
 * Returns "home" | "away" | null (null = could not determine, e.g. level after 90+ET with no penalty info).
 */
export function resolveKnockoutWinner(event: SDBEvent): string | null {
  const home = parseScore(event.intHomeScore);
  const away = parseScore(event.intAwayScore);

  if (home === null || away === null) return null;
  if (home > away) return "home";
  if (away > home) return "away";

  // Scores level — try to parse penalty result from strResult
  // TheSportsDB may include text like "2-2 (4-3 pens)" or "1-1 aet (4-2 pen)"
  const result = event.strResult ?? "";
  const penMatch = result.match(/\((\d+)[–\-](\d+)\s*(?:pen|pens|penalties)/i);
  if (penMatch) {
    const homePen = parseInt(penMatch[1], 10);
    const awayPen = parseInt(penMatch[2], 10);
    if (homePen > awayPen) return "home";
    if (awayPen > homePen) return "away";
  }

  console.warn(`  ⚠ Could not determine knockout winner for event ${event.idEvent} (${event.strEvent})`);
  return null;
}
