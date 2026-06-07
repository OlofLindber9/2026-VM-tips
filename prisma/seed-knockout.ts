/**
 * Knockout-bracket seed.
 *
 * Builds a production-safe WC 2026 knockout tree (R32 → R16 → QF → SF →
 * Final + 3P) using placeholder slots. Real teams are filled by the live sync
 * once the actual knockout fixtures are known.
 *
 * Each match gets a stable `bracketCode` ("R32-1", "R16-1", "QF-1", "SF-1",
 * "F", "3P") so subsequent rounds can reference it via `nextMatchCode` and
 * `nextMatchSlot`. Once a knockout match completes, lib/bracket.ts's
 * `propagateBracketWinners` writes the winning team into the next slot.
 *
 * Pre-tournament, slots that aren't yet known reference placeholder team
 * rows ("TBD-R32-1", etc.) so the schema's required homeTeamId/awayTeamId
 * always resolves. The bracket UI hides placeholders.
 *
 * Run: npx tsx prisma/seed-knockout.ts
 */

import * as nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

type SeedKnockoutOptions = {
  useDemoPairings?: boolean;
};

// Demo-only R32 pairings used by prisma/seed-test-bracket.ts. The default
// production seed uses TBD placeholders instead.
const DEMO_R32_PAIRINGS: { home: string; away: string }[] = [
  { home: "BRA", away: "HAI" },
  { home: "ARG", away: "JOR" },
  { home: "FRA", away: "CIV" },
  { home: "ENG", away: "NZL" },
  { home: "ESP", away: "PAN" },
  { home: "GER", away: "EGY" },
  { home: "POR", away: "TUR" },
  { home: "NED", away: "PAR" },
  { home: "BEL", away: "RSA" },
  { home: "CRO", away: "TUN" },
  { home: "URU", away: "AUS" },
  { home: "COL", away: "JPN" },
  { home: "MAR", away: "IRN" },
  { home: "SUI", away: "ECU" },
  { home: "USA", away: "MEX" },
  { home: "SEN", away: "KOR" },
];

// ---------------------------------------------------------------------------
// Bracket structure: who feeds into whom
//
// The shape below is the standard binary tree. Bracket slot N's winner
// advances to slot floor((N+1)/2) of the next round, alternating home/away.
// ---------------------------------------------------------------------------

type BracketEdge = {
  bracketCode: string;
  stage: "r32" | "r16" | "qf" | "sf" | "3p" | "final";
  matchNumber: number;
  scheduledAt: Date;
  venue: string;
  city: string;
  country: string;
  // For round-1 (R32) we know the teams. For later rounds the teams start as
  // placeholders and get filled in as previous rounds complete.
  homeTeamId: string;
  awayTeamId: string;
  nextMatchCode: string | null;
  nextMatchSlot: "home" | "away" | null;
};

type KnockoutScheduleEntry = {
  matchNumber: number;
  scheduledAt: Date;
  venue: string;
  city: string;
  country: string;
};

function utc(iso: string): Date {
  return new Date(iso);
}

