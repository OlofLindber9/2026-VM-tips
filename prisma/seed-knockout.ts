/**
 * Knockout-bracket seed.
 *
 * Builds a complete WC 2026 knockout tree (R32 → R16 → QF → SF → Final + 3P)
 * using a hypothetical group-stage outcome so the bracket can be exercised
 * end-to-end while the real groups are still being played.
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

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Hypothetical R32 matchups — pretend each group's top 2 + best 3rd-placed
// teams produced this set of pairings. These use real seeded teams so the
// matchups feel concrete.
// ---------------------------------------------------------------------------

// 32 teams total — picked so every team appears exactly once
const R32_PAIRINGS: { home: string; away: string }[] = [
  { home: "BRA", away: "HAI" },  // R32-1
  { home: "ARG", away: "JOR" },  // R32-2
  { home: "FRA", away: "CIV" },  // R32-3
  { home: "ENG", away: "NZL" },  // R32-4
  { home: "ESP", away: "PAN" },  // R32-5
  { home: "GER", away: "EGY" },  // R32-6
  { home: "POR", away: "TUR" },  // R32-7
  { home: "NED", away: "PAR" },  // R32-8
  { home: "BEL", away: "RSA" },  // R32-9
  { home: "CRO", away: "TUN" },  // R32-10
  { home: "URU", away: "AUS" },  // R32-11
  { home: "COL", away: "JPN" },  // R32-12
  { home: "MAR", away: "IRN" },  // R32-13
  { home: "SUI", away: "ECU" },  // R32-14
  { home: "USA", away: "MEX" },  // R32-15
  { home: "SEN", away: "KOR" },  // R32-16
];

// ---------------------------------------------------------------------------
// Bracket structure: who feeds into whom
//
// The shape below is the standard binary tree. Match N's winner advances to
// match floor((N+1)/2) of the next round, alternating home/away slot.
// ---------------------------------------------------------------------------

type BracketEdge = {
  bracketCode: string;
  stage: "r32" | "r16" | "qf" | "sf" | "3p" | "final";
  matchNumber: number;
  // For round-1 (R32) we know the teams. For later rounds the teams start as
  // placeholders and get filled in as previous rounds complete.
  homeTeamId: string;
  awayTeamId: string;
  nextMatchCode: string | null;
  nextMatchSlot: "home" | "away" | null;
  // Scheduled date offset (days from tournament start)
  daysFromStart: number;
};

const TOURNAMENT_START = new Date("2026-06-11T00:00:00Z");

function dayOffset(days: number, hourUtc = 18): Date {
  const d = new Date(TOURNAMENT_START);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
}

function placeholderTeamId(roundCode: string, num: number): string {
  return `TBD-${roundCode}-${num}`;
}

function buildEdges(): BracketEdge[] {
  const edges: BracketEdge[] = [];

  // R32: 16 matches, real teams
  R32_PAIRINGS.forEach((p, i) => {
    const num = i + 1;
    const r16Slot = Math.ceil(num / 2);            // R32-1+R32-2 → R16-1, etc.
    const slot: "home" | "away" = num % 2 === 1 ? "home" : "away";
    edges.push({
      bracketCode: `R32-${num}`,
      stage: "r32",
      matchNumber: 100 + num,
      homeTeamId: p.home,
      awayTeamId: p.away,
      nextMatchCode: `R16-${r16Slot}`,
      nextMatchSlot: slot,
      daysFromStart: 19 + Math.floor(i / 4),       // June 30 … July 3
    });
  });

  // R16: 8 matches, placeholder teams
  for (let num = 1; num <= 8; num++) {
    const qfSlot = Math.ceil(num / 2);
    const slot: "home" | "away" = num % 2 === 1 ? "home" : "away";
    edges.push({
      bracketCode: `R16-${num}`,
      stage: "r16",
      matchNumber: 200 + num,
      homeTeamId: placeholderTeamId("R32", num * 2 - 1),
      awayTeamId: placeholderTeamId("R32", num * 2),
      nextMatchCode: `QF-${qfSlot}`,
      nextMatchSlot: slot,
      daysFromStart: 23 + Math.floor((num - 1) / 2),
    });
  }

  // QF: 4 matches, placeholder teams
  for (let num = 1; num <= 4; num++) {
    const sfSlot = Math.ceil(num / 2);
    const slot: "home" | "away" = num % 2 === 1 ? "home" : "away";
    edges.push({
      bracketCode: `QF-${num}`,
      stage: "qf",
      matchNumber: 300 + num,
      homeTeamId: placeholderTeamId("R16", num * 2 - 1),
      awayTeamId: placeholderTeamId("R16", num * 2),
      nextMatchCode: `SF-${sfSlot}`,
      nextMatchSlot: slot,
      daysFromStart: 28 + Math.floor((num - 1) / 2),
    });
  }

  // SF: 2 matches → both feed into Final.
  // Note: losers of SF go to 3P, but our schema only encodes one nextMatch
  // edge. We'll handle 3P via the SF entries having `nextMatchCode = "F"`,
  // and 3P is populated via a manual lookup (kept simple for the seed).
  for (let num = 1; num <= 2; num++) {
    const slot: "home" | "away" = num === 1 ? "home" : "away";
    edges.push({
      bracketCode: `SF-${num}`,
      stage: "sf",
      matchNumber: 400 + num,
      homeTeamId: placeholderTeamId("QF", num * 2 - 1),
      awayTeamId: placeholderTeamId("QF", num * 2),
      nextMatchCode: "F",
      nextMatchSlot: slot,
      daysFromStart: 32 + (num - 1),
    });
  }

  // 3rd place playoff
  edges.push({
    bracketCode: "3P",
    stage: "3p",
    matchNumber: 500,
    homeTeamId: placeholderTeamId("SF", 1),
    awayTeamId: placeholderTeamId("SF", 2),
    nextMatchCode: null,
    nextMatchSlot: null,
    daysFromStart: 37,
  });

  // Final
  edges.push({
    bracketCode: "F",
    stage: "final",
    matchNumber: 600,
    homeTeamId: placeholderTeamId("SF", 1),
    awayTeamId: placeholderTeamId("SF", 2),
    nextMatchCode: null,
    nextMatchSlot: null,
    daysFromStart: 38,
  });

  return edges;
}

// ---------------------------------------------------------------------------
// Placeholder Team rows — every TBD-* slot needs a Team row to satisfy the
// homeTeamId/awayTeamId FK on Match.
// ---------------------------------------------------------------------------

async function ensurePlaceholderTeams() {
  const placeholders: { id: string; name: string }[] = [];
  for (let i = 1; i <= 16; i++) placeholders.push({ id: `TBD-R32-${i}`, name: `Vinnare R32-${i}` });
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

export async function seedKnockoutBracket() {
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

  const edges = buildEdges();

  for (const e of edges) {
    await prisma.match.create({
      data: {
        homeTeamId: e.homeTeamId,
        awayTeamId: e.awayTeamId,
        scheduledAt: dayOffset(e.daysFromStart),
        venue: "MetLife Stadium",
        city: e.stage === "final" ? "East Rutherford" : "East Rutherford",
        country: "USA",
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

if (require.main === module) {
  seedKnockoutBracket()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
