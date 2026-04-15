/**
 * WC 2026 seed — real fixture data from openfootball/worldcup.json.
 *
 * Fetches the schedule at runtime so the dates are always current.
 * Only group-stage matches are seeded (knockout participants unknown until
 * the tournament starts).
 *
 * To run:  npm run db:seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Team mapping: English name (as used in worldcup.json) → { id, name, group }
// id  = FIFA 3-letter code used as primary key
// name = Swedish display name
// ---------------------------------------------------------------------------
const TEAM_MAP: Record<string, { id: string; name: string }> = {
  "Mexico":               { id: "MEX", name: "Mexiko" },
  "South Africa":         { id: "RSA", name: "Sydafrika" },
  "South Korea":          { id: "KOR", name: "Sydkorea" },
  "Czech Republic":       { id: "CZE", name: "Tjeckien" },
  "Canada":               { id: "CAN", name: "Kanada" },
  "Bosnia & Herzegovina": { id: "BIH", name: "Bosnien-Hercegovina" },
  "Qatar":                { id: "QAT", name: "Qatar" },
  "Switzerland":          { id: "SUI", name: "Schweiz" },
  "Brazil":               { id: "BRA", name: "Brasilien" },
  "Morocco":              { id: "MAR", name: "Marocko" },
  "Haiti":                { id: "HAI", name: "Haiti" },
  "Scotland":             { id: "SCO", name: "Skottland" },
  "USA":                  { id: "USA", name: "USA" },
  "Paraguay":             { id: "PAR", name: "Paraguay" },
  "Australia":            { id: "AUS", name: "Australien" },
  "Turkey":               { id: "TUR", name: "Turkiet" },
  "Germany":              { id: "GER", name: "Tyskland" },
  "Curaçao":              { id: "CUW", name: "Curaçao" },
  "Ivory Coast":          { id: "CIV", name: "Elfenbenskusten" },
  "Ecuador":              { id: "ECU", name: "Ecuador" },
  "Netherlands":          { id: "NED", name: "Nederländerna" },
  "Japan":                { id: "JPN", name: "Japan" },
  "Sweden":               { id: "SWE", name: "Sverige" },
  "Tunisia":              { id: "TUN", name: "Tunisien" },
  "Belgium":              { id: "BEL", name: "Belgien" },
  "Egypt":                { id: "EGY", name: "Egypten" },
  "Iran":                 { id: "IRN", name: "Iran" },
  "New Zealand":          { id: "NZL", name: "Nya Zeeland" },
  "Spain":                { id: "ESP", name: "Spanien" },
  "Cape Verde":           { id: "CPV", name: "Kap Verde" },
  "Saudi Arabia":         { id: "SAU", name: "Saudiarabien" },
  "Uruguay":              { id: "URU", name: "Uruguay" },
  "France":               { id: "FRA", name: "Frankrike" },
  "Senegal":              { id: "SEN", name: "Senegal" },
  "Iraq":                 { id: "IRQ", name: "Irak" },
  "Norway":               { id: "NOR", name: "Norge" },
  "Argentina":            { id: "ARG", name: "Argentina" },
  "Algeria":              { id: "ALG", name: "Algeriet" },
  "Austria":              { id: "AUT", name: "Österrike" },
  "Jordan":               { id: "JOR", name: "Jordanien" },
  "Portugal":             { id: "POR", name: "Portugal" },
  "DR Congo":             { id: "COD", name: "DR Kongo" },
  "Uzbekistan":           { id: "UZB", name: "Uzbekistan" },
  "Colombia":             { id: "COL", name: "Colombia" },
  "England":              { id: "ENG", name: "England" },
  "Croatia":              { id: "CRO", name: "Kroatien" },
  "Ghana":                { id: "GHA", name: "Ghana" },
  "Panama":               { id: "PAN", name: "Panama" },
};

// ---------------------------------------------------------------------------
// Venue mapping: OpenFootball ground string → { venue, city, country }
// ---------------------------------------------------------------------------
const GROUND_MAP: Record<string, { venue: string; city: string; country: string }> = {
  "Mexico City":                        { venue: "Estadio Azteca",          city: "Mexico City",    country: "Mexico" },
  "Guadalajara (Zapopan)":              { venue: "Estadio Akron",            city: "Guadalajara",    country: "Mexico" },
  "Monterrey (Guadalupe)":              { venue: "Estadio BBVA",             city: "Monterrey",      country: "Mexico" },
  "Dallas (Arlington)":                 { venue: "AT&T Stadium",             city: "Arlington",      country: "USA" },
  "Houston":                            { venue: "NRG Stadium",              city: "Houston",        country: "USA" },
  "New York/New Jersey (East Rutherford)": { venue: "MetLife Stadium",       city: "East Rutherford", country: "USA" },
  "Philadelphia":                       { venue: "Lincoln Financial Field",  city: "Philadelphia",   country: "USA" },
  "Boston (Foxborough)":                { venue: "Gillette Stadium",         city: "Foxborough",     country: "USA" },
  "Atlanta":                            { venue: "Mercedes-Benz Stadium",    city: "Atlanta",        country: "USA" },
  "Miami Gardens":                      { venue: "Hard Rock Stadium",        city: "Miami Gardens",  country: "USA" },
  "Los Angeles (Inglewood)":            { venue: "SoFi Stadium",             city: "Inglewood",      country: "USA" },
  "San Francisco Bay Area (Santa Clara)": { venue: "Levi's Stadium",         city: "Santa Clara",    country: "USA" },
  "Seattle":                            { venue: "Lumen Field",              city: "Seattle",        country: "USA" },
  "Vancouver":                          { venue: "BC Place",                 city: "Vancouver",      country: "Canada" },
  "Toronto":                            { venue: "BMO Field",                city: "Toronto",        country: "Canada" },
  "Kansas City (Kansas City)":          { venue: "Arrowhead Stadium",        city: "Kansas City",    country: "USA" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Parse "2026-06-11" + "13:00 UTC-6" → UTC Date
function parseMatchDate(dateStr: string, timeStr: string): Date {
  const parts = timeStr.trim().split(" ");
  const [hh, mm] = parts[0].split(":").map(Number);
  const offsetStr = parts[1] ?? "UTC+0";
  const offset = parseInt(offsetStr.replace("UTC", ""), 10) || 0;
  const [year, month, day] = dateStr.split("-").map(Number);
  // local time - offset = UTC
  const utcHours = hh - offset;
  return new Date(Date.UTC(year, month - 1, day, utcHours, mm, 0));
}

// "Group A" → "A"
function groupLetter(groupStr: string): string {
  return groupStr.replace("Group ", "").trim();
}

// OpenFootball round → our stage code
function roundToStage(round: string): string {
  if (round.startsWith("Matchday")) return "group";
  if (round === "Round of 32") return "r32";
  if (round === "Round of 16") return "r16";
  if (round === "Quarter-final") return "qf";
  if (round === "Semi-final") return "sf";
  if (round === "3rd Place") return "3p";
  if (round === "Final") return "final";
  return "group";
}

// ---------------------------------------------------------------------------
// OpenFootball fixture shape
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
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Fetching WC 2026 fixtures from openfootball/worldcup.json …");
  const res = await fetch(
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
  );
  if (!res.ok) throw new Error(`Failed to fetch fixtures: ${res.status}`);
  const data = await res.json() as { matches: OFMatch[] };
  const fixtures: OFMatch[] = data.matches;

  // Only group-stage matches have a "group" field and real team names
  const groupMatches = fixtures.filter(
    (f) => f.group && TEAM_MAP[f.team1] && TEAM_MAP[f.team2]
  );

  console.log(`  Found ${groupMatches.length} group-stage matches`);

  // ── Upsert teams ──────────────────────────────────────────────────────────
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

  // ── Upsert matches ────────────────────────────────────────────────────────
  console.log("Upserting matches …");

  // Clear existing matches to avoid duplicates when re-seeding
  await prisma.match.deleteMany({});

  let count = 0;
  let matchNumber = 1;

  for (const f of groupMatches) {
    const home = TEAM_MAP[f.team1];
    const away = TEAM_MAP[f.team2];
    if (!home || !away) continue;

    const scheduledAt = parseMatchDate(f.date, f.time);
    const stage = roundToStage(f.round);
    const group = f.group ? groupLetter(f.group) : null;
    const location = GROUND_MAP[f.ground] ?? {
      venue: f.ground,
      city: f.ground,
      country: "USA",
    };

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
      },
    });

    count++;
    matchNumber++;
  }

  console.log(`  ✓ ${count} matches`);
  console.log("Done! Run npx prisma generate if the client is stale.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