const KNOCKOUT_SCHEDULE: Record<string, KnockoutScheduleEntry> = {
  // R32 codes are ordered by bracket path, not by kickoff time. This keeps the
  // existing winner-propagation tree while attaching FIFA match numbers/times.
  "R32-1": schedule(74, "2026-06-29T20:30:00Z", "Gillette Stadium", "Boston / Foxborough", "USA"),
  "R32-2": schedule(77, "2026-06-30T21:00:00Z", "MetLife Stadium", "New York / East Rutherford", "USA"),
  "R32-3": schedule(73, "2026-06-28T19:00:00Z", "SoFi Stadium", "Los Angeles", "USA"),
  "R32-4": schedule(75, "2026-06-30T01:00:00Z", "Estadio BBVA", "Monterrey", "Mexico"),
  "R32-5": schedule(83, "2026-07-02T23:00:00Z", "BMO Field", "Toronto", "Canada"),
  "R32-6": schedule(84, "2026-07-02T19:00:00Z", "SoFi Stadium", "Los Angeles", "USA"),
  "R32-7": schedule(81, "2026-07-02T00:00:00Z", "Levi's Stadium", "San Francisco / Santa Clara", "USA"),
  "R32-8": schedule(82, "2026-07-01T20:00:00Z", "Lumen Field", "Seattle", "USA"),
  "R32-9": schedule(76, "2026-06-29T17:00:00Z", "NRG Stadium", "Houston", "USA"),
  "R32-10": schedule(78, "2026-06-30T17:00:00Z", "AT&T Stadium", "Dallas / Arlington", "USA"),
  "R32-11": schedule(79, "2026-07-01T01:00:00Z", "Estadio Azteca", "Mexico City", "Mexico"),
  "R32-12": schedule(80, "2026-07-01T16:00:00Z", "Mercedes-Benz Stadium", "Atlanta", "USA"),
  "R32-13": schedule(86, "2026-07-03T22:00:00Z", "Hard Rock Stadium", "Miami", "USA"),
  "R32-14": schedule(88, "2026-07-03T18:00:00Z", "AT&T Stadium", "Dallas / Arlington", "USA"),
  "R32-15": schedule(85, "2026-07-03T03:00:00Z", "BC Place", "Vancouver", "Canada"),
  "R32-16": schedule(87, "2026-07-04T01:30:00Z", "Arrowhead Stadium", "Kansas City", "USA"),

  "R16-1": schedule(89, "2026-07-04T21:00:00Z", "Lincoln Financial Field", "Philadelphia", "USA"),
  "R16-2": schedule(90, "2026-07-04T17:00:00Z", "NRG Stadium", "Houston", "USA"),
  "R16-3": schedule(93, "2026-07-06T19:00:00Z", "AT&T Stadium", "Dallas / Arlington", "USA"),
  "R16-4": schedule(94, "2026-07-07T00:00:00Z", "Lumen Field", "Seattle", "USA"),
  "R16-5": schedule(91, "2026-07-05T20:00:00Z", "MetLife Stadium", "New York / East Rutherford", "USA"),
  "R16-6": schedule(92, "2026-07-06T00:00:00Z", "Estadio Azteca", "Mexico City", "Mexico"),
  "R16-7": schedule(95, "2026-07-07T16:00:00Z", "Mercedes-Benz Stadium", "Atlanta", "USA"),
  "R16-8": schedule(96, "2026-07-07T20:00:00Z", "BC Place", "Vancouver", "Canada"),

  "QF-1": schedule(97, "2026-07-09T20:00:00Z", "Gillette Stadium", "Boston / Foxborough", "USA"),
  "QF-2": schedule(98, "2026-07-10T19:00:00Z", "SoFi Stadium", "Los Angeles", "USA"),
  "QF-3": schedule(99, "2026-07-11T21:00:00Z", "Hard Rock Stadium", "Miami", "USA"),
  "QF-4": schedule(100, "2026-07-12T01:00:00Z", "Arrowhead Stadium", "Kansas City", "USA"),

  "SF-1": schedule(101, "2026-07-14T19:00:00Z", "AT&T Stadium", "Dallas / Arlington", "USA"),
  "SF-2": schedule(102, "2026-07-15T19:00:00Z", "Mercedes-Benz Stadium", "Atlanta", "USA"),
  "3P": schedule(103, "2026-07-18T21:00:00Z", "Hard Rock Stadium", "Miami", "USA"),
  "F": schedule(104, "2026-07-19T19:00:00Z", "MetLife Stadium", "New York / East Rutherford", "USA"),
};

function schedule(
  matchNumber: number,
  scheduledAt: string,
  venue: string,
  city: string,
  country: string
): KnockoutScheduleEntry {
  return {
    matchNumber,
    scheduledAt: utc(scheduledAt),
    venue,
    city,
    country,
  };
}

