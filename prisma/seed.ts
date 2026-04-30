/**
 * WC 2026 seed — fixture schedule from openfootball/worldcup.json,
 * TheSportsDB event IDs matched and stored for sync.
 *
 * - Full schedule comes from OpenFootball (reliable, complete).
 * - TheSportsDB idEvent is matched by team names + date and stored as sportsDbId
 *   so the sync endpoint can look up results without a bootstrap step.
 *
 * To run:  npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import { getSeasonEvents, type SDBEvent } from "../lib/thesportsdb";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Team mapping: English name (OpenFootball / TheSportsDB) → { id, name }
// id   = FIFA 3-letter code used as primary key
// name = Swedish display name
// ---------------------------------------------------------------------------
const TEAM_MAP: Record<string, { id: string; name: string }> = {
  // ── Americas ──────────────────────────────────────────────────────────────
  "Mexico":                           { id: "MEX", name: "Mexiko" },
  "Canada":                           { id: "CAN", name: "Kanada" },
  "USA":                              { id: "USA", name: "USA" },
  "United States":                    { id: "USA", name: "USA" },
  "Brazil":                           { id: "BRA", name: "Brasilien" },
  "Argentina":                        { id: "ARG", name: "Argentina" },
  "Colombia":                         { id: "COL", name: "Colombia" },
  "Uruguay":                          { id: "URU", name: "Uruguay" },
  "Ecuador":                          { id: "ECU", name: "Ecuador" },
  "Paraguay":                         { id: "PAR", name: "Paraguay" },
  "Panama":                           { id: "PAN", name: "Panama" },
  "Haiti":                            { id: "HAI", name: "Haiti" },
  "Curaçao":                          { id: "CUW", name: "Curaçao" },
  "Curacao":                          { id: "CUW", name: "Curaçao" },
  // ── Europe ────────────────────────────────────────────────────────────────
  "Spain":                            { id: "ESP", name: "Spanien" },
  "Germany":                          { id: "GER", name: "Tyskland" },
  "France":                           { id: "FRA", name: "Frankrike" },
  "England":                          { id: "ENG", name: "England" },
  "Portugal":                         { id: "POR", name: "Portugal" },
  "Netherlands":                      { id: "NED", name: "Nederländerna" },
  "Belgium":                          { id: "BEL", name: "Belgien" },
  "Switzerland":                      { id: "SUI", name: "Schweiz" },
  "Austria":                          { id: "AUT", name: "Österrike" },
  "Turkey":                           { id: "TUR", name: "Turkiet" },
  "Croatia":                          { id: "CRO", name: "Kroatien" },
  "Norway":                           { id: "NOR", name: "Norge" },
  "Sweden":                           { id: "SWE", name: "Sverige" },
  "Scotland":                         { id: "SCO", name: "Skottland" },
  "Czech Republic":                   { id: "CZE", name: "Tjeckien" },
  "Bosnia & Herzegovina":             { id: "BIH", name: "Bosnien-Hercegovina" },
  "Bosnia and Herzegovina":           { id: "BIH", name: "Bosnien-Hercegovina" },
  "Bosnia Herzegovina":               { id: "BIH", name: "Bosnien-Hercegovina" },
  "Bosnia-Herzegovina":               { id: "BIH", name: "Bosnien-Hercegovina" },
  // ── Africa ────────────────────────────────────────────────────────────────
  "Morocco":                          { id: "MAR", name: "Marocko" },
  "Senegal":                          { id: "SEN", name: "Senegal" },
  "South Africa":                     { id: "RSA", name: "Sydafrika" },
  "Ivory Coast":                      { id: "CIV", name: "Elfenbenskusten" },
  "Cote d'Ivoire":                    { id: "CIV", name: "Elfenbenskusten" },
  "Côte d'Ivoire":                    { id: "CIV", name: "Elfenbenskusten" },
  "Côte D'Ivoire":                    { id: "CIV", name: "Elfenbenskusten" },
  "Tunisia":                          { id: "TUN", name: "Tunisien" },
  "Algeria":                          { id: "ALG", name: "Algeriet" },
  "Egypt":                            { id: "EGY", name: "Egypten" },
  "Ghana":                            { id: "GHA", name: "Ghana" },
  "DR Congo":                         { id: "COD", name: "DR Kongo" },
  "Congo DR":                         { id: "COD", name: "DR Kongo" },
  "Democratic Republic of Congo":     { id: "COD", name: "DR Kongo" },
  "Cape Verde":                       { id: "CPV", name: "Kap Verde" },
  "Cabo Verde":                       { id: "CPV", name: "Kap Verde" },
  // ── Asia / Oceania ────────────────────────────────────────────────────────
  "Japan":                            { id: "JPN", name: "Japan" },
  "South Korea":                      { id: "KOR", name: "Sydkorea" },
  "Korea Republic":                   { id: "KOR", name: "Sydkorea" },
  "Iran":                             { id: "IRN", name: "Iran" },
  "IR Iran":                          { id: "IRN", name: "Iran" },
  "Saudi Arabia":                     { id: "SAU", name: "Saudiarabien" },
  "Iraq":                             { id: "IRQ", name: "Irak" },
  "Jordan":                           { id: "JOR", name: "Jordanien" },
  "Qatar":                            { id: "QAT", name: "Qatar" },
  "Australia":                        { id: "AUS", name: "Australien" },
  "New Zealand":                      { id: "NZL", name: "Nya Zeeland" },
  "Uzbekistan":                       { id: "UZB", name: "Uzbekistan" },
};

// ---------------------------------------------------------------------------
// Venue mapping: OpenFootball ground string → { venue, city, country }
// ---------------------------------------------------------------------------
const GROUND_MAP: Record<string, { venue: string; city: string; country: string }> = {
  "Mexico City":                              { venue: "Estadio Azteca",            city: "Mexico City",     country: "Mexico" },
  "Guadalajara (Zapopan)":                    { venue: "Estadio Akron",              city: "Guadalajara",     country: "Mexico" },
  "Monterrey (Guadalupe)":                    { venue: "Estadio BBVA",               city: "Monterrey",       country: "Mexico" },
  "Dallas (Arlington)":                       { venue: "AT&T Stadium",               city: "Arlington",       country: "USA" },
  "Houston":                                  { venue: "NRG Stadium",                city: "Houston",         country: "USA" },
  "New York/New Jersey (East Rutherford)":    { venue: "MetLife Stadium",            city: "East Rutherford", country: "USA" },
  "Philadelphia":                             { venue: "Lincoln Financial Field",    city: "Philadelphia",    country: "USA" },
  "Boston (Foxborough)":                      { venue: "Gillette Stadium",           city: "Foxborough",      country: "USA" },
  "Atlanta":                                  { venue: "Mercedes-Benz Stadium",      city: "Atlanta",         country: "USA" },
  "Miami Gardens":                            { venue: "Hard Rock Stadium",          city: "Miami Gardens",   country: "USA" },
  "Los Angeles (Inglewood)":                  { venue: "SoFi Stadium",               city: "Inglewood",       country: "USA" },
  "San Francisco Bay Area (Santa Clara)":     { venue: "Levi's Stadium",             city: "Santa Clara",     country: "USA" },
  "Seattle":                                  { venue: "Lumen Field",                city: "Seattle",         country: "USA" },
  "Vancouver":                                { venue: "BC Place",                   city: "Vancouver",       country: "Canada" },
  "Toronto":                                  { venue: "BMO Field",                  city: "Toronto",         country: "Canada" },
  "Kansas City (Kansas City)":                { venue: "Arrowhead Stadium",          city: "Kansas City",     country: "USA" },
};

// ---------------------------------------------------------------------------
// OpenFootball types
// ---------------------------------------------------------------------------
type OFMatch = {
  round: string;
  num?: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMatchDate(dateStr: string, timeStr: string): Date {
  const parts = timeStr.trim().split(" ");
  const [hh, mm] = parts[0].split(":").map(Number);
  const offsetStr = parts[1] ?? "UTC+0";
  const offset = parseInt(offsetStr.replace("UTC", ""), 10) || 0;
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcHours = hh - offset;
  return new Date(Date.UTC(year, month - 1, day, utcHours, mm, 0));
}

function groupLetter(groupStr: string): string {
  return groupStr.replace("Group ", "").trim();
}

function roundToStage(round: string): string {
  if (round.startsWith("Matchday")) return "group";
  if (round === "Round of 32")      return "r32";
  if (round === "Round of 16")      return "r16";
  if (round === "Quarter-final")    return "qf";
  if (round === "Semi-final")       return "sf";
  if (round === "3rd Place")        return "3p";
  if (round === "Final")            return "final";
  return "group";
}

// ---------------------------------------------------------------------------
// TheSportsDB matching
// Build a map: "homeId|awayId|YYYY-MM-DD" → idEvent
// We allow ±1 day tolerance for timezone edge cases.
// ---------------------------------------------------------------------------
function buildSdbIndex(events: SDBEvent[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const ev of events) {
    const homeId = TEAM_MAP[ev.strHomeTeam]?.id;
    const awayId = TEAM_MAP[ev.strAwayTeam]?.id;
    if (!homeId || !awayId) continue;
    // Index by event date plus ±1 day
    const base = new Date(ev.dateEvent);
    for (let delta = -1; delta <= 1; delta++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + delta);
      const dateKey = d.toISOString().slice(0, 10);
      index.set(`${homeId}|${awayId}|${dateKey}`, ev.idEvent);
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// Knockout stage round names as they appear in OpenFootball JSON
// ---------------------------------------------------------------------------
const KNOCKOUT_ROUNDS = new Set(["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "3rd Place", "Final"]);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // ── 1. Fetch OpenFootball fixtures (full schedule) ────────────────────────
  console.log("Fetching WC 2026 fixtures from openfootball/worldcup.json …");
  const res = await fetch(
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
  );
  if (!res.ok) throw new Error(`Failed to fetch OpenFootball fixtures: ${res.status}`);
  const data = await res.json() as { matches: OFMatch[] };
  const fixtures: OFMatch[] = data.matches;

  const groupMatches = fixtures.filter(
    (f) => f.group && TEAM_MAP[f.team1] && TEAM_MAP[f.team2]
  );
  const knockoutMatches = fixtures.filter((f) => KNOCKOUT_ROUNDS.has(f.round));
  console.log(`  Found ${groupMatches.length} group-stage matches`);
  console.log(`  Found ${knockoutMatches.length} knockout matches`);

  // ── 2. Fetch TheSportsDB events → build ID index ───────────────────────────
  console.log("Fetching TheSportsDB events for ID matching …");
  let sdbIndex: Map<string, string>;
  try {
    const sdbEvents = await getSeasonEvents();
    sdbIndex = buildSdbIndex(sdbEvents);
    console.log(`  TheSportsDB has ${sdbEvents.length} events, matched index has ${sdbIndex.size / 3} unique entries`);
  } catch (err) {
    console.warn(`  ⚠ Could not fetch TheSportsDB events (${err}). sportsDbId will be null for all matches.`);
    sdbIndex = new Map();
  }

  // ── 3. Upsert teams ────────────────────────────────────────────────────────
  console.log("Upserting teams …");
  const seenTeams = new Set<string>();
  for (const f of groupMatches) {
    for (const englishName of [f.team1, f.team2]) {
      const mapped = TEAM_MAP[englishName];
      if (!mapped || seenTeams.has(mapped.id)) continue;
      seenTeams.add(mapped.id);
      const group = f.group ? groupLetter(f.group) : null;
      await prisma.team.upsert({
        where: { id: mapped.id },
        update: { name: mapped.name, group },
        create: { id: mapped.id, name: mapped.name, group },
      });
    }
  }
  console.log(`  ✓ ${seenTeams.size} teams`);

  // ── 4. Clear + recreate matches ────────────────────────────────────────────
  console.log("Clearing existing matches …");
  await prisma.match.deleteMany({});

  console.log("Creating matches …");
  let count = 0;
  let linked = 0;
  let matchNumber = 1;

  for (const f of groupMatches) {
    const home = TEAM_MAP[f.team1]!;
    const away = TEAM_MAP[f.team2]!;
    const scheduledAt = parseMatchDate(f.date, f.time);
    const stage = roundToStage(f.round);
    const group = f.group ? groupLetter(f.group) : null;
    const location = GROUND_MAP[f.ground] ?? { venue: f.ground, city: f.ground, country: "USA" };

    // Look up TheSportsDB event ID
    const dateKey = scheduledAt.toISOString().slice(0, 10);
    const sportsDbId =
      sdbIndex.get(`${home.id}|${away.id}|${dateKey}`) ?? null;

    if (sportsDbId) linked++;

    await prisma.match.create({
      data: {
        homeTeamId: home.id,
        awayTeamId: away.id,
        scheduledAt,
        venue: location.venue,
        city: location.city,
        country: location.country,
        stage,
        group,
        matchNumber: f.num ?? matchNumber,
        status: "upcoming",
        homeScore: null,
        awayScore: null,
        sportsDbId,
      },
    });

    count++;
    matchNumber++;
  }

  console.log(`  ✓ ${count} group matches created (${linked} linked to TheSportsDB)`);

  // ── 5. Create TBD placeholder team ────────────────────────────────────────
  await prisma.team.upsert({
    where: { id: "TBD" },
    update: {},
    create: { id: "TBD", name: "TBD", group: null },
  });

  // ── 6. Create knockout match stubs ─────────────────────────────────────────
  console.log("Creating knockout match stubs …");
  let knockoutCount = 0;

  for (const f of knockoutMatches) {
    const stage = roundToStage(f.round);
    const location = GROUND_MAP[f.ground] ?? { venue: f.ground, city: f.ground, country: "USA" };

    // Some future knockout entries may have no time yet — fall back to 20:00 UTC
    let scheduledAt: Date;
    try {
      scheduledAt = parseMatchDate(f.date, f.time || "20:00 UTC+0");
    } catch {
      console.warn(`  ⚠ Could not parse date for knockout match ${f.num}: ${f.date} ${f.time}`);
      continue;
    }

    // Look up TheSportsDB event ID (only relevant once both teams are real)
    const home = TEAM_MAP[f.team1];
    const away = TEAM_MAP[f.team2];
    const homeId = home?.id ?? "TBD";
    const awayId = away?.id ?? "TBD";

    let sportsDbId: string | null = null;
    if (homeId !== "TBD" && awayId !== "TBD") {
      const dateKey = scheduledAt.toISOString().slice(0, 10);
      sportsDbId = sdbIndex.get(`${homeId}|${awayId}|${dateKey}`) ?? null;
    }

    await prisma.match.create({
      data: {
        homeTeamId: homeId,
        awayTeamId: awayId,
        scheduledAt,
        venue: location.venue,
        city: location.city,
        country: location.country,
        stage,
        group: null,
        matchNumber: f.num ?? null,
        status: "upcoming",
        homeScore: null,
        awayScore: null,
        sportsDbId,
      },
    });

    knockoutCount++;
  }

  console.log(`  ✓ ${knockoutCount} knockout stubs created`);
  console.log("Done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
