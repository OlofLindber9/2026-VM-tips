/**
 * Test the API-Football live data pipeline against real fixture data.
 *
 * Run with:
 *   npx tsx scripts/test-live-api.ts
 *
 * What it does:
 *   1. Looks for any currently live fixture (any league)
 *   2. Falls back to a recent Champions League or Premier League fixture
 *   3. Fetches full details (events + statistics) via getFixtureById
 *   4. Runs the data through your parseEvents / parseStats functions
 *   5. Prints what LiveMatchDetails would actually receive
 */

import { getFixtureById, type AFFixture, type AFEvent, type AFTeamStatistics } from "../lib/api-football";
import { parseEvents, parseStats } from "../lib/mock-live";

const API_KEY = process.env.API_FOOTBALL_KEY;
if (!API_KEY) {
  console.error("Missing API_FOOTBALL_KEY in .env");
  process.exit(1);
}

const BASE = "https://v3.football.api-sports.io";

async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  } as RequestInit);
  const json = await res.json() as { response: unknown[] };
  return json.response;
}

// ---------------------------------------------------------------------------
// Step 1: Find a usable fixture
// ---------------------------------------------------------------------------

async function findFixture(): Promise<AFFixture | null> {
  console.log("🔍 Looking for live fixtures...");
  const live = await apiFetch("/fixtures?live=all") as AFFixture[];

  if (live.length > 0) {
    const f = live[0];
    console.log(`✅ Found live fixture: ${f.teams.home.name} vs ${f.teams.away.name} (ID ${f.fixture.id})`);
    return getFixtureById(f.fixture.id);
  }

  console.log("   No live matches right now. Fetching recent Champions League fixtures...");
  // league 2 = Champions League, league 39 = Premier League
  const recent = await apiFetch("/fixtures?league=2&season=2024&last=5") as AFFixture[];

  if (recent.length === 0) {
    console.log("   Trying Premier League...");
    const pl = await apiFetch("/fixtures?league=39&season=2024&last=5") as AFFixture[];
    if (pl.length === 0) {
      console.error("❌ No fixtures found. Try a different league/season.");
      return null;
    }
    const f = pl[0];
    console.log(`✅ Using PL fixture: ${f.teams.home.name} vs ${f.teams.away.name} (ID ${f.fixture.id})`);
    return getFixtureById(f.fixture.id);
  }

  const f = recent[0];
  console.log(`✅ Using CL fixture: ${f.teams.home.name} vs ${f.teams.away.name} (ID ${f.fixture.id})`);
  return getFixtureById(f.fixture.id);
}

// ---------------------------------------------------------------------------
// Step 2: Print the raw API shape
// ---------------------------------------------------------------------------

function printRaw(fixture: AFFixture) {
  console.log("\n─── RAW API RESPONSE (key fields) ────────────────────────────");
  console.log("Status  :", fixture.fixture.status.short, `(${fixture.fixture.status.long})`);
  console.log("Minute  :", fixture.fixture.status.elapsed);
  console.log("Score   :", fixture.goals.home, "–", fixture.goals.away);
  console.log("HT score:", fixture.score?.halftime?.home, "–", fixture.score?.halftime?.away);

  const events = fixture.events ?? [];
  const stats  = fixture.statistics ?? [];

  console.log(`\nEvents  : ${events.length} total`);
  if (events.length > 0) {
    console.log("  First event (raw):");
    console.log("  ", JSON.stringify(events[0], null, 2).split("\n").join("\n  "));
  }

  console.log(`\nStats   : ${stats.length} team(s)`);
  if (stats.length > 0) {
    const s = (stats[0] as AFTeamStatistics).statistics;
    console.log(`  ${(stats[0] as AFTeamStatistics).team.name} has ${s.length} stat entries`);
    console.log("  First 4 entries:", s.slice(0, 4));
  }
}

// ---------------------------------------------------------------------------
// Step 3: Run through your parse functions and print results
// ---------------------------------------------------------------------------

function printParsed(fixture: AFFixture) {
  console.log("\n─── PARSED (what LiveMatchDetails receives) ───────────────────");

  const events = fixture.events ?? [];
  const stats  = fixture.statistics ?? [];
  const homeId = fixture.teams.home.id;

  const parsed = parseEvents(events, homeId);
  console.log(`\nEvents parsed: ${parsed.length} (goals + cards + subs)`);
  parsed.forEach(e => {
    const min  = e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`;
    const icon = e.type === "Goal" ? "⚽" : e.type === "Card" ? "🟨" : "🔄";
    const assist = e.assist ? ` (assist: ${e.assist})` : "";
    console.log(`  ${icon} ${min} [${e.side.toUpperCase()}] ${e.player}${assist} — ${e.detail}`);
  });
  if (parsed.length === 0) console.log("  (none — match may not have started yet)");

  const parsedStats = parseStats(stats as AFTeamStatistics[]);
  console.log("\nStats parsed:");
  if (parsedStats) {
    const rows: Array<[string, keyof typeof parsedStats]> = [
      ["Possession",    "possession"],
      ["Shots on goal", "shotsOnGoal"],
      ["Total shots",   "totalShots"],
      ["Corners",       "corners"],
      ["Fouls",         "fouls"],
      ["Offsides",      "offsides"],
      ["Yellow cards",  "yellowCards"],
    ];
    const home = fixture.teams.home.name.padEnd(20);
    const away = fixture.teams.away.name;
    console.log(`  ${"".padEnd(16)} ${home} ${away}`);
    for (const [label, key] of rows) {
      const h = parsedStats[key].home;
      const a = parsedStats[key].away;
      console.log(`  ${label.padEnd(16)} ${String(h).padEnd(20)} ${a}`);
    }
  } else {
    console.log("  (no stats available — match may not have started)");
  }

  // HT
  const ht = fixture.score?.halftime;
  if (ht && ht.home !== null) {
    console.log(`\nHalftime: ${ht.home} – ${ht.away} ✅`);
  } else {
    console.log("\nHalftime: not yet available");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== API-Football live pipeline test ===\n");

  const fixture = await findFixture();
  if (!fixture) process.exit(1);

  printRaw(fixture);
  printParsed(fixture);

  console.log("\n✅ Test complete. If events and stats look reasonable above, the pipeline is working.");
}

main().catch(e => { console.error(e); process.exit(1); });