function scheduleFor(bracketCode: string): KnockoutScheduleEntry {
  const entry = KNOCKOUT_SCHEDULE[bracketCode];
  if (!entry) throw new Error(`Missing knockout schedule for ${bracketCode}`);
  return entry;
}

function placeholderTeamId(roundCode: string, num: number, slot?: "HOME" | "AWAY"): string {
  return slot ? `TBD-${roundCode}-${num}-${slot}` : `TBD-${roundCode}-${num}`;
}

function buildEdges(options: SeedKnockoutOptions = {}): BracketEdge[] {
  const edges: BracketEdge[] = [];

  // R32: 16 matches, unknown teams until the group stage is complete.
  for (let num = 1; num <= 16; num++) {
    const bracketCode = `R32-${num}`;
    const matchSchedule = scheduleFor(bracketCode);
    const demoPairing = options.useDemoPairings ? DEMO_R32_PAIRINGS[num - 1] : null;
    const r16Slot = Math.ceil(num / 2);            // R32-1+R32-2 → R16-1, etc.
    const slot: "home" | "away" = num % 2 === 1 ? "home" : "away";
    edges.push({
      bracketCode,
      stage: "r32",
      ...matchSchedule,
      homeTeamId: demoPairing?.home ?? placeholderTeamId("R32", num, "HOME"),
      awayTeamId: demoPairing?.away ?? placeholderTeamId("R32", num, "AWAY"),
      nextMatchCode: `R16-${r16Slot}`,
      nextMatchSlot: slot,
    });
  }

  // R16: 8 matches, placeholder teams
  for (let num = 1; num <= 8; num++) {
    const bracketCode = `R16-${num}`;
    const matchSchedule = scheduleFor(bracketCode);
    const qfSlot = Math.ceil(num / 2);
    const slot: "home" | "away" = num % 2 === 1 ? "home" : "away";
    edges.push({
      bracketCode,
      stage: "r16",
      ...matchSchedule,
      homeTeamId: placeholderTeamId("R32", num * 2 - 1),
      awayTeamId: placeholderTeamId("R32", num * 2),
      nextMatchCode: `QF-${qfSlot}`,
      nextMatchSlot: slot,
    });
  }

  // QF: 4 matches, placeholder teams
  for (let num = 1; num <= 4; num++) {
    const bracketCode = `QF-${num}`;
    const matchSchedule = scheduleFor(bracketCode);
    const sfSlot = Math.ceil(num / 2);
    const slot: "home" | "away" = num % 2 === 1 ? "home" : "away";
    edges.push({
      bracketCode,
      stage: "qf",
      ...matchSchedule,
      homeTeamId: placeholderTeamId("R16", num * 2 - 1),
      awayTeamId: placeholderTeamId("R16", num * 2),
      nextMatchCode: `SF-${sfSlot}`,
      nextMatchSlot: slot,
    });
  }

  // SF: 2 matches → both feed into Final.
  // Note: losers of SF go to 3P, but our schema only encodes one nextMatch
  // edge. We'll handle 3P via the SF entries having `nextMatchCode = "F"`,
  // and 3P is populated via a manual lookup (kept simple for the seed).
  for (let num = 1; num <= 2; num++) {
    const bracketCode = `SF-${num}`;
    const matchSchedule = scheduleFor(bracketCode);
    const slot: "home" | "away" = num === 1 ? "home" : "away";
    edges.push({
      bracketCode,
      stage: "sf",
      ...matchSchedule,
      homeTeamId: placeholderTeamId("QF", num * 2 - 1),
      awayTeamId: placeholderTeamId("QF", num * 2),
      nextMatchCode: "F",
      nextMatchSlot: slot,
    });
  }

  // 3rd place playoff
  edges.push({
    bracketCode: "3P",
    stage: "3p",
    ...scheduleFor("3P"),
    homeTeamId: placeholderTeamId("SF", 1),
    awayTeamId: placeholderTeamId("SF", 2),
    nextMatchCode: null,
    nextMatchSlot: null,
  });

  // Final
  edges.push({
    bracketCode: "F",
    stage: "final",
    ...scheduleFor("F"),
    homeTeamId: placeholderTeamId("SF", 1),
    awayTeamId: placeholderTeamId("SF", 2),
    nextMatchCode: null,
    nextMatchSlot: null,
  });

  return edges;
}

