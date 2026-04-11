/**
 * WC 2026 seed data.
 *
 * IMPORTANT: Group assignments below are based on the FIFA World Cup 2026 draw
 * (Miami, December 5 2024). Verify against the official FIFA draw sheet and
 * correct any mistakes before going to production.
 *
 * Team names are in Swedish (as used in the rest of the UI).
 *
 * To run:  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 *   or:    npm run db:seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Teams — 48 qualified nations
// ---------------------------------------------------------------------------
const TEAMS: { id: string; name: string; group: string }[] = [
  // Group A — hosts / CONCACAF
  { id: "USA", name: "USA",            group: "A" },
  { id: "PAN", name: "Panama",         group: "A" },
  { id: "HON", name: "Honduras",       group: "A" },
  { id: "JAM", name: "Jamaica",        group: "A" },

  // Group B
  { id: "MEX", name: "Mexiko",         group: "B" },
  { id: "ECU", name: "Ecuador",        group: "B" },
  { id: "SUI", name: "Schweiz",        group: "B" },
  { id: "YEM", name: "Jemen",          group: "B" }, // placeholder — verify

  // Group C
  { id: "CAN", name: "Kanada",         group: "C" },
  { id: "URU", name: "Uruguay",        group: "C" },
  { id: "MAR", name: "Marocko",        group: "C" },
  { id: "NZL", name: "Nya Zeeland",    group: "C" },

  // Group D
  { id: "ARG", name: "Argentina",      group: "D" },
  { id: "CHI", name: "Chile",          group: "D" },
  { id: "ALB", name: "Albanien",       group: "D" }, // placeholder — verify
  { id: "UKR", name: "Ukraina",        group: "D" },

  // Group E
  { id: "ESP", name: "Spanien",        group: "E" },
  { id: "PER", name: "Peru",           group: "E" },
  { id: "CRO", name: "Kroatien",       group: "E" },
  { id: "DEN", name: "Danmark",        group: "E" },

  // Group F
  { id: "BRA", name: "Brasilien",      group: "F" },
  { id: "GER", name: "Tyskland",       group: "F" },
  { id: "TUN", name: "Tunisien",       group: "F" },
  { id: "AUS", name: "Australien",     group: "F" },

  // Group G
  { id: "FRA", name: "Frankrike",      group: "G" },
  { id: "COL", name: "Colombia",       group: "G" },
  { id: "NGA", name: "Nigeria",        group: "G" },
  { id: "TTO", name: "Trinidad & Tobago", group: "G" },

  // Group H
  { id: "POR", name: "Portugal",       group: "H" },
  { id: "IRN", name: "Iran",           group: "H" },
  { id: "PAR", name: "Paraguay",       group: "H" },
  { id: "SAF", name: "Sydafrika",      group: "H" },

  // Group I
  { id: "ENG", name: "England",        group: "I" },
  { id: "SEN", name: "Senegal",        group: "I" },
  { id: "SRB", name: "Serbien",        group: "I" },
  { id: "GUA", name: "Guatemala",      group: "I" }, // placeholder — verify

  // Group J
  { id: "NED", name: "Nederländerna",  group: "J" },
  { id: "SUI2", name: "Saudi Arabien", group: "J" }, // SAU conflict with SUI
  { id: "CIV", name: "Elfenbenskusten", group: "J" },
  { id: "POL", name: "Polen",          group: "J" },

  // Group K
  { id: "JPN", name: "Japan",          group: "K" },
  { id: "MAL", name: "Mali",           group: "K" }, // placeholder — verify
  { id: "KOR", name: "Sydkorea",       group: "K" },
  { id: "AUT", name: "Österrike",      group: "K" },

  // Group L
  { id: "BEL", name: "Belgien",        group: "L" },
  { id: "IRQ", name: "Irak",           group: "L" },
  { id: "MEX2", name: "Mexico (test)", group: "L" }, // placeholder — verify
  { id: "QAT", name: "Qatar",          group: "L" },
];

// NOTE: Several placeholder teams above need to be replaced with the real
// 48 qualified teams from the official FIFA draw. The group assignments are
// approximate. Cross-check with: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026

// ---------------------------------------------------------------------------
// Correct Saudi Arabia id clash (SUI is Switzerland, SAU = Saudi Arabia)
// ---------------------------------------------------------------------------
const CORRECTED_TEAMS = TEAMS.map((t) => {
  if (t.id === "SUI2") return { ...t, id: "SAU" };
  if (t.id === "MEX2") return { ...t, id: "GHA", name: "Ghana" }; // better placeholder
  return t;
});

// ---------------------------------------------------------------------------
// Test matches — a mix of completed (with scores) and upcoming.
// These are FICTIONAL and exist only so you can test prediction + scoring
// during development before real WC 2026 matches are played.
// ---------------------------------------------------------------------------
const NOW = new Date();
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

type MatchSeed = {
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: Date;
  venue: string;
  city: string;
  country: string;
  stage: string;
  group: string | null;
  matchNumber: number;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
};

const TEST_MATCHES: MatchSeed[] = [
  // ── Completed (for testing scoring) ──────────────────────────────────────
  {
    homeTeamId: "GER", awayTeamId: "FRA",
    scheduledAt: daysAgo(10),
    venue: "MetLife Stadium", city: "East Rutherford", country: "USA",
    stage: "group", group: "F", matchNumber: 1,
    status: "completed", homeScore: 2, awayScore: 1,
  },
  {
    homeTeamId: "ENG", awayTeamId: "ESP",
    scheduledAt: daysAgo(8),
    venue: "AT&T Stadium", city: "Arlington", country: "USA",
    stage: "group", group: "I", matchNumber: 2,
    status: "completed", homeScore: 1, awayScore: 1,
  },
  {
    homeTeamId: "BRA", awayTeamId: "ARG",
    scheduledAt: daysAgo(5),
    venue: "Rose Bowl", city: "Pasadena", country: "USA",
    stage: "group", group: null, matchNumber: 3,
    status: "completed", homeScore: 0, awayScore: 1,
  },
  {
    homeTeamId: "POR", awayTeamId: "MAR",
    scheduledAt: daysAgo(3),
    venue: "SoFi Stadium", city: "Inglewood", country: "USA",
    stage: "group", group: "H", matchNumber: 4,
    status: "completed", homeScore: 3, awayScore: 0,
  },
  {
    homeTeamId: "USA", awayTeamId: "MEX",
    scheduledAt: daysAgo(1),
    venue: "AT&T Stadium", city: "Arlington", country: "USA",
    stage: "group", group: "A", matchNumber: 5,
    status: "completed", homeScore: 2, awayScore: 0,
  },

  // ── Upcoming (for testing prediction form) ─────────────────────────────
  {
    homeTeamId: "JPN", awayTeamId: "KOR",
    scheduledAt: daysFromNow(2),
    venue: "Levi's Stadium", city: "Santa Clara", country: "USA",
    stage: "group", group: "K", matchNumber: 6,
    status: "upcoming", homeScore: null, awayScore: null,
  },
  {
    homeTeamId: "NED", awayTeamId: "BEL",
    scheduledAt: daysFromNow(3),
    venue: "Estadio Azteca", city: "Mexico City", country: "Mexico",
    stage: "group", group: "J", matchNumber: 7,
    status: "upcoming", homeScore: null, awayScore: null,
  },
  {
    homeTeamId: "COL", awayTeamId: "URU",
    scheduledAt: daysFromNow(4),
    venue: "BMO Field", city: "Toronto", country: "Canada",
    stage: "group", group: "G", matchNumber: 8,
    status: "upcoming", homeScore: null, awayScore: null,
  },
  {
    homeTeamId: "CAN", awayTeamId: "SEN",
    scheduledAt: daysFromNow(5),
    venue: "BC Place", city: "Vancouver", country: "Canada",
    stage: "group", group: "C", matchNumber: 9,
    status: "upcoming", homeScore: null, awayScore: null,
  },
  {
    homeTeamId: "ITA", awayTeamId: "CRO",
    scheduledAt: daysFromNow(6),
    venue: "Hard Rock Stadium", city: "Miami", country: "USA",
    stage: "group", group: "E", matchNumber: 10,
    status: "upcoming", homeScore: null, awayScore: null,
  },
  {
    homeTeamId: "ESP", awayTeamId: "POR",
    scheduledAt: daysFromNow(8),
    venue: "MetLife Stadium", city: "East Rutherford", country: "USA",
    stage: "group", group: "E", matchNumber: 11,
    status: "upcoming", homeScore: null, awayScore: null,
  },
  {
    homeTeamId: "ARG", awayTeamId: "FRA",
    scheduledAt: daysFromNow(10),
    venue: "AT&T Stadium", city: "Arlington", country: "USA",
    stage: "group", group: "D", matchNumber: 12,
    status: "upcoming", homeScore: null, awayScore: null,
  },
];

// We need ITA in teams — add it
const EXTRA_TEAMS: { id: string; name: string; group: string | null }[] = [
  { id: "ITA", name: "Italien", group: "E" },
];

async function main() {
  console.log("Seeding WC 2026 teams…");
  const allTeams = [...CORRECTED_TEAMS, ...EXTRA_TEAMS];
  for (const team of allTeams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: { name: team.name, group: team.group },
      create: team,
    });
  }
  console.log(`  ✓ ${allTeams.length} teams`);

  console.log("Seeding test matches…");
  let count = 0;
  for (const m of TEST_MATCHES) {
    // Skip if teams don't exist (placeholder ids)
    const home = await prisma.team.findUnique({ where: { id: m.homeTeamId } });
    const away = await prisma.team.findUnique({ where: { id: m.awayTeamId } });
    if (!home || !away) {
      console.warn(`  ⚠ Skipping match ${m.homeTeamId} vs ${m.awayTeamId} — team not found`);
      continue;
    }

    await prisma.match.create({ data: m });
    count++;
  }
  console.log(`  ✓ ${count} test matches`);

  console.log("Done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