// ---------------------------------------------------------------------------
// Placeholder Team rows — every TBD-* slot needs a Team row to satisfy the
// homeTeamId/awayTeamId FK on Match.
// ---------------------------------------------------------------------------

async function ensurePlaceholderTeams() {
  const placeholders: { id: string; name: string }[] = [];
  for (let i = 1; i <= 16; i++) {
    placeholders.push({ id: `TBD-R32-${i}-HOME`, name: `Lagplats R32-${i}` });
    placeholders.push({ id: `TBD-R32-${i}-AWAY`, name: `Lagplats R32-${i}` });
    placeholders.push({ id: `TBD-R32-${i}`, name: `Vinnare R32-${i}` });
  }
  for (let i = 1; i <= 8; i++)  placeholders.push({ id: `TBD-R16-${i}`, name: `Vinnare R16-${i}` });
  for (let i = 1; i <= 4; i++)  placeholders.push({ id: `TBD-QF-${i}`,  name: `Vinnare QF-${i}` });
  for (let i = 1; i <= 2; i++)  placeholders.push({ id: `TBD-SF-${i}`,  name: `Vinnare SF-${i}` });
  placeholders.push({ id: "TBD-F",  name: "Vinnare Final" });
  placeholders.push({ id: "TBD-3P", name: "Vinnare Brons" });

  for (const p of placeholders) {
    await prisma.team.upsert({
      where: { id: p.id },
      update: { name: p.name, group: null },
      create: { id: p.id, name: p.name, group: null },
    });
  }
  return placeholders.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function seedKnockoutBracket(options: SeedKnockoutOptions = {}) {
  console.log("Seeding knockout bracket …");

  const placeholderCount = await ensurePlaceholderTeams();
  console.log(`  ✓ ${placeholderCount} placeholder teams ensured`);

  // Wipe existing knockout matches AND their predictions (group stage untouched).
  // Predictions FK to Match without ON DELETE CASCADE, so we delete them first.
  const knockoutStages = ["r32", "r16", "qf", "sf", "3p", "final"];
  const oldKnockoutMatches = await prisma.match.findMany({
    where: { stage: { in: knockoutStages } },
    select: { id: true },
  });
  if (oldKnockoutMatches.length > 0) {
    const wipedPreds = await prisma.prediction.deleteMany({
      where: { matchId: { in: oldKnockoutMatches.map((m) => m.id) } },
    });
    if (wipedPreds.count > 0) {
      console.log(`  ✓ Cleared ${wipedPreds.count} old predictions on knockout matches`);
    }
  }
  const wiped = await prisma.match.deleteMany({
    where: { stage: { in: knockoutStages } },
  });
  console.log(`  ✓ Cleared ${wiped.count} old knockout matches`);

  const edges = buildEdges(options);

  for (const e of edges) {
    await prisma.match.create({
      data: {
        homeTeamId: e.homeTeamId,
        awayTeamId: e.awayTeamId,
        scheduledAt: e.scheduledAt,
        venue: e.venue,
        city: e.city,
        country: e.country,
        stage: e.stage,
        group: null,
        matchNumber: e.matchNumber,
        status: "upcoming",
        homeScore: null,
        awayScore: null,
        bracketCode: e.bracketCode,
        nextMatchCode: e.nextMatchCode,
        nextMatchSlot: e.nextMatchSlot,
      },
    });
  }
  console.log(`  ✓ ${edges.length} knockout matches created`);
  console.log("Done.");
}

export async function disconnectKnockoutSeedPrisma() {
  await prisma.$disconnect();
}

if (require.main === module) {
  seedKnockoutBracket()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
